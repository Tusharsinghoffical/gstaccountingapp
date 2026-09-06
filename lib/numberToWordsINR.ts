/**
 * Converts numbers into the Indian numbering system words (Lakhs, Crores, etc.)
 * Format: "Rupees One Lakh Forty-Five Thousand Only"
 * With paise: "Rupees One Lakh Forty-Five Thousand and Fifty Paise Only"
 */

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function convertTwoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const ten = Math.floor(n / 10);
  const one = n % 10;
  return TENS[ten] + (one > 0 ? "-" + ONES[one] : "");
}

function convertThreeDigits(n: number): string {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  let str = "";
  if (hundred > 0) {
    str += ONES[hundred] + " Hundred";
  }
  if (rest > 0) {
    if (str !== "") str += " ";
    str += convertTwoDigits(rest);
  }
  return str;
}

/**
 * Converts integer part in Indian numbering:
 * Digits: [Crores] [Lakhs] [Thousands] [Hundreds & Units]
 */
function convertIntegerINR(num: number): string {
  if (num === 0) return "Zero";

  const crore = Math.floor(num / 10000000);
  num %= 10000000;

  const lakh = Math.floor(num / 100000);
  num %= 100000;

  const thousand = Math.floor(num / 1000);
  num %= 1000;

  const remainder = num;

  const parts: string[] = [];

  if (crore > 0) {
    parts.push(convertIntegerINR(crore) + " Crore");
  }

  if (lakh > 0) {
    parts.push(convertTwoDigits(lakh) + " Lakh");
  }

  if (thousand > 0) {
    parts.push(convertTwoDigits(thousand) + " Thousand");
  }

  if (remainder > 0) {
    parts.push(convertThreeDigits(remainder));
  }

  return parts.join(" ");
}

/**
 * Converts an INR currency amount into compliant words representation.
 * @param amount Numeric amount (e.g. 145000.50)
 * @returns e.g. "Rupees One Lakh Forty-Five Thousand and Fifty Paise Only"
 */
export function numberToWordsINR(amount: number): string {
  if (isNaN(amount) || !isFinite(amount)) return "Zero";

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  const rupees = Math.floor(absAmount);
  const paise = Math.round((absAmount - rupees) * 100);

  let result = "Rupees " + convertIntegerINR(rupees);

  if (paise > 0) {
    result += " and " + convertTwoDigits(paise) + " Paise";
  }

  result += " Only";

  return isNegative ? "Minus " + result : result;
}
