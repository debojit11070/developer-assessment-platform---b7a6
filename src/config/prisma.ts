import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

function buildClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  const isNeon = /neon\.tech|neon\.build|neon\.psdb\.cloud/.test(url);

  if (isNeon) {
    const adapter = new PrismaNeon({ connectionString: url });
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = buildClient();

process.on("beforeExit", async () => {
  await prisma.$disconnect();
});
