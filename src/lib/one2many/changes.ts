export type RelationId = string | number;
export type RelationRow = { id?: RelationId };
export type One2manyChanges<T extends RelationRow> = {
  create: { index: number; values: T }[];
  update: { index: number; id: RelationId; values: T }[];
  deleteIds: RelationId[];
};

function idKey(id: unknown) {
  if (typeof id === "string" && id.trim()) return `string:${id}`;
  if (typeof id === "number" && Number.isSafeInteger(id)) return `number:${id}`;
  throw new Error("El ID de una línea no es válido.");
}

/** owned must be the complete, authorized collection read by the server, never a client snapshot or a paginated subset. */
export function planOne2manyChanges<T extends RelationRow>(owned: readonly { id: RelationId }[], submitted: readonly T[]): One2manyChanges<T> {
  const allowed = new Map<string, RelationId>();
  for (const row of owned) {
    const key = idKey(row.id);
    if (allowed.has(key)) throw new Error("El conjunto de líneas existentes contiene IDs duplicados.");
    allowed.set(key, row.id);
  }
  const seen = new Set<string>();
  const create: One2manyChanges<T>["create"] = [], update: One2manyChanges<T>["update"] = [];
  submitted.forEach((row, index) => {
    if (row.id === undefined) { create.push({ index, values: row }); return; }
    const key = idKey(row.id);
    if (!allowed.has(key)) throw new Error("Una línea no pertenece al documento o ya no está disponible.");
    if (seen.has(key)) throw new Error("La misma línea aparece más de una vez.");
    seen.add(key); update.push({ index, id: row.id, values: row });
  });
  return { create, update, deleteIds: [...allowed].filter(([key]) => !seen.has(key)).map(([, id]) => id) };
}
