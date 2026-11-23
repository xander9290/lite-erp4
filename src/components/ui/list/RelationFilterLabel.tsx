"use client";
import type { Many2OneLoader } from "@/lib/many2one/model-lookup";
import type { ListFilter } from "@/lib/list/types";
import { filterOperatorLabels, many2manyFilterIds } from "@/lib/list/filters";
import { useMany2OneSearch } from "../form/useMany2OneSearch";

/** Active-filter chip of a relation: names resolved through the same authorized lookup. */
export default function RelationFilterLabel({ filter, load }: { filter: ListFilter; load: Many2OneLoader }) {
  const single = filter.operator === "eq" || filter.operator === "neq";
  const multiple = filter.operator === "any" || filter.operator === "all";
  const ids = multiple ? many2manyFilterIds(filter.value) : [];
  const one = useMany2OneSearch({ model: "user", searchFields: [], displayName: "{id}", id: filter.value, pageSize: 1 }, single && Boolean(filter.value), 0, load);
  const many = useMany2OneSearch({ model: "user", searchFields: [], displayName: "{id}", ids, pageSize: Math.max(1, Math.min(25, ids.length)) }, multiple && ids.length > 0, 0, load);
  const names = multiple ? ids.map(id => many.data?.items.find(item => item.value === id)?.label ?? "Registro").join(", ") : "";
  return <>{filterOperatorLabels[filter.operator]}{single ? `: ${one.data?.items.find(item => item.value === filter.value)?.label ?? "Registro seleccionado"}` : multiple ? `: ${names}` : ""}</>;
}
