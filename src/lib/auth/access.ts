import "server-only";
import { cache } from "react";
import { auth } from "@/auth";
import { AccessError } from "./policy";
import { assertNoModuleMaintenance } from "../module-manager/maintenance";

export const getCurrentUser = cache(async () => (await auth())?.user ?? null);
export async function requireUser(options: { allowMaintenance?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user?.id) throw new AccessError("UNAUTHENTICATED");
  if (!options.allowMaintenance) await assertNoModuleMaintenance();
  return user;
}
export async function requireAdmin(options: { allowMaintenance?: boolean } = {}) {
  const user = await requireUser(options);
  if (!user.isAdmin) throw new AccessError("FORBIDDEN");
  return user;
}
