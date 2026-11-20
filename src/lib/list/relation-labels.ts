import "server-only";
import type { Many2OneLoader } from "../many2one/model-lookup";
import { readListValue, type ListResult } from "./types";

/** Server-fixed, authorized providers. Resolve only this page; never publish lookup records. */
export async function resolveListLabels(result: ListResult, providers: Readonly<Record<string, Many2OneLoader>>): Promise<ListResult> {
  if (!result.ok || (!result.data.rows.length && !result.data.groups?.length)) return result;
  const groupField = result.data.groupField;
  if (!result.data.rows.length && (!groupField || !Object.hasOwn(providers, groupField))) return result;
  try {
    const entries = Object.entries(providers);
    // Up to 12 published Many2one columns + creator + 4 Many2many.
    if (entries.length > 17 || entries.some(([field]) => !/^[a-z][A-Za-z0-9]*$/.test(field))) throw new Error("Invalid relation configuration");
    const labels = new Map<string, Map<string, string>>();
    await Promise.all(entries.map(async ([field, load]) => {
      // Many2many rows carry arrays of IDs.
      const values = [...result.data.rows.flatMap(row => { const value = readListValue(row, field); return Array.isArray(value) ? value : [value]; }), ...(field === groupField ? result.data.groups?.map(group => group.value) ?? [] : [])];
      const ids = [...new Set(values.filter((value): value is string => typeof value === "string" && !!value))];
      const names = new Map<string, string>();
      for (let offset = 0; offset < ids.length; offset += 100) {
        const batch = ids.slice(offset, offset + 100), requested = new Set(batch);
        const response = await load({ ids: batch });
        if (!response.ok) throw new Error("Lookup unavailable");
        for (const item of response.items) if (requested.has(item.value) && typeof item.label === "string") names.set(item.value, item.label);
      }
      labels.set(field, names);
    }));
    const groups = groupField && labels.has(groupField) && result.data.groups
      ? { groups: result.data.groups.map(group => ({ ...group, label: typeof group.value === "string" && group.value ? labels.get(groupField)?.get(group.value) || "" : undefined })) }
      : {};
    return { ...result, data: { ...result.data, ...groups, rows: result.data.rows.map(row => ({ ...row,
      $labels: Object.fromEntries(entries.map(([field]) => {
        const id = readListValue(row, field);
        if (Array.isArray(id)) return [field, id.filter((value): value is string => typeof value === "string" && Boolean(labels.get(field)?.get(value))).map(value => ({ value, label: labels.get(field)!.get(value)! }))];
        return [field, typeof id === "string" && id ? { value: id, label: labels.get(field)?.get(id) || "" } : null];
      })),
    })) } };
  } catch { return { ok: false, error: "No se pudieron consultar los nombres de los registros relacionados. Intenta nuevamente." }; }
}
