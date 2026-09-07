# Developer Assessment Platform — Backend API

A robust, scalable, secure REST API for a **Developer Assessment & Coding Platform** (B7A6 assignment). Built with **Node.js, TypeScript, Express.js, PostgreSQL + Prisma, Stripe**, and **Vercel-ready** (TSUP build output).

The platform models three distinct primary roles:

| Role | Purpose |
| --- | --- |
| **CANDIDATE** | Browse published assessments, accept invitations, take timed attempts, get evaluated. |
| **COMPANY** | Build a problem bank, compose assessments, invite candidates, review/evaluate attempts. |
| **ADMIN** | Manage users (role/status/soft-delete), view dashboard, browse audit logs. |

---

## Tech Stack

| Layer | Tech |
| --- | --- |
| Runtime | Node.js 20+, TypeScript, Express.js |
| ORM / DB | PostgreSQL + Prisma |
| Validation | Zod |
| Auth | JWT (access + refresh), bcryptjs |
| Payments | Stripe (Checkout Sessions + webhooks) |
| Security | Helmet, CORS, express-rate-limit |
| Build | TSUP (ESM + CJS shim) |
| Deployment | Vercel Serverless (vercel.json) |

---

## Quick start

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   # Fill in DATABASE_URL, JWT secrets, and STRIPE keys
   ```

3. **Set up the database**

   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   npm run seed
   ```

4. **Start in development**

   ```bash
   npm run dev
   ```

5. **Build & run (production)**

   ```bash
   npm run build
   npm start
   ```

---

## Demo / Admin Credentials (created by `npm run seed`)

| Role | Email | Password |
| --- | --- | --- |
| ADMIN | `admin@assessment.dev` | `Admin@12345` |
| COMPANY | `company@assessment.dev` | `Company@12345` |
| CANDIDATE | `candidate@assessment.dev` | `Candidate@12345` |

> Tip: the seed also creates a few seed problems owned by the company account so you can immediately publish an assessment.

---

## API surface (28 endpoints)

All endpoints are mounted under `/api/v1`. All responses use:

```jsonc
// Success
{ "success": true, "message": "OK", "data": { /* ... */ } }

// Error
{ "success": false, "message": "Something went wrong", "errors": { /* ... */ } }
```

### Auth
- `POST   /auth/register`            — Register a CANDIDATE or COMPANY
- `POST   /auth/login`               — Email/password login
- `POST   /auth/refresh-token`       — Refresh access token
- `POST   /auth/logout`              — Invalidate refresh token

### Users / Profile
- `GET    /users/me`                 — Current user profile (with role-specific sub-profile)
- `PATCH  /users/me`                 — Update basic profile fields
- `PATCH  /users/candidates/me/profile`  — Update candidate profile (skills, headline, links)
- `PATCH  /users/companies/me/profile`   — Update company profile

### Problems
- `POST   /problems`                 — Create problem (COMPANY/ADMIN)
- `GET    /problems`                 — List with `?page&limit&search&type&difficulty&sortBy&order`
- `GET    /problems/:id`             — Get problem (correct answers hidden for non-admins)
- `PATCH  /problems/:id`             — Update (owner only)
- `DELETE /problems/:id`             — Soft delete (owner only)

### Assessments
- `POST   /assessments`              — Create assessment with linked problems
- `GET    /assessments`              — List published (filters: search, status, price range, sortBy)
- `GET    /assessments/:id`          — Get assessment (with problems)
- `PATCH  /assessments/:id`          — Update assessment
- `PATCH  /assessments/:id/status`   — Publish / archive / draft
- `DELETE /assessments/:id`          — Soft delete

### Invitations
- `POST   /invitations`              — Company invites a candidate
- `GET    /invitations/me`           — List my invitations (candidate)
- `POST   /invitations/accept`       — Accept
- `POST   /invitations/decline`      — Decline

### Attempts
- `POST   /attempts/start/:invitationId`           — Start an attempt
- `GET    /attempts/assessment/:assessmentId/me`   — My attempt for an assessment
- `POST   /attempts/:attemptId/answer`             — Save/update an answer
- `POST   /attempts/:attemptId/submit`             — Submit (auto-grades MCQs)
- `POST   /attempts/:attemptId/evaluate`           — Manual evaluation
- `GET    /attempts/assessment/:assessmentId/all`  — List all attempts (owner only)

### Payments
- `POST   /payments/initiate`         — Create Stripe Checkout session
- `GET    /payments/:id`             — Track payment status
- `GET    /payments/me/list`         — My payments
- `GET    /payments/success?session_id=...` / `/payments/cancel?session_id=...`
- `POST   /payments/webhook`         — Stripe webhook (raw body, signature-checked)

### Admin
- `GET    /admin/users`              — List users (filter: role, status, search)
- `PATCH  /admin/users/:id`          — Update role / status
- `DELETE /admin/users/:id`          — Soft delete a user
- `GET    /admin/dashboard-stats`    — Counts, revenue, recent signups, attempt status breakdown
- `GET    /admin/audit-logs`         — System audit trail

> Total: **28 endpoints** (well over the minimum 20 required).

---

## Architecture

```
src/
├── server.ts                 # Entry point (Vercel + local)
├── app/
│   ├── app.ts                # Express factory
│   ├── middlewares/          # auth, error, rate-limit, validation
│   ├── modules/              # feature modules (routes/controller/service/validation)
│   └── utils/                # JWT, response, errors
├── config/
│   ├── env.ts                # env loading
│   └── prisma.ts             # shared PrismaClient
└── …
```

Each module follows **routes → controller → (service) → Prisma**. RBAC is centralised in the `authorize(...)` middleware.

---

## Highlights / Engineering decisions

- **Transactions everywhere they matter.** Creating an assessment, registering a user, evaluating an attempt and starting an attempt all run inside `prisma.$transaction(...)` to prevent partial writes.
- **Soft deletes.** `deletedAt` on every major entity (User, Problem, Assessment) — never hard-delete.
- **Audit log trail.** Critical actions (login, role change, assessment publish, payment success, attempt events) write into the `AuditLog` table.
- **Auto MCQ grading + manual grading.** MCQs auto-grade on submission; coding/written problems are evaluated by the owning company via the `evaluate` endpoint.
- **Idempotent attempt start.** Re-starting an attempt for the same invitation returns the existing attempt.
- **Stripe in real or mock mode.** If `STRIPE_SECRET_KEY` is missing the initiate endpoint auto-marks the payment as `SUCCEEDED` so the API stays demoable offline. Stripe webhooks verify the `stripe-signature` header.
- **Vercel-safe Stripe webhook.** The raw body parser is registered *only* on `/api/v1/payments/webhook`, ahead of the global JSON parser, so signature verification works in production.
- **Standardised JSON envelopes.** A `ok(...) / created(...) / fail(...)` helper is used in every controller.
- **Rate limiting** on auth and payment endpoints to prevent abuse.
- **Helmet + CORS** configured out of the box.

---

## Deployment (Vercel)

1. Push the repo to GitHub.
2. Import in Vercel; the `vercel.json` will route every request to `dist/server.js` (TSUP output).
3. Set environment variables (`DATABASE_URL`, `JWT_*`, `STRIPE_*`, `APP_BASE_URL`) in the project settings.
4. In your database provider, allow connections from Vercel IPs (or use the connection string with pooling).
5. Deploy.

---

## Testing the API

A ready-to-import Postman collection is included in `postman_collection.json`. It already defines the `{{baseUrl}}`, `{{accessToken}}` and entity id variables — just sign in and the rest works.

`openapi.json` is a minimal OpenAPI 3.0 spec that you can import into Swagger UI or Stoplight.
