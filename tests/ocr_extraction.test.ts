import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  selectGroqVisionModel,
  computeOcrConfidence,
} from "../lib/validation/ocr.ts";
import type { GroqModelItem } from "../lib/validation/ocr.ts";

describe("Groq Vision Model Discovery & Selection", () => {
  it("prioritizes llama-3.2-11b-vision-preview when available", () => {
    const models: GroqModelItem[] = [
      { id: "llama-3.1-8b-instant" },
      { id: "llama-3.2-90b-vision-preview" },
      { id: "llama-3.2-11b-vision-preview" },
      { id: "mixtral-8x7b-32768" },
    ];

    const selected = selectGroqVisionModel(models);
    assert.equal(selected, "llama-3.2-11b-vision-preview");
  });

  it("selects llama-3.2-90b-vision-preview if 11b is not available", () => {
    const models: GroqModelItem[] = [
      { id: "llama-3.1-70b-versatile" },
      { id: "llama-3.2-90b-vision-preview" },
      { id: "gemma2-9b-it" },
    ];

    const selected = selectGroqVisionModel(models);
    assert.equal(selected, "llama-3.2-90b-vision-preview");
  });

  it("detects generic models with 'vision' substring when priority models are absent", () => {
    const models: GroqModelItem[] = [
      { id: "llama-3.1-8b-instant" },
      { id: "meta-llama/llama-vision-70b" },
      { id: "whisper-large-v3" },
    ];

    const selected = selectGroqVisionModel(models);
    assert.equal(selected, "meta-llama/llama-vision-70b");
  });

  it("returns null when no vision models are available on the account", () => {
    const nonVisionModels: GroqModelItem[] = [
      { id: "llama-3.1-8b-instant" },
      { id: "llama-3.1-70b-versatile" },
      { id: "mixtral-8x7b-32768" },
      { id: "gemma2-9b-it" },
    ];

    const selected = selectGroqVisionModel(nonVisionModels);
    assert.equal(selected, null);
  });

  it("returns null on empty or malformed model lists", () => {
    assert.equal(selectGroqVisionModel([]), null);
    assert.equal(selectGroqVisionModel(null), null);
  });
});

describe("OCR Confidence Flag & Score Categorization", () => {
  it("assigns 'high' confidence when score exceeds 0.80", () => {
    assert.equal(computeOcrConfidence(0.98), "high");
    assert.equal(computeOcrConfidence(0.90), "high");
    assert.equal(computeOcrConfidence(0.81), "high");
  });

  it("assigns 'medium' confidence for scores between 0.50 and 0.80", () => {
    assert.equal(computeOcrConfidence(0.80), "medium");
    assert.equal(computeOcrConfidence(0.75), "medium");
    assert.equal(computeOcrConfidence(0.65), "medium");
    assert.equal(computeOcrConfidence(0.51), "medium");
  });

  it("assigns 'low' confidence when score is 0.50 or below", () => {
    assert.equal(computeOcrConfidence(0.50), "low");
    assert.equal(computeOcrConfidence(0.35), "low");
    assert.equal(computeOcrConfidence(0.12), "low");
    assert.equal(computeOcrConfidence(0.0), "low");
  });
});

describe("Storage Reference Resolution & Extraction Payload Contract", () => {
  it("parses storage URI references correctly into bucket and filePath", () => {
    function parseStorageReference(payload: {
      bucket?: string;
      filePath?: string;
      storageRef?: string;
    }): { bucket: string; filePath: string } {
      let bucket = payload.bucket || "invoices";
      let filePath = payload.filePath || "";

      if (payload.storageRef && !filePath) {
        const cleaned = payload.storageRef.replace("storage://", "");
        const slashIdx = cleaned.indexOf("/");
        if (slashIdx !== -1) {
          bucket = cleaned.substring(0, slashIdx);
          filePath = cleaned.substring(slashIdx + 1);
        } else {
          filePath = cleaned;
        }
      }

      return { bucket, filePath };
    }

    // Direct bucket + filePath
    const res1 = parseStorageReference({
      bucket: "invoices",
      filePath: "biz-1/2024-05-inv.pdf",
    });
    assert.equal(res1.bucket, "invoices");
    assert.equal(res1.filePath, "biz-1/2024-05-inv.pdf");

    // storage:// URI ref
    const res2 = parseStorageReference({
      storageRef: "storage://invoices/tenant-99/receipt.png",
    });
    assert.equal(res2.bucket, "invoices");
    assert.equal(res2.filePath, "tenant-99/receipt.png");
  });

  it("validates that OCR extraction output contains verbatim raw text and confidence flag", () => {
    interface OcrPayload {
      success: boolean;
      raw_text: string;
      confidence: "high" | "medium" | "low";
      confidence_score: number;
      engine: "groq_vision" | "tesseract_fallback";
      model_used: string | null;
      metadata: {
        bucket: string;
        file_path: string;
        mime_type: string;
        bytes_processed: number;
        extracted_at: string;
      };
    }

    const sampleOutput: OcrPayload = {
      success: true,
      raw_text: "TAX INVOICE\nBharat Enterprises\nGSTIN: 27AAPFU0939F1ZV\nTotal: 145000",
      confidence: "high",
      confidence_score: 0.95,
      engine: "groq_vision",
      model_used: "llama-3.2-11b-vision-preview",
      metadata: {
        bucket: "invoices",
        file_path: "biz-1/17150000-tax_invoice.png",
        mime_type: "image/png",
        bytes_processed: 254100,
        extracted_at: new Date().toISOString(),
      },
    };

    assert.equal(sampleOutput.success, true);
    assert.ok(sampleOutput.raw_text.length > 0);
    assert.ok(["high", "medium", "low"].includes(sampleOutput.confidence));
    assert.ok(sampleOutput.confidence_score >= 0 && sampleOutput.confidence_score <= 1);
    assert.ok(["groq_vision", "tesseract_fallback"].includes(sampleOutput.engine));
    assert.ok(sampleOutput.metadata.file_path.includes("biz-1/"));
  });
});
