import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createModule, createModuleModel, isDeclarativeModule, moduleId, moduleRegistration, registerModule } from "./scaffold";
import { loadAppGenerationProfile } from "../orm/generator/profile";
import { manifestModel, registerView } from "./eject";
import { sourceFile } from "../scaffold/source-edit";
import { writeResource } from "../scaffold/resource-write";

const index = `import "server-only";\nimport type { ModuleDefinition } from "@/lib/modules/define";\nimport demo from "./demo/manifest";\n// preserve me\nexport const modules: readonly ModuleDefinition[] = [demo];\n`;
async function fixture(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(await realpath(tmpdir()), "lite-module-scaffold-"));
  try {
    await mkdir(join(root, "src/modules"), { recursive: true });
    await writeFile(join(root, "src/modules/index.ts"), index);
    await run(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}

test("registerModule preserva código, adopta imports y es idempotente", () => {
  const updated = registerModule(index, "ensayo");
  sourceFile(updated);
  assert.match(updated, /import ensayoModule from "\.\/ensayo\/manifest"/);
  assert.match(updated, /preserve me/);
  assert.match(updated, /\[demo,\s*ensayoModule,/);
  assert.equal(registerModule(updated, "ensayo"), updated);
  const imported = 'import custom from "./ensayo/manifest";\n' + index;
  assert.match(registerModule(imported, "ensayo"), /\[demo,\s*custom,/);
  assert.equal(registerModule(imported, "ensayo").match(/ensayo\/manifest/g)?.length, 1);
  assert.doesNotThrow(() => registerModule("// ensayoModule\n" + index, "ensayo"));
});

test("registerModule rechaza IDs, spreads, duplicados e índices ambiguos", () => {
  for (const id of ["../x", "foo-bar", "Upper", "perfil", "nuevo"]) assert.throws(() => moduleId(id));
  for (const text of [index.replace("export const", "const"), index.replace("import demo", "import type demo"), index.replace("[demo]", "[...other]"), index.replace("[demo]", "[demo, demo]"), index.replace("[demo]", "getModules()"), index.replace("[demo]", "[unknown]"), `const ensayoModule = 1;\n${index}`]) assert.throws(() => registerModule(text, "ensayo"));
});

test("create:module y create:model generan sólo fuentes y conservan manifest personalizado", async () => fixture(async root => {
  const result = await createModule(root, "ensayo", true);
  assert.equal(result.changes.length, 2);
  assert.deepEqual(await readdir(join(root, "src/modules")), ["index.ts"]);
  await createModule(root, "ensayo");
  const manifest = join(root, "src/modules/ensayo/manifest.ts");
  assert.equal(await isDeclarativeModule(root, "ensayo"), true);
  assert.equal(await isDeclarativeModule(root, "legacy"), false);
  const original = (await readFile(manifest, "utf8")).replace('icon: "boxes",', 'icon: "boxes",\n  description: "Mi configuración: Categoria y Tarea",');
  await writeFile(manifest, original);
  const dry = await createModuleModel(root, "ensayo", "Categoria", true);
  assert.equal(dry.identity.key, "categoria");
  assert.equal(await readFile(manifest, "utf8"), original);
  await assert.rejects(readFile(join(root, "src/modules/ensayo/models/categoria.ts")));
  await createModuleModel(root, "ensayo", "Categoria");
  await createModuleModel(root, "ensayo", "Tarea");
  const after = await readFile(manifest, "utf8");
  assert.match(after, /Mi configuración/);
  assert.equal(manifestModel(after, "categoria").className, "Categoria");
  assert.equal(manifestModel(after, "tarea").classImport, "./models/tarea");
  sourceFile(registerView(after, "tarea", "form"));
  const model = await readFile(join(root, "src/modules/ensayo/models/tarea.ts"), "utf8");
  assert.match(model, /export class Tarea extends Model/);
  assert.doesNotMatch(model, /defineModel|clientFields/);
  await assert.rejects(createModule(root, "ensayo"), /ya existe/);
  await assert.rejects(createModuleModel(root, "ensayo", "Tarea"), /ya está declarado/);
  for (const name of ["../x", "lower", "Fields", "Model", "Nuevo"]) await assert.rejects(createModuleModel(root, "ensayo", name));
  assert.equal(await readFile(manifest, "utf8"), after);
}));

test("rechaza colisiones, archivos personalizados, manifests dinámicos y configuración doble", async () => fixture(async root => {
  await mkdir(join(root, "src/app/(auth)/erp/flota"), { recursive: true });
  await assert.rejects(createModule(root, "flota"), /estática/);
  await createModule(root, "ensayo");
  const manifest = join(root, "src/modules/ensayo/manifest.ts");
  const before = await readFile(manifest, "utf8");
  await mkdir(join(root, "src/modules/ensayo/models"));
  await writeFile(join(root, "src/modules/ensayo/models/tarea.ts"), "// personalización\n");
  await assert.rejects(createModuleModel(root, "ensayo", "Tarea"), /ya existe|cambió/);
  assert.equal(await readFile(manifest, "utf8"), before);
  await writeFile(manifest, before.replace("models: {}", "models: { ...otros }"));
  await assert.rejects(createModuleModel(root, "ensayo", "Categoria"), /sin spreads/);
  await writeFile(manifest, before.replace("models: {}", "models: { [custom]: Clase }"));
  await assert.rejects(createModuleModel(root, "ensayo", "Categoria"), /claves literales/);
  await writeFile(manifest, before.replace('id: "ensayo"', 'id: "otro"'));
  await assert.rejects(createModuleModel(root, "ensayo", "Categoria"), /ID/);
  await mkdir(join(root, "src/app/(auth)/erp/ensayo"), { recursive: true });
  await writeFile(join(root, "src/app/(auth)/erp/ensayo/orm.config.ts"), "export const generationProfile = {};\n");
  await assert.rejects(isDeclarativeModule(root, "ensayo"), /estática/);
  await assert.rejects(loadAppGenerationProfile(root, "ensayo"), /ambigua/);
}));

test("registro de sync es revisable, idempotente y rechaza ediciones concurrentes", async () => fixture(async root => {
  const plan = await moduleRegistration(root, "ensayo");
  assert.equal(await readFile(join(root, "src/modules/index.ts"), "utf8"), index);
  await writeResource(root, plan);
  assert.deepEqual(await moduleRegistration(root, "ensayo"), []);
  const next = await moduleRegistration(root, "otro");
  await writeFile(join(root, "src/modules/index.ts"), "// concurrent\n" + next[0].before);
  await assert.rejects(writeResource(root, next), /cambió/);
}));

test("rechaza directorios enlazados sin exigir privilegios de symlink de archivo en Windows", async () => fixture(async root => {
  const target = join(root, "target"); await mkdir(target);
  await symlink(target, join(root, "src/modules/ensayo"), process.platform === "win32" ? "junction" : "dir");
  await assert.rejects(createModule(root, "ensayo"), /enlaces simbólicos/);
  assert.deepEqual(await readdir(target), []);
}));
