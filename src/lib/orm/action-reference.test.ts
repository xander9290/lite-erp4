import assert from "node:assert/strict";
import test from "node:test";
import { actionReferenceName, defineActionReferences, type ModelActionReference } from "./action-reference";

test("references preserve literal keys, model scope and a serializable immutable shape", () => {
  const actions = defineActionReferences("TestOrder", ["confirmar", "cancelar"]);
  assert.deepEqual(JSON.parse(JSON.stringify(actions.confirmar)), { model: "TestOrder", name: "confirmar" });
  assert.ok(Object.isFrozen(actions)); assert.ok(Object.isFrozen(actions.confirmar));
  assert.equal(actionReferenceName(actions.confirmar, "TestOrder"), "confirmar");
  assert.equal(actionReferenceName(actions.confirmar, "OtherOrder"), null);
  assert.equal(actionReferenceName(actions.confirmar, undefined), null);
  for (const value of [null, "confirmar", {}, { model: "TestOrder", name: "bad-name" }]) assert.equal(actionReferenceName(value as ModelActionReference, "TestOrder"), null);
});

test("action contracts reject invalid scopes, duplicate names and prototype keys", () => {
  for (const names of [["a", "a"], ["constructor"], ["__proto__"], ["prototype"], ["bad-name"]]) assert.throws(() => defineActionReferences("Example", names));
  assert.throws(() => defineActionReferences("wrong.scope", ["confirmar"]));
  assert.deepEqual(defineActionReferences("Example", []), {});
});
