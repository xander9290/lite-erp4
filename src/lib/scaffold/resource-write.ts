import "server-only";
import { lstat, mkdir, mkdtemp, open, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { assertNoSymlinks } from "../orm/generator/write";

export type SourceChange = { path: string; before: string | null; after: string };
export async function readSource(path: string): Promise<string | null> {
  await assertNoSymlinks(path);
  try {
    if (!(await lstat(path)).isFile()) throw new Error(`Se esperaba un archivo: ${path}`);
    return await readFile(path, "utf8");
  } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}
async function validate(root: string, changes: readonly SourceChange[]) {
  const paths = new Set<string>();
  for (const change of changes) {
    const path = relative(root, change.path);
    if (!path || path.startsWith("..") || resolve(root, path) !== change.path || paths.has(change.path.toLowerCase())) throw new Error("Rutas inválidas o duplicadas en el scaffold.");
    paths.add(change.path.toLowerCase());
    if (await readSource(change.path) !== change.before) throw new Error(`El archivo ya existe o cambió: ${path}. No se sobrescriben personalizaciones.`);
    if (change.before === null) {
      let parent = root;
      for (const part of path.split(/[\\/]/)) {
        try {
          const siblings = await readdir(parent);
          if (siblings.some(name => name !== part && name.toLowerCase() === part.toLowerCase())) throw new Error(`Colisión de mayúsculas/minúsculas en ${path}.`);
          parent = join(parent, part);
        } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") break; throw error; }
      }
      try {
        const entries = await readdir(dirname(change.path));
        if (entries.some(name => name.toLowerCase() === change.path.split(/[\\/]/).at(-1)!.toLowerCase())) throw new Error(`Colisión de nombre en ${path}.`);
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    }
  }
}
/** New files are exclusive; shared source edits are checked before writing. No managed hashes touched. */
export async function writeResource(root: string, changes: readonly SourceChange[], dryRun = false) {
  root = resolve(root);
  await validate(root, changes);
  if (dryRun) return;
  const directory = join(root, "src/lib/applications/scaffolded");
  await assertNoSymlinks(directory);
  await mkdir(directory, { recursive: true });
  const lockPath = join(directory, ".create-app.lock");
  await assertNoSymlinks(lockPath);
  const lock = await open(lockPath, "wx");
  const applied: SourceChange[] = [];
  let stage: string | undefined;
  let preserve = false;
  try {
    await validate(root, changes);
    stage = await mkdtemp(join(root, ".create-resource-"));
    for (let i = 0; i < changes.length; i++) {
      const change = changes[i];
      await writeFile(join(stage, String(i)), change.after);
      if (change.before !== null) await writeFile(join(stage, `${i}.before`), change.before);
    }
    for (let i = 0; i < changes.length; i++) {
      const change = changes[i];
      await assertNoSymlinks(change.path);
      if (await readSource(change.path) !== change.before) throw new Error(`El archivo cambió durante la creación: ${change.path}`);
      await mkdir(dirname(change.path), { recursive: true });
      if (change.before === null) {
        const file = await open(change.path, "wx");
        applied.push(change);
        try { await file.writeFile(change.after); } finally { await file.close(); }
      } else {
        await rename(join(stage, String(i)), change.path);
        applied.push(change);
      }
    }
  } catch (error) {
    for (const change of applied.reverse()) {
      try {
        if (await readSource(change.path) !== change.after) throw new Error("Edición concurrente durante la restauración.");
        if (change.before === null) await rm(change.path);
        else await writeFile(change.path, change.before);
      } catch { preserve = true; }
    }
    if (preserve) throw new Error(`Restauración incompleta: revisa ${stage}. No se sobrescribieron ediciones concurrentes.`);
    throw error;
  } finally {
    await lock.close();
    await rm(lockPath, { force: true });
    if (stage && !preserve) await rm(stage, { recursive: true, force: true });
  }
}
