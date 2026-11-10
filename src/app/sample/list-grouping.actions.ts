"use server";
import { listStateSchema } from "@/lib/list/query";
import { groupedPage, groupingPlan } from "@/lib/list/grouping";
import type { ListRecord, ListResult, ListState } from "@/lib/list/types";
import { groupingSampleColumns } from "./list-grouping.config";

/** Public, fictional fixture. No database, credentials or ERP records. */
export async function loadGroupingSample(input: ListState): Promise<ListResult> {
  try {
    const state = listStateSchema.parse(input);
    if (state.invalidFilters) throw new Error();
    const plan = groupingPlan(groupingSampleColumns, state);
    if (!groupingSampleColumns.some(column => column.field === state.sort)) throw new Error();
    for (const filter of state.filters) {
      if (!["active", "insured", "available"].includes(filter.field) || filter.operator !== "eq" || !["true", "false"].includes(filter.value ?? "")) throw new Error();
    }
    const rows: ListRecord[] = Array.from({ length: 96 }, (_, index) => ({
      id: `group-demo-${index}`, name: `Vehículo ficticio ${String(index + 1).padStart(2, "0")}`,
      active: index % 2 === 0, insured: index % 3 === 0, available: index % 5 === 0,
    })).filter(row => row.name.toString().toLowerCase().includes(state.query.toLowerCase()) &&
      state.filters.every(filter => row[filter.field as keyof typeof row] === (filter.value === "true")) &&
      plan.predicates.every(predicate => Object.entries(predicate).every(([field, value]) => row[field as keyof typeof row] === value)));
    if (plan.field) {
      const groups = [false, true].map(value => ({ value, count: rows.filter(row => row[plan.field!] === value).length })).filter(group => group.count);
      return { ok: true, data: groupedPage(state, rows.length, groups.slice((state.page - 1) * state.pageSize, state.page * state.pageSize + 1)) };
    }
    rows.sort((a, b) => String(a[state.sort]).localeCompare(String(b[state.sort])) * (state.direction === "asc" ? 1 : -1) || a.id.localeCompare(b.id));
    const page = Math.min(state.page, Math.max(1, Math.ceil(rows.length / state.pageSize)));
    return { ok: true, data: { rows: rows.slice((page - 1) * state.pageSize, page * state.pageSize), total: rows.length, page, pageSize: state.pageSize } };
  } catch { return { ok: false, error: "Revisa la agrupación y los filtros del ejemplo." }; }
}
