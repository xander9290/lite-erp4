import "server-only";
import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import type { FieldPath } from "react-hook-form";
import type { FormViewResult } from "@/components/ui/form/formView.types";
import { userSchema, type UserValues } from "@/schemas/user.schema";
import { hashPassword } from "../auth/password";
import { AccessError, assertUserChange } from "../auth/policy";

export const userFormSelect = { id: true, login: true, active: true, isAdmin: true, updatedAt: true, partner: { select: { name: true, email: true, phone: true, avatarUrl: true, updatedAt: true } } } satisfies Prisma.UserSelect;
type UserFormRecord = Prisma.UserGetPayload<{ select: typeof userFormSelect }>;
export function userFormValues(user: UserFormRecord): UserValues {
  return { id: user.id, revision: user.updatedAt.toISOString(), partnerRevision: user.partner?.updatedAt.toISOString() ?? null, login: user.login, name: user.partner?.name ?? "", email: user.partner?.email ?? "", phone: user.partner?.phone ?? "", avatarUrl: user.partner?.avatarUrl ?? null, active: user.active, isAdmin: user.isAdmin, password: "" };
}
type Actor = { id: string; sessionVersion: number };
class UserValidationError extends Error {}

/** Internal service; callers obtain actor from the server session, never from form props. */
export async function saveUserRecord(prisma: PrismaClient, actor: Actor, input: unknown): Promise<FormViewResult<UserValues>> {
  const parsed = userSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<FieldPath<UserValues>, string>> = {};
    for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".") as FieldPath<UserValues>] ??= issue.message;
    return { ok: false, kind: "validation", error: "Revisa los datos del usuario.", fieldErrors };
  }
  const values = parsed.data;
  const password = values.password ? await hashPassword(values.password) : undefined;
  try {
    const result = await prisma.$transaction(async tx => {
      const currentActor = await tx.user.findUnique({ where: { id: actor.id }, select: { active: true, isAdmin: true, sessionVersion: true } });
      if (!currentActor?.active || currentActor.sessionVersion !== actor.sessionVersion) throw new AccessError("UNAUTHENTICATED");
      if (!currentActor.isAdmin) throw new AccessError("FORBIDDEN");
      const partnerData = { name: values.name, email: values.email || null, phone: values.phone || null, avatarUrl: values.avatarUrl };
      if (!values.id) return tx.user.create({ data: { login: values.login, password: password!, active: values.active, isAdmin: values.isAdmin, partner: { create: partnerData } }, select: userFormSelect });
      const current = await tx.user.findUnique({ where: { id: values.id }, select: { id: true, active: true, isAdmin: true, login: true, updatedAt: true, partnerId: true, partner: { select: { updatedAt: true } } } });
      if (!current) throw new UserValidationError("Este usuario ya no está disponible.");
      if (current.updatedAt.toISOString() !== values.revision) throw new UserValidationError("El usuario cambió desde que lo abriste. Recarga sus datos antes de guardar.");
      if ((current.partner?.updatedAt.toISOString() ?? null) !== values.partnerRevision) throw new UserValidationError("El contacto del usuario cambió desde que lo abriste. Recarga sus datos antes de guardar.");
      const violation = assertUserChange(actor.id, current, values, await tx.user.count({ where: { active: true, isAdmin: true } }));
      if (violation) throw new UserValidationError(violation);
      const revoke = Boolean(password || current.login !== values.login || current.active !== values.active || current.isAdmin !== values.isAdmin);
      return tx.user.update({ where: { id: current.id }, data: {
        login: values.login, ...(password ? { password } : {}), active: values.active, isAdmin: values.isAdmin,
        ...(revoke ? { sessionVersion: { increment: 1 } } : {}),
        partner: current.partnerId ? { update: partnerData } : { create: partnerData },
      }, select: userFormSelect });
    }, { isolationLevel: "Serializable" });
    return { ok: true, values: userFormValues(result), message: values.id ? "Usuario actualizado." : "Usuario creado." };
  } catch (error) {
    if (error instanceof AccessError) return { ok: false, kind: "server", error: error.message };
    if (error instanceof UserValidationError) return { ok: false, kind: "validation", error: error.message };
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return { ok: false, kind: "validation", error: "Este usuario ya existe.", fieldErrors: { login: "Elige un usuario diferente." } };
    return { ok: false, kind: "server", error: "No se pudo guardar el usuario. Recarga los datos e intenta nuevamente." };
  }
}
