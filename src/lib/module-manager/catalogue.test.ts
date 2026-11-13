import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PrismaClient } from "@/generated/prisma/client";
import { inspectManifest, readModuleInventory, resolveCatalogue, schemaTables, type ModuleInventory } from "./inventory";
import { cataloguePage, moduleCatalogue } from "./service";
import { sourceHash } from "../orm/generator/installation-state";

const manifest = (id = "ensayo", models = "tarea: Tarea") => `throw new Error("No debe ejecutarse"); export default defineModule({id: "${id}", name:"Ensayo", icon:"boxes", models:{${models}}});`;
const schema = `model EnsayoTarea {
  id String @id
  name String @map("titulo")
  tags String[]
  ownerId String @map("owner_id")
  owner User @relation(fields: [ownerId], references: [id])
  @@map("tareas_personalizadas")
}
model User {
  id String @id
  tareas EnsayoTarea[]
  @@map("users")
}
`;
const declaration = (id: string, models: string[] = [], depends: string[] = []) => ({ id, name: id, description: "", version: "0.1.0", kind: "manual" as const, models, depends, issues: [] });
const inventory = (): ModuleInventory => ({ declarations: [inspectManifest(manifest(), "ensayo", "declarative")], tables: schemaTables({ "models.prisma": schema }), managed: new Set(["ensayo"]), owners: { EnsayoTarea: "ensayo" } });
const columns = ["id", "titulo", "tags", "owner_id"].map(column_name => ({ table_name: "tareas_personalizadas", column_name }));
const state = { query: "", sort: "name", direction: "asc", page: 1, pageSize: 10, filters: [] };

async function fixture(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(join(await realpath(tmpdir()), "lite-manager-"));
  try {
    await mkdir(join(root, "prisma/models"), { recursive: true });
    await mkdir(join(root, "src/modules/ensayo"), { recursive: true });
    await writeFile(join(root, "src/modules/ensayo/manifest.ts"), manifest());
    const own = schema.slice(0, schema.indexOf("model User"));
    await writeFile(join(root, "prisma/models/orm-ensayo.prisma"), own);
    await writeFile(join(root, "prisma/models/user.prisma"), schema.slice(schema.indexOf("model User")));
    await writeFile(join(root, "prisma/.orm-installations.json"), JSON.stringify({ version: 1, modules: { ensayo: { file: "orm-ensayo.prisma", hash: sourceHash(own), inverses: [] } } }));
    await run(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}

test("inspecciona manifests sin ejecutarlos y rechaza metadatos dinámicos/IDs ambiguos", () => {
  assert.deepEqual(inspectManifest(manifest(), "ensayo", "declarative").models, ["EnsayoTarea"]);
  assert.equal(inspectManifest('export const app = defineApplication({ id:"anterior",name:"Anterior",version:"1.0.0",models:["Trabajo"],depends:["contactos"] });', "anterior", "scaffold").kind, "scaffold");
  assert.throws(() => inspectManifest(manifest("otro"), "ensayo", "declarative"));
  assert.throws(() => inspectManifest(manifest().replace('name:"Ensayo"', "name: secret()"), "ensayo", "declarative"));
  assert.throws(() => inspectManifest(manifest("ensayo", "...extras"), "ensayo", "declarative"));
});

test("proyecta nombres físicos, escalares/arrays y excluye relaciones e inversas", () => {
  assert.deepEqual(schemaTables({ schema }), [
    { model: "EnsayoTarea", name: "tareas_personalizadas", columns: ["id", "titulo", "tags", "owner_id"] },
    { model: "User", name: "users", columns: ["id"] },
  ]);
});

test("distingue instalado, disponible, pendiente, fuera de catálogo y módulo vacío", () => {
  assert.equal(resolveCatalogue(inventory(), new Set(["ensayo"]), columns)[0].status, "installed");
  assert.equal(resolveCatalogue(inventory(), new Set(["ensayo"]), [])[0].status, "pending");
  assert.equal(resolveCatalogue(inventory(), new Set(["ensayo"]), columns.slice(1))[0].tables[0].missingColumns[0], "id");
  assert.equal(resolveCatalogue(inventory(), new Set(), columns)[0].status, "unregistered");
  const available = inventory(); available.managed.clear(); available.owners = {}; available.tables = [];
  assert.equal(resolveCatalogue(available, new Set(), [])[0].status, "available");
  available.declarations = [inspectManifest(manifest("ensayo", ""), "ensayo", "declarative")];
  assert.equal(resolveCatalogue(available, new Set(), [])[0].status, "empty");
  const changed = inventory(); changed.owners = { EnsayoAnterior: "ensayo" };
  assert.equal(resolveCatalogue(changed, new Set(["ensayo"]), columns)[0].status, "pending");
});

test("comentarios/literales no cambian mappings ni relaciones y los tipos se leen completos", () => {
  const sources = { schema: `model StringEntity {
  id String @id
}
model Child {
  id String @id
  note String @default("@relation") // @map("falso")
  parent StringEntity?
  @@map("child_table")
}` };
  assert.deepEqual(schemaTables(sources), [
    { model: "StringEntity", name: "StringEntity", columns: ["id"] },
    { model: "Child", name: "child_table", columns: ["id", "note"] },
  ]);
});

test("dependencias transitivas, ciclos, IDs duplicados y fuentes ausentes requieren revisión", () => {
  const source = inventory(); source.declarations = [declaration("a", [], ["b"]), declaration("b", [], ["c"]), declaration("c", ["Missing"])];
  const rows = resolveCatalogue(source, new Set(["a", "b", "c", "sinfuente"]), []);
  assert.equal(rows.find(row => row.id === "a")?.status, "review");
  assert.deepEqual(rows.find(row => row.id === "c")?.dependents, ["b"]);
  assert.equal(rows.find(row => row.id === "sinfuente")?.status, "review");
  source.declarations = [declaration("a", [], ["b"]), declaration("b", [], ["a"])];
  assert.ok(resolveCatalogue(source, new Set(["a", "b"]), []).every(row => row.issues.some(issue => issue.includes("ciclo"))));
  source.declarations = [declaration("a"), declaration("a")];
  assert.equal(resolveCatalogue(source, new Set(["a"]), [])[0].status, "review");
});

test("inventario detecta fuentes fuera del registro, restos de instalación y preserva archivos", async () => fixture(async root => {
  const path = join(root, "src/modules/ensayo/manifest.ts");
  const original = await readFile(path, "utf8");
  const result = await readModuleInventory(root);
  assert.equal(result.declarations[0].id, "ensayo");
  assert.equal(result.managed.has("ensayo"), true);
  assert.equal(await readFile(path, "utf8"), original);
  await rm(path);
  assert.equal((await readModuleInventory(root)).declarations[0].kind, "unknown");
}));

test("inventario marca enlaces y manifests inválidos sin ejecutarlos", async () => fixture(async root => {
  const target = join(root, "outside"); await mkdir(target);
  await writeFile(join(target, "manifest.ts"), manifest("enlace"));
  await symlink(target, join(root, "src/modules/enlace"), process.platform === "win32" ? "junction" : "dir");
  await writeFile(join(root, "src/modules/ensayo/manifest.ts"), "export default defineModule({");
  const result = await readModuleInventory(root);
  assert.ok(result.declarations.every(row => row.issues.length));
}));

test("catálogo filtra/pagina con política fija y rechaza campos u operaciones falsificados", () => {
  const rows = resolveCatalogue(inventory(), new Set(["ensayo"]), columns);
  assert.equal(cataloguePage(rows, { ...state, query: "INSTALADO" }).total, 1);
  assert.equal(cataloguePage(rows, { ...state, filters: [{ field: "status", operator: "eq", value: "available" }] }).total, 0);
  assert.equal(cataloguePage(rows, { ...state, page: 99 }).page, 1);
  for (const patch of [{ sort: "password" }, { groupBy: ["status"] }, { filters: [{ field: "password", operator: "eq", value: "x" }] }, { filters: [{ field: "name", operator: "gt", value: "x" }] }, { pageSize: 1000 }]) assert.throws(() => cataloguePage(rows, { ...state, ...patch }));
});

test("servicio revalida admin/sesión antes de leer fuentes y parametriza el schema", async () => fixture(async root => {
  let account = { active: true, isAdmin: true, sessionVersion: 4 };
  let queries = 0;
  const database = { $transaction: async (run: (tx: unknown) => unknown) => run({
    $executeRaw: async () => 0,
    user: { findUnique: async () => account },
    $queryRaw: async (sql: TemplateStringsArray, schemaName: string) => { assert.ok(sql.join("").includes("information_schema")); assert.equal(schemaName, "fixture_schema"); queries++; return columns; },
  }) } as unknown as PrismaClient;
  const context = { root, schema: "fixture_schema", registered: new Set(["ensayo"]) };
  assert.equal((await moduleCatalogue(database, { id: "admin", sessionVersion: 4 }, context))[0].status, "installed");
  assert.equal(queries, 1);
  for (const patch of [{ isAdmin: false }, { active: false }, { sessionVersion: 5 }]) {
    account = { active: true, isAdmin: true, sessionVersion: 4, ...patch };
    await assert.rejects(moduleCatalogue(database, { id: "forged-admin", sessionVersion: 4 }, { ...context, root: join(root, "missing") }), /administrador|sesión/);
  }
  assert.equal(queries, 1);
}));
