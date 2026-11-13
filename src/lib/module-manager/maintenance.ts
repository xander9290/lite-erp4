import "server-only";
import { join } from "node:path";
import { readSource } from "../scaffold/resource-write";

export async function isModuleMaintenance() {
  return await readSource(join(process.cwd(), ".module-operations/maintenance.json")) !== null;
}
export async function assertNoModuleMaintenance() {
  if (await isModuleMaintenance()) throw new Error("El ERP está en mantenimiento de módulos. Un administrador debe finalizarlo antes de continuar.");
}
export async function maintenanceOperation() {
  try {
    const value = JSON.parse(await readSource(join(process.cwd(), ".module-operations/maintenance.json")) ?? "null");
    return value && /^[a-f0-9]{32}$/.test(value.id) && /^[a-z][a-z0-9-]*$/.test(value.module) ? { id: String(value.id), module: String(value.module) } : null;
  } catch { return null; }
}
