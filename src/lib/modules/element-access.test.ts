import assert from "node:assert/strict";
import test from "node:test";
import { Fields, Model, depends, type ReactionValues } from "../orm";
import { defineModule } from "./define";
import { projectElementAccess } from "./element-access";
import core from "../core/manifest";

class Target extends Model { name = Fields.Text({ required: true }); code = Fields.Text(); sourceId = Fields.Many2one("PoliciesSource", { required: true, onDelete: "Restrict" }); }
class Source extends Model {
  name = Fields.Text({ required: true });
  targetId = Fields.Many2one("PoliciesTarget");
  rows = Fields.One2many("PoliciesTarget", { inverse: "sourceId" });
  targetName = Fields.Text({ related: "targetId.name" });
  amount = Fields.Integer();
  doubled = Fields.Integer({ compute: "double" });
  @depends("amount") double(values: ReactionValues) { return Number(values.amount) * 2; }
}
const definition = defineModule({ id: "policies", name: "Policies", icon: "boxes", models: { source: Source, target: Target } });
const blocked = { noRead: true, noWrite: true, invisible: false, readOnly: false };

test("creator presentation follows User profile restrictions without a Partner model", () => {
  const entries = [...definition.models, ...core.models];
  const policy = projectElementAccess(definition.models[0], { fieldAccess: {}, blockedActions: {} }, entries);
  assert.equal(policy.canRead(["createBy", "createByUser.name", "createByUser.avatarUrl"]), true);
  const restricted = projectElementAccess(definition.models[0], { fieldAccess: { "core.user": { name: blocked } }, blockedActions: {} }, entries);
  assert.equal(restricted.canRead(["createBy", "createByUser.name"]), false);
  assert.equal(restricted.canRead(["createByUser.login"]), true);
});

test("related and computed dependencies propagate no-read without hiding unrelated readable routes", () => {
  const policy = projectElementAccess(definition.models[0], { fieldAccess: { "policies.target": { name: blocked }, "policies.source": { amount: blocked } }, blockedActions: {} }, definition.models);
  assert.equal(policy.canRead(["target.name"]), false);
  assert.equal(policy.canRead(["target.code"]), true);
  assert.equal(policy.fields.targetName.noRead, true);
  assert.equal(policy.fields.doubled.noRead, true);
  assert.equal(policy.canRead(["name"]), true);
});

test("private child snapshots protect parent actions without hiding the parent's public fields", () => {
  const policy = projectElementAccess(definition.models[0], { fieldAccess: { "policies.target": { code: blocked } }, blockedActions: {} }, definition.models);
  assert.equal(policy.privateDocument, true);
  assert.equal(policy.fields.name?.noRead, undefined);
  assert.equal(policy.canRead(["name"]), true);
});
