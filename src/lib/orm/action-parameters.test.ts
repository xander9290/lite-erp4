import assert from "node:assert/strict";
import { test } from "node:test";
import { Fields, Model, action, defineModel, ActionParameterError, type ActionParams, type ActionContext, type ActionRecord } from "./index";
import { compileActionParameters, parseActionParameters } from "./action-parameters";
import { defineModule } from "../modules/define";
import { composeModules } from "../modules/compose";
import { unavailableEnvironment } from "../orm/environment";
const closeParams = { nota: Fields.Text({ required: true, maxLength: 2000 }), cantidad: Fields.Integer({ required: true, min: 1, default: 1 }) };
class Ticket extends Model {
  name = Fields.Text({ required: true });
  @action({ label: "Cerrar", params: closeParams }) cerrar(record: ActionRecord<Ticket>, params: ActionParams<typeof closeParams>, context: ActionContext) {
    assert.ok(Object.isFrozen(record)); assert.ok(Object.isFrozen(params)); assert.ok(Object.isFrozen(context)); assert.equal(context.actor.id, "actor");
    return { name: `${params.nota}:${params.cantidad}` };
  }
  @action({ label: "Legacy" }) legacy(_record: ActionRecord<Ticket>, context: ActionContext) { return { name: context.actor.id }; }
}
const contract = defineModel(Ticket, { name: "DemoTicket", table: "demo_ticket" });
const context = { tx: {} as never, actor: { id: "actor", sessionVersion: 0 }, action: "cerrar", env: unavailableEnvironment };
const record = { id: "ticket", revision: "2026-01-01T00:00:00.000Z", name: "Ticket" };
test("parameter actions derive public metadata and execute with frozen typed params while retaining the legacy signature", async () => {
  assert.equal(contract.actions[0].params?.nota.kind, "text");
  assert.ok(!JSON.stringify(contract.actions).includes("schema"));
  assert.deepEqual(await contract.runAction("cerrar", record, context, { nota: " Listo " }), { name: "Listo:1" });
  assert.deepEqual(await contract.runAction("legacy", record, context), { name: "actor" });
  await assert.rejects(contract.runAction("legacy", record, context, { nota: "forged" }), ActionParameterError);
  await assert.rejects(contract.runAction("cerrar", record, context, { nota: "", cantidad: 0 }), (e: unknown) => e instanceof ActionParameterError && Boolean(e.parameterErrors?.nota) && Boolean(e.parameterErrors?.cantidad));
  await assert.rejects(contract.runAction("cerrar", record, context, { nota: "x", actor: "forged" }), ActionParameterError);
});
test("parameter contracts reject unsafe declarations, oversized inputs and unsupported relation writes", () => {
  for (const fields of [{}, { id: Fields.Text() }, { root: Fields.Text() }, { payload: Fields.Image({ folder: "test" }) }, { tags: Fields.Many2many("Tag") }, { password: Fields.Text({ sensitive: true }) }, { code: Fields.Text({ sequence: {} }) }, { value: Fields.Text({ default: () => "x" }) }, { name: Fields.Text({ unique: true }) }, { note: Fields.Text({ tracking: true }) }]) assert.throws(() => compileActionParameters(fields as never));
  const compiled = compileActionParameters(closeParams);
  for (const input of [null, [], new Date(), new Map(), "bad", { nota: "x".repeat(17000) }, { nota: 1n }]) assert.throws(() => parseActionParameters(compiled, input), ActionParameterError);
  assert.throws(() => compileActionParameters(Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`field${i}`, Fields.Text()]))));
  let invoked = false;
  assert.throws(() => parseActionParameters(compileActionParameters(closeParams), { nota: "ok", toJSON: () => { invoked = true; return {}; } }), ActionParameterError);
  assert.equal(invoked, false);
  const optional = compileActionParameters({ text: Fields.Text(), active: Fields.Boolean() });
  assert.deepEqual(parseActionParameters(optional, {}), { text: null, active: false });
});
test("parameter Many2one dependencies are registered and parameter actions cannot dispatch through Kanban", () => {
  class Agent extends Model { name = Fields.Text(); }
  class Task extends Model {
    name = Fields.Text();
    state = Fields.Selection([{ value: "a", label: "A" }, { value: "b", label: "B" }], { required: true });
    @action({ label: "Assign", params: { agentId: Fields.Many2one("PeopleAgent", { required: true }) } }) assign() { return { state: "b" }; }
  }
  const people = defineModule({ id: "people", name: "People", icon: "users", models: { agent: Agent } });
  const task = (depends: string[]) => defineModule({ id: "jobs", name: "Jobs", icon: "list", depends, models: { task: Task } });
  assert.throws(() => composeModules([people, task([])]), /depends/);
  assert.equal(composeModules([people, task(["people"])]).length, 2);
  assert.throws(() => defineModule({ id: "jobs", name: "Jobs", icon: "list", models: { task: { model: Task, kanban: { field: "state", transitions: [{ from: "a", to: "b", action: "assign" }] } } } }), /parámetros/);
});
