import assert from "node:assert/strict";
import test from "node:test";
import { domainBuilder as d, snapshotDomain, declareRelationDomain, domainDependencies, resolveDomain } from "./domain-builder";
import { compileListDomain, compileRelationDomain, validateRelationDomain, compileCollectionDomain } from "./domain";
import { Fields } from "./fields";
import { defineModule } from "../modules/define";
import { composeModules } from "../modules/compose";
import { Model } from "./model";
import { fieldExpression } from "./generator/generate";
import { fieldFromMetadata } from "../modules/fields";
import type { Prisma } from "@/generated/prisma/client";

const target = { paisId: Fields.Many2one("GeoPais", { required: true }).metadata, active: Fields.Boolean().metadata, secret: Fields.Text({ sensitive: true }).metadata };
const owner = { paisId: Fields.Many2one("GeoPais").metadata, wrong: Fields.Integer().metadata, hidden: Fields.Text({ sensitive: true }).metadata };

test("constructor builds a frozen bounded JSON tree and extracts only explicit dependencies", () => {
  const expression = declareRelationDomain(d => d.all(d.eq("paisId", d.draft("paisId")), d.any(d.eq("active", true), d.not(d.eq("active", false)))))!;
  assert.ok(Object.isFrozen(expression));
  assert.deepEqual(domainDependencies(expression), ["paisId"]);
  assert.equal(typeof JSON.parse(JSON.stringify(expression)).all[0].value.draft, "string");
  const where = compileRelationDomain(expression, target, owner, { paisId: "mx" });
  assert.deepEqual(where, { AND: [{ AND: [{ paisId: { equals: "mx" } }, { OR: [{ active: { equals: true } }, { NOT: { active: { equals: false } } }] }] }] });
  assert.deepEqual(compileListDomain(target, [snapshotDomain(d.eq("active", true))]), { AND: [{ active: { equals: true } }] });
});

test("empty dependencies deny the entire domain even under OR/NOT; false and zero remain values", () => {
  const expression = snapshotDomain(d.not(d.any(d.eq("paisId", d.draft("paisId")), d.eq("active", true))));
  for (const values of [{}, { paisId: null }, { paisId: "" }]) assert.deepEqual(compileRelationDomain(expression, target, owner, values), { id: { in: [] } });
  assert.deepEqual(resolveDomain(d.eq("active", d.draft("enabled")), { enabled: false }), d.eq("active", false));
  assert.deepEqual(resolveDomain(d.eq("quantity", d.draft("quantity")), { quantity: 0 }), d.eq("quantity", 0));
  assert.deepEqual(compileListDomain({ optional: Fields.Text().metadata }, [d.eq("optional", null)]), { AND: [{ optional: { equals: null } }] });
});

test("domain rejects invalid structure, cycles, unknown names, private fields and incompatible dependencies before values", () => {
  const cycle: { not?: unknown } = {}; cycle.not = cycle;
  for (const value of [cycle, { ...d.eq("active", true), extra: true }, { field: "active", operator: "execute", value: true }, d.eq("a.b", true), d.eq("active", undefined as never), d.all(...Array.from({ length: 101 }, () => d.eq("active", true)))]) assert.throws(() => snapshotDomain(value));
  for (const expression of [d.eq("secret", "x"), d.eq("missing", d.draft("paisId")), d.eq("paisId", d.draft("wrong")), d.eq("paisId", d.draft("hidden")), d.eq("paisId", d.draft("missing")), d.gt("paisId", d.draft("paisId"))]) assert.throws(() => validateRelationDomain(snapshotDomain(expression), target, owner));
  assert.throws(() => compileListDomain(target, [d.eq("secret", "x")]));
});

test("Many2one and Many2many retain domains through browser mirrors and generation without functions in metadata", () => {
  const field = Fields.Many2one("GeoEstado", { domain: d => d.eq("paisId", d.draft("paisId")) });
  const mirror = fieldFromMetadata(field.metadata);
  assert.deepEqual(mirror.metadata, field.metadata);
  const source = fieldExpression(field.metadata);
  assert.match(source, /"domain": \(\) =>/);
  const recreated = Function("Fields", `return ${source}`)(Fields);
  assert.deepEqual(recreated.metadata, field.metadata);
  const many = Fields.Many2many("GeoEstado", { domain: d => d.eq("active", true) });
  assert.deepEqual(many.many2many.domain, d.eq("active", true));
  assert.throws(() => Fields.Many2one("GeoEstado", { domain: {} as never }));
});

test("composition validates registered targets and source dependencies, including missing module dependencies", () => {
  class Pais extends Model { name = Fields.Text(); }
  class Estado extends Model { paisId = Fields.Many2one("GeoPais"); }
  const geo = defineModule({ id: "geo", name: "Geo", icon: "boxes", models: { pais: Pais, estado: Estado } });
  class Contact extends Model { paisId = Fields.Many2one("GeoPais"); estadoId = Fields.Many2one("GeoEstado", { domain: d => d.eq("paisId", d.draft("paisId")) }); }
  const contactModule = (depends: string[]) => defineModule({ id: "contacts", name: "Contacts", icon: "boxes", depends, models: { contact: Contact } });
  assert.throws(() => composeModules([geo, contactModule([])]), /depends/);
  assert.doesNotThrow(() => composeModules([geo, contactModule(["geo"])]));
});

test("collection constructor accepts server context but rejects draft references", async () => {
  const context = { actor: { id: "actor", sessionVersion: 0 }, tx: {} as Prisma.TransactionClient };
  assert.deepEqual(await compileCollectionDomain(target, d => d.eq("active", true), context), { AND: [{ active: { equals: true } }] });
  assert.deepEqual(await compileCollectionDomain({}, (d, { actor }) => d.eq("createBy", actor.id), context), { AND: [{ createBy: { equals: "actor" } }] });
  await assert.rejects(compileCollectionDomain(target, d => d.eq("paisId", d.draft("paisId")), context), /borrador/);
});
