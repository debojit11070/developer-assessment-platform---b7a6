import Stripe from "stripe";
import type { Request, Response } from "express";
import { PaymentPurpose, PaymentStatus } from "@prisma/client";
import { prisma } from "../../../config/prisma.js";
import { config } from "../../../config/env.js";
import { ok, created } from "../../utils/response.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../utils/errors.js";

const stripe = config.stripe.secretKey
  ? new Stripe(config.stripe.secretKey, {
      apiVersion: "2024-09-30.acacia" as Stripe.LatestApiVersion,
    })
  : null;

export async function initiatePayment(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new ForbiddenError();
  const { assessmentId, purpose } = req.body as { assessmentId: string; purpose: PaymentPurpose };

  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
  });
  if (!assessment || assessment.deletedAt) throw new NotFoundError("Assessment not found");
  if (assessment.priceCents <= 0) {
    throw new BadRequestError("This assessment is free and does not require payment");
  }

  const payment = await prisma.payment.create({
    data: {
      userId: req.user.sub,
      assessmentId,
      purpose,
      amountCents: assessment.priceCents,
      currency: assessment.currency,
      status: PaymentStatus.PENDING,
    },
  });

  if (!config.stripe.secretKey) {
    // Local/dev shortcut: simulate successful payment when Stripe is not configured.
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.SUCCEEDED,
        stripePaymentId: `mock_${payment.id}`,
      },
    });
    ok(res, {
      payment,
      mode: "mock",
      message: "Stripe not configured — payment simulated",
    }, "Payment simulated", 201);
    return;
  }

  const session = await stripe!.checkout.sessions.create({
    mode: "payment",
    customer_email: req.user.email,
    line_items: [
      {
        price_data: {
          currency: assessment.currency,
          product_data: {
            name: assessment.title,
            description: `Fee for accessing the "${assessment.title}" assessment`,
          },
          unit_amount: assessment.priceCents,
        },
        quantity: 1,
      },
    ],
    success_url: `${config.app.baseUrl}/api/v1/payments/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.app.baseUrl}/api/v1/payments/cancel?session_id={CHECKOUT_SESSION_ID}`,
    metadata: {
      paymentId: payment.id,
      userId: req.user.sub,
      assessmentId,
    },
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: { stripeSessionId: session.id, checkoutUrl: session.url ?? null },
  });

  const updated = await prisma.payment.findUnique({ where: { id: payment.id } });
  created(res, { payment: updated, checkoutUrl: session.url, sessionId: session.id }, "Checkout session created");
}

export async function getPaymentById(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new ForbiddenError();
  const payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
  if (!payment) throw new NotFoundError("Payment not found");
  if (payment.userId !== req.user.sub && req.user.role !== "ADMIN") {
    throw new ForbiddenError("Not your payment");
  }
  ok(res, payment, "Payment fetched");
}

export async function paymentSuccess(req: Request, res: Response): Promise<void> {
  const sessionId = (req.query.session_id as string) ?? "";
  if (!sessionId) throw new BadRequestError("Missing session_id");
  if (!config.stripe.secretKey) {
    const payment = await prisma.payment.findUnique({ where: { stripeSessionId: sessionId } });
    ok(res, { payment, mode: "mock" }, "Payment success (mock)");
    return;
  }
  const session = await stripe!.checkout.sessions.retrieve(sessionId);
  if (session.payment_status === "paid") {
    await prisma.payment.update({
      where: { stripeSessionId: sessionId },
      data: {
        status: PaymentStatus.SUCCEEDED,
        stripePaymentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
      },
    });
  }
  const payment = await prisma.payment.findUnique({ where: { stripeSessionId: sessionId } });
  ok(res, { payment, session }, "Payment status retrieved");
}

export async function paymentCancel(req: Request, res: Response): Promise<void> {
  const sessionId = (req.query.session_id as string) ?? "";
  if (!sessionId) throw new BadRequestError("Missing session_id");
  await prisma.payment.update({
    where: { stripeSessionId: sessionId },
    data: { status: PaymentStatus.CANCELLED },
  });
  const payment = await prisma.payment.findUnique({ where: { stripeSessionId: sessionId } });
  ok(res, payment, "Payment cancelled");
}

export async function stripeWebhook(req: Request, res: Response): Promise<void> {
  if (!config.stripe.secretKey || !config.stripe.webhookSecret) {
    res.status(200).json({ received: true, mode: "mock" });
    return;
  }
  const sig = req.headers["stripe-signature"] as string | undefined;
  let event: Stripe.Event;
  try {
    if (!sig) throw new BadRequestError("Missing stripe-signature");
    event = stripe!.webhooks.constructEvent(req.body as Buffer, sig, config.stripe.webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook error";
    res.status(400).send(`Webhook Error: ${message}`);
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.id) {
      await prisma.payment.update({
        where: { stripeSessionId: session.id },
        data: {
          status: PaymentStatus.SUCCEEDED,
          stripePaymentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
        },
      });
      await prisma.auditLog.create({
        data: {
          action: "payment.succeeded",
          resource: "payment",
          resourceId: session.metadata?.paymentId ?? null,
          meta: { sessionId: session.id },
        },
      });
    }
  } else if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.id) {
      await prisma.payment.update({
        where: { stripeSessionId: session.id },
        data: { status: PaymentStatus.CANCELLED },
      });
    }
  }

  res.status(200).json({ received: true });
}

export async function myPayments(req: Request, res: Response): Promise<void> {
  if (!req.user) throw new ForbiddenError();
  const items = await prisma.payment.findMany({
    where: { userId: req.user.sub },
    include: { assessment: { select: { id: true, title: true } } },
    orderBy: { createdAt: "desc" },
  });
  ok(res, { items }, "Payments fetched");
}
