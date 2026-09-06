import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PURCHASE_INVOICE_CATEGORIES,
  purchaseCategorySchema,
  createInvoiceSchema,
} from "../lib/validation/invoice.ts";
import {
  heuristicClassifyPurchaseInvoice,
  classifyPurchaseInvoice,
} from "../lib/ai/classifyInvoice.ts";

describe("Purchase Invoice AI Category Classification & Validation", () => {
  it("enforces strict whitelist of 6 standard expense categories", () => {
    assert.deepEqual(PURCHASE_INVOICE_CATEGORIES, [
      "Office Supplies",
      "Raw Materials",
      "Utilities",
      "Professional Services",
      "Travel",
      "Other",
    ]);

    for (const category of PURCHASE_INVOICE_CATEGORIES) {
      const parsed = purchaseCategorySchema.safeParse(category);
      assert.equal(parsed.success, true, `Expected valid parse for ${category}`);
    }

    // Invalid categories must be rejected
    const invalidCategories = [
      "Entertainment",
      "Marketing & Sales",
      "Depreciation",
      "Personal",
      "Taxes",
    ];
    for (const invalid of invalidCategories) {
      const parsed = purchaseCategorySchema.safeParse(invalid);
      assert.equal(parsed.success, false, `Expected rejection for invalid category: ${invalid}`);
    }
  });

  it("validates createInvoiceSchema accepts optional purchase category", () => {
    const validBase = {
      type: "purchase" as const,
      customer_or_supplier_id: "supp-1",
      invoice_date: "2024-04-15",
      items: [
        {
          description: "Dell 27-inch Monitor",
          hsn_code: "8471",
          qty: 2,
          rate: 15000,
          discount: 0,
          gst_rate: 18,
        },
      ],
    };

    // 1. Without category
    const resNoCategory = createInvoiceSchema.safeParse(validBase);
    assert.equal(resNoCategory.success, true);

    // 2. With valid category
    const resWithCategory = createInvoiceSchema.safeParse({
      ...validBase,
      category: "Office Supplies",
    });
    assert.equal(resWithCategory.success, true);
    if (resWithCategory.success) {
      assert.equal(resWithCategory.data.category, "Office Supplies");
    }

    // 3. With invalid category
    const resInvalidCategory = createInvoiceSchema.safeParse({
      ...validBase,
      category: "Unauthorized Expense Category",
    });
    assert.equal(resInvalidCategory.success, false);
  });

  it("classifies invoices accurately using domain indicators (deterministic engine)", () => {
    // A. Professional Services
    const r1 = heuristicClassifyPurchaseInvoice({
      vendor_name: "KPMG Advisory LLP",
      line_items: [{ description: "Quarterly Statutory Audit and Tax Consulting" }],
    });
    assert.equal(r1.category, "Professional Services");

    // B. Office Supplies
    const r2 = heuristicClassifyPurchaseInvoice({
      vendor_name: "Staples Stationery Mart",
      line_items: [
        { description: "A4 Printing Paper Reams 75 GSM" },
        { description: "HP LaserJet Toner Cartridges" },
      ],
    });
    assert.equal(r2.category, "Office Supplies");

    // C. Utilities
    const r3 = heuristicClassifyPurchaseInvoice({
      vendor_name: "BESCOM (Bangalore Electricity Supply Co)",
      line_items: [{ description: "Commercial Electricity Consumption Bill May 2024" }],
    });
    assert.equal(r3.category, "Utilities");

    // D. Travel
    const r4 = heuristicClassifyPurchaseInvoice({
      vendor_name: "InterGlobe Aviation Ltd (IndiGo)",
      line_items: [{ description: "Flight Tickets BLR to BOM Economy Class" }],
    });
    assert.equal(r4.category, "Travel");

    // E. Raw Materials
    const r5 = heuristicClassifyPurchaseInvoice({
      vendor_name: "Tata Steel Tubes Division",
      line_items: [{ description: "Cold Rolled Seamless Steel Pipes 25mm" }],
    });
    assert.equal(r5.category, "Raw Materials");

    // F. Fallback / Other
    const r6 = heuristicClassifyPurchaseInvoice({
      vendor_name: "Unclassified General Vendor",
      line_items: [{ description: "Misc Item 123" }],
    });
    assert.equal(r6.category, "Other");
  });

  it("asserts the non-auto-application invariant: category remains empty until explicitly accepted", async () => {
    // Simulated form state
    let formCategoryState: string = ""; // user-editable category state in UI
    const mockInvoiceData = {
      vendor_name: "Google Cloud India",
      line_items: [{ description: "Cloud compute and server hosting" }],
    };

    // Groq / classifier returns suggestion
    const classification = await classifyPurchaseInvoice(mockInvoiceData);
    assert.equal(classification.success, true);
    assert.equal(classification.category, "Utilities");

    // INVARIANT CHECK:
    // Even after classification completes, formCategoryState MUST NOT change automatically!
    assert.equal(
      formCategoryState,
      "",
      "Invariant violation: Category was auto-applied without user clicking the suggestion chip!"
    );

    // Explicit User Action: User clicks suggestion chip "Click to Accept"
    formCategoryState = classification.category;

    assert.equal(formCategoryState, "Utilities");
  });
});
