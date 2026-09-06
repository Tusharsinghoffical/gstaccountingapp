import fs from "fs";
import path from "path";
import crypto from "crypto";

const STORAGE_ROOT = path.join(process.cwd(), "storage");

export interface StoredFileMetadata {
  fileId: string;
  originalName?: string;
  extension: string;
  filePath: string;
  sizeBytes: number;
}

/**
 * Saves a buffer to ./storage/{businessId}/invoices/{uuid}.{ext}
 */
export async function saveInvoiceFile(
  businessId: string,
  buffer: Buffer,
  extension: string,
  originalName?: string
): Promise<StoredFileMetadata> {
  const fileId = crypto.randomUUID();
  const cleanExt = extension.replace(/^\./, "").toLowerCase() || "bin";
  const businessDir = path.join(STORAGE_ROOT, businessId, "invoices");

  await fs.promises.mkdir(businessDir, { recursive: true });

  const fileName = `${fileId}.${cleanExt}`;
  const filePath = path.join(businessDir, fileName);

  await fs.promises.writeFile(filePath, buffer);

  return {
    fileId,
    originalName,
    extension: cleanExt,
    filePath,
    sizeBytes: buffer.length,
  };
}

/**
 * Finds the absolute file path for a fileId inside a business directory.
 */
export async function getInvoiceFilePath(
  businessId: string,
  fileId: string
): Promise<{ filePath: string; extension: string } | null> {
  const businessDir = path.join(STORAGE_ROOT, businessId, "invoices");

  try {
    if (!fs.existsSync(businessDir)) return null;

    const files = await fs.promises.readdir(businessDir);
    const match = files.find((f) => f.startsWith(`${fileId}.`));

    if (!match) return null;

    const filePath = path.join(businessDir, match);
    const extension = path.extname(match).replace(/^\./, "").toLowerCase();

    return { filePath, extension };
  } catch {
    return null;
  }
}

/**
 * Deletes a file from ./storage/{businessId}/invoices/{uuid}.{ext}
 */
export async function deleteInvoiceFile(
  businessId: string,
  fileId: string
): Promise<boolean> {
  const found = await getInvoiceFilePath(businessId, fileId);
  if (!found) return false;

  try {
    await fs.promises.unlink(found.filePath);
    return true;
  } catch {
    return false;
  }
}
