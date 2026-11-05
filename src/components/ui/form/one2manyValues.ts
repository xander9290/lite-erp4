/** Form rows contain plain data (including Date), never RHF's generated render keys. */
export function sameRowData(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left instanceof Date || right instanceof Date) return left instanceof Date && right instanceof Date && Object.is(left.getTime(), right.getTime());
  if (!left || !right || typeof left !== "object" || typeof right !== "object" || Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left) && Array.isArray(right) && left.length !== right.length) return false;
  const a = left as Record<string, unknown>, b = right as Record<string, unknown>;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && sameRowData(a[key], b[key]));
}

export function rowLimits(minRows = 0, maxRows = 100) {
  const minimum = Number.isFinite(minRows) ? Math.max(0, Math.trunc(minRows)) : 0;
  const maximum = Number.isFinite(maxRows) ? Math.max(minimum, Math.trunc(maxRows)) : Math.max(minimum, 100);
  return { minimum, maximum };
}
