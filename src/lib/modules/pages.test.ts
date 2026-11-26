import assert from "node:assert/strict";
import { test } from "node:test";
import type { Prisma } from "@/generated/prisma/client";
import { Fields, Model } from "../orm";
import { defineModule } from "./define";
import { extendModel } from "./extend";
import { composeModules } from "./compose";
import { compilePages, hiddenPagesFor, type HiddenPage } from "./pages";
import { loadHiddenPages } from "../access/page-policy.server";

class Ficha extends Model {
  name = Fields.Text({ label: "Nombre", required: true, maxLength: 80 });
}
const form = () => Promise.resolve({ default: () => null });
const pages = { extra: { ventas: "Ventas", compras: "Compras" } };
const spec = (options: object) => ({ id: "pruebas", name: "Pruebas", icon: "flask-conical", models: { ficha: { model: Ficha, ...options } } });

test("the pages catalog compiles from the manifest and rejects invalid declarations", () => {
  const model = defineModule(spec({ pages })).models[0];
  assert.deepEqual(model.pages.map(page => [page.notebook, page.page, page.label, page.module]), [["extra", "ventas", "Ventas", "pruebas"], ["extra", "compras", "Compras", "pruebas"]]);
  assert.deepEqual(defineModule(spec({})).models[0].pages, []);
  for (const invalid of [[], { extra: {} }, { "1x": { a: "A" } }, { extra: { "mal nombre": "A" } }, { extra: { a: "" } }, { extra: { a: 3 } }, Object.fromEntries(Array.from({ length: 9 }, (_, index) => [`n${index}`, { a: "A" }]))])
    assert.throws(() => defineModule(spec({ pages: invalid })), /pages/, JSON.stringify(invalid));
  assert.throws(() => compilePages("x", "otro", { extra: { ventas: "Otra" } }, compilePages("x", "pruebas", pages)), /ya la declara pruebas/);
});

test("extensions add pages to the base catalog and cannot redeclare its pages", () => {
  const base = defineModule({ ...spec({ pages, views: { form } }) });
  const Extra = extendModel(Ficha, Base => { class FichaExtra extends Base { nota = Fields.Text({ label: "Nota", maxLength: 40 }); } return FichaExtra; });
  const extending = (extraPages: Record<string, Record<string, string>>) => defineModule({ id: "extra", name: "Extra", icon: "plus", depends: ["pruebas"], models: {}, extends: { "pruebas.ficha": { model: Extra, pages: extraPages } } });
  const composed = composeModules([base, extending({ extra: { notas: "Notas" } })]);
  assert.deepEqual(composed[0].models[0].pages.map(page => `${page.module}:${page.notebook}/${page.page}`), ["pruebas:extra/ventas", "pruebas:extra/compras", "extra:extra/notas"]);
  assert.throws(() => composeModules([base, extending({ extra: { ventas: "Otra" } })]), /ya la declara pruebas/);
  assert.throws(() => extending({ extra: { a: "" } }), /etiqueta/);
});

test("hidden pages are projected per screen and layout, only for declared pages", () => {
  const catalog = compilePages("pruebas.ficha", "pruebas", pages);
  const hidden: HiddenPage[] = [
    { model: "pruebas.ficha", screen: "default", layout: "form", notebook: "extra", page: "ventas" },
    { model: "pruebas.ficha", screen: "default", layout: "form", notebook: "extra", page: "ventas" },
    { model: "pruebas.ficha", screen: "default", layout: "modal", notebook: "extra", page: "compras" },
    { model: "pruebas.ficha", screen: "otra", layout: "form", notebook: "extra", page: "compras" },
    { model: "pruebas.ficha", screen: "default", layout: "form", notebook: "extra", page: "retirada" },
    { model: "pruebas.otro", screen: "default", layout: "form", notebook: "extra", page: "compras" },
  ];
  assert.deepEqual(hiddenPagesFor("pruebas.ficha", catalog, "default", hidden), { declared: ["extra/ventas", "extra/compras"], form: ["extra/ventas"], modal: ["extra/compras"] });
  assert.deepEqual(hiddenPagesFor("pruebas.ficha", catalog, "otra", hidden).form, ["extra/compras"]);
  assert.deepEqual(hiddenPagesFor("pruebas.ficha", catalog, "default", undefined), { declared: ["extra/ventas", "extra/compras"], form: [], modal: [] });
});

test("page policies query effective groups only and ignore rows of another module", async () => {
  const queries: unknown[] = [];
  const tx = { accessPageHidden: { findMany: async (args: unknown) => { queries.push(args); return [
    { groupId: "pruebas.lector", model: "pruebas.ficha", screen: "default", layout: "form", notebook: "extra", page: "ventas" },
    { groupId: "otro.rol", model: "pruebas.ficha", screen: "default", layout: "form", notebook: "extra", page: "compras" },
  ]; } } } as unknown as Prisma.TransactionClient;
  assert.deepEqual(await loadHiddenPages(tx, new Set()), []);
  assert.deepEqual(queries, []);
  assert.deepEqual(await loadHiddenPages(tx, new Set(["pruebas.lector", "otro.rol"])), [{ model: "pruebas.ficha", screen: "default", layout: "form", notebook: "extra", page: "ventas" }]);
  assert.equal(queries.length, 1);
});
