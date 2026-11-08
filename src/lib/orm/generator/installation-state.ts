import "server-only";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { prismaBlocks } from "./prisma-source";
import { assertNoSymlinks } from "./write";

export const sourceHash = (text: string) => createHash("sha256").update(text).digest("hex");
const idSchema = z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
const filename = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]*\.prisma$/);
const installationSchema = z.strictObject({
  file: filename,
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  inverses: z.array(z.strictObject({ file: filename, target: z.string().regex(/^[A-Z][A-Za-z0-9]*$/), text: z.string().min(1) })),
});
const stateSchema = z.strictObject({ version: z.literal(1), modules: z.record(idSchema, installationSchema) });
export type InstallationState = z.infer<typeof stateSchema>;
export const statePath = (root: string) => join(root, "prisma/.orm-installations.json");

export async function optionalSource(path: string) {
  try { return await readFile(path, "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}

export function inverseText(id: string, target: string, declarations: readonly string[]) {
  return `\n  // BEGIN lite-erp:${id}:${target}\n${declarations.join("\n")}\n  // END lite-erp:${id}:${target}\n`;
}

/** Only remove a ledger-owned segment, located inside its expected model. */
export function removeInverse(source: string, inverse: { target: string; text: string }) {
  const block = prismaBlocks(source).find(item => item.kind === "model" && item.name === inverse.target);
  if (!block || !block.body.includes(inverse.text) || source.indexOf(inverse.text) !== source.lastIndexOf(inverse.text)) throw new Error(`La inversa gestionada de ${inverse.target} fue modificada o eliminada.`);
  return source.replace(inverse.text, "");
}

export async function readInstallationState(root: string) {
  const directory = join(root, "prisma/models");
  await assertNoSymlinks(directory);
  await assertNoSymlinks(statePath(root));
  const stateText = await optionalSource(statePath(root));
  const state: InstallationState = stateText === null ? { version: 1, modules: {} } : stateSchema.parse(JSON.parse(stateText));
  const sources: Record<string, string> = {};
  for (const name of (await readdir(directory)).filter(name => name.endsWith(".prisma")).sort()) {
    if (!filename.safeParse(name).success) throw new Error(`Nombre de esquema no soportado: ${name}.`);
    await assertNoSymlinks(join(directory, name));
    sources[name] = await readFile(join(directory, name), "utf8");
  }
  const clean = { ...sources };
  const owners: Record<string, string> = {};
  for (const [id, entry] of Object.entries(state.modules)) {
    if (entry.file !== `orm-${id}.prisma`) throw new Error("El registro de instalación contiene una ruta ajena al módulo.");
    for (const inverse of entry.inverses) {
      if (!inverse.text.startsWith(`\n  // BEGIN lite-erp:${id}:${inverse.target}\n`) || !inverse.text.endsWith(`\n  // END lite-erp:${id}:${inverse.target}\n`)) throw new Error("Marcadores de instalación inválidos.");
      if (!Object.hasOwn(clean, inverse.file)) throw new Error(`Falta el esquema ${inverse.file}.`);
      clean[inverse.file] = removeInverse(clean[inverse.file], inverse);
    }
  }
  for (const [id, entry] of Object.entries(state.modules)) {
    if (!Object.hasOwn(clean, entry.file) || sourceHash(clean[entry.file]) !== entry.hash) throw new Error(`El esquema instalado de ${id} fue modificado o eliminado fuera del generador.`);
    for (const block of prismaBlocks(clean[entry.file]).filter(block => block.kind === "model")) owners[block.name] = id;
  }
  return { directory, stateText, state, sources, clean, owners };
}

/** Regenerate an installed declaration against the other modules; preserve downstream inverses. */
export async function generationBaseline(root: string, id: string) {
  const snapshot = await readInstallationState(root);
  const sources = { ...snapshot.sources };
  const installed = Object.hasOwn(snapshot.state.modules, id) ? snapshot.state.modules[id] : undefined;
  if (installed) {
    delete sources[installed.file];
    for (const inverse of installed.inverses) sources[inverse.file] = removeInverse(sources[inverse.file], inverse);
  }
  const downstream = installed ? Object.entries(snapshot.state.modules).filter(([other]) => other !== id).flatMap(([, entry]) => entry.inverses.filter(inverse => inverse.file === installed.file)) : [];
  return { ...snapshot, schema: Object.values(sources).join("\n\n"), downstream };
}
