import "server-only";
import { cache } from "react";
import { auth } from "@/auth";
import { AccessError } from "./policy";

export const getCurrentUser = cache(async () => (await auth())?.user ?? null);
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user?.id) throw new AccessError("UNAUTHENTICATED");
  return user;
}
export async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) throw new AccessError("FORBIDDEN");
  return user;
}
