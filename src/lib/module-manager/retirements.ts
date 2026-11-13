import "server-only";
import { join } from "node:path";
import { z } from "zod";
import { readSource } from "../scaffold/resource-write";

const entry = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/), name: z.string(), version: z.string(),
  kind: z.enum(["declarative", "scaffold"]), models: z.array(z.string().regex(/^[A-Z][A-Za-z0-9]*$/)),
  groups: z.array(z.string()), rules: z.array(z.string()),
  depends: z.array(z.string()).default([]),
  archiveId: z.string().regex(/^[a-f0-9]{32}$/).optional(),
  archiveHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
});
const registry = z.strictObject({ version: z.literal(1), applications: z.array(entry) });
export type RetiredApplication = z.infer<typeof entry>;
export async function readRetirements(root: string) {
  const path = join(root, "prisma/.app-retirements.json");
  const before = await readSource(path);
  const value = before === null ? { version: 1 as const, applications: [] } : registry.parse(JSON.parse(before));
  if (new Set(value.applications.map(item => item.id)).size !== value.applications.length) throw new Error("Hay IDs retirados duplicados.");
  return { path, before, value };
}
export async function assertApplicationIdAvailable(root: string, id: string) {
  if ((await readRetirements(root)).value.applications.some(item => item.id === id)) throw new Error(`El ID ${id} conserva datos de una aplicación retirada. Recupera la aplicación o completa su purga antes de reutilizarlo.`);
}
