import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Fields, Model, defineModel } from "./index";
import { vehicleModel } from "./examples/fleet-vehicle";
import { generateModule, type ModuleGeneration } from "./generator/generate";
import { prismaBlocks } from "./generator/prisma-source";
import { artifactPlan, writeArtifacts } from "./generator/write";

const schema = `// 🦷 Preserve Unicode offsets and ignored braces: } model Fake {\ngenerator client {\n provider = "prisma-client"\n output = "./client"\n}\ndatasource db {\n provider = "postgresql"\n}\nmodel Partner {\n id String @id @default(cuid())\n name String\n // A comment with }\n note String? @default("{not a block}")\n @@map("partners")\n}\n`;
const context = { schema, owners: { Partner: "contactos" } };
const profile: ModuleGeneration = { id: "flota", depends: ["contactos"], models: [{ model: vehicleModel, clientFields: Object.keys(vehicleModel.fields) }] };

test("generation maps declarations to Prisma, preserves existing models and proposes inverse relations", () => {
  const files = generateModule(profile, context);
  assert.deepEqual(generateModule(profile, context), files);
  assert.match(files["models.prisma"], /plate String @unique @db.VarChar\(20\)/);
  assert.match(files["models.prisma"], /mileage Int @default\(0\)/);
  assert.match(files["models.prisma"], /driverId String\? @map\("driver_id"\)/);
  assert.match(files["models.prisma"], /driver Partner\? @relation\("FleetVehicle_driverId"/);
  assert.match(files["models.prisma"], /state FleetVehicleStateEnum @default\(available\)/);
  assert.match(files["models.prisma"], /nextServiceAt DateTime\?.*@db.Timestamptz\(3\)/);
  const preview = prismaBlocks(files["schema.preview.prisma"]);
  assert.equal(preview.some(block => block.kind === "generator"), false);
  assert.equal(preview.some(block => block.name === "Fake"), false);
  const partner = preview.find(block => block.name === "Partner")!;
  assert.match(partner.body, /note String\? @default\("\{not a block\}"\)/);
  assert.match(partner.body, /fleetVehicleDriverIdRecords FleetVehicle\[\]/);
  const report = JSON.parse(files["review.json"]);
  assert.equal(report.relations[0].owner, "contactos");
  assert.ok(report.validationOnly.some((item: string) => item.includes("mileage")));
});

test("client publication is explicit and never serializes model methods or hidden fields", () => {
  const model = defineModel(class Private extends Model {
    name = Fields.Text({ required: true });
    privateNote = Fields.Text({ label: "SERVER_ONLY_LABEL" });
    operation() { return "SERVER_ONLY_METHOD"; }
  }, { name: "Private", table: "private" });
  const files = generateModule({ id: "private", depends: [], models: [{ model, clientFields: ["name"] }] }, context);
  const client = files["Private.schema.ts"];
  assert.match(client, /from "@\/lib\/orm\/fields"/);
  for (const forbidden of ["privateNote", "SERVER_ONLY_LABEL", "SERVER_ONLY_METHOD", "defineModel", "server-only"]) assert.equal(client.includes(forbidden), false);
  assert.match(files["models.prisma"], /privateNote String\?/);
});

test("relation generation supports generated targets, self relations and one-to-one uniqueness", () => {
  const a = defineModel(class A extends Model { parentId = Fields.Many2one("A"); }, { name: "A", table: "a" });
  const b = defineModel(class B extends Model { ownerId = Fields.Many2one("A", { unique: true, required: true }); }, { name: "B", table: "b" });
  const files = generateModule({ id: "ab", depends: [], models: [{ model: a, clientFields: ["parentId"] }, { model: b, clientFields: ["ownerId"] }] }, context);
  assert.match(files["models.prisma"], /aParentIdRecords A\[\]/);
  assert.match(files["models.prisma"], /bOwnerIdRecords B\? @relation/);
  assert.match(files["models.prisma"], /ownerId String @unique/);
});

test("generation rejects collisions, unknown relations, missing dependencies and nonportable defaults", () => {
  assert.throws(() => generateModule({ ...profile, depends: [] }, context), /dependencia/);
  assert.throws(() => generateModule(profile, { ...context, owners: {} }), /dependencia/);
  assert.throws(() => generateModule({ ...profile, models: [...profile.models, ...profile.models] }, context), /conflicto/);
  assert.throws(() => generateModule({ ...profile, models: [{ ...profile.models[0], clientFields: ["password"] }] }, context), /publicados/);
  assert.throws(() => generateModule(profile, { ...context, schema: schema + '\nmodel Old {\n id String @id\n @@map("fleet_vehicles")\n}\n' }), /ya pertenece/);
  const unknown = defineModel(class Unknown extends Model { targetId = Fields.Many2one("Missing"); }, { name: "Unknown", table: "unknown" });
  assert.throws(() => generateModule({ id: "unknown", depends: [], models: [{ model: unknown, clientFields: ["targetId"] }] }, context), /No existe el destino/);
  const factory = defineModel(class Factory extends Model { date = Fields.DateTime({ default: () => { throw new Error("Must not execute"); } }); }, { name: "Factory", table: "factory" });
  assert.throws(() => generateModule({ id: "factory", depends: [], models: [{ model: factory, clientFields: ["date"] }] }, context), /no se puede serializar/);
  const collision = schema.replace('name String', 'name String\n fleetVehicleDriverIdRecords String');
  assert.throws(() => generateModule(profile, { ...context, schema: collision }), /inversa en conflicto/);
});

test("writer plans without changes, regenerates owned artifacts and preserves custom files", async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), "orm-artifacts-")), directory = join(root, "output");
  try {
    const files = { "example.ts": "version one\n", "example.ts.backup": "Separate artifact\n" };
    assert.equal((await artifactPlan(directory, "test", files)).changes[0].action, "create");
    await assert.rejects(readFile(join(directory, "generation-manifest.json")), { code: "ENOENT" });
    await writeArtifacts(directory, "test", files);
    assert.equal((await artifactPlan(directory, "test", files)).changes[0].action, "unchanged");
    await writeFile(join(directory, "custom.ts"), "My business logic\n");
    await writeArtifacts(directory, "test", { "example.ts": "version two\n", "example.ts.backup": "Separate artifact updated\n" });
    assert.equal(await readFile(join(directory, "example.ts"), "utf8"), "version two\n");
    assert.equal(await readFile(join(directory, "example.ts.backup"), "utf8"), "Separate artifact updated\n");
    assert.equal(await readFile(join(directory, "custom.ts"), "utf8"), "My business logic\n");
    await writeFile(join(directory, "example.ts"), "Custom edit\n");
    await assert.rejects(writeArtifacts(directory, "test", { "example.ts": "version three\n", "example.ts.backup": "Separate artifact updated\n", "new.ts": "new\n" }), /modificado/);
    assert.equal(await readFile(join(directory, "example.ts"), "utf8"), "Custom edit\n");
    await assert.rejects(readFile(join(directory, "new.ts")), { code: "ENOENT" });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("writer rejects unowned files, stale removals, malformed manifests and symlink escapes", async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), "orm-protection-"));
  try {
    await writeFile(join(root, "custom.ts"), "Do not replace\n");
    await assert.rejects(writeArtifacts(root, "test", { "custom.ts": "replacement\n" }), /personalizado/);
    await writeFile(join(root, "generation-manifest.json"), "null");
    await assert.rejects(artifactPlan(root, "test", {}), /manifiesto/);
    await rm(join(root, "generation-manifest.json"));
    await writeArtifacts(root, "test", { "owned.ts": "owned\n" });
    await assert.rejects(writeArtifacts(root, "test", {}), /retiraría/);
    const target = join(root, "target.ts");
    await writeFile(target, "outside\n");
    await symlink(target, join(root, "link.ts"));
    await assert.rejects(artifactPlan(root, "test", { "link.ts": "bad\n" }), /simbólicos/);
    assert.equal(await readFile(target, "utf8"), "outside\n");
  } finally { await rm(root, { recursive: true, force: true }); }
});
