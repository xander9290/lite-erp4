import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const { createNumberFormat } = createRequire(import.meta.url)("./numberFormat.ts");

test("integer accepts digits and correctly grouped pasted numbers", () => {
  const format = createNumberFormat({ type: "integer" });
  assert.deepEqual(format.parseInput("0012"), { text: "0012", value: 12 });
  assert.deepEqual(format.parseInput("1,234"), { text: "1234", value: 1234 });
  assert.equal(format.format(1234), "1,234");
});

test("integer rejects fractional values, malformed groups, letters and exponents", () => {
  const format = createNumberFormat({ type: "integer" });
  for (const text of ["1.5", "1,2", "abc", "1e3", "Infinity", "NaN", "--1", "+1"]) {
    assert.equal(format.parseInput(text), null, text);
  }
});

test("blank values are null and zero remains a number", () => {
  const format = createNumberFormat({ type: "float", decimals: 2 });
  assert.deepEqual(format.parseInput(""), { text: "", value: null });
  assert.deepEqual(format.parseInput("0"), { text: "0", value: 0 });
  assert.equal(format.format(null), "");
  assert.equal(format.format(0), "0.00");
});

test("default zero starts with an empty editing draft and retains its numeric value", () => {
  for (const options of [
    { type: "integer" },
    { type: "float", decimals: 3 },
    { type: "monetary", decimals: 2, currency: "MXN" },
  ]) {
    const format = createNumberFormat(options);
    assert.equal(format.toInput(0), "");
    assert.equal(format.round(0), 0);
    assert.notEqual(format.format(0), "");
    assert.equal(format.parseInput("5").value, 5);
    assert.equal(format.parseInput("").value, null);
  }
});

test("decimal editing preserves the separator and trailing zeroes", () => {
  const format = createNumberFormat({ type: "float", decimals: 3 });
  assert.deepEqual(format.parseInput("12."), { text: "12.", value: 12 });
  assert.deepEqual(format.parseInput("12.30"), { text: "12.30", value: 12.3 });
  assert.equal(format.parseInput(".5").value, 0.5);
  assert.equal(format.parseInput("12.3456"), null);
  assert.equal(format.format(12.3), "12.300");
});

test("negative values require allowNegative and allow an incomplete sign while editing", () => {
  assert.equal(createNumberFormat({ type: "integer" }).parseInput("-1"), null);
  const format = createNumberFormat({ type: "float", decimals: 2, allowNegative: true });
  assert.deepEqual(format.parseInput("-"), { text: "-", value: null });
  assert.deepEqual(format.parseInput("-."), { text: "-.", value: null });
  assert.equal(format.parseInput("-.5").value, -0.5);
  assert.equal(format.parseInput("-0").value, 0);
});

test("monetary uses the specified decimals independently of currency defaults", () => {
  const format = createNumberFormat({ type: "monetary", decimals: 3, currency: "JPY" });
  assert.equal(format.format(1234.5), "1,234.500");
  assert.equal(format.parseInput("1,234.500").value, 1234.5);
});

test("currency prefixes support MXN, USD, EUR and the ERU alias", () => {
  for (const [currency, symbol] of [["MXN", "$"], ["USD", "$"], ["EUR", "€"], ["ERU", "€"]]) {
    assert.equal(createNumberFormat({ type: "monetary", decimals: 2, currency }).currencySymbol, symbol);
  }
  assert.equal(createNumberFormat({ type: "monetary", decimals: 2, currency: " eru " }).currencyCode, "EUR");
  assert.equal(createNumberFormat({ type: "monetary", decimals: 2 }).currencySymbol, undefined);
});

test("locale determines decimal and grouping separators", () => {
  const format = createNumberFormat({ type: "float", decimals: 2, locale: "de-DE" });
  assert.deepEqual(format.parseInput("1.234,50"), { text: "1234,50", value: 1234.5 });
  assert.equal(format.format(1234.5), "1.234,50");
  assert.equal(format.parseInput("1.2.3,50"), null);
});

test("rounding uses decimal formatting rather than binary toFixed rounding", () => {
  const format = createNumberFormat({ type: "monetary", decimals: 2 });
  assert.equal(format.round(1.005), 1.01);
  assert.equal(format.round(-1.005), -1.01);
  assert.equal(format.round(null), null);
});

test("values that cannot retain their declared precision are rejected", () => {
  const format = createNumberFormat({ type: "float", decimals: 20 });
  assert.equal(format.parseInput("9007199254740992"), null);
  assert.equal(format.parseInput("9007199254740990.1"), null);
  assert.equal(format.parseInput("0.12345678901234567890"), null);
  assert.equal(format.parseInput("0.00000000000000000001").value, 1e-20);
});

test("decimal configuration must be an integer between zero and twenty", () => {
  for (const decimals of [-1, 2.5, 21, undefined]) {
    assert.throws(() => createNumberFormat({ type: "float", decimals }), RangeError);
  }
});
