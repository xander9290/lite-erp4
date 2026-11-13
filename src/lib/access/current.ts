import "server-only";
import { cache } from "react";
import { getCurrentUser } from "../auth/access";
import { prisma } from "../prisma";
import { userGroups } from "./engine";

/**
 * Session user plus effective access groups, once per request. Presentation only
 * (drawer, menus, application layout): every operation is authorized again on the server.
 */
export const getCurrentAccessUser = cache(async () => {
  const user = await getCurrentUser();
  if (!user?.id) return null;
  const groups = user.isAdmin ? new Set<string>() : await userGroups(prisma, user.id);
  return { ...user, groups: groups as ReadonlySet<string> };
});
