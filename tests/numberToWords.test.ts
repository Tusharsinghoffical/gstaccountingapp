import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { numberToWordsINR } from "../lib/numberToWordsINR.ts";

describe("numberToWordsINR", () => {
  it("converts zero correctly", () => {
    assert.equal(numberToWordsINR(0), "Rupees Zero Only");
  });

  it("converts single and two-digit numbers", () => {
    assert.equal(numberToWordsINR(5), "Rupees Five Only");
    assert.equal(numberToWordsINR(17), "Rupees Seventeen Only");
    assert.equal(numberToWordsINR(42), "Rupees Forty-Two Only");
    assert.equal(numberToWordsINR(99), "Rupees Ninety-Nine Only");
  });

  it("converts hundreds and thousands correctly", () => {
    assert.equal(numberToWordsINR(100), "Rupees One Hundred Only");
    assert.equal(numberToWordsINR(105), "Rupees One Hundred Five Only");
    assert.equal(numberToWordsINR(1250), "Rupees One Thousand Two Hundred Fifty Only");
    assert.equal(
      numberToWordsINR(15000),
      "Rupees Fifteen Thousand Only"
    );
  });

  it("converts Lakhs and Crores accurately", () => {
    // 1 Lakh
    assert.equal(numberToWordsINR(100000), "Rupees One Lakh Only");

    // 1 Lakh 45 Thousand
    assert.equal(
      numberToWordsINR(145000),
      "Rupees One Lakh Forty-Five Thousand Only"
    );

    // 88 Thousand 500
    assert.equal(
      numberToWordsINR(88500),
      "Rupees Eighty-Eight Thousand Five Hundred Only"
    );

    // 1 Crore
    assert.equal(numberToWordsINR(10000000), "Rupees One Crore Only");

    // 5 Crore 23 Lakh 40 Thousand 500
    assert.equal(
      numberToWordsINR(52340500),
      "Rupees Five Crore Twenty-Three Lakh Forty Thousand Five Hundred Only"
    );
  });

  it("converts decimal paise values correctly", () => {
    assert.equal(
      numberToWordsINR(145000.5),
      "Rupees One Lakh Forty-Five Thousand and Fifty Paise Only"
    );
    assert.equal(
      numberToWordsINR(100.05),
      "Rupees One Hundred and Five Paise Only"
    );
    assert.equal(
      numberToWordsINR(0.75),
      "Rupees Zero and Seventy-Five Paise Only"
    );
  });

  it("handles negative amounts", () => {
    assert.equal(
      numberToWordsINR(-500),
      "Minus Rupees Five Hundred Only"
    );
  });
});
