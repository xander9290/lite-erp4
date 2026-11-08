import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { Fields } from "../fields";
import { Model, defineModel } from "../model";
import type { GenerationProfile } from "./profile";
import { installModels } from "./install";
import { prepareModuleArtifacts } from "./prepare";
import { createAppTemplate } from "../../scaffold/templates";
import { createApplication } from "../../scaffold/create";
import { generateModule } from "./generate";

const fixture = "model User {\n id String @id\n}\n" + 'datasource db {\n provider = "postgresql"\n}\n\nmodel Partner {\n id String @id\n name String // developer-owned contact field\n}\n\nmodel Company {\n id String @id\n}\n';
class Visit extends Model {
  name = Fields.Text({ required: true, maxLength: 100 });
  patientId = Fields.Many2one("Partner");
  companyId = Fields.Many2one("Company");
}
const visit = defineModel(Visit, { name: "TestVisit", table: "test_visits" });
const profile: GenerationProfile = { module: { id: "test-visits", depends: ["contactos"], models: [{ model: visit, clientFields: ["name", "patientId", "companyId"] }] }, externalOwners: { Partner: "contactos", Company: "contactos" } };

async function temporaryProject() {
  const root = await mkdtemp(join(await realpath(tmpdir()), "lite-erp-install-"));
  await symlink(join(process.cwd(), "node_modules"), join(root, "node_modules"), "dir");
  await mkdir(join(root, "prisma/models"), { recursive: true });
  await writeFile(join(root, "package.json"), '{"type":"module"}');
  await writeFile(join(root, "prisma/models/schema.prisma"), fixture);
  // Schema validation/diff must succeed even though no database exists at this address.
  await writeFile(join(root, "prisma7.config.ts"), 'import { defineConfig } from "prisma/config"; export default defineConfig({schema:"prisma/models",datasource:{url:"postgresql://test:test@127.0.0.1:1/not_connected"}});');
  return root;
}
const source = (root: string) => join(root, "prisma/models/schema.prisma");

test("installation is review-only by default, preserves source and installs two inverses in the same file", { timeout: 30000 }, async () => {
  const root = await temporaryProject();
  try {
    const plan = await installModels(root, profile);
    assert.equal(plan.changes.length, 3);
    assert.match(plan.sql, /CREATE TABLE "test_visits"/);
    assert.deepEqual(await readdir(join(root, "prisma")), ["models"]);
    assert.equal(await readFile(source(root), "utf8"), fixture);
    await installModels(root, profile, true);
    const installed = await readFile(source(root), "utf8");
    assert.match(installed, /BEGIN lite-erp:test-visits:Partner/);
    assert.match(installed, /BEGIN lite-erp:test-visits:Company/);
    assert.match(installed, /name String \/\/ developer-owned/);
    assert.equal((await installModels(root, profile, true)).changes.length, 0);
    const regenerated = await prepareModuleArtifacts(root, profile.module, profile.externalOwners);
    assert.doesNotMatch(regenerated["migration.preview.sql"], /CREATE|ALTER|DROP/);
    // Personal edits outside managed segments remain valid and survive repeat installation.
    await writeFile(source(root), installed.replace("name String //", "name String? //"));
    assert.equal((await installModels(root, profile, true)).changes.length, 0);
    assert.match(await readFile(source(root), "utf8"), /name String\?/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("installed dependencies keep downstream inverses and enforce recorded ownership", { timeout: 30000 }, async () => {
  const root = await temporaryProject();
  try {
    await installModels(root, profile, true);
    class Line extends Model { visitId = Fields.Many2one("TestVisit", { required: true }); }
    const line = defineModel(Line, { name: "TestLine", table: "test_lines" });
    const child: GenerationProfile = { module: { id: "test-lines", depends: ["test-visits"], models: [{ model: line, clientFields: ["visitId"] }] }, externalOwners: {} };
    await installModels(root, child, true);
    class ExtendedVisit extends Visit { notes = Fields.Text(); count = Fields.Integer({ required: true, default: 0 }); }
    const expanded: GenerationProfile = { ...profile, module: { ...profile.module, models: [{ model: defineModel(ExtendedVisit, { name: "TestVisit", table: "test_visits" }), clientFields: ["name", "patientId", "companyId", "notes", "count"] }] } };
    await assert.rejects(installModels(root, expanded, true), /--update/);
    const updatePlan = await installModels(root, expanded, false, true);
    assert.match(updatePlan.sql, /ADD COLUMN/);
    assert.match(await readFile(join(root, "prisma/models/orm-test-visits.prisma"), "utf8"), /testLineVisitIdRecords/);
    await installModels(root, expanded, true, true);
    assert.equal((await installModels(root, expanded, true)).changes.length, 0);
    assert.equal((await installModels(root, child, true)).changes.length, 0);
    assert.match(await readFile(join(root, "prisma/models/orm-test-visits.prisma"), "utf8"), /testLineVisitIdRecords/);
    const regenerated = await prepareModuleArtifacts(root, expanded.module, expanded.externalOwners);
    assert.match(regenerated["schema.preview.prisma"], /testLineVisitIdRecords TestLine\[\]/);
    assert.doesNotMatch(regenerated["migration.preview.sql"], /CREATE|ALTER|DROP/);
    await assert.rejects(prepareModuleArtifacts(root, child.module, { TestVisit: "impostor" }), /propietario/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("managed edits and model evolution abort without overwriting files", { timeout: 30000 }, async () => {
  const root = await temporaryProject();
  try {
    await installModels(root, profile, true);
    const ledger = await readFile(join(root, "prisma/.orm-installations.json"), "utf8");
    class Changed extends Visit { notes = Fields.Text(); }
    const changed: GenerationProfile = { ...profile, module: { ...profile.module, models: [{ model: defineModel(Changed, { name: "TestVisit", table: "test_visits" }), clientFields: ["name"] }] } };
    await assert.rejects(installModels(root, changed, true), /cambió/);
    assert.equal(await readFile(join(root, "prisma/.orm-installations.json"), "utf8"), ledger);
    const original = await readFile(source(root), "utf8");
    await writeFile(source(root), original.replace("testVisitPatientIdRecords", "customPatient"));
    await assert.rejects(installModels(root, profile, true), /inversa gestionada/);
    await writeFile(source(root), original);
    const ownFile = join(root, "prisma/models/orm-test-visits.prisma");
    const edited = (await readFile(ownFile, "utf8")) + "// custom edit\n";
    await writeFile(ownFile, edited);
    await assert.rejects(installModels(root, profile, true), /modificado/);
    assert.equal(await readFile(ownFile, "utf8"), edited);
    assert.equal(await readFile(join(root, "prisma/.orm-installations.json"), "utf8"), ledger);
    assert.equal((await readdir(join(root, "prisma"))).includes(".orm-install.lock"), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("unowned files, symlinks, invalid relations and concurrent installers do not write schemas", { timeout: 30000 }, async () => {
  const root = await temporaryProject();
  try {
    const ownFile = join(root, "prisma/models/orm-test-visits.prisma");
    await writeFile(ownFile, "// custom\n");
    await assert.rejects(installModels(root, profile, true), /personalizado/);
    await rm(ownFile);
    await symlink(source(root), ownFile);
    await assert.rejects(installModels(root, profile, true), /simbólicos/);
    await rm(ownFile);
    await writeFile(join(root, "prisma/.orm-install.lock"), "occupied");
    await assert.rejects(installModels(root, profile, true), { code: "EEXIST" });
    assert.equal(await readFile(join(root, "prisma/.orm-install.lock"), "utf8"), "occupied");
    await rm(join(root, "prisma/.orm-install.lock"));
    await assert.rejects(installModels(root, { ...profile, externalOwners: {} }, true), /dependencia/);
    assert.equal(await readFile(source(root), "utf8"), fixture);
    assert.deepEqual(await readdir(join(root, "prisma")), ["models"]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("CLI installs a real scaffold in an isolated project; examples and unsafe arguments are rejected", { timeout: 30000 }, async () => {
  const root = await temporaryProject(), project = process.cwd();
  try {
    const template = createAppTemplate("Taller de prueba");
    await writeFile(join(root, "tsconfig.json"), JSON.stringify({ compilerOptions: { paths: { "@/*": [join(root, "src/*"), join(project, "src/*")] } } }));
    await createApplication(root, template, generateModule(template.profile, { schema: fixture, owners: {} }));
    const run = (...args: string[]) => spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", join(project, "scripts/orm-install.ts"), ...args], { cwd: root, encoding: "utf8", timeout: 20000 });
    const review = run("taller-de-prueba");
    assert.equal(review.status, 0, review.stderr + review.stdout);
    assert.match(review.stdout, /plan de instalación/);
    assert.deepEqual(await readdir(join(root, "prisma")), ["models"]);
    const install = run("taller-de-prueba", "--write");
    assert.equal(install.status, 0, install.stderr + install.stdout);
    assert.match(await readFile(join(root, "prisma/models/orm-taller-de-prueba.prisma"), "utf8"), /model TallerDePruebaRecord/);
    const again = run("taller-de-prueba", "--write");
    assert.equal(again.status, 0, again.stderr + again.stdout);
    assert.match(again.stdout, /ya instalado sin cambios/);
    for (const flag of ["--write", "--check"]) {
      const regenerate = spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", join(project, "scripts/orm-generate.ts"), "taller-de-prueba", flag], { cwd: root, encoding: "utf8", timeout: 20000 });
      assert.equal(regenerate.status, 0, regenerate.stderr + regenerate.stdout);
    }
    for (const args of [["flota"], ["../auth"], ["taller-de-prueba", "--force"]]) assert.equal(run(...args).status, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});
