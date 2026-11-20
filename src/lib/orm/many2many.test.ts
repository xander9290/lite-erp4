import assert from "node:assert/strict";
import { test } from "node:test";
import { Fields, Model, constraint, action, type ActionRecord, type FormValues } from "./index";
import { generateModule } from "./generator/generate";
import { many2manyStorage, validateMany2many } from "./many2many";
import { composeModules } from "../modules/compose";
import { defineModule } from "../modules/define";
import { repositoryFiles } from "./generator/bind";

class Task extends Model {
  name = Fields.Text({ required: true });
  tags = Fields.Many2many("DemoTag", { label: "Etiquetas", maxSelected: 3 });
  @constraint("tags") valid(values: Readonly<Record<string, unknown>>) { assert.ok(Object.isFrozen(values.tags)); }
  @action({ label: "Vaciar" }) clear(record: ActionRecord<Task>) { assert.ok(Object.isFrozen(record.tags)); return { tags: [] }; }
}
class Tag extends Model { name = Fields.Text({ required: true }); }
const definition = defineModule({ id: "demo", name: "Demo", icon: "tags", models: { task: Task, tag: Tag } });
const contract = definition.models[0].contract;
const fields = contract.many2manyFields;

test("Many2many distinguishes ID sets from scalar fields and carries typed defaults/actions/constraints", async () => {
  const values: FormValues<typeof Task> = { name: "Task", tags: ["tag"] };
  assert.deepEqual(contract.formSchema.parse(values), values);
  assert.deepEqual(contract.createDefaults(), { name: "", tags: [] });
  assert.ok(!Object.hasOwn(contract.metadata, "tags"));
  assert.ok(!definition.models[0].list.fields.includes("tags"));
  assert.throws(() => contract.schema.parse(values));
  assert.deepEqual(await contract.runAction("clear", { ...values, id: "task", revision: "2026-01-01T00:00:00.000Z" }, {} as never), { tags: [] });
  await contract.constrain(values, {} as never);
  const first = fields.tags.createDefault(); first.push("x"); assert.deepEqual(fields.tags.createDefault(), []);
});

test("Many2many rejects nested writes, duplicate/malformed IDs, unsupported options and bounds", () => {
  for (const value of [null, "id", [{}], ["x", "x"], [""], [" x"], ["a", "b", "c", "d"]]) assert.equal(fields.tags.schema.safeParse(value).success, false);
  for (const options of [{ minSelected: -1 }, { minSelected: 2, maxSelected: 1 }, { maxSelected: 101 }, { maxSelected: 0 }, { tracking: true }, { inverse: "tags" }, { label: "" }]) assert.throws(() => Fields.Many2many("DemoTag", options as never));
  assert.throws(() => Fields.Many2many("bad.id"));
  assert.equal(Fields.Many2many("DemoTag", { minSelected: 1 }).schema.safeParse([]).success, false);
});

test("Many2many checks the complete bounded selection against target access and fails closed", async () => {
  let calls = 0;
  const access = async (target: string, ids: readonly string[]) => { calls++; assert.equal(target, "DemoTag"); return new Set(ids.filter(id => id === "yes")); };
  await validateMany2many({ tags: ["yes"] }, fields, access);
  await assert.rejects(validateMany2many({ tags: ["yes", "hidden"] }, fields, access));
  await assert.rejects(validateMany2many({ tags: ["missing"] }, fields, undefined));
  const before = calls;
  await assert.rejects(validateMany2many({ tags: ["yes", "yes"] }, fields, access));
  assert.equal(calls, before);
  await validateMany2many({ tags: [] }, fields, access);
});

test("Many2many emits owned explicit junctions, composite PK, reverse index and safe deletion policies", () => {
  const schema = 'datasource db {\n provider = "postgresql"\n}\nmodel User {\n id String @id\n}\n';
  const result = generateModule(definition.profile.module, { schema, owners: {} });
  assert.match(result["models.prisma"], /model DemoTaskTagsLink/);
  assert.match(result["models.prisma"], /@@id\(\[sourceId, targetId\]\)/);
  assert.match(result["models.prisma"], /source DemoTask .*onDelete: Cascade/);
  assert.match(result["models.prisma"], /target DemoTag .*onDelete: Restrict/);
  assert.match(result["models.prisma"], /@@index\(\[targetId\]\)/);
  assert.match(result["DemoTask.schema.ts"], /tags: Fields.Many2many/);
  assert.equal(many2manyStorage(contract, "tags").table, "demo_task_tags_rel");
  assert.throws(() => repositoryFiles(definition.profile.module), /declarativos/);
});

test("Many2many requires registered declarative targets and direct module dependencies", () => {
  assert.equal(composeModules([definition]).length, 1);
  const owner = defineModule({ id: "other", name: "Other", icon: "tags", models: { task: Task } });
  assert.throws(() => composeModules([owner]), /destino/);
  assert.throws(() => composeModules([owner, definition]), /depends/);
  assert.equal(composeModules([defineModule({ id: "other", name: "Other", icon: "tags", depends: ["demo"], models: { task: Task } }), definition]).length, 2);
});

test("Many2many handles self relations, external ownership and alias collisions deterministically", () => {
  class Node extends Model { name = Fields.Text(); peers = Fields.Many2many("SelfNode"); }
  const own = defineModule({ id: "self", name: "Self", icon: "tags", models: { node: Node } });
  const schema = 'datasource db {\n provider = "postgresql"\n}\nmodel User {\n id String @id\n}\n';
  const self = generateModule(own.profile.module, { schema, owners: {} });
  assert.match(self["models.prisma"], /selfNodePeersLinkSourceRecords/);
  assert.match(self["models.prisma"], /selfNodePeersLinkTargetRecords/);
  const external = { ...own.profile.module, models: [{ ...own.profile.module.models[0], model: { ...own.models[0].contract, name: "OtherNode", table: "other_node" } }] };
  const source = `${schema}\nmodel SelfNode {\n id String @id\n}\n`;
  assert.throws(() => generateModule(external, { schema: source, owners: { SelfNode: "base" } }), /dependencia/);
  const result = generateModule({ ...external, depends: ["base"] }, { schema: source, owners: { SelfNode: "base" } });
  const review = JSON.parse(result["review.json"]);
  assert.ok(review.relations.some((relation: { target: string; owner: string }) => relation.target === "SelfNode" && relation.owner === "base"));
  class Conflict extends Model { name = Fields.Text(); tagsId = Fields.Many2one("DemoTag"); tags = Fields.Many2many("DemoTag"); }
  const bad = defineModule({ id: "demo", name: "Demo", icon: "tags", models: { task: Conflict, tag: Tag } });
  assert.throws(() => generateModule(bad.profile.module, { schema, owners: {} }), /conflicto/);
});

test("Many2many create: option metadata, composition rules for the target and per-actor projection", async () => {
  const declared = Fields.Many2many("DemoTag", { label: "Etiquetas", create: true });
  assert.equal(declared.many2many.create, true);
  assert.equal(Fields.Many2many("DemoTag").many2many.create, undefined);
  assert.throws(() => Fields.Many2many("DemoTag", { create: "si" as never }), /create debe ser true o false/);
  assert.throws(() => Fields.Many2many("DemoTag", { create: true, domain: d => d.eq("name", "x") }), /no se combina con domain/);

  class Note extends Model { name = Fields.Text({ required: true }); tags = Fields.Many2many("QuickTag", { create: true }); }
  class Tag extends Model { name = Fields.Text({ required: true, maxLength: 40 }); active = Fields.Boolean({ default: true }); }
  assert.doesNotThrow(() => composeModules([defineModule({ id: "quick", name: "Quick", icon: "tags", models: { note: Note, tag: Tag } })]));
  class Coded extends Model { name = Fields.Text({ required: true }); code = Fields.Text({ required: true }); }
  assert.throws(() => composeModules([defineModule({ id: "quick", name: "Quick", icon: "tags", models: { note: Note, tag: Coded } })]), /obligatorios sin default: code/);
  class Unnamed extends Model { title = Fields.Text({ required: true }); }
  assert.throws(() => composeModules([defineModule({ id: "quick", name: "Quick", icon: "tags", models: { note: Note, tag: Unnamed } })]), /campo Text «name» editable/);

  // Projection: «Crear» reaches the browser only for actors who may create the target.
  const { projectModelAccess } = await import("../modules/access");
  const config = { id: "quick.note", lookups: { tags: "quick.tag" }, many2many: { tags: { target: "QuickTag", minSelected: 0, maxSelected: 100, create: true } } } as never;
  const access = (create: boolean) => ({ isAdmin: false, groups: new Set<string>(), modelAccess: { "quick.note": { read: true, write: true, create: true, unlink: false }, "quick.tag": { read: true, write: false, create, unlink: false } } });
  assert.equal((projectModelAccess(config, access(true), []) as { many2many: Record<string, { create?: boolean }> }).many2many.tags.create, true);
  assert.equal((projectModelAccess(config, access(false), []) as { many2many: Record<string, { create?: boolean }> }).many2many.tags.create, undefined);
});
