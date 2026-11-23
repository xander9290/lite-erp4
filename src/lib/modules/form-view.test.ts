import assert from "node:assert/strict";
import test from "node:test";
import { Fields, Model } from "../orm";
import { defineModule } from "./define";
import { extendModel } from "./extend";
import { composeModules } from "./compose";
import { formExtensionContent, resolveFormView } from "./form-view";

const page = async () => ({ default: () => null });
const modal = async () => ({ default: () => null });
const insert = async () => ({ default: () => null });
class Item extends Model { name = Fields.Text(); }
const base = defineModule({ id: "base", name: "Base", icon: "box", models: { item: { model: Item, views: { form: page, modal } } } });
const extra = extendModel(Item, Base => class extends Base { detail = Fields.Text(); });

test("page and modal layouts resolve independently; missing modal keeps the page layout", () => {
  const entry = base.models[0];
  assert.equal(resolveFormView(entry, "form").load, page);
  assert.equal(resolveFormView(entry, "modal").load, modal);
  assert.deepEqual(resolveFormView({ ...entry, views: { form: page } }, "modal"), { kind: "form", load: page });
  assert.deepEqual(resolveFormView({ ...entry, views: {} }, "modal"), { kind: "form", load: undefined });
  assert.deepEqual(entry.collectionViews, ["list"], "modal is never a collection presentation");
  assert.throws(() => defineModule({ id: "bad", name: "Bad", icon: "box", models: { item: { model: Item, views: { modal: true } } } } as never), /registro de vista inválido: modal/);
});

test("a dependent modal override wins without changing the base page or partial extension form", () => {
  const first = defineModule({ id: "extra", name: "Extra", icon: "box", depends: ["base"], models: {}, extends: { "base.item": { model: extra, views: { form: insert, modal: page } } } });
  const second = defineModule({ id: "final", name: "Final", icon: "box", depends: ["extra", "base"], models: {}, extends: { "base.item": { model: extendModel(Item, Base => class extends Base { finalNote = Fields.Text(); }), views: { modal } } } });
  const composed = composeModules([second, base, first]).find(module => module.id === "base")!.models[0];
  assert.equal(resolveFormView(composed, "form").load, page);
  assert.equal(resolveFormView(composed, "modal").load, modal);
  assert.equal(base.models[0].views.modal, modal);
  assert.equal(composed.extensions[0].views?.form, insert);
  const unrelated = defineModule({ id: "other", name: "Other", icon: "box", depends: ["base"], models: {}, extends: { "base.item": { model: extendModel(Item, Base => class extends Base { otherNote = Fields.Text(); }), views: { modal } } } });
  assert.throws(() => composeModules([first, base, unrelated]), /base.item: vistas modal en conflicto entre extra, other/);
});

test("modal insertions are isolated with a dedicated layout and override page content per extension on fallback", () => {
  const extensions = [
    { module: "partial", label: "Partial", fields: ["a"], computed: [], views: { form: page } },
    { module: "inserts", label: "Inserts", fields: ["b"], computed: [], insertions: { form: page } },
    { module: "both", label: "Both", fields: ["c"], computed: [], views: { form: page }, insertions: { modal: insert } },
  ];
  const content = (presentation: "form" | "modal", layout: "form" | "modal") => formExtensionContent(extensions, presentation, layout);
  assert.deepEqual(content("form", "form").map(item => [item.form, item.insertions]), [[page, undefined], [undefined, page], [page, undefined]]);
  assert.deepEqual(content("modal", "form").map(item => [item.form, item.insertions]), [[page, undefined], [undefined, page], [undefined, insert]]);
  assert.deepEqual(content("modal", "modal").map(item => [item.form, item.insertions]), [[undefined, undefined], [undefined, undefined], [undefined, insert]]);
});
