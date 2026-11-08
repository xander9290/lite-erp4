import { listModels, type ListViewConfig, type ListModel, type ListFilter, type ListState } from "./types";
import { isListFilterShape } from "./filters";

function readFilters(value: unknown): { filters: ListFilter[]; invalidFilters?: boolean } {
  if (value == null || value === "") return { filters: [] };
  try {
    const parsed = typeof value === "string" && value.length <= 6000 ? JSON.parse(value) : value;
    if (!Array.isArray(parsed) || parsed.length > 12 || !parsed.every(isListFilterShape)) throw new Error();
    return { filters: parsed };
  } catch { return { filters: [], invalidFilters: true }; }
}

function boundedInteger(value: unknown, fallback: number, maximum: number) {
  const parsed = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

/** URL parameters are untrusted. Normalize them against the configured visible columns. */
export function normalizeListState(config: ListViewConfig, input: Record<string, unknown>, defaultPageSize = 25): ListState {
  const sortable = config.columns.filter(column => column.sortable).map(column => column.field);
  const modelSort = Object.hasOwn(listModels, config.model) ? listModels[config.model as ListModel].defaultSort : "id";
  const fallbackSort = config.defaultSort?.field ?? (sortable.includes(modelSort) ? modelSort : sortable[0]) ?? "id";
  return {
    query: typeof input.query === "string" ? input.query.slice(0, 120).trim() : "",
    page: boundedInteger(input.page, 1, Number.MAX_SAFE_INTEGER),
    pageSize: boundedInteger(input.pageSize, boundedInteger(defaultPageSize, 25, 50), 50),
    sort: typeof input.sort === "string" && sortable.includes(input.sort) ? input.sort : fallbackSort,
    direction: input.direction === "asc" || input.direction === "desc" ? input.direction : config.defaultSort?.direction ?? "asc",
    ...readFilters(input.filters),
  };
}

const parameterNames = { query: "q", page: "page", pageSize: "size", sort: "sort", direction: "dir", filters: "filters" } as const;
export function listParameter(key: keyof typeof parameterNames, prefix = "") { return prefix ? `${prefix}_${parameterNames[key]}` : parameterNames[key]; }

export function readListState(config: ListViewConfig, params: Pick<URLSearchParams, "get">, defaultPageSize = 25, prefix = "") {
  return normalizeListState(config, Object.fromEntries(Object.keys(parameterNames).map(key => [key, params.get(listParameter(key as keyof typeof parameterNames, prefix))])), defaultPageSize);
}

/** Preserve unrelated parameters; changing a search, order or size always starts on page one. */
export function patchListParams(current: string, patch: Partial<ListState>, prefix = "") {
  const params = new URLSearchParams(current);
  if (["query", "sort", "direction", "pageSize", "filters"].some(key => Object.hasOwn(patch, key))) params.delete(listParameter("page", prefix));
  for (const [key, value] of Object.entries(patch)) {
    if (key === "invalidFilters") continue;
    const name = listParameter(key as keyof typeof parameterNames, prefix);
    if (value === "" || (key === "page" && value === 1) || (key === "filters" && Array.isArray(value) && !value.length)) params.delete(name);
    else params.set(name, key === "filters" ? JSON.stringify(value) : String(value));
  }
  return params.toString();
}
