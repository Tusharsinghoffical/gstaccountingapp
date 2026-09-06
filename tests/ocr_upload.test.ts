import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateInvoiceFile,
  generateScopedInvoiceStoragePath,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
} from "../lib/validation/ocr.ts";

describe("OCR Invoice Upload Validation & Storage Scoping", () => {
  it("enforces 10 MB maximum file size limit", () => {
    assert.equal(MAX_FILE_SIZE_BYTES, 10 * 1024 * 1024);

    // File slightly below 10MB (valid)
    const validFile = {
      name: "tax_invoice.pdf",
      size: 9.8 * 1024 * 1024,
      type: "application/pdf",
    };
    const validRes = validateInvoiceFile(validFile);
    assert.equal(validRes.valid, true);

    // File exceeding 10MB (invalid)
    const largeFile = {
      name: "heavy_scan.pdf",
      size: 10.5 * 1024 * 1024,
      type: "application/pdf",
    };
    const invalidRes = validateInvoiceFile(largeFile);
    assert.equal(invalidRes.valid, false);
    assert.match(invalidRes.error!, /exceeds maximum allowed limit of 10 MB/);
  });

  it("validates allowed invoice MIME types (PDF, PNG, JPG, WEBP)", () => {
    const validMimes = [
      { name: "bill.pdf", size: 500000, type: "application/pdf" },
      { name: "receipt.png", size: 200000, type: "image/png" },
      { name: "photo.jpg", size: 300000, type: "image/jpeg" },
      { name: "invoice.webp", size: 150000, type: "image/webp" },
    ];

    for (const file of validMimes) {
      const res = validateInvoiceFile(file);
      assert.equal(res.valid, true, `Expected ${file.name} to be valid`);
    }

    const invalidMimes = [
      { name: "script.exe", size: 10000, type: "application/x-msdownload" },
      { name: "sheet.csv", size: 50000, type: "text/csv" },
      { name: "archive.zip", size: 200000, type: "application/zip" },
    ];

    for (const file of invalidMimes) {
      const res = validateInvoiceFile(file);
      assert.equal(res.valid, false, `Expected ${file.name} to be rejected`);
      assert.match(res.error!, /Unsupported file format/);
    }
  });

  it("generates multi-tenant scoped paths with business_id prefix", () => {
    const businessId = "biz-42-test";
    const fileName = "Invoice #2024 / April!.pdf";
    const storagePath = generateScopedInvoiceStoragePath(businessId, fileName, 1715000000);

    // Storage path MUST start with business_id/
    assert.ok(storagePath.startsWith(`${businessId}/`));
    assert.equal(storagePath.split("/")[0], businessId);
    assert.match(storagePath, /^biz-42-test\/\d+-invoice__2024___april_.pdf$/);
  });

  it("extracts folder name accurately for Storage RLS evaluation", () => {
    // Simulates (storage.foldername(name))[1] in Postgres
    function getStorageFoldername(path: string): string {
      const parts = path.split("/");
      return parts.length > 1 ? parts[0] : "";
    }

    const tenantPath = "e82f5342-0952-4860-a997-b552bf1cc321/invoice-001.pdf";
    const folder = getStorageFoldername(tenantPath);
    assert.equal(folder, "e82f5342-0952-4860-a997-b552bf1cc321");
  });
});
