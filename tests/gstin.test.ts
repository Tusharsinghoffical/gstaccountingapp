import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateGSTIN } from "../lib/validation/gstin.ts";

describe("validateGSTIN", () => {
  it("validates official valid GSTINs with correct checksums", () => {
    const res1 = validateGSTIN("27AAPFU0939F1ZV");
    assert.equal(res1.isValid, true);
    assert.equal(res1.stateCode, "27");
    assert.equal(res1.pan, "AAPFU0939F");

    const res2 = validateGSTIN("27AAACT2828Q1ZU");
    assert.equal(res2.isValid, true);
    assert.equal(res2.stateCode, "27");
    assert.equal(res2.pan, "AAACT2828Q");
  });

  it("normalizes lowercase inputs and trims whitespace", () => {
    const res = validateGSTIN("  27aapfu0939f1zv  ");
    assert.equal(res.isValid, true);
    assert.equal(res.stateCode, "27");
    assert.equal(res.pan, "AAPFU0939F");
  });

  it("detects incorrect check digits (checksum mismatch)", () => {
    // 27AAPFU0939F1ZV with check digit replaced with 'X'
    const res = validateGSTIN("27AAPFU0939F1ZX");
    assert.equal(res.isValid, false);
    assert.match(res.error || "", /checksum mismatch/i);
  });

  it("rejects invalid lengths", () => {
    const resShort = validateGSTIN("27AAPFU0939F");
    assert.equal(resShort.isValid, false);
    assert.match(resShort.error || "", /must be exactly 15 characters/i);

    const resLong = validateGSTIN("27AAPFU0939F1ZV123");
    assert.equal(resLong.isValid, false);
    assert.match(resLong.error || "", /must be exactly 15 characters/i);
  });

  it("rejects invalid state codes", () => {
    // State code 00 is invalid
    const res = validateGSTIN("00AAPFU0939F1ZV");
    assert.equal(res.isValid, false);
  });

  it("handles null or undefined safely", () => {
    assert.equal(validateGSTIN(null).isValid, false);
    assert.equal(validateGSTIN(undefined).isValid, false);
  });
});
