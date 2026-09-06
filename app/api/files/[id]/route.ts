import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { assertBusinessMembership } from "@/lib/auth/authorize";
import { getInvoiceFilePath } from "@/lib/storage/local-files";
import fs from "fs";

const MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  tiff: "image/tiff",
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = (await getServerSession(authOptions)) as { user?: { id?: string } } | null;
  const userId = session?.user?.id;
  if (!userId) {
    return new NextResponse(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const fileId = params.id;
  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get("businessId");

  if (!businessId) {
    return new NextResponse(
      JSON.stringify({ error: "Missing businessId parameter" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // Assert tenant membership (throws 403 if unauthorized)
    await assertBusinessMembership(userId, businessId);
  } catch {
    return new NextResponse(
      JSON.stringify({ error: "Forbidden: Access denied to this business's files" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const fileInfo = await getInvoiceFilePath(businessId, fileId);
  if (!fileInfo || !fs.existsSync(fileInfo.filePath)) {
    return new NextResponse(JSON.stringify({ error: "File not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const fileBuffer = await fs.promises.readFile(fileInfo.filePath);
  const contentType = MIME_TYPES[fileInfo.extension] || "application/octet-stream";

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${fileId}.${fileInfo.extension}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
