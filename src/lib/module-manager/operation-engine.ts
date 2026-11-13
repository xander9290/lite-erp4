import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, mkdtemp, open, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { z } from "zod";
import { prisma } from "../prisma";
import { AccessError } from "../auth/policy";
import type { ModelActor } from "../orm/context";
import { loadAppGenerationProfile } from "../orm/generator/profile";
import { planModelInstallation } from "../orm/generator/install";
import { readInstallationState, removeInverse } from "../orm/generator/installation-state";
import { prismaBlocks } from "../orm/generator/prisma-source";
import { artifactPlan, assertNoSymlinks } from "../orm/generator/write";
import { repositoryFiles } from "../orm/generator/bind";
import { imageUploadFiles } from "../orm/generator/image-uploads";
import { assertSyncSQL, migrationFiles, pendingMigrations, readApplied, syncApplication } from "../orm/generator/sync";
import { moduleRegistration } from "../modules/scaffold";
import { defineModuleObject } from "../modules/eject";
import { array, literal, object, property, sourceFile, unwrap, variable } from "../scaffold/source-edit";
import { readSource, writeResource, type ResourceChange } from "../scaffold/resource-write";
import { moduleCatalogue } from "./service";
import { readRetirements, type RetiredApplication } from "./retirements";
import { archiveFingerprint, removalFiles, restoreScaffoldRegistration, sourceDependents, sourceFingerprint } from "./operation-files";
import { verifyDatabaseBackup } from "./operation-backup";
import { inspectRemovalDatabase } from "./operation-database";
import { schemaTables } from "./inventory";
import type { ModuleOperationPlan } from "./operation.types";
import { normalizedSQL } from "./operation-sql";

export const operationInput = z.strictObject({ module: z.string().max(100).regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/), operation: z.enum(["install", "update", "uninstall"]), policy: z.enum(["keep", "drop"]).default("keep") }).superRefine((value, context) => {
  if (value.operation !== "uninstall" && value.policy !== "keep") context.addIssue({ code: "custom", message: "La política de eliminación sólo se aplica a desinstalar." });
});
export type OperationInput = z.input<typeof operationInput>;
type StoredPlan = { view: ModuleOperationPlan; actor: ModelActor; input: z.output<typeof operationInput>; changes: ResourceChange[]; environment: string; sourceState: string; effectStarted?: boolean };
const jobId = /^[a-f0-9]{32}$/;
const jobPath = (root: string, id: string) => { if (!jobId.test(id)) throw new Error("Operación no disponible."); return join(root, ".module-operations", `${id}.json`); };
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
const literalSQL = (value: string) => `'${value.replaceAll("'", "''")}'`;
const connection = () => { const value = process.env.DATABASE_URL; if (!value) throw new Error("Falta la conexión de desarrollo."); return value; };
const schemaName = () => new URL(connection()).searchParams.get("schema") ?? "public";
const environment = () => digest(connection());
const redact = (text: string) => text.replaceAll(connection(), "[base de datos]");

export async function authorizeOperation(actor: ModelActor) {
  const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { active: true, isAdmin: true, sessionVersion: true } });
  if (!user?.active || user.sessionVersion !== actor.sessionVersion) throw new AccessError("UNAUTHENTICATED");
  if (!user.isAdmin) throw new AccessError("FORBIDDEN");
}

export function prismaCommand(root: string, args: string[], expected = [0]) {
  const result = spawnSync(process.execPath, [join(root, "node_modules/prisma/build/index.js"), ...args, "--config", join(root, "prisma7.config.ts")], { cwd: root, env: process.env, encoding: "utf8", timeout: 120000, windowsHide: true });
  if (result.error || !expected.includes(result.status ?? -1)) throw new Error(redact(`Prisma no pudo completar ${args[0]} ${args[1] ?? ""}: ${result.error?.message ?? result.stderr}`));
  return { status: result.status!, stdout: result.stdout };
}

async function schemaDiff(root: string, sources: Record<string, string>) {
  const directory = join(root, ".module-operations");
  await assertNoSymlinks(directory); await mkdir(directory, { recursive: true });
  const temporary = await mkdtemp(join(directory, "preview-"));
  try {
    await writeFile(join(temporary, "schema.prisma"), Object.values(sources).join("\n\n"));
    prismaCommand(root, ["validate", "--schema", join(temporary, "schema.prisma")]);
    return prismaCommand(root, ["migrate", "diff", "--from-schema", join(root, "prisma/models"), "--to-schema", join(temporary, "schema.prisma"), "--script"]).stdout;
  } finally {
    if (!relative(directory, temporary).startsWith("..") && dirname(temporary) === directory) await rm(temporary, { recursive: true, force: true });
  }
}

async function assertDatabaseBaseline(root: string) {
  if (pendingMigrations(await migrationFiles(root), await readApplied(connection())).length) throw new Error("Hay migraciones pendientes. Revísalas por su flujo antes de esta operación.");
  if (prismaCommand(root, ["migrate", "diff", "--from-config-datasource", "--to-schema", join(root, "prisma/models"), "--exit-code"], [0, 2]).status !== 0) throw new Error("La base no coincide con el esquema instalado. Revisa el drift o una operación interrumpida antes de continuar.");
}

export async function registeredApplicationIds(root: string) {
  const ids = new Set<string>();
  const main = sourceFile(await readSource(join(root, "src/lib/applications/registry.ts")) ?? "");
  const declaration = variable(main, "applications");
  if (!ts.isCallExpression(declaration) || declaration.arguments.length !== 1) throw new Error("Registro principal no compatible.");
  const entries = unwrap(declaration.arguments[0]);
  if (!ts.isArrayLiteralExpression(entries) || entries.elements.some(node => ts.isSpreadElement(node) && (!ts.isIdentifier(node.expression) || !["scaffoldApplications", "moduleApplications"].includes(node.expression.text)))) throw new Error("El registro principal tiene entradas dinámicas no compatibles.");
  const names = new Set(entries.elements.filter(ts.isIdentifier).map(node => node.text));
  for (const node of main.statements.filter(ts.isImportDeclaration)) {
    if (!ts.isStringLiteral(node.moduleSpecifier)) continue;
    const match = /^@\/app\/\(auth\)\/erp\/([^/]+)\/manifest$/.exec(node.moduleSpecifier.text);
    const bindings = node.importClause?.namedBindings;
    if (match && bindings && ts.isNamedImports(bindings) && bindings.elements.some(binding => names.has(binding.name.text))) ids.add(match[1]);
  }
  if (entries.elements.some(node => ts.isSpreadElement(node) && ts.isIdentifier(node.expression) && node.expression.text === "scaffoldApplications")) {
    const catalog = JSON.parse(await readSource(join(root, "src/lib/applications/scaffolded/catalog.json")) ?? '{"applications":[]}');
    for (const id of z.array(z.string()).parse(catalog.applications)) ids.add(id);
  }
  if (entries.elements.some(node => ts.isSpreadElement(node) && ts.isIdentifier(node.expression) && node.expression.text === "moduleApplications")) {
    const file = sourceFile(await readSource(join(root, "src/modules/index.ts")) ?? "");
    const refs = new Set(array(variable(file, "modules")).elements.map(node => { if (!ts.isIdentifier(node)) throw new Error("Índice de módulos no compatible."); return node.text; }));
    for (const node of file.statements.filter(ts.isImportDeclaration)) if (node.importClause?.name && refs.has(node.importClause.name.text) && ts.isStringLiteral(node.moduleSpecifier)) {
      const match = /^\.\/([a-z][a-z0-9]*)\/manifest$/.exec(node.moduleSpecifier.text);
      if (!match) throw new Error("Import de módulo no compatible."); ids.add(match[1]);
    }
  }
  return ids;
}

async function accessKeys(root: string, id: string) {
  const text = await readSource(join(root, "src/modules", id, "manifest.ts"));
  if (text === null) return { groups: [], rules: [] };
  const node = defineModuleObject(sourceFile(text));
  const has = (name: string) => node.properties.some(item => item.name && (ts.isIdentifier(item.name) || ts.isStringLiteral(item.name)) && item.name.text === name);
  const groups = has("groups") ? object(property(node, "groups")).properties.map(item => { if (!item.name || (!ts.isIdentifier(item.name) && !ts.isStringLiteral(item.name))) throw new Error("Grupos no literales."); return `${id}.${item.name.text}`; }) : [];
  const rules = has("rules") ? array(property(node, "rules")).elements.map(item => `${id}.${literal(property(object(item as ts.Expression), "id"))}`) : [];
  return { groups, rules };
}

function cleanupSQL(schema: string, models: readonly string[], modelIds: readonly string[], keys: { groups: string[]; rules: string[] }) {
  const table = (name: string) => `${quote(schema)}.${quote(name)}`;
  const statements = models.length ? [`DELETE FROM ${table("record_activities")} WHERE model IN (${models.map(literalSQL).join(", ")});`] : [];
  if (keys.groups.length) statements.push(`DELETE FROM ${table("access_user_groups")} WHERE group_id IN (${keys.groups.map(literalSQL).join(", ")});`);
  const conditions = [keys.groups.length ? `group_id IN (${keys.groups.map(literalSQL).join(", ")})` : "", modelIds.length ? `model IN (${modelIds.map(literalSQL).join(", ")})` : ""].filter(Boolean);
  if (conditions.length) statements.push(`DELETE FROM ${table("access_model_overrides")} WHERE ${conditions.join(" OR ")};`);
  if (keys.rules.length) statements.push(`DELETE FROM ${table("access_rule_states")} WHERE rule_id IN (${keys.rules.map(literalSQL).join(", ")});`);
  return statements.join("\n");
}

async function buildPlan(root: string, actor: ModelActor, input: z.output<typeof operationInput>, id = randomBytes(16).toString("hex")): Promise<StoredPlan> {
  await authorizeOperation(actor);
  await assertDatabaseBaseline(root);
  const snapshot = await readInstallationState(root);
  const retired = await readRetirements(root);
  const catalogue = await moduleCatalogue(prisma, actor, { root, schema: schemaName(), registered: await registeredApplicationIds(root) });
  const record = catalogue.find(item => item.id === input.module);
  const retained = retired.value.applications.find(item => item.id === input.module);
  if (!record && !retained) throw new Error("Módulo no disponible.");
  const descriptor = record ?? { ...retained!, depends: [], dependents: [], issues: [], models: retained!.models, kind: retained!.kind, name: retained!.name };
  const blockers: string[] = [...descriptor.issues];
  const warnings = ["La operación requiere reiniciar el servidor y cerrar el mantenimiento al terminar. Las imágenes remotas se conservan."];
  const changes: ResourceChange[] = [];
  let recordCounts: ModuleOperationPlan["recordCounts"];
  let sql = "";
  if (descriptor.kind === "manual" || descriptor.kind === "unknown") blockers.push("Esta aplicación requiere un adaptador específico; el motor genérico no puede modificar entidades compartidas.");
  if (["modulos", "usuarios", "contactos", "accesos"].includes(input.module)) blockers.push("Aplicación de infraestructura protegida.");
  if (input.operation !== "uninstall") {
    if (retained && input.operation !== "install") blockers.push("Para recuperar una aplicación retirada, usa Instalar antes de actualizarla.");
    if (record?.missingDependencies.length) blockers.push(`Dependencias no disponibles: ${record.missingDependencies.join(", ")}.`);
    if (!descriptor.models.length) blockers.push("Añade el primer modelo antes de instalar.");
    if (input.operation === "install" && snapshot.state.modules[input.module] && !retained) blockers.push("Ya tiene una instalación gestionada. Usa Actualizar.");
    if (input.operation === "update" && !snapshot.state.modules[input.module]) blockers.push("No tiene instalación gestionada. Usa Instalar.");
    if (!blockers.length && retained) {
      if (!retained.archiveId || !retained.archiveHash) blockers.push("No hay un archivo de código verificable para recuperar esta aplicación en esta máquina.");
      else {
        const archivePath = jobPath(root, retained.archiveId); await assertNoSymlinks(archivePath);
        let archive: StoredPlan;
        try { archive = JSON.parse(await readFile(archivePath, "utf8")); }
        catch { throw new Error("El respaldo de código no está disponible en esta máquina. Recupéralo antes de reactivar la aplicación."); }
        if (archive.view.phase !== "complete" || archive.view.operation !== "uninstall" || archive.input.policy !== "keep" || archive.input.module !== input.module || archive.environment !== environment()) throw new Error("El respaldo de código no corresponde a esta aplicación y entorno.");
        const saved = archive.changes.filter(change => change.after === null);
        const allowed = [retained.kind === "declarative" ? `src/modules/${input.module}/` : `src/app/(auth)/erp/${input.module}/`, ...["apps", "bindings", "uploads"].map(folder => `src/generated/orm/${folder}/${input.module}/`)];
        for (const change of saved) {
          const path = relative(root, change.path).replaceAll("\\", "/");
          if (!allowed.some(prefix => path.startsWith(prefix)) || path.split("/").includes("..") || change.before === null || await readSource(change.path) !== null) throw new Error("El alcance del respaldo cambió o existen fuentes que se sobrescribirían.");
        }
        if (archiveFingerprint(root, saved) !== retained.archiveHash) throw new Error("Se modificó el respaldo de código. No se recuperarán fuentes sin verificar.");
        changes.push(...saved.map(change => ({ path: change.path, before: null, after: change.before! })));
        changes.push(...await (retained.kind === "declarative" ? moduleRegistration(root, input.module) : restoreScaffoldRegistration(root, input.module)));
        changes.push({ path: retired.path, before: retired.before, after: `${JSON.stringify({ version: 1, applications: retired.value.applications.filter(item => item.id !== input.module) }, null, 2)}\n` });
        warnings.push("Se recuperará el código verificado y la misma identidad, conservando registros, actividad y asignaciones de acceso. No se aprobará SQL adicional durante la reactivación.");
      }
    } else if (!blockers.length) {
      const profile = await loadAppGenerationProfile(root, input.module);
      if (!profile) throw new Error("No se pudo cargar el perfil de instalación.");
      const proposal = await planModelInstallation(root, profile, input.operation === "update");
      changes.push(...proposal.changes);
      if (profile.runtime) changes.push(...await moduleRegistration(root, input.module));
      else {
        for (const [directory, owner, files] of [
          [`src/generated/orm/apps/${input.module}`, input.module, proposal.artifacts],
          [`src/generated/orm/uploads/${input.module}`, `uploads-${input.module}`, imageUploadFiles(profile.module)],
          [`src/generated/orm/bindings/${input.module}`, `binding-${input.module}`, repositoryFiles(profile.module)],
        ] as const) {
          const plan = await artifactPlan(join(root, directory), owner, files);
          for (const [name, after] of Object.entries({ ...files, "generation-manifest.json": plan.manifestText })) {
            const path = join(root, directory, name), before = await readSource(path);
            if (before !== after) changes.push({ path, before, after });
          }
        }
      }
      sql = proposal.sql;
      assertSyncSQL(sql);
      if (!profile.runtime) warnings.push("Se regenerarán contratos, uploads y bindings gestionados; las vistas personalizadas se conservan.");
    }
  } else {
    if (retained && input.policy === "keep") blockers.push("La aplicación ya está retirada con sus datos conservados. No es necesario volver a retirarla.");
    if (!snapshot.state.modules[input.module]) blockers.push("No hay propiedad instalada que permita retirar este módulo automáticamente.");
    if (descriptor.dependents.length) blockers.push(`Aplicaciones dependientes: ${descriptor.dependents.join(", ")}.`);
    const owned = new Set(descriptor.models);
    const installedModels = Object.entries(snapshot.owners).filter(([, owner]) => owner === input.module).map(([model]) => model);
    if (owned.size !== installedModels.length || installedModels.some(model => !owned.has(model))) blockers.push("La declaración y la propiedad instalada no coinciden. Resuelve los cambios de modelos antes de retirar la aplicación.");
    if (catalogue.some(item => item.id !== input.module && item.issues.length)) blockers.push("Hay manifests que no se pudieron inspeccionar. Resuélvelos antes de comprobar dependencias de retirada.");
    for (const [id, installation] of Object.entries(snapshot.state.modules)) if (id !== input.module && installation.inverses.some(inverse => inverse.file === snapshot.state.modules[input.module]?.file)) blockers.push(`El esquema de ${id} depende de este módulo.`);
    if (!blockers.length && !retained) {
      if (input.policy === "keep") {
        const profile = await loadAppGenerationProfile(root, input.module);
        if (!profile) throw new Error("No se pudo verificar la declaración antes de archivarla.");
        const proposal = await planModelInstallation(root, profile, true);
        if (normalizedSQL(proposal.sql) || proposal.changes.some(change => change.path.endsWith(".prisma"))) blockers.push("Sincroniza los cambios pendientes del modelo antes de retirar la aplicación conservando datos.");
      }
      changes.push(...await removalFiles(root, input.module, descriptor.kind));
      const keys = await accessKeys(root, input.module);
      blockers.push(...await sourceDependents(root, changes, descriptor.models, [...keys.groups, ...keys.rules], schemaTables(snapshot.sources).filter(table => owned.has(table.model)).map(table => table.name)));
    }
    if (!blockers.length && retained) blockers.push(...await sourceDependents(root, [], descriptor.models, [...retained.groups, ...retained.rules], schemaTables(snapshot.sources).filter(table => owned.has(table.model)).map(table => table.name)));
    if (!blockers.length) {
      const keys = retained ? { groups: retained.groups, rules: retained.rules } : await accessKeys(root, input.module);
      const nextRetired = retired.value.applications.filter(item => item.id !== input.module);
      if (input.policy === "keep") {
        nextRetired.push({ id: input.module, name: descriptor.name, kind: descriptor.kind as RetiredApplication["kind"], version: record?.version ?? retained!.version, models: descriptor.models, depends: descriptor.depends, archiveId: id, archiveHash: archiveFingerprint(root, changes), ...keys });
        warnings.push("Se conservan esquema, tablas, registros, actividad y asignaciones. El ID queda reservado.");
      } else {
        const database = await inspectRemovalDatabase(connection(), schemaName(), schemaTables(snapshot.sources).filter(table => owned.has(table.model)).map(table => table.name));
        blockers.push(...database.blockers); recordCounts = database.counts;
        const installation = snapshot.state.modules[input.module];
        const sources = { ...snapshot.sources };
        for (const inverse of installation.inverses) sources[inverse.file] = removeInverse(sources[inverse.file], inverse);
        delete sources[installation.file];
        for (const source of Object.values(sources)) for (const block of prismaBlocks(source).filter(block => block.kind === "model")) for (const model of owned) if (new RegExp(`\\b${model}\\b`).test(block.maskedBody)) blockers.push(`El modelo ${block.name} conserva una referencia a ${model}.`);
        if (!blockers.length) {
          for (const [name, before] of Object.entries(snapshot.sources)) if (sources[name] !== before) changes.push({ path: join(snapshot.directory, name), before, after: sources[name] ?? null });
          const modules = { ...snapshot.state.modules }; delete modules[input.module];
          changes.push({ path: join(root, "prisma/.orm-installations.json"), before: snapshot.stateText!, after: `${JSON.stringify({ version: 1, modules }, null, 2)}\n` });
          const publicModels = descriptor.kind === "declarative" ? descriptor.models.map(name => `${input.module}.${name.slice(input.module.length).toLowerCase()}`) : [];
          sql = cleanupSQL(schemaName(), descriptor.models, publicModels, keys) + "\n" + await schemaDiff(root, sources);
          warnings.push("Se eliminarán registros, actividad y configuración exclusiva. Antes del SQL se creará y restaurará un respaldo en una base temporal.");
        }
      }
      const after = `${JSON.stringify({ version: 1, applications: nextRetired }, null, 2)}\n`;
      if (after !== retired.before) changes.push({ path: retired.path, before: retired.before, after });
    }
  }
  const sourceState = await sourceFingerprint(root);
  const fingerprint = digest(JSON.stringify({ sources: sourceState, input, sql: normalizedSQL(sql), recordCounts, environment: environment(), changes: changes.map(change => ({ path: relative(root, change.path), after: change.after === null ? null : digest(change.after) })) }));
  return { actor, input, environment: environment(), sourceState, changes, view: { id, module: input.module, name: descriptor.name, operation: input.operation, policy: input.policy, fingerprint, createdAt: new Date().toISOString(), sql, changes: changes.map(change => ({ path: relative(root, change.path).replaceAll("\\", "/"), action: change.after === null ? "delete" : change.before === null ? "create" : "update" })), blockers: [...new Set(blockers)], warnings, phase: "review", message: blockers.length ? "Resuelve los bloqueos antes de aplicar." : "Plan preparado para revisión.", ...(recordCounts ? { recordCounts } : {}) } };
}

async function save(root: string, plan: StoredPlan) {
  const directory = join(root, ".module-operations"); await assertNoSymlinks(directory); await mkdir(directory, { recursive: true });
  const path = jobPath(root, plan.view.id); await assertNoSymlinks(path);
  await writeFile(path, JSON.stringify(plan), { mode: 0o600 });
}
export async function reviewModuleOperation(root: string, actor: ModelActor, input: unknown) {
  const plan = await buildPlan(resolve(root), actor, operationInput.parse(input)); await save(resolve(root), plan); return plan.view;
}
export async function readModuleOperation(root: string, actor: ModelActor, id: string) {
  await authorizeOperation(actor);
  const path = jobPath(resolve(root), id); await assertNoSymlinks(path);
  const plan = JSON.parse(await readFile(path, "utf8")) as StoredPlan;
  plan.input = operationInput.parse(plan.input);
  if (plan.view.id !== id || !/^[a-f0-9]{64}$/.test(plan.view.fingerprint) || !["review", "running", "complete", "failed"].includes(plan.view.phase)) throw new Error("El archivo de operación no es válido.");
  return plan;
}

export async function applyModuleOperation(root: string, actor: ModelActor, id: string, fingerprint: string, confirmedModule: string) {
  root = resolve(root);
  if (process.env.NODE_ENV === "production") throw new Error("Las operaciones de esquema están habilitadas sólo en desarrollo.");
  const stored = await readModuleOperation(root, actor, id);
  if (stored.actor.id !== actor.id || stored.actor.sessionVersion !== actor.sessionVersion) throw new AccessError("FORBIDDEN");
  if (stored.view.phase === "complete") return stored.view;
  if (stored.view.phase !== "review") throw new Error("La operación ya empezó. Revisa su resultado antes de crear otro plan.");
  if (stored.view.fingerprint !== fingerprint || stored.environment !== environment() || Date.now() - Date.parse(stored.view.createdAt) > 30 * 60000 || confirmedModule !== stored.input.module) throw new Error("Confirmación o plan obsoletos. Vuelve a revisar la operación.");
  const lockPath = join(root, "prisma/.module-operation.lock"); await assertNoSymlinks(lockPath);
  const lock = await open(lockPath, "wx").catch(error => { throw new Error((error as NodeJS.ErrnoException).code === "EEXIST" ? "Hay otra operación activa. Consulta su resultado antes de continuar." : "No se pudo reservar la operación."); });
  await lock.writeFile(String(process.pid));
  let maintenanceCreated = false;
  try {
    const fresh = await buildPlan(root, actor, stored.input, stored.view.id);
    if (fresh.view.fingerprint !== fingerprint || fresh.view.blockers.length) throw new Error("El proyecto, la base o el alcance cambiaron. Revisa un plan nuevo.");
    // Stored JSON is only a review record: executable SQL/paths always come from
    // the freshly recomputed plan, never from edited disk or browser payloads.
    stored.changes = fresh.changes;
    stored.sourceState = fresh.sourceState;
    stored.view = { ...fresh.view, id: stored.view.id, createdAt: stored.view.createdAt, phase: "running", message: "Operación en curso." };
    await save(root, stored);
    const maintenance = join(root, ".module-operations/maintenance.json");
    if (await readSource(maintenance) !== null) throw new Error("Hay otro mantenimiento abierto. Ciérralo antes de iniciar una operación.");
    await writeFile(maintenance, JSON.stringify({ id, module: stored.input.module, actor: actor.id }), { flag: "wx", mode: 0o600 });
    maintenanceCreated = true;
    await authorizeOperation(actor);
    if (stored.input.operation !== "uninstall") {
      stored.effectStarted = true; await save(root, stored);
      if ((await readRetirements(root)).value.applications.some(item => item.id === stored.input.module)) await writeResource(root, fresh.changes);
      await syncApplication(root, stored.input.module, {
        log: () => {},
        confirm: async () => {
          await authorizeOperation(actor);
          const files = pendingMigrations(await migrationFiles(root), await readApplied(connection()));
          if (files.length !== 1 || normalizedSQL(files[0].sql) !== normalizedSQL(stored.view.sql)) throw new Error("El SQL preparado ya no coincide con el plan aprobado. No se aplicó.");
          return true;
        },
      });
    } else {
      if (stored.input.policy === "drop") await verifyDatabaseBackup(root, id, connection());
      await authorizeOperation(actor);
      stored.effectStarted = true; await save(root, stored);
      await writeResource(root, fresh.changes);
      if (stored.input.policy === "drop") {
        const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
        const directory = join(root, "prisma/migrations", `${stamp}_uninstall_${stored.input.module.replaceAll("-", "_")}`);
        await assertNoSymlinks(directory); await mkdir(directory);
        await writeFile(join(directory, "migration.sql"), `-- Reviewed module operation ${id}\nBEGIN;\nSET LOCAL lock_timeout = '10s';\n${stored.view.sql}\nCOMMIT;\n`, { flag: "wx" });
        await authorizeOperation(actor);
        prismaCommand(root, ["migrate", "deploy"]);
      }
      prismaCommand(root, ["generate"]);
      const compiled = spawnSync(process.execPath, [join(root, "node_modules/typescript/bin/tsc"), "--noEmit", "--incremental", "false"], { cwd: root, encoding: "utf8", timeout: 120000, windowsHide: true });
      if (compiled.error || compiled.status !== 0) throw new Error("La retirada se preparó pero TypeScript no pudo verificarse. Conserva el mantenimiento y revisa las referencias restantes.");
      // Remove empty source directories only; never recursively delete a source tree.
      const allowed = [join(root, "src/modules", stored.input.module), join(root, "src/app/(auth)/erp", stored.input.module), ...["apps", "bindings", "uploads"].map(folder => join(root, "src/generated/orm", folder, stored.input.module))];
      for (const path of [...new Set(fresh.changes.filter(change => change.after === null).map(change => dirname(change.path)))].sort((a, b) => b.length - a.length)) {
        let directory = path;
        while (allowed.some(base => directory === base || directory.startsWith(base + sep))) {
          try { await assertNoSymlinks(directory); await rmdir(directory); } catch { break; }
          directory = dirname(directory);
        }
      }
    }
    stored.view.phase = "complete";
    stored.view.canFinish = true;
    stored.view.message = "Operación completada. Reinicia el servidor y finaliza el mantenimiento antes de continuar trabajando.";
    await save(root, stored); return stored.view;
  } catch (error) {
    if (stored.view.phase === "running") { stored.view.phase = "failed"; stored.view.canFinish = maintenanceCreated && !stored.effectStarted; stored.view.message = redact(error instanceof Error ? error.message : "Falló la operación. Revisa los pasos completados antes de continuar."); await save(root, stored); }
    throw error;
  } finally { await lock.close(); await rm(lockPath, { force: true }); }
}

export async function finishModuleMaintenance(root: string, actor: ModelActor, id: string) {
  const plan = await readModuleOperation(root, actor, id);
  if (plan.view.phase !== "complete" && !(plan.view.phase === "failed" && !plan.effectStarted && await sourceFingerprint(root) === plan.sourceState)) throw new Error("La operación no terminó o ya preparó cambios. Revisa el estado antes de cerrar mantenimiento.");
  const path = join(root, ".module-operations/maintenance.json"); await assertNoSymlinks(path);
  const current = JSON.parse(await readSource(path) ?? "null");
  if (current?.id !== id || current.actor !== plan.actor.id) throw new Error("El mantenimiento no corresponde a esta operación.");
  await assertDatabaseBaseline(root);
  await rm(path);
  plan.view.message = "Mantenimiento finalizado. Ya puedes continuar trabajando.";
  plan.view.canFinish = false;
  await save(root, plan);
  return plan.view;
}
