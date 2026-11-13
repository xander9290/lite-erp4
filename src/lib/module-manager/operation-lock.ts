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
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
}
