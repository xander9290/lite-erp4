export type FieldNumberType = "integer" | "float" | "monetary";

type NumberFormatOptions = {
  type: FieldNumberType;
  decimals?: number;
  currency?: string;
  locale?: string;
  allowNegative?: boolean;
};

export type ParsedNumber = { text: string; value: number | null };

function canonicalDecimal(text: string) {
  const negative = text.startsWith("-");
  const [integer, fraction = ""] = (negative ? text.slice(1) : text).split(".");
  const whole = integer.replace(/^0+/, "") || "0";
  const digits = fraction.replace(/0+$/, "");
  const sign = negative && (whole !== "0" || digits) ? "-" : "";
  return `${sign}${whole}${digits ? `.${digits}` : ""}`;
}

export function createNumberFormat({
  type,
  decimals,
  currency,
  locale = "es-MX",
  allowNegative = false,
}: NumberFormatOptions) {
  const precision = type === "integer" ? 0 : (decimals ?? Number.NaN);
  if (!Number.isInteger(precision) || precision < 0 || precision > 20) {
    throw new RangeError("decimals debe ser un entero entre 0 y 20 para float y monetary.");
  }

  const options = { numberingSystem: "latn", maximumFractionDigits: precision };
  const displayFormatter = new Intl.NumberFormat(locale, { ...options, minimumFractionDigits: precision });
  const editFormatter = new Intl.NumberFormat(locale, { ...options, useGrouping: false });
  const rawFormatter = new Intl.NumberFormat("en-US", { ...options, useGrouping: false });
  const integerFormatter = new Intl.NumberFormat(locale, { numberingSystem: "latn", maximumFractionDigits: 0 });
  const parts = new Intl.NumberFormat(locale, { numberingSystem: "latn" }).formatToParts(-12345.6);
  const decimalSeparator = parts.find((part) => part.type === "decimal")?.value ?? ".";
  const groupSeparator = parts.find((part) => part.type === "group")?.value;
  const minusSign = parts.find((part) => part.type === "minusSign")?.value ?? "-";

  let currencyCode = type === "monetary" ? currency?.trim().toUpperCase() : undefined;
  if (currencyCode === "ERU") currencyCode = "EUR";
  const currencySymbol = currencyCode
    ? new Intl.NumberFormat(locale, { style: "currency", currency: currencyCode, currencyDisplay: "narrowSymbol" })
        .formatToParts(0).find((part) => part.type === "currency")?.value
    : undefined;

  function parseInput(input: string): ParsedNumber | null {
    let text = input.trim();
    if (minusSign !== "-" && text.startsWith(minusSign)) text = `-${text.slice(minusSign.length)}`;
    const negative = text.startsWith("-");
    if (negative && !allowNegative) return null;

    const unsigned = negative ? text.slice(1) : text;
    const pieces = unsigned.split(decimalSeparator);
    if (pieces.length > 2 || (precision === 0 && pieces.length > 1)) return null;
    let integer = pieces[0];
    const fraction = pieces[1];

    if (groupSeparator && integer.includes(groupSeparator)) {
      const digits = integer.split(groupSeparator).join("");
      if (!/^\d+$/.test(digits) || !Number.isSafeInteger(Number(digits))) return null;
      if (integerFormatter.format(Number(digits)) !== integer) return null;
      integer = digits;
    }

    if (!/^\d*$/.test(integer) || (fraction !== undefined && (!/^\d*$/.test(fraction) || fraction.length > precision))) return null;
    const normalized = `${negative ? "-" : ""}${integer}${fraction !== undefined ? `.${fraction}` : ""}`;
    const editable = `${negative ? "-" : ""}${integer}${fraction !== undefined ? `${decimalSeparator}${fraction}` : ""}`;
    if (!/\d/.test(normalized)) return { text: editable, value: null };

    const number = Number(normalized);
    if (!Number.isFinite(number) || !Number.isSafeInteger(Math.trunc(number))) return null;
    const value = Object.is(number, -0) ? 0 : number;
    if (rawFormatter.format(value) !== canonicalDecimal(normalized)) return null;
    return { text: editable, value };
  }

  return {
    key: JSON.stringify([type, precision, currencyCode, locale, allowNegative]),
    decimals: precision,
    currencyCode,
    currencySymbol,
    parseInput,
    format: (value: number | null) => value === null ? "" : displayFormatter.format(value),
    toInput: (value: number | null) => value === null || value === 0 ? "" : editFormatter.format(value),
    round: (value: number | null) => value === null ? null : Number(rawFormatter.format(value)),
  };
}
