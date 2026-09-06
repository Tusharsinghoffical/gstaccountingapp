import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatINR, formatDateIN } from "../lib/format.ts";

describe("formatINR", () => {
  it("formats standard amounts in Indian numbering system", () => {
    assert.equal(formatINR(1000), "₹1,000");
    assert.equal(formatINR(10000), "₹10,000");
    assert.equal(formatINR(100000), "₹1,00,000"); // 1 Lakh (prompt example)
    assert.equal(formatINR(500000), "₹5,00,000"); // 5 Lakhs
  });

  it("handles zero and negative zero edge cases", () => {
    assert.equal(formatINR(0), "₹0");
    assert.equal(formatINR(-0), "₹0");
  });

  it("handles negative numbers properly", () => {
    assert.equal(formatINR(-500), "-₹500");
    assert.equal(formatINR(-100000), "-₹1,00,000");
    assert.equal(formatINR(-10000000), "-₹1,00,00,000");
  });

  it("handles values above 1 crore accurately", () => {
    assert.equal(formatINR(10000000), "₹1,00,00,000"); // 1 Crore
    assert.equal(formatINR(25000000), "₹2,50,00,000"); // 2.5 Crore
    assert.equal(formatINR(100000000), "₹10,00,00,000"); // 10 Crore
    assert.equal(formatINR(1000000000), "₹1,00,00,00,000"); // 100 Crore
  });

  it("handles decimal amounts with 2 decimal places", () => {
    assert.equal(formatINR(100000.5), "₹1,00,000.50");
    assert.equal(formatINR(12345678.75), "₹1,23,45,678.75");
    assert.equal(formatINR(0.5), "₹0.50");
  });

  it("respects explicit showDecimals option", () => {
    assert.equal(formatINR(100000, { showDecimals: true }), "₹1,00,000.00");
    assert.equal(formatINR(100000.5, { showDecimals: false }), "₹1,00,001");
  });

  it("safely handles non-finite numbers", () => {
    assert.equal(formatINR(NaN), "₹0");
    assert.equal(formatINR(Infinity), "₹0");
    assert.equal(formatINR(-Infinity), "₹0");
  });
});

describe("formatDateIN", () => {
  it("formats dates as DD/MM/YYYY", () => {
    // Note: Month is 0-indexed in JS Date
    const d1 = new Date(2024, 3, 15); // 15 April 2024
    assert.equal(formatDateIN(d1), "15/04/2024");
  });

  it("zero-pads single-digit days and months", () => {
    const d1 = new Date(2024, 0, 5); // 5 Jan 2024
    assert.equal(formatDateIN(d1), "05/01/2024");

    const d2 = new Date(2024, 8, 9); // 9 Sept 2024
    assert.equal(formatDateIN(d2), "09/09/2024");
  });

  it("handles end-of-year and leap-year dates", () => {
    const leapDay = new Date(2024, 1, 29); // 29 Feb 2024
    assert.equal(formatDateIN(leapDay), "29/02/2024");

    const newYearsEve = new Date(2024, 11, 31); // 31 Dec 2024
    assert.equal(formatDateIN(newYearsEve), "31/12/2024");
  });

  it("throws descriptive error for invalid date objects", () => {
    assert.throws(() => formatDateIN(new Date("invalid")), {
      message: "Invalid date provided to formatDateIN",
    });
  });
});
