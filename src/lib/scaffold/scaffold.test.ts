import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { appIdentity, createAppTemplate, scaffoldRegistryFiles } from "./templates";
import { createApplication } from "./create";
import { generateModule } from "../orm/generator/generate";
import { loadAppGenerationProfile } from "../orm/generator/profile";

const fixtureSchema = "model User {\n id String @id\n}\n" + 'datasource db {\n provider = "postgresql"\n}\n';
async function temporaryRoot() { return mkdtemp(join(await realpath(tmpdir()), "lite-erp-scaffold-")); }
const artifacts = (template: ReturnType<typeof createAppTemplate>) => generateModule(template.profile, { schema: fixtureSchema, owners: {} });

test("application identity produces safe routes and rejects reserved/path-like names", () => {
  assert.deepEqual(appIdentity("Flota"), { id: "flota", name: "Flota", modelName: "FlotaRecord", table: "flota_records" });
  assert.equal(appIdentity("Gestión de Flota").id, "gestion-de-flota");
  for (const name of ["", " ", "../flota", "/erp/flota", "Flota\n", "Perfil", "Nuevo", "Auth", "a".repeat(81), "flota; echo bad", "_private"]) assert.throws(() => appIdentity(name));
});

test("dry run writes nothing; creation emits editable source, owned artifacts and explicit registration", async () => {
  const root = await temporaryRoot();
  try {
    const template = createAppTemplate("Prueba"), generated = artifacts(template);
    const plan = await createApplication(root, template, generated, true);
    assert.ok(plan.paths.some(path => path.endsWith(join("models", "Record.ts"))));
    assert.deepEqual(await readdir(root), []);
    await createApplication(root, template, generated);
    const model = await readFile(join(root, "src/app/(auth)/erp/prueba/models/Record.ts"), "utf8");
    assert.match(model, /class PruebaRecord extends Model/);
    assert.match(model, /displayName\(record: DisplayRecord<PruebaRecord, "name">\)/);
    assert.match(model, /return record.name/);
    const profile = await readFile(join(root, "src/app/(auth)/erp/prueba/orm.config.ts"), "utf8");
    assert.match(profile, /clientFields: \["name", "active"\]/);
    const action = await readFile(join(root, "src/app/(auth)/erp/prueba/actions/record.actions.ts"), "utf8");
    for (const declaration of action.split("export async function ").slice(1)) {
      assert.match(declaration, /await requireAdmin\(\)|return queries\.\w+\(/, `Acción sin autorización: ${declaration.split("(")[0]}`);
    }
    assert.match(action, /createQueryActions\(\{ prisma, authorize: requireAdmin \}/);
    assert.match(action, /lookupRecords: recordService.lookup/);
    assert.equal(action.includes("ok: true"), false);
    const form = await readFile(join(root, "src/app/(auth)/erp/prueba/views/RecordForm.tsx"), "utf8");
    for (const feature of ["zodResolver", "FormViewLoader", "navigation.run", "router.bfcacheId", "saveRecord"]) assert.ok(form.includes(feature));
    const catalog = JSON.parse(await readFile(join(root, "src/lib/applications/scaffolded/catalog.json"), "utf8"));
    assert.deepEqual(catalog.applications, ["prueba"]);
    await writeFile(join(root, "src/app/(auth)/erp/prueba/models/Record.ts"), "My own changes\n");
    await assert.rejects(createApplication(root, template, generated), /Ya existe/);
    assert.equal(await readFile(join(root, "src/app/(auth)/erp/prueba/models/Record.ts"), "utf8"), "My own changes\n");
    const other = createAppTemplate("Otra");
    await createApplication(root, other, artifacts(other));
    assert.deepEqual(JSON.parse(await readFile(join(root, "src/lib/applications/scaffolded/catalog.json"), "utf8")).applications, ["otra", "prueba"]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("custom registry edits or existing generated artifacts abort before creating application files", async () => {
  const root = await temporaryRoot();
  try {
    const a = createAppTemplate("A");
    await createApplication(root, a, artifacts(a));
    const registry = join(root, "src/lib/applications/scaffolded/registry.ts");
    await writeFile(registry, "// My custom registration\n");
    const b = createAppTemplate("B");
    await assert.rejects(createApplication(root, b, artifacts(b)), /modificado/);
    await assert.rejects(readdir(join(root, "src/app/(auth)/erp/b")), { code: "ENOENT" });
    assert.equal(await readFile(registry, "utf8"), "// My custom registration\n");
    const occupied = createAppTemplate("Ocupada");
    await mkdir(join(root, "src/generated/orm/apps/ocupada"), { recursive: true });
    await writeFile(join(root, "src/generated/orm/apps/ocupada/custom.ts"), "Preserve\n");
    await assert.rejects(createApplication(root, occupied, artifacts(occupied)), /Ya existe/);
    assert.equal(await readFile(join(root, "src/generated/orm/apps/ocupada/custom.ts"), "utf8"), "Preserve\n");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("created model profiles load without React and infer schemas identical to the declaration", async () => {
  const root = await temporaryRoot();
  try {
    await writeFile(join(root, "package.json"), '{"type":"module"}');
    await symlink(join(process.cwd(), "node_modules"), join(root, "node_modules"), process.platform === "win32" ? "junction" : "dir");
    const template = createAppTemplate("Perfil de Prueba");
    await createApplication(root, template, artifacts(template));
    const profile = await loadAppGenerationProfile(root, template.app.id);
    assert.ok(profile);
    const model = profile.module.models[0].model;
    assert.equal(model.name, template.app.modelName);
    assert.deepEqual(Object.keys(model.fields), ["name", "active"]);
    assert.equal(model.fields.name.schema.safeParse("").success, false);
    assert.deepEqual(scaffoldRegistryFiles(["b", "a"]), scaffoldRegistryFiles(["a", "b"]));
    await assert.rejects(loadAppGenerationProfile(root, "../auth"), /inválido/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("CLI creates a compilable app in an isolated project and its ORM profile regenerates unchanged", { timeout: 120000 }, async () => {
  const root = await temporaryRoot(), project = process.cwd();
  try {
    await symlink(join(project, "node_modules"), join(root, "node_modules"), process.platform === "win32" ? "junction" : "dir");
    await writeFile(join(root, "package.json"), '{"type":"module"}');
    await mkdir(join(root, "prisma/models"), { recursive: true });
    await writeFile(join(root, "prisma/models/schema.prisma"), fixtureSchema);
    await writeFile(join(root, "prisma7.config.ts"), 'import { defineConfig } from "prisma/config"; export default defineConfig({schema:"prisma/models",datasource:{url:"postgresql://test:test@localhost:5432/not_connected"}});');
    await writeFile(join(root, "tsconfig.json"), JSON.stringify({ extends: join(project, "tsconfig.json"), compilerOptions: { incremental: false, paths: { "@/*": [join(root, "src/*"), join(project, "src/*")] } }, include: ["src/**/*.ts", "src/**/*.tsx", join(project, "src/types/next-auth.d.ts")], exclude: ["node_modules"] }));
    // The generated registry's relative type import has the same neighboring contract in a real project.
    await mkdir(join(root, "src/lib/applications"), { recursive: true });
    await writeFile(join(root, "src/lib/applications/manifest.ts"), await readFile(join(project, "src/lib/applications/manifest.ts"), "utf8"));
    const run = (script: string, args: string[]) => spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", join(project, "scripts", script), ...args], { cwd: root, encoding: "utf8", timeout: 45000 });
    const create = run("create-app.ts", ["Tutoría"]);
    assert.equal(create.status, 0, create.stderr + create.stdout);
    assert.ok(create.stdout.includes("tutoria"));
    const check = run("orm-generate.ts", ["tutoria", "--check"]);
    assert.equal(check.status, 0, check.stderr + check.stdout);
    const compile = spawnSync(process.execPath, [join(project, "node_modules/typescript/bin/tsc"), "--project", join(root, "tsconfig.json"), "--noEmit"], { cwd: root, encoding: "utf8", timeout: 60000 });
    assert.equal(compile.status, 0, compile.stderr + compile.stdout);
    const again = run("create-app.ts", ["Tutoría"]);
    assert.equal(again.status, 1);
    assert.match(again.stderr, /Ya existe/);
  } finally { await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
});
