import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateStructuredInvoice,
  StructuredInvoiceDataSchema,
  StructuredInvoiceItemSchema,
  INDIAN_GSTIN_REGEX,
} from "../lib/validation/ocr.ts";
import type {
  StructuredInvoiceData,
  StructuredInvoiceItem,
} from "../lib/validation/ocr.ts";

describe("OCR Structured Invoice Data Schema & Validation (Prompt 18)", () => {
  const validInvoiceData: StructuredInvoiceData = {
    vendor_name: "Bharat Enterprises",
    vendor_gstin: "27AAPFU0939F1ZV",
    invoice_number: "INV/2024-25/0001",
    invoice_date: "2024-04-15",
    line_items: [
      {
        description: "IT Software Advisory Services",
        hsn: "998311",
        qty: 1,
        rate: 122881.36,
        gst_rate: 18,
      },
      {
        description: "Cloud Architecture Consulting",
        hsn: "998313",
        qty: 2,
        rate: 10000,
        gst_rate: 18,
      },
    ],
    total_amount: 168600,
  };

  it("passes validation for a fully populated, valid Indian GST invoice", () => {
    const result = validateStructuredInvoice(validInvoiceData);
    assert.equal(result.valid, true);
    assert.ok(result.data);
    assert.equal(result.data?.vendor_name, "Bharat Enterprises");
    assert.equal(result.data?.vendor_gstin, "27AAPFU0939F1ZV");
    assert.equal(result.data?.invoice_number, "INV/2024-25/0001");
    assert.equal(result.data?.invoice_date, "2024-04-15");
    assert.equal(result.data?.line_items.length, 2);
    assert.equal(result.data?.total_amount, 168600);
  });

  it("validates Indian GSTIN 15-character format pattern", () => {
    // Valid GSTINs
    assert.ok(INDIAN_GSTIN_REGEX.test("27AAPFU0939F1ZV"));
    assert.ok(INDIAN_GSTIN_REGEX.test("29AABCU9603R1ZK"));
    assert.ok(INDIAN_GSTIN_REGEX.test("07AAAAA0000A1Z5"));

    // Invalid GSTINs
    assert.equal(INDIAN_GSTIN_REGEX.test("27AAPFU0939F1Z"), false); // 14 chars
    assert.equal(INDIAN_GSTIN_REGEX.test("27AAPFU0939F1ZVV"), false); // 16 chars
    assert.equal(INDIAN_GSTIN_REGEX.test("XXAAPFU0939F1ZV"), false); // State not digits
    assert.equal(INDIAN_GSTIN_REGEX.test("27AAPFU093991ZV"), false); // PAN 10th char not alpha
  });

  it("rejects invalid or missing vendor fields", () => {
    // Missing vendor name
    const noName = { ...validInvoiceData, vendor_name: "" };
    const resNoName = validateStructuredInvoice(noName);
    assert.equal(resNoName.valid, false);
    assert.match(resNoName.error!, /vendor_name/);

    // Invalid GSTIN
    const badGstin = { ...validInvoiceData, vendor_gstin: "INVALID_GSTIN" };
    const resBadGstin = validateStructuredInvoice(badGstin);
    assert.equal(resBadGstin.valid, false);
    assert.match(resBadGstin.error!, /vendor_gstin/);
  });

  it("rejects invalid invoice numbers and un-normalized date formats", () => {
    // Empty invoice number
    const noInvNo = { ...validInvoiceData, invoice_number: "   " };
    const resNoInv = validateStructuredInvoice(noInvNo);
    assert.equal(resNoInv.valid, false);
    assert.match(resNoInv.error!, /invoice_number/);

    // Non-ISO date format (e.g. DD/MM/YYYY instead of YYYY-MM-DD)
    const badDate = { ...validInvoiceData, invoice_date: "15/04/2024" };
    const resBadDate = validateStructuredInvoice(badDate);
    assert.equal(resBadDate.valid, false);
    assert.match(resBadDate.error!, /invoice_date/);

    // Word format date
    const wordDate = { ...validInvoiceData, invoice_date: "15-Apr-2024" };
    const resWordDate = validateStructuredInvoice(wordDate);
    assert.equal(resWordDate.valid, false);
    assert.match(resWordDate.error!, /invoice_date/);
  });

  it("rejects empty line items or invalid line item values", () => {
    // Empty line items array
    const emptyItems = { ...validInvoiceData, line_items: [] };
    const resEmpty = validateStructuredInvoice(emptyItems);
    assert.equal(resEmpty.valid, false);
    assert.match(resEmpty.error!, /line_items/);

    // Line item with zero or negative quantity
    const zeroQty = {
      ...validInvoiceData,
      line_items: [{ ...validInvoiceData.line_items[0], qty: 0 }],
    };
    const resZeroQty = validateStructuredInvoice(zeroQty);
    assert.equal(resZeroQty.valid, false);
    assert.match(resZeroQty.error!, /line_items.0.qty/);

    // Line item with negative rate
    const negRate = {
      ...validInvoiceData,
      line_items: [{ ...validInvoiceData.line_items[0], rate: -500 }],
    };
    const resNegRate = validateStructuredInvoice(negRate);
    assert.equal(resNegRate.valid, false);
    assert.match(resNegRate.error!, /line_items.0.rate/);

    // Line item with invalid HSN code (1 char or >8 chars)
    const shortHsn = {
      ...validInvoiceData,
      line_items: [{ ...validInvoiceData.line_items[0], hsn: "9" }],
    };
    const resShortHsn = validateStructuredInvoice(shortHsn);
    assert.equal(resShortHsn.valid, false);
    assert.match(resShortHsn.error!, /line_items.0.hsn/);
  });

  it("rejects non-positive total invoice amount", () => {
    // Zero amount
    const zeroAmount = { ...validInvoiceData, total_amount: 0 };
    const resZero = validateStructuredInvoice(zeroAmount);
    assert.equal(resZero.valid, false);
    assert.match(resZero.error!, /total_amount/);

    // Negative amount
    const negAmount = { ...validInvoiceData, total_amount: -145000 };
    const resNeg = validateStructuredInvoice(negAmount);
    assert.equal(resNeg.valid, false);
    assert.match(resNeg.error!, /total_amount/);
  });

  it("strictly suppresses malformed data and returns error details", () => {
    // Null / non-object payload
    const nullPayload = validateStructuredInvoice(null);
    assert.equal(nullPayload.valid, false);
    assert.equal(nullPayload.data, undefined);

    const stringPayload = validateStructuredInvoice("malformed string");
    assert.equal(stringPayload.valid, false);
    assert.equal(stringPayload.data, undefined);

    // Partially malformed object
    const brokenObj = {
      vendor_name: "ABC Corp",
      // missing all other required fields
    };
    const resBroken = validateStructuredInvoice(brokenObj);
    assert.equal(resBroken.valid, false);
    assert.equal(resBroken.data, undefined);
    assert.ok(resBroken.errors && resBroken.errors.length > 0);
  });
});
