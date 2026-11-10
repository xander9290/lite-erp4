import "server-only";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, parse, resolve } from "node:path";

const manifestName = "generation-manifest.json";
const hash = (value: string) => createHash("sha256").update(value.replace(/\r\n/g, "\n")).digest("hex");
type Manifest = { generator: "lite-erp-orm-v1"; module: string; files: Record<string, string> };
const validName = (value: string) => /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(value) && value !== "." && value !== "..";
async function readOptional(path: string) {
  try { return await readFile(path, "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}
export async function assertNoSymlinks(path: string) {
  const absolute = resolve(path), root = parse(absolute).root;
  let current = root;
  for (const part of absolute.slice(root.length).split(/[\\/]/)) {
    current = join(current, part);
    try { if ((await lstat(current)).isSymbolicLink()) throw new Error(`No se permiten enlaces simbólicos en la salida: ${current}.`); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") break; throw error; }
  }
}

/** Preflight every artifact before any change. No force flag and no automatic deletion. */
export async function artifactPlan(directory: string, module: string, files: Record<string, string>) {
  if (!isAbsolute(directory)) throw new Error("La salida del generador debe ser una ruta absoluta.");
  await assertNoSymlinks(directory);
  for (const name of [...Object.keys(files), manifestName]) {
    if (!validName(name) || (name === manifestName && Object.hasOwn(files, name))) throw new Error(`Nombre de artefacto inválido: ${name}.`);
    await assertNoSymlinks(join(directory, name));
  }
  const text = await readOptional(join(directory, manifestName));
  const previous: Manifest | null = text === null ? null : JSON.parse(text);
  if (text !== null && (!previous || typeof previous !== "object" || Array.isArray(previous) || previous.generator !== "lite-erp-orm-v1" || previous.module !== module || !previous.files || typeof previous.files !== "object" || Array.isArray(previous.files) || Object.keys(previous).some(key => !["generator", "module", "files"].includes(key)))) throw new Error("El manifiesto de generación no pertenece a este módulo.");
  for (const [name, digest] of Object.entries(previous?.files ?? {})) {
    if (!validName(name) || name === manifestName || typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest)) throw new Error("El manifiesto contiene archivos inválidos.");
    await assertNoSymlinks(join(directory, name));
    const old = await readOptional(join(directory, name));
    if (old === null || hash(old) !== digest) throw new Error(`No se sobrescribirá ${name}: fue modificado o eliminado fuera del generador.`);
    if (!Object.hasOwn(files, name)) throw new Error(`La generación retiraría ${name}; revisa explícitamente el cambio antes de continuar.`);
  }
  const changes: { name: string; action: "create" | "update" | "unchanged" }[] = [];
  for (const [name, content] of Object.entries(files)) {
    const old = await readOptional(join(directory, name));
    if (old !== null && !Object.hasOwn(previous?.files ?? {}, name)) throw new Error(`No se sobrescribirá el archivo personalizado ${name}.`);
    changes.push({ name, action: old !== null && hash(old) === hash(content) ? "unchanged" : old === null ? "create" : "update" });
  }
  const manifest: Manifest = { generator: "lite-erp-orm-v1", module, files: Object.fromEntries(Object.entries(files).map(([name, content]) => [name, hash(content)])) };
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  return { changes, manifestText, manifestChanged: text !== manifestText };
}

export async function writeArtifacts(directory: string, module: string, files: Record<string, string>) {
  await assertNoSymlinks(directory);
  await mkdir(directory, { recursive: true });
  const lock = join(directory, ".generation.lock");
  const handle = await open(lock, "wx");
  let stage: string | undefined;
  let preserveStage = false;
  const applied: { target: string; backup?: string }[] = [];
  try {
    const plan = await artifactPlan(directory, module, files);
    const writes = plan.changes.filter(change => change.action !== "unchanged").map(change => ({ name: change.name, content: files[change.name] }));
    if (plan.manifestChanged) writes.push({ name: manifestName, content: plan.manifestText });
    if (!writes.length) return plan;
    stage = await mkdtemp(join(directory, ".generation-"));
    await mkdir(join(stage, "next"));
    await mkdir(join(stage, "previous"));
    for (const { name, content } of writes) await writeFile(join(stage, "next", name), content, { flag: "wx" });
    for (const { name } of writes) {
      const target = join(directory, name), backup = join(stage, "previous", name);
      const entry: { target: string; backup?: string } = { target };
      if (await readOptional(target) !== null) { await rename(target, backup); entry.backup = backup; }
      applied.push(entry);
      await rename(join(stage, "next", name), target);
    }
    return plan;
  } catch (error) {
    // Roll back files already replaced if a later rename fails.
    const failures: unknown[] = [];
    for (const { target, backup } of applied.reverse()) {
      try {
        await rm(target, { force: true });
        if (backup) await rename(backup, target);
      } catch (rollbackError) { failures.push(rollbackError); }
    }
    if (failures.length) { preserveStage = true; throw new AggregateError([error, ...failures], `No se pudo completar la restauración. Se conservaron los respaldos en ${stage}.`); }
    throw error;
  } finally {
    await handle.close();
    if (stage && !preserveStage) await rm(stage, { recursive: true, force: true });
    await rm(lock, { force: true });
  }
}
