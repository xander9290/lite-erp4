"use client";

import { useMemo } from "react";
import ModelCollection from "@/components/modules/ModelCollection";
import { Fields } from "@/lib/orm/fields";
import type { ModelClientConfig } from "@/lib/modules/config";
import type { CollectionSource } from "@/lib/modules/collection";
import type { ListFilter, ListRecord, ListState } from "@/lib/list/types";
import type { Many2OneLoader } from "@/lib/many2one/model-lookup";
import { many2manyFilterIds } from "@/lib/list/filters";

/** Fictitious contacts with tags; filtering is simulated in memory like the server does. */
const tags = [{ value: "t-urgente", label: "Urgente" }, { value: "t-vip", label: "VIP" }, { value: "t-proveedor", label: "Proveedor" }, { value: "t-cliente", label: "Cliente" }, { value: "t-moroso", label: "Moroso" }];
const label = new Map(tags.map(tag => [tag.value, tag.label]));
const fields = { name: Fields.Text({ label: "Contacto", required: true }), email: Fields.Text({ label: "Correo" }) };
const config: ModelClientConfig = {
  capabilities: { read: true, create: false, write: false, unlink: false, move: false },
  id: "sample.tags", module: "sample", moduleName: "Ejemplos", key: "tags", name: "TagsDemo", label: "Contactos con etiquetas", route: "/sample",
  fields: Object.fromEntries(Object.entries(fields).map(([name, field]) => [name, field.metadata])), preview: {}, related: [], reactionRules: [], lookups: { tagIds: "sample.tag" }, actions: [],
  many2many: { tagIds: { target: "SampleTag", label: "Etiquetas", minSelected: 0, maxSelected: 20 } },
  list: { fields: ["name", "email"], searchFields: ["name", "email"], sortable: ["name"], filterable: ["name", "email"], groupable: [] },
  view: "list", collectionViews: ["list", "card"], defaultSort: { field: "name", direction: "asc" },
};
const names = ["Ana López", "Luis Pérez", "Marta Ruiz", "Comercial del Sur", "Clínica Central", "Estudio Norte", "Jorge Díaz", "Sofía Ramos"];
const rows: ListRecord[] = names.map((name, index) => ({ id: `c${index}`, name, email: `${name.split(" ")[0].toLowerCase()}@ejemplo.mx`, tagIds: tags.filter((_, tag) => (index + tag) % 3 === 0).slice(0, 1 + (index % 4)).map(tag => tag.value), revision: "2026-11-20T00:00:00.000Z" }));
const matches = (row: ListRecord, filter: ListFilter) => {
  const linked = (row.tagIds as string[]) ?? [];
  if (filter.field !== "tagIds") return String(row[filter.field] ?? "").toLowerCase().includes((filter.value ?? "").toLowerCase());
  const ids = many2manyFilterIds(filter.value);
  return filter.operator === "any" ? ids.some(id => linked.includes(id)) : filter.operator === "all" ? ids.every(id => linked.includes(id)) : filter.operator === "empty" ? !linked.length : linked.length > 0;
};
const lookup: Many2OneLoader = async request => {
  const found = tags.filter(tag => request.ids ? request.ids.includes(tag.value) : request.id ? tag.value === request.id : tag.label.toLowerCase().includes((request.query ?? "").toLowerCase()));
  const page = request.page ?? 1, pageSize = request.ids?.length ?? request.pageSize ?? 5;
  return { ok: true, items: found.slice((page - 1) * pageSize, page * pageSize).map(tag => ({ ...tag, record: { id: tag.value } })), total: found.length, page, pageSize };
};

export default function TagCollectionSample() {
  const source = useMemo<CollectionSource>(() => ({
    filterLookups: { tagIds: lookup },
    load: async (state: ListState) => {
      const filtered = rows.filter(row => (!state.query || String(row.name).toLowerCase().includes(state.query.toLowerCase())) && state.filters.every(filter => matches(row, filter)));
      const start = (state.page - 1) * state.pageSize;
      return { ok: true, data: { rows: filtered.slice(start, start + state.pageSize).map(row => ({ ...row, $labels: { tagIds: (row.tagIds as string[]).map(value => ({ value, label: label.get(value)! })) } })), total: filtered.length, page: state.page, pageSize: state.pageSize } };
    },
  }), []);
  return <section id="tag-collections" aria-labelledby="tag-collections-title" className="min-w-0 scroll-mt-6 space-y-4">
    <h2 id="tag-collections-title" className="text-xl font-semibold">Etiquetas en colecciones</h2>
    <p className="text-sm text-base-content/65">Datos ficticios en memoria. La columna Etiquetas (Many2many) muestra chips y se filtra con «tiene alguna de», «tiene todas», sin o con etiquetas. No se ordena ni agrupa.</p>
    <div className="flex h-[30rem] min-w-0 flex-col overflow-hidden rounded-xl border border-base-300">
      <ModelCollection config={config} source={source} columns={[{ field: "name" }, { field: "email" }, { field: "tagIds" }]} paramPrefix="tags" pageSize={8} create={false} open={false} delete={false} movable={false} />
    </div>
  </section>;
}
