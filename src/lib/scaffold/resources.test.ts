import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { Fields, Model, defineModel } from "../orm";
import { modelIdentity } from "./models";
import { resourceTemplates } from "./resource-templates";
import { writeResource } from "./resource-write";
import { sourceFile, array, manifestObject, property } from "./source-edit";
import { loadAppGenerationProfile } from "../orm/generator/profile";
import { unboundFiles } from "../orm/generator/bind";

test("resource identity is scoped and rejects unsafe or reserved names", () => {
  assert.equal(modelIdentity("flota", "Fabricante").name, "FlotaFabricante");
  assert.deepEqual(modelIdentity("flota", "Fabricante"), modelIdentity("flota", "FlotaFabricante"));
  for (const [app, name] of [["../a", "Good"], ["flota", "../Bad"], ["flota", "Nuevo"], ["flota", "Flota"], ["flota", "lower"]]) assert.throws(() => modelIdentity(app, name));
});

test("source edits reject broken syntax and ambiguous/spread configuration", () => {
  assert.throws(() => sourceFile("export const manifest = defineApplication({"), /sintaxis/);
  assert.throws(() => manifestObject(sourceFile("export const manifest=defineApplication({...other, models:[]});")), /literal/);
  const manifest = manifestObject(sourceFile("export const appManifest=defineApplication({models:[...other]});"));
  assert.throws(() => array(property(manifest, "models")), /array literal/);
});

test("view templates support typed fields, modal guards and explicit kanban states", () => {
  const model = defineModel(class extends Model {
    name = Fields.Text({ label: 'Nombre "público"', required: true });
    count = Fields.Integer({ default: 0 });
    at = Fields.DateTime();
    state = Fields.Selection([{ value: "draft", label: "Borrador" }, { value: "done", label: "Hecho" }] as const, { required: true });
    ownerId = Fields.Many2one("Partner");
    logo = Fields.Image({ folder: "tests/work", tracking: true });
  }, { name: "TestWork", table: "test_work" });
  const entry = { model, clientFields: Object.keys(model.fields) };
  const template = resourceTemplates(modelIdentity("test", "Work"), entry, { source: "./models/Work", exported: "customExport" }, { views: ["list", "card", "kanban", "form"], form: "modal", group: "state", label: 'Trabajo "especial"' });
  for (const [path, code] of Object.entries(template.files).filter(([path]) => /\.tsx?$/.test(path))) {
    const result = ts.transpileModule(code, { fileName: path, reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } });
    assert.deepEqual(result.diagnostics?.filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error), [], path);
  }
  assert.match(template.files["views/WorkForm.tsx"], /FieldNumber<RecordInput>/);
  assert.match(template.files["views/WorkForm.tsx"], /FieldDate<RecordInput>/);
  assert.match(template.files["views/WorkForm.tsx"], /FieldMany2One<RecordInput>/);
  assert.match(template.files["views/WorkForm.tsx"], /FieldImage<RecordInput>.*upload=\{imageUploads.logo\}/);
  assert.match(template.files["views/WorkForm.tsx"], /generated\/orm\/uploads\/test\/TestWork.images/);
  assert.doesNotMatch(template.files["actions/work.actions.ts"], /createModelImageSigner/);
  assert.match(template.files["views/work.list.ts"], /"field":"logo".*"widget":"image"/);
  assert.doesNotMatch(template.files["views/WorkForm.tsx"], /tests\/work|API_SECRET/);
  assert.match(template.files["views/WorkModal.tsx"], /navigation.run/);
  assert.match(template.files["views/WorkForm.tsx"], /FormViewLoader/);
  assert.match(template.files["views/WorkForm.tsx"], /navigation.run/);
  assert.match(template.files["models/work.service.ts"], /customExport as recordModel/);
  assert.match(template.files["actions/work.actions.ts"], /createQueryActions/);
  assert.doesNotMatch(template.files["actions/work.actions.ts"], /recordLists|listMyRecords|listActiveRecords/);
  assert.equal(template.menus.length, 3);
  assert.throws(() => resourceTemplates(modelIdentity("test", "Work"), entry, { source: "./models/Work", exported: "customExport" }, { views: ["kanban"], group: "name" }), /Selection/);
  assert.throws(() => resourceTemplates(modelIdentity("test", "Work"), { ...entry, clientFields: ["name"] }, { source: "./models/Work", exported: "customExport" }, {}), /privacidad/);
});

test("resource writes are dry-run by default when requested and reject collisions, stale edits and symlinks", async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), "lite-resource-write-"));
  const outside = await mkdtemp(join(await realpath(tmpdir()), "lite-resource-outside-"));
  try {
    const path = join(root, "src/example.ts");
    const changes = [{ path, before: null, after: "new\n" }];
    await writeResource(root, changes, true);
    assert.deepEqual(await readdir(root), []);
    await writeResource(root, changes);
    assert.equal(await readFile(path, "utf8"), "new\n");
    await assert.rejects(writeResource(root, [{ path: join(root, "other.ts"), before: null, after: "other" }, ...changes]), /existe o cambió/);
    await assert.rejects(readFile(join(root, "other.ts")), /ENOENT/);
    await assert.rejects(writeResource(root, [{ path, before: "old", after: "overwrite" }]), /cambió/);
    await symlink(outside, join(root, "escape"), process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(writeResource(root, [{ path: join(root, "escape/x.ts"), before: null, after: "escape" }]), /simbólicos/);
    assert.deepEqual(await readdir(outside), []);
    await mkdir(join(root, "src/Upper"));
    await assert.rejects(writeResource(root, [{ path: join(root, "src/upper/item.ts"), before: null, after: "case collision" }]), /Colisión/);
  } finally { await rm(root, { recursive: true, force: true }); await rm(outside, { recursive: true, force: true }); }
});

test("CLI model first then views preserves sources and produces a compilable editable resource", { timeout: 90000 }, async () => {
  const project = process.cwd(), root = await mkdtemp(join(await realpath(tmpdir()), "lite-resource-cli-"));
  try {
    await symlink(join(project, "node_modules"), join(root, "node_modules"), process.platform === "win32" ? "junction" : "dir");
    await writeFile(join(root, "package.json"), '{"type":"module"}');
    await writeFile(join(root, "tsconfig.json"), JSON.stringify({ extends: join(project, "tsconfig.json"), compilerOptions: { incremental: false, paths: { "@/*": [join(root, "src/*"), join(project, "src/*")] } }, include: ["src/**/*.ts", "src/**/*.tsx", join(project, "src/types/next-auth.d.ts")], exclude: ["node_modules"] }));
    await mkdir(join(root, "prisma/models"), { recursive: true });
    await writeFile(join(root, "prisma/models/schema.prisma"), 'datasource db {\n provider = "postgresql"\n}\nmodel User {\n id String @id\n}\n');
    await writeFile(join(root, "prisma7.config.ts"), 'import {defineConfig} from "prisma/config";export default defineConfig({schema:"prisma/models",datasource:{url:"postgresql://unused:unused@localhost:5432/unused"}});');
    await mkdir(join(root, "src/lib/applications"), { recursive: true });
    await writeFile(join(root, "src/lib/applications/manifest.ts"), await readFile(join(project, "src/lib/applications/manifest.ts"), "utf8"));
    const run = (script: string, args: string[], status = 0) => {
      const result = spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", join(project, "scripts", script), ...args], { cwd: root, encoding: "utf8", timeout: 35000 });
      assert.equal(result.status, status, result.stdout + result.stderr); return result;
    };
    run("create-app.ts", ["Prueba"]);
    const base = join(root, "src/app/(auth)/erp/prueba");
    const manifestPath = join(base, "manifest.ts");
    await writeFile(manifestPath, (await readFile(manifestPath, "utf8")).replace("export const manifest =", "// Mi comentario y mi nombre de exportación se conservan.\nexport const customManifest =") + '\nexport { customManifest as manifest };\n');
    const oldProfile = await readFile(join(base, "orm.config.ts"), "utf8");
    const oldForm = await readFile(join(base, "views/RecordForm.tsx"), "utf8");
    run("create-model.ts", ["prueba", "Work", "--dry-run"]);
    assert.equal(await readFile(join(base, "orm.config.ts"), "utf8"), oldProfile);
    await assert.rejects(readFile(join(base, "models/Work.ts")), /ENOENT/);
    run("create-model.ts", ["prueba", "Work"]);
    const modelPath = join(base, "models/Work.ts");
    await writeFile(modelPath, (await readFile(modelPath, "utf8")).replace("  // Define aquí", '  state = Fields.Selection([{value:"draft",label:"Borrador"},{value:"done",label:"Hecho"}] as const, {required:true,default:"draft"});\n  logo = Fields.Image({folder:"tests/work",tracking:true});\n  // Define aquí'));
    const profilePath = join(base, "orm.config.ts");
    await writeFile(profilePath, (await readFile(profilePath, "utf8")).replace('model: pruebaWorkModel, clientFields: ["name", "active"]', 'model: pruebaWorkModel, clientFields: ["name", "active", "state", "logo"]'));
    run("create-model.ts", ["prueba", "Work"], 1);
    run("create-views.ts", ["prueba", "Work", "--views", "list,card,kanban,form", "--form", "modal", "--group", "state", "--dry-run"]);
    await assert.rejects(readFile(join(base, "views/WorkList.tsx")), /ENOENT/);
    run("create-views.ts", ["prueba", "Work", "--views", "list,card,kanban,form", "--form", "modal", "--group", "state"]);
    const manifest = await readFile(join(base, "manifest.ts"), "utf8");
    assert.match(manifest, /mis-registros/); assert.match(manifest, /work\/tablero/);
    assert.match(manifest, /Mi comentario y mi nombre/);
    assert.match(manifest, /export const customManifest/);
    assert.equal(await readFile(join(base, "views/RecordForm.tsx"), "utf8"), oldForm);
    run("create-views.ts", ["prueba", "Work"], 1);
    assert.equal(await readFile(join(base, "manifest.ts"), "utf8"), manifest);
    run("orm-generate.ts", ["prueba", "--write"]);
    const profile = await loadAppGenerationProfile(root, "prueba");
    assert.ok(profile);
    // Before real migration/bind the compile fixture uses explicit rejecting repositories.
    for (const [name, source] of Object.entries(unboundFiles(profile.module))) await writeFile(join(root, "src/generated/orm/bindings/prueba", name), source);
    const compiled = spawnSync(process.execPath, [join(project, "node_modules/typescript/bin/tsc"), "--project", join(root, "tsconfig.json"), "--noEmit"], { cwd: root, encoding: "utf8", timeout: 30000 });
    assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
    const formPath = join(base, "views/WorkForm.tsx");
    const customizedForm = await readFile(formPath, "utf8");
    await writeFile(modelPath, (await readFile(modelPath, "utf8")).replace("  // Define aquí", '  detail = Fields.Image({folder:"tests/details"});\n  // Define aquí'));
    await writeFile(profilePath, (await readFile(profilePath, "utf8")).replace('["name", "active", "state", "logo"]', '["name", "active", "state", "logo", "detail"]'));
    run("orm-generate.ts", ["prueba", "--write"]);
    assert.match(await readFile(join(root, "src/generated/orm/uploads/prueba/PruebaWork.images.ts"), "utf8"), /detail: createSigned/);
    assert.equal(await readFile(formPath, "utf8"), customizedForm);
    const compiledAgain = spawnSync(process.execPath, [join(project, "node_modules/typescript/bin/tsc"), "--project", join(root, "tsconfig.json"), "--noEmit"], { cwd: root, encoding: "utf8", timeout: 30000 });
    assert.equal(compiledAgain.status, 0, compiledAgain.stdout + compiledAgain.stderr);
  } finally { await rm(root, { recursive: true, force: true }); }
});
