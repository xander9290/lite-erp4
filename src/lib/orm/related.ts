import "server-only";

/** A fixed server projection only; never publish relation objects to the browser. */
export function relatedValues(record: unknown, outputs: Readonly<Record<string, string>>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(outputs).map(([name, path]) => {
    let value: unknown = record;
    for (const part of path.split(".")) {
      value = value && typeof value === "object" && Object.hasOwn(value, part)
        ? (value as Record<string, unknown>)[part] : null;
    }
    return [name, value instanceof Date ? value.toISOString() : value ?? null];
  }));
}
