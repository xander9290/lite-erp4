import assert from "node:assert/strict";
import { test } from "node:test";
import { slotEntries, insertionDeclarationIssue, type InsertionPosition } from "@/components/ui/form/insertions/resolve";
import { placeCardColumns, placeListColumns, type ColumnEntry } from "./collection-insertions";

let seq = 0;
const entry = (module: string, target: string, position: InsertionPosition, ...fields: string[]): ColumnEntry =>
  ({ key: `${module}-${seq}`, seq: seq++, rev: 1, module, target, position, content: fields.map(field => ({ field, label: field.toUpperCase() })) });
const modules = [{ module: "extra", depends: ["ubicaciones"] }, { module: "crm", depends: ["extra", "ubicaciones"] }, { module: "otro", depends: [] }];
const policy = {
  published: ["name", "email", "phone", "vat", "estadoId", "etapa", "secreto", "nota"],
  extensionFields: { extra: ["vat", "estadoId"], crm: ["etapa"], otro: ["nota"] },
  modules,
};
const base = [{ field: "name" }, { field: "email" }, { field: "phone" }];
const slotsOf = (entries: ColumnEntry[], targets: string[]) => Object.fromEntries(targets.map(target => [target, slotEntries(entries, modules, target).slot]));

test("collection targets: column before/after/replace, columns:end inside, card zones", () => {
  assert.equal(insertionDeclarationIssue("column:email", "after"), undefined);
  assert.match(insertionDeclarationIssue("column:email", "inside")!, /no admite/);
  assert.equal(insertionDeclarationIssue("columns:end", "inside"), undefined);
  assert.match(insertionDeclarationIssue("columns:start", "inside")!, /columns:end/);
  assert.equal(insertionDeclarationIssue("card:body", "inside"), undefined);
  assert.match(insertionDeclarationIssue("card:header", "inside")!, /card:title, card:body, card:footer/);
  assert.match(insertionDeclarationIssue("card:body", "replace")!, /no admite/);
});

test("list: positions, dependency order, end and fallback columns", () => {
  const entries = [entry("crm", "column:email", "after", "etapa"), entry("extra", "column:email", "after", "vat"), entry("extra", "columns:end", "inside", "estadoId")];
  const targets = [...base.map(column => `column:${column.field}`), "columns:end"];
  const { columns, issues } = placeListColumns(base, slotsOf(entries, targets), [entry("otro", "column:telefono", "after", "nota")], policy);
  assert.deepEqual(columns.map(column => column.field), ["name", "email", "vat", "etapa", "phone", "estadoId", "nota"]);
  assert.equal(columns.find(column => column.field === "vat")?.label, "VAT");
  assert.deepEqual(issues, []);
});

test("list: replace re-presents a base column; fields outside the extension or unpublished are rejected", () => {
  const entries = [entry("extra", "column:phone", "replace", "phone"), entry("otro", "column:name", "after", "vat", "secreto"), entry("crm", "column:name", "before", "nombre")];
  const { columns, issues } = placeListColumns(base, slotsOf(entries, base.map(column => `column:${column.field}`)), [], policy);
  assert.deepEqual(columns.map(column => column.field), ["name", "email", "phone"]);
  assert.equal(columns[2].label, "PHONE");
  assert.ok(issues.some(issue => /otro: vat no pertenece/.test(issue)));
  assert.ok(issues.some(issue => /otro: secreto no pertenece/.test(issue)));
  assert.ok(issues.some(issue => /crm: nombre no está publicado/.test(issue)));
});

test("list: duplicates are skipped and the 12-column limit drops columns of the last modules", () => {
  const dup = placeListColumns(base, slotsOf([entry("extra", "column:name", "after", "vat"), entry("crm", "columns:end", "inside", "etapa")], ["column:name", "columns:end"]), [entry("extra", "column:x", "after", "vat")], policy);
  assert.deepEqual(dup.columns.map(column => column.field), ["name", "vat", "email", "phone", "etapa"]);
  assert.match(dup.issues[0], /vat ya está en la lista/);
  const limited = placeListColumns(base, slotsOf([entry("extra", "columns:end", "inside", "vat", "estadoId"), entry("crm", "columns:end", "inside", "etapa")], ["columns:end"]), [], policy, 4);
  assert.deepEqual(limited.columns.map(column => column.field), ["name", "email", "phone", "vat"]);
  assert.deepEqual(limited.issues, ["crm: se omite la columna etapa; la lista admite 4 columnas.", "extra: se omite la columna estadoId; la lista admite 4 columnas."]);
});

test("card: rows by zone and position, fallback at the end of the body", () => {
  const entries = [entry("extra", "card:title", "after", "vat"), entry("extra", "card:body", "inside", "estadoId"), entry("crm", "card:footer", "inside", "etapa"), entry("crm", "card:body", "before", "secreto")];
  const { cards, issues } = placeCardColumns(slotsOf(entries, ["card:title", "card:body", "card:footer"]), [entry("otro", "column:x", "after", "nota")], policy);
  assert.deepEqual(cards.title.after.map(column => column.field), ["vat"]);
  assert.deepEqual(cards.body.inside.map(column => column.field), ["estadoId", "nota"]);
  assert.deepEqual(cards.footer.inside.map(column => column.field), ["etapa"]);
  assert.deepEqual(cards.body.before, []);
  assert.match(issues[0], /crm: secreto no pertenece/);
});
