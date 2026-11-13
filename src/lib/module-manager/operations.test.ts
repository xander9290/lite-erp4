import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unregisterModule, removalFiles, sourceDependents, sourceFingerprint } from "./operation-files";
import { writeArtifacts } from "../orm/generator/write";
import { assertApplicationIdAvailable, readRetirements } from "./retirements";
import { writeResource } from "../scaffold/resource-write";
import { sourceFile } from "../scaffold/source-edit";
import { assertNoFrameworkWriters, assertNoOtherModuleOperation } from "./operation-lock";
import { normalizedSQL } from "./operation-sql";
import { verifyOperationTypes } from "./operation-typecheck";

async function fixture(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(await realpath(tmpdir()), "module-operations-"));
  try { await mkdir(join(root, "src")); await mkdir(join(root, "prisma")); await run(root); }
  finally { await rm(root, { recursive: true, force: true }); }
}

test("retira sólo el import y la entrada literal del módulo, conservando el resto", () => {
  const before = 'import demo from "./demo/manifest";\nimport other from "./other/manifest";\n// comentario propio\nexport const modules = [demo, other] as const;\n';
  const after = unregisterModule(before, "demo");
  sourceFile(after); assert.ok(!after.includes("demo")); assert.ok(after.includes("other")); assert.ok(after.includes("comentario propio"));
  assert.equal(unregisterModule(after, "demo"), after);
  assert.throws(() => unregisterModule(before.replace("[demo, other]", "[...more]"), "demo"));
});

test("la comparación SQL conserva valores literales y descarta sólo comentarios externos", () => {
  assert.equal(normalizedSQL('-- Review\nCREATE TABLE "x" (id TEXT);\n'), normalizedSQL('CREATE   TABLE "x" (id TEXT);'));
  assert.notEqual(normalizedSQL("SELECT 'a  b';"), normalizedSQL("SELECT 'a b';"));
  assert.notEqual(normalizedSQL("SELECT 'line\n-- literal';"), normalizedSQL("SELECT 'line';"));
  assert.equal(normalizedSQL("SELECT /* outside */ '-- inside';"), "SELECT '-- inside';");
  assert.throws(() => normalizedSQL("SELECT 'unfinished"));
});

test("retira Prisma generado verificable y bloquea artefactos modificados o assets sin adaptador", async () => fixture(async root => {
  await mkdir(join(root, "src/modules/unit"), { recursive: true });
  await writeFile(join(root, "src/modules/unit/manifest.ts"), "export default {};\n");
  await writeFile(join(root, "src/modules/index.ts"), 'import unit from "./unit/manifest"; export const modules = [unit];\n');
  const directory = join(root, "src/generated/orm/apps/unit");
  const source = "model UnitItem { id String @id }\n";
  await writeArtifacts(directory, "unit", { "models.prisma": source });
  const plan = await removalFiles(root, "unit", "declarative");
  assert.ok(plan.some(change => change.path === join(directory, "models.prisma") && change.after === null));
  await writeFile(join(directory, "models.prisma"), `${source}// manual edit\n`);
  await assert.rejects(removalFiles(root, "unit", "declarative"), /modificado/);
  await writeFile(join(directory, "models.prisma"), source);
  await writeFile(join(root, "src/modules/unit/asset.png"), Buffer.from([0, 1, 2]));
  await assert.rejects(removalFiles(root, "unit", "declarative"), /retirada manual/);
}));

test("una herramienta del framework ya abierta bloquea el plan de módulos", async () => fixture(async root => {
  await assertNoFrameworkWriters(root);
  await writeFile(join(root, "prisma/.orm-sync.lock"), "active");
  await assert.rejects(assertNoFrameworkWriters(root), /herramienta del framework activa/);
}));

test("borrado de fuentes tiene preflight, dry-run y restauración ante un fallo posterior", async () => fixture(async root => {
  const victim = join(root, "src/victim.ts"), blocker = join(root, "src/blocking.ts");
  await writeFile(victim, "// personalización\n");
  await writeResource(root, [{ path: victim, before: "// personalización\n", after: null }], true);
  assert.equal(await readFile(victim, "utf8"), "// personalización\n");
  await assert.rejects(writeResource(root, [
    { path: victim, before: "// personalización\n", after: null },
    { path: blocker, before: null, after: "file, not directory" },
    { path: join(blocker, "child.ts"), before: null, after: "unreachable" },
  ]));
  assert.equal(await readFile(victim, "utf8"), "// personalización\n");
  await assert.rejects(readFile(blocker));
  await writeResource(root, [{ path: victim, before: "// personalización\n", after: null }]);
  await assert.rejects(readFile(victim));
}));

test("detecta imports, delegates, Many2one y referencias a grupos fuera del alcance", async () => fixture(async root => {
  const owned = join(root, "src/modules/demo/models/item.ts");
  await mkdir(join(root, "src/modules/demo/models"), { recursive: true }); await writeFile(owned, "export class Item {}\n");
  await writeFile(join(root, "src/consumer.ts"), 'import {Item} from "@/modules/demo/models/item"; export const x = prisma.demoItem;\n');
  await writeFile(join(root, "src/dynamic.ts"), 'export const load = () => import("@/modules/demo/models/item");\n');
  await writeFile(join(root, "src/query.ts"), 'db.query("SELECT * FROM demo_item");\n');
  await mkdir(join(root, "src/modules/other"), { recursive: true });
  await writeFile(join(root, "src/modules/other/manifest.ts"), 'export const group = "demo.usuario";\n');
  const blockers = await sourceDependents(root, [{ path: owned, before: "export class Item {}\n", after: null }], ["DemoItem"], ["demo.usuario"], ["demo_item"]);
  assert.equal(blockers.length, 4);
  assert.ok(blockers.some(item => item.includes("consumer.ts")));
}));

test("las identidades retenidas se reservan sin editar hashes instalados", async () => fixture(async root => {
  assert.equal((await readRetirements(root)).value.applications.length, 0);
  await writeFile(join(root, "prisma/.app-retirements.json"), JSON.stringify({ version: 1, applications: [{ id: "demo", name: "Demo", version: "1.0.0", kind: "declarative", models: ["DemoItem"], groups: [], rules: [] }] }));
  await assert.rejects(assertApplicationIdAvailable(root, "demo"), /conserva datos/);
  await assertApplicationIdAvailable(root, "other");
}));

test("las huellas detectan cambios de fuentes y excluyen jobs y locks", async () => fixture(async root => {
  await writeFile(join(root, "src/a.ts"), "export const a = 1;\n");
  const before = await sourceFingerprint(root);
  await mkdir(join(root, ".module-operations")); await writeFile(join(root, ".module-operations/job.json"), "{}");
  await writeFile(join(root, "prisma/.orm-sync.lock"), "lock");
  assert.equal(await sourceFingerprint(root), before);
  await writeFile(join(root, "src/a.ts"), "export const a = 2;\n");
  assert.notEqual(await sourceFingerprint(root), before);
}));

test("el lock permite al ejecutor propietario y bloquea otros escritores", async () => fixture(async root => {
  const lock = join(root, "prisma/.module-operation.lock");
  await writeFile(lock, "otro-proceso"); await assert.rejects(assertNoOtherModuleOperation(root), /activa/);
  await writeFile(lock, String(process.pid)); await assertNoOtherModuleOperation(root);
}));

test("el mantenimiento conserva el bloqueo de generadores después de liberar el proceso", async () => fixture(async root => {
  await mkdir(join(root, ".module-operations"));
  await writeFile(join(root, ".module-operations/maintenance.json"), "{}");
  await assert.rejects(assertNoOtherModuleOperation(root), /mantenimiento/);
  await writeFile(join(root, "prisma/.module-operation.lock"), String(process.pid));
  await assertNoOtherModuleOperation(root);
}));

test("verifica fuentes y tipos de rutas actuales aunque el servidor dev conserve rutas retiradas", async () => fixture(async root => {
  await writeFile(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, types: [], skipLibCheck: true }, include: ["src/**/*.ts", ".next/types/**/*.ts", ".next/dev/types/**/*.ts"] }));
  await mkdir(join(root, ".next/dev/types"), { recursive: true });
  await mkdir(join(root, ".next/types"), { recursive: true });
  await writeFile(join(root, ".next/dev/types/validator.ts"), 'import "../../../retired-route";\nconst stale: number = "old";\n');
  await writeFile(join(root, "src/current.ts"), 'export const current: number = 1;\n');
  verifyOperationTypes(root);
  await writeFile(join(root, ".next/types/validator.ts"), 'const current: number = "invalid";\n');
  assert.throws(() => verifyOperationTypes(root), /TypeScript/);
  await writeFile(join(root, ".next/types/validator.ts"), "");
  await writeFile(join(root, "src/current.ts"), 'export const current: number = "invalid";\n');
  assert.throws(() => verifyOperationTypes(root), /TypeScript/);
}));
