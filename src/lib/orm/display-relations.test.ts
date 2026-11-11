import assert from "node:assert/strict";
import test from "node:test";
import { Model, defineModel } from "./model";
import { Fields } from "./fields";
import { displayLookupSelect, projectDisplayRecord } from "./display";
import { lookupProjectionPlan } from "./generator/display";
import { repositoryFiles } from "./generator/bind";
import { createModelService } from "./service";
import { unboundRepository } from "./repository";
import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { generateModule } from "./generator/generate";

const brand = defineModel(class extends Model {
  name = Fields.Text();
  secret = Fields.Text({ sensitive: true });
}, { name: "DisplayBrand", table: "display_brand" });
class Vehicle extends Model {
  name = Fields.Text({ required: true });
  fabricanteId = Fields.Many2one("DisplayBrand");
  displayFields: readonly string[] = ["name", "fabricante.name"];
  displayName(row: Readonly<{ name: string; fabricante: Readonly<{ name: string | null }> | null }>) {
    assert.equal(Object.isFrozen(row), true);
    if (row.fabricante) {
      assert.equal(Object.isFrozen(row.fabricante), true);
      assert.equal("secret" in row.fabricante, false);
    }
    return [row.fabricante?.name, row.name].filter(Boolean).join(" · ");
  }
}
const model = defineModel(Vehicle, { name: "DisplayVehicle", table: "display_vehicle" });
const entry = { model, clientFields: ["name", "fabricanteId"] };
const target = { model: brand, clientFields: ["name", "secret"] };
const profile = { id: "display-relations", depends: [], models: [entry, target] };

test("nested display projection is immutable, nullable and excludes undeclared data", () => {
  const row = { id: "1", name: "Corolla", fabricante: { name: "Toyota", secret: "hidden" } };
  assert.equal(model.displayName(row), "Toyota · Corolla");
  assert.equal(model.displayName({ id: "2", name: "Bici", fabricante: null }), "Bici");
  assert.equal(Object.isFrozen(row.fabricante), false);
  assert.deepEqual(projectDisplayRecord(row, model.displayFields), { id: "1", name: "Corolla", fabricante: { name: "Toyota" } });
  const paths = ["id", "fabricante.name", "fabricante.country.name", "fabricante.createdAt"];
  assert.deepEqual(projectDisplayRecord({ id: "1", fabricante: null }, paths), { id: "1", fabricante: null });
  assert.deepEqual(projectDisplayRecord({ id: "1", fabricante: { name: "Toyota", country: { name: "Japan" }, createdAt: new Date(0) } }, paths), {
    id: "1", fabricante: { name: "Toyota", country: { name: "Japan" }, createdAt: "1970-01-01T00:00:00.000Z" },
  });
  assert.throws(() => projectDisplayRecord({ id: "1", fabricante: [] }, model.displayFields));
  assert.throws(() => projectDisplayRecord(row, ["constructor.name"]));
});

test("path validation rejects unknown aliases, sensitive relations and unbounded traversal", () => {
  for (const path of ["fabricanteId.name", "missing.name", "fabricante.__proto__", "fabricante.a.b.c.d", "fabricante."]) {
    assert.throws(() => defineModel(class extends Vehicle { displayFields = [path]; }, { name: "InvalidVehicle", table: "invalid_vehicle" }), /displayFields/);
  }
  assert.throws(() => defineModel(class extends Model {
    fabricanteId = Fields.Many2one("DisplayBrand", { sensitive: true });
    displayFields = ["fabricante.name"];
  }, { name: "InvalidVehicle", table: "invalid_vehicle" }), /displayFields/);
});

test("generator verifies publication and privacy at each relation boundary", () => {
  assert.deepEqual(lookupProjectionPlan(profile, entry).paths, ["fabricante.name"]);
  assert.throws(() => lookupProjectionPlan({ ...profile, models: [entry] }, entry), /mismo perfil/);
  assert.throws(() => lookupProjectionPlan({ ...profile, models: [entry, { ...target, clientFields: ["secret"] }] }, entry), /publicado/);
  assert.throws(() => lookupProjectionPlan(profile, { ...entry, clientFields: ["name"] }), /relación no publicada/);
  for (const path of ["fabricante.secret", "fabricante.missing"]) {
    const changed = { ...entry, model: { ...model, displayFields: [path] } };
    assert.throws(() => lookupProjectionPlan({ ...profile, models: [changed, target] }, changed), /no sensible/);
  }
  const source = repositoryFiles(profile)["DisplayVehicle.store.ts"];
  assert.match(source, /lookupPaths: \["fabricante.name"\]/);
  assert.match(source, /DisplayBrandFields as DisplayBrandDisplayFields/);
  assert.match(source, /DisplayVehicleDisplayFields.fabricanteId.metadata, target: "DisplayBrand"/);
  assert.match(source, /DisplayBrandDisplayFields.name.metadata/);
  assert.equal(source.match(/tx\.displayVehicle\.findMany\(\{ where: query.where/g)?.length, 1);
});

test("nested select accepts only generated paths and checks current metadata", () => {
  const guards = [
    { metadata: model.fields.fabricanteId.metadata, target: "DisplayBrand" },
    { metadata: brand.fields.name.metadata },
  ];
  const policy = { id: [], name: [{ metadata: model.fields.name.metadata }], "fabricante.name": guards };
  assert.deepEqual(displayLookupSelect(model.displayFields, policy), { id: true, name: true, fabricante: { select: { name: true } } });
  assert.throws(() => displayLookupSelect(["fabricante.secret"], policy), /no permitido/);
  for (const guard of [{ metadata: undefined }, { metadata: brand.fields.secret.metadata }, { metadata: model.fields.fabricanteId.metadata, target: "WrongTarget" }]) {
    assert.throws(() => displayLookupSelect(["fabricante.name"], { "fabricante.name": [guard] }), /no publicada o sensible/);
  }
});

test("self relations allow three hops and merge shared select branches", () => {
  const tree = defineModel(class extends Model {
    name = Fields.Text();
    parentId = Fields.Many2one("DisplayTree");
    displayFields = ["name", "parent.name", "parent.parent.parent.name"];
  }, { name: "DisplayTree", table: "display_tree" });
  const node = { model: tree, clientFields: ["name", "parentId"] };
  const plan = lookupProjectionPlan({ id: "display-tree", depends: [], models: [node] }, node);
  const policy = Object.fromEntries(Object.entries(plan.policy).map(([path, guards]) => [path, guards.map(guard => ({ metadata: tree.metadata[guard.field as keyof typeof tree.metadata], target: guard.target }))]));
  assert.deepEqual(displayLookupSelect(tree.displayFields, policy), {
    id: true, name: true, parent: { select: { name: true, parent: { select: { parent: { select: { name: true } } } } } },
  });
});

test("lookup loads a page once, only returns ID/label and fails closed for old bindings", async () => {
  let account = { active: true, isAdmin: true, sessionVersion: 1 };
  let reads = 0, counts = 0;
  const tx = { user: { findUnique: async () => account } } as unknown as Prisma.TransactionClient;
  const prisma = { $transaction: async (run: (tx: Prisma.TransactionClient) => unknown, config: unknown) => {
    assert.deepEqual(config, { isolationLevel: "RepeatableRead" }); return run(tx);
  } } as unknown as PrismaClient;
  const repository = { ...unboundRepository<{ name: string; fabricanteId: string | null }>(),
    lookupPaths: ["fabricante.name"],
    count: async () => { counts++; return 2; },
    lookup: async (_tx: Prisma.TransactionClient, query: { fields: readonly string[] }) => {
      reads++; assert.deepEqual(query.fields, model.displayFields);
      return [{ id: "1", name: "Corolla", fabricante: { name: "Toyota", secret: "hidden" } }, { id: "2", name: "Bici", fabricante: null }];
    },
  };
  const options = { columns: [{ field: "name", label: "Nombre" }], searchFields: ["name"] };
  const service = createModelService(model, repository, options);
  const actor = { id: "admin", sessionVersion: 1 };
  const result = await service.lookup(prisma, actor, { ids: ["1", "2"] });
  assert.deepEqual(result, { ok: true, total: 2, page: 1, pageSize: 2, items: [
    { value: "1", label: "Toyota · Corolla", record: { id: "1" } },
    { value: "2", label: "Bici", record: { id: "2" } },
  ] });
  const old = createModelService(model, { ...repository, lookupPaths: undefined }, options);
  assert.equal((await old.lookup(prisma, actor, {})).ok, false);
  account = { ...account, isAdmin: false };
  assert.equal((await service.lookup(prisma, actor, {})).ok, false);
  account = { ...account, isAdmin: true, sessionVersion: 2 };
  assert.equal((await service.lookup(prisma, actor, {})).ok, false);
  assert.equal(reads, 1); assert.equal(counts, 1);
});

test("relational bindings compile against an isolated real Prisma client without a database", { timeout: 60000 }, async () => {
  const project = process.cwd(), root = await mkdtemp(join(await realpath(tmpdir()), "display-binding-"));
  try {
    await symlink(join(project, "node_modules"), join(root, "node_modules"), process.platform === "win32" ? "junction" : "dir");
    const baseline = `generator client {\n provider = "prisma-client"\n output = "./src/generated/prisma"\n}\ndatasource db {\n provider = "postgresql"\n}\nmodel User {\n id String @id\n login String\n partnerId String?\n partner Partner? @relation(fields: [partnerId], references: [id])\n}\nmodel Partner {\n id String @id\n name String\n avatarUrl String?\n users User[]\n}\n`;
    const files = generateModule(profile, { schema: baseline, owners: {} });
    await writeFile(join(root, "schema.prisma"), 'generator client {\n provider = "prisma-client"\n output = "./src/generated/prisma"\n}\n' + files["schema.preview.prisma"]);
    await writeFile(join(root, "package.json"), '{"type":"module"}');
    await writeFile(join(root, "prisma.config.ts"), 'import {defineConfig} from "prisma/config";export default defineConfig({schema:"schema.prisma",datasource:{url:"postgresql://unused:unused@127.0.0.1:1/unused"}});');
    const generated = spawnSync(process.execPath, [join(project, "node_modules/prisma/build/index.js"), "generate", "--config", join(root, "prisma.config.ts")], { cwd: root, encoding: "utf8", timeout: 30000 });
    assert.equal(generated.status, 0, generated.stdout + generated.stderr);
    const contracts = join(root, "src/generated/orm/apps", profile.id), bindings = join(root, "src/generated/orm/bindings", profile.id);
    await mkdir(contracts, { recursive: true }); await mkdir(bindings, { recursive: true });
    for (const [name, source] of Object.entries(files).filter(([name]) => name.endsWith(".schema.ts"))) await writeFile(join(contracts, name), source);
    for (const [name, source] of Object.entries(repositoryFiles(profile))) await writeFile(join(bindings, name), source);
    // Resolve the real repository interface against the fixture client, while reusing shared DTOs.
    await mkdir(join(root, "src/lib/orm"), { recursive: true });
    const repositorySource = (await readFile(join(project, "src/lib/orm/repository.ts"), "utf8"))
      .replaceAll('"../list/', '"@/lib/list/').replaceAll('"./record"', '"@/lib/orm/record"').replaceAll('"./audit"', '"@/lib/orm/audit"');
    await writeFile(join(root, "src/lib/orm/repository.ts"), repositorySource);
    await writeFile(join(root, "tsconfig.json"), JSON.stringify({ extends: join(project, "tsconfig.json"), compilerOptions: { incremental: false, paths: { "@/*": [join(root, "src/*"), join(project, "src/*")] } }, include: ["src/**/*.ts"], exclude: ["node_modules"] }));
    const compiled = spawnSync(process.execPath, [join(project, "node_modules/typescript/bin/tsc"), "--project", join(root, "tsconfig.json"), "--noEmit"], { cwd: root, encoding: "utf8", timeout: 30000 });
    assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
  } finally { await rm(root, { recursive: true, force: true }); }
});
