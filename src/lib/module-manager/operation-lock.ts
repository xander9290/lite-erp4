import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { assertNoSymlinks } from "../orm/generator/write";

export async function assertNoOtherModuleOperation(root: string) {
  const path = join(root, "prisma/.module-operation.lock");
  await assertNoSymlinks(path);
  try {
    const owner = (await readFile(path, "utf8")).trim();
    if (owner !== String(process.pid)) throw new Error("Hay una operación de módulos activa. Espera su resultado; no retires el lock sin comprobar su proceso.");
    return;
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const maintenance = join(root, ".module-operations/maintenance.json");
  await assertNoSymlinks(maintenance);
  try { await readFile(maintenance); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
  throw new Error("Hay un mantenimiento de módulos abierto. Comprueba la operación y finaliza el mantenimiento antes de usar los generadores.");
}

export async function assertNoFrameworkWriters(root: string) {
  await assertNoOtherModuleOperation(root);
  for (const name of ["prisma/.orm-sync.lock", "prisma/.orm-install.lock", "src/lib/applications/scaffolded/.create-app.lock"]) {
    const path = join(root, name);
    await assertNoSymlinks(path);
    try { await readFile(path); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") continue; throw error; }
    throw new Error(`Hay una herramienta del framework activa (${name}). Comprueba su resultado antes de continuar.`);
  }
}
