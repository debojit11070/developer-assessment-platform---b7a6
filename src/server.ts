import { createApp } from "./app/app.js";
import { config } from "./config/env.js";
import { prisma } from "./config/prisma.js";

const app = createApp();

const port = config.port;

async function start(): Promise<void> {
  try {
    await prisma.$connect();
    // eslint-disable-next-line no-console
    console.log("[db] connected");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[db] connection failed", err);
    process.exit(1);
  }

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] listening on http://localhost:${port}`);
  });
}

// Vercel serverless export. The exported `app` is what Vercel wraps.
export default app;

if (process.env.NODE_ENV !== "test") {
  start();
}
