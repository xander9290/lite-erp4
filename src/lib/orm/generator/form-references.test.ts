import assert from "node:assert/strict";
import test from "node:test";
import { Fields, Model } from "../index";
import { defineModule } from "../../modules/define";
import { extendModel } from "../../modules/extend";
import { formReferenceFiles } from "./form-references";

class Item extends Model {
  name = Fields.Text();
  secret = Fields.Text({ sensitive: true });
  folio = Fields.Text({ sequence: { prefix: "X", padding: 3, reset: "none" } });
  state = Fields.Selection([{ value: "draft", label: "PRIVATE_LABEL" }, { value: "done", label: "Hecho" }]);
}
test("generated form references publish scalar types and the owner id, never secrets, defaults or managed fields", () => {
  const declared = defineModule({ id: "items", name: "Items", icon: "list", models: { item: Item } });
  const files = formReferenceFiles(declared.profile.module);
  assert.match(files["ItemsItem.form.ts"], /\("items.item"\)/);
  assert.match(files["ItemsItem.form.ts"], /"state": "draft" \| "done" \| null/);
  assert.doesNotMatch(files["ItemsItem.form.ts"], /secret|folio|PRIVATE_LABEL|server-only/);
  const extra = extendModel(Item, Base => { class Extra extends Base { parentId = Fields.Many2one("ItemsItem"); } return Extra; });
  const extension = defineModule({ id: "more", name: "More", icon: "list", depends: ["items"], models: {}, extends: { "items.item": extra } });
  const source = formReferenceFiles(extension.profile.module)["MoreItemsItem.form.ts"];
  assert.match(source, /\("items.item"\)/);
  assert.match(source, /"parentId": string \| null/);
  assert.match(source, /"name": string/);
  assert.doesNotMatch(source, /recordId|secret|folio/);
});
