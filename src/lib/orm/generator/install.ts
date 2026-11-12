import "server-only";
import { mkdir, mkdtemp, open, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { GenerationProfile } from "./profile";
import { prepareModuleArtifacts } from "./prepare";
import { inverseText, optionalSource, readInstallationState, removeInverse, sourceHash, statePath } from "./installation-state";
import { prismaBlocks } from "./prisma-source";
import { assertNoSymlinks } from "./write";
import { assertAdditiveEvolution } from "./evolution";

/** Source installation only. SQL is a review artifact, never executed here. */
export async function planModelInstallation(root: string, profile: GenerationProfile, update = false, force = false) {
  if (force && !update) throw new Error("--force requiere una actualización explícita.");
  const snapshot = await readInstallationState(root);
  const artifacts = await prepareModuleArtifacts(root, profile.module, profile.externalOwners);
  const id = profile.module.id, filename = `orm-${id}.prisma`;
  const installed = Object.hasOwn(snapshot.state.modules, id) ? snapshot.state.modules[id] : undefined;
  const hash = sourceHash(artifacts["models.prisma"]);
  if (installed && installed.hash !== hash) {
    if (!update) throw new Error(`El modelo de ${id} cambió. Revisa la propuesta y usa --update para una actualización aditiva.`);
    assertAdditiveEvolution(snapshot.clean[installed.file], artifacts["models.prisma"], force);
  }
  const changes: { path: string; before: string | null; after: string }[] = [];
  if (!installed || installed.hash !== hash) {
    const path = join(snapshot.directory, filename);
    await assertNoSymlinks(path);
    if (!installed && await optionalSource(path) !== null) throw new Error(`No se sobrescribirá el esquema personalizado ${filename}.`);
    const review = JSON.parse(artifacts["review.json"]) as { relations: { target: string; declaration: string }[] };
    const local = new Set(profile.module.models.map(entry => entry.model.name));
    const grouped = new Map<string, string[]>();
    for (const relation of review.relations.filter(relation => !local.has(relation.target))) {
      grouped.set(relation.target, [...(grouped.get(relation.target) ?? []), relation.declaration]);
    }
    const patched = { ...snapshot.sources };
    for (const inverse of installed?.inverses ?? []) patched[inverse.file] = removeInverse(patched[inverse.file], inverse);
    const inverses: { file: string; target: string; text: string }[] = [];
    for (const [target, declarations] of grouped) {
      const matches = Object.entries(patched).flatMap(([file, source]) => prismaBlocks(source).filter(block => block.kind === "model" && block.name === target).map(block => ({ file, source, block })));
      if (matches.length !== 1) throw new Error(`No se pudo ubicar un único destino ${target}.`);
      const { file, source, block } = matches[0];
      const text = inverseText(id, target, declarations);
      if (source.includes(`// BEGIN lite-erp:${id}:${target}`)) throw new Error(`Marcador de instalación sin propiedad en ${file}.`);
      patched[file] = source.slice(0, block.end - 1) + text + source.slice(block.end - 1);
      inverses.push({ file, target, text });
    }
    let ownSource = artifacts["models.prisma"];
    // A dependent module owns its inverse, even when this module owns the containing file.
    for (const [other, entry] of Object.entries(snapshot.state.modules)) {
      if (other === id) continue;
      for (const inverse of entry.inverses.filter(inverse => inverse.file === filename)) {
        const block = prismaBlocks(ownSource).find(block => block.kind === "model" && block.name === inverse.target);
        if (!block) throw new Error(`Otro módulo depende de ${inverse.target}.`);
        ownSource = ownSource.slice(0, block.end - 1) + inverse.text + ownSource.slice(block.end - 1);
      }
    }
    changes.push({ path, before: installed ? snapshot.sources[filename] : null, after: ownSource });
    for (const [file, after] of Object.entries(patched)) if (after !== snapshot.sources[file]) changes.push({ path: join(snapshot.directory, file), before: snapshot.sources[file], after });
    const state = { version: 1, modules: { ...snapshot.state.modules, [id]: { file: filename, hash, inverses } } };
    changes.push({ path: statePath(root), before: snapshot.stateText, after: `${JSON.stringify(state, null, 2)}\n` });
  }
  return { id, changes, sql: artifacts["migration.preview.sql"], snapshot };
}

/** Exclusive installer lock, optimistic source checks and rollback for ordinary write failures. */
export async function installModels(root: string, profile: GenerationProfile, write = false, update = false, force = false, expectedChanges?: readonly { path: string; before: string | null; after: string }[]) {
  if (!write) return planModelInstallation(root, profile, update, force);
  await assertNoSymlinks(join(root, "prisma"));
  const lock = join(root, "prisma/.orm-install.lock");
  const handle = await open(lock, "wx");
  let stage: string | undefined, preserve = false;
  const applied: { path: string; backup?: string }[] = [];
  try {
    const plan = await planModelInstallation(root, profile, update, force);
    if (expectedChanges && JSON.stringify(plan.changes) !== JSON.stringify(expectedChanges)) throw new Error("La propuesta cambió durante la preparación. Repite orm:sync.");
    if (!plan.changes.length) return plan;
    stage = await mkdtemp(join(root, "prisma/.orm-install-"));
    await mkdir(join(stage, "next"));
    await mkdir(join(stage, "previous"));
    for (const [i, change] of plan.changes.entries()) await writeFile(join(stage, "next", String(i)), change.after, { flag: "wx" });
    // Also check unrelated schema sources: the SQL preview must describe the schema being installed.
    const current = await readInstallationState(root);
    if (current.stateText !== plan.snapshot.stateText || JSON.stringify(current.sources) !== JSON.stringify(plan.snapshot.sources)) throw new Error("El esquema cambió durante la revisión. Repite la instalación.");
    for (const [i, change] of plan.changes.entries()) {
      await assertNoSymlinks(change.path);
      if (await optionalSource(change.path) !== change.before) throw new Error("Un archivo cambió durante la instalación.");
      const entry: { path: string; backup?: string } = { path: change.path };
      if (change.before !== null) { entry.backup = join(stage, "previous", String(i)); await rename(change.path, entry.backup); }
      applied.push(entry);
      await rename(join(stage, "next", String(i)), change.path);
    }
    return plan;
  } catch (error) {
    const failures: unknown[] = [];
    for (const entry of applied.reverse()) {
      try { await rm(entry.path, { force: true }); if (entry.backup) await rename(entry.backup, entry.path); }
      catch (failure) { failures.push(failure); }
    }
    if (failures.length) { preserve = true; throw new AggregateError([error, ...failures], `Restauración incompleta; respaldos conservados en ${stage}.`); }
    throw error;
  } finally {
    await handle.close();
    if (stage && !preserve) await rm(stage, { recursive: true, force: true });
    await rm(lock, { force: true });
  }
}
