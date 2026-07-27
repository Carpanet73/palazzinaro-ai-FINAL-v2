/**
 * numberToItalianWords.ts — CORREZIONE BP
 * Converte un importo in euro nella forma scritta usata nei contratti italiani,
 * es. 7800.00 -> "settemilaottocento/00"
 */

const UNITS = ["", "uno", "due", "tre", "quattro", "cinque", "sei", "sette", "otto", "nove"];
const TEENS = ["dieci", "undici", "dodici", "tredici", "quattordici", "quindici", "sedici", "diciassette", "diciotto", "diciannove"];
const TENS = ["", "", "venti", "trenta", "quaranta", "cinquanta", "sessanta", "settanta", "ottanta", "novanta"];

function twoDigitsToWords(n: number): string {
  if (n < 10) return UNITS[n];
  if (n < 20) return TEENS[n - 10];
  const ten = Math.floor(n / 10);
  const unit = n % 10;
  let word = TENS[ten];
  if (unit === 1 || unit === 8) {
    word = word.slice(0, -1); // "venti" + "uno" -> "ventuno", "venti" + "otto" -> "ventotto"
  }
  return word + (unit > 0 ? UNITS[unit] : "");
}

function threeDigitsToWords(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  let word = "";
  if (hundreds > 0) {
    word += (hundreds === 1 ? "cento" : UNITS[hundreds] + "cento");
  }
  if (rest > 0) word += twoDigitsToWords(rest);
  return word;
}

function integerToWords(n: number): string {
  if (n === 0) return "zero";
  if (n < 1000) return threeDigitsToWords(n);

  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  let word = thousands === 1 ? "mille" : threeDigitsToWords(thousands) + "mila";
  if (rest > 0) word += threeDigitsToWords(rest);
  return word;
}

/** Converte un importo (numero o stringa) in "importointero/centesimi", es. "settemilaottocento/00" */
export function amountToItalianWords(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  const intPart = Math.floor(num);
  const cents = Math.round((num - intPart) * 100);
  const centsStr = String(cents).padStart(2, "0");
  return `${integerToWords(intPart)}/${centsStr}`;
}
