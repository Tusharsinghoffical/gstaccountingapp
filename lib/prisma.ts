import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Enable SQLite WAL mode and optimizations
async function configureSqlite() {
  try {
    await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
    await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 30000;");
    await prisma.$queryRawUnsafe("PRAGMA foreign_keys = ON;");
  } catch {
    // Ignore during build or when database is not yet ready
  }
}

configureSqlite();

export default prisma;
