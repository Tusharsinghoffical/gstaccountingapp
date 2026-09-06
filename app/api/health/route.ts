import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const startTime = Date.now();
    // Test database connectivity
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - startTime;

    return NextResponse.json(
      {
        status: "healthy",
        database: "connected",
        latencyMs: latency,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Database unreachable";
    logger.error("Health check failed", error, { message });

    return NextResponse.json(
      {
        status: "unhealthy",
        database: "disconnected",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
