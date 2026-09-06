import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateInvoiceTaxes } from "../lib/tax.ts";

describe("calculateInvoiceTaxes", () => {
  it("computes intra-state supply with CGST + SGST split", () => {
    // Maharashtra (27) to Maharashtra (27)
    const result = calculateInvoiceTaxes("27", "27", [
      {
        description: "IT Consulting Services",
        hsn_code: "998311",
        qty: 1,
        rate: 100000,
        gst_rate: 18,
      },
    ]);

    assert.equal(result.isIntraState, true);
    assert.equal(result.subtotal, 100000);
    assert.equal(result.cgst, 9000); // 9%
    assert.equal(result.sgst, 9000); // 9%
    assert.equal(result.igst, 0);
    assert.equal(result.total, 118000);
    assert.equal(result.items[0].amount, 118000);
  });

  it("computes inter-state supply with IGST only", () => {
    // Maharashtra (27) to Karnataka (29)
    const result = calculateInvoiceTaxes("27", "29", [
      {
        description: "Industrial Machine Component",
        hsn_code: "847130",
        qty: 2,
        rate: 50000,
        gst_rate: 18,
      },
    ]);

    assert.equal(result.isIntraState, false);
    assert.equal(result.subtotal, 100000);
    assert.equal(result.cgst, 0);
    assert.equal(result.sgst, 0);
    assert.equal(result.igst, 18000); // 18%
    assert.equal(result.total, 118000);
  });

  it("handles multiple line items with different GST rate slabs", () => {
    const result = calculateInvoiceTaxes("27", "27", [
      {
        description: "Essential Food Commodity",
        hsn_code: "1001",
        qty: 10,
        rate: 500, // 5000
        gst_rate: 5, // 5% -> 250 (125 CGST + 125 SGST)
      },
      {
        description: "Stationery / Paper",
        hsn_code: "4802",
        qty: 5,
        rate: 1000, // 5000
        gst_rate: 12, // 12% -> 600 (300 CGST + 300 SGST)
      },
      {
        description: "Software License",
        hsn_code: "997331",
        qty: 1,
        rate: 10000, // 10000
        gst_rate: 18, // 18% -> 1800 (900 CGST + 900 SGST)
      },
    ]);

    assert.equal(result.subtotal, 20000);
    assert.equal(result.cgst, 1325); // 125 + 300 + 900
    assert.equal(result.sgst, 1325); // 125 + 300 + 900
    assert.equal(result.igst, 0);
    assert.equal(result.total, 22650);
  });

  it("applies discounts before calculating GST", () => {
    const result = calculateInvoiceTaxes("27", "27", [
      {
        description: "Branded Garments",
        hsn_code: "6203",
        qty: 1,
        rate: 1000,
        discount: 200, // Taxable = 800
        gst_rate: 5, // 5% of 800 = 40 (20 CGST + 20 SGST)
      },
    ]);

    assert.equal(result.subtotal, 800);
    assert.equal(result.cgst, 20);
    assert.equal(result.sgst, 20);
    assert.equal(result.total, 840);
  });
});
