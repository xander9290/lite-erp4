import "server-only";
import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import type { FormViewResult } from "@/components/ui/form/formView.types";
import { changePasswordSchema, emptyPasswordValues, profileSchema, type ChangePasswordValues, type ProfileRecord, type ProfileValues } from "@/schemas/profile.schema";
import { AccessError } from "./policy";
import { hashPassword, verifyPassword } from "./password";
import { createLoginLimiter } from "./attempts";

type Actor = { id: string; sessionVersion: number };
const passwordAttempts = createLoginLimiter(5);
const profileSelect = { id: true, active: true, sessionVersion: true, login: true, isAdmin: true, updatedAt: true,
  partner: { select: { name: true, email: true, phone: true, avatarUrl: true, updatedAt: true } } } satisfies Prisma.UserSelect;
type ProfileUser = Prisma.UserGetPayload<{ select: typeof profileSelect }>;
function checkUser(user: ProfileUser | null, actor: Actor): asserts user is ProfileUser {
  if (!user?.active || user.sessionVersion !== actor.sessionVersion) throw new AccessError("UNAUTHENTICATED");
}
function profileRecord(user: ProfileUser): ProfileRecord {
  return { account: { login: user.login, isAdmin: user.isAdmin }, values: {
    revision: user.updatedAt.toISOString(), partnerRevision: user.partner?.updatedAt.toISOString() ?? null,
    name: user.partner?.name ?? user.login, email: user.partner?.email ?? "", phone: user.partner?.phone ?? "", avatarUrl: user.partner?.avatarUrl ?? null,
  } };
}

/** Actor comes from the server session; neither ID nor access permissions are editable. */
export async function loadOwnProfile(prisma: PrismaClient, actor: Actor): Promise<ProfileRecord> {
  const user = await prisma.user.findUnique({ where: { id: actor.id }, select: profileSelect });
  checkUser(user, actor);
  return profileRecord(user);
}

export async function saveOwnProfile(prisma: PrismaClient, actor: Actor, input: unknown): Promise<FormViewResult<ProfileValues>> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, kind: "validation", error: "Revisa los datos de tu perfil.", fieldErrors: Object.fromEntries(parsed.error.issues.filter(issue => issue.path.length).map(issue => [issue.path.join("."), issue.message])) };
  try {
    const result = await prisma.$transaction(async tx => {
      const user = await tx.user.findUnique({ where: { id: actor.id }, select: profileSelect });
      checkUser(user, actor);
      const current = profileRecord(user).values;
      if (current.revision !== parsed.data.revision || current.partnerRevision !== parsed.data.partnerRevision) return null;
      const { name, email, phone, avatarUrl } = parsed.data;
      const contact = { name, email: email || null, phone: phone || null, avatarUrl };
      return tx.user.update({ where: { id: actor.id }, data: { partner: user.partner ? { update: contact } : { create: contact } }, select: profileSelect });
    }, { isolationLevel: "Serializable" });
    return result ? { ok: true, values: profileRecord(result).values, message: "Perfil actualizado." }
      : { ok: false, kind: "validation", error: "Tu perfil cambió desde que lo abriste. Recarga los datos antes de guardar." };
  } catch (error) {
    return { ok: false, kind: "server", error: error instanceof AccessError ? error.message : "No se pudo guardar tu perfil. Intenta nuevamente." };
  }
}

export async function changeOwnPassword(prisma: PrismaClient, actor: Actor, input: unknown): Promise<FormViewResult<ChangePasswordValues>> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, kind: "validation", error: "Revisa los datos de la contraseña.", fieldErrors: Object.fromEntries(parsed.error.issues.filter(issue => issue.path.length).map(issue => [issue.path.join("."), issue.message])) };
  if (!passwordAttempts.allow(actor.id)) return { ok: false, kind: "validation", error: "Demasiados intentos. Espera un minuto e intenta nuevamente." };
  try {
    const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { active: true, sessionVersion: true, password: true } });
    if (!user?.active || user.sessionVersion !== actor.sessionVersion) throw new AccessError("UNAUTHENTICATED");
    if (!await verifyPassword(parsed.data.currentPassword, user.password)) return { ok: false, kind: "validation", error: "La contraseña actual no es correcta.", fieldErrors: { currentPassword: "La contraseña actual no es correcta." } };
    const password = await hashPassword(parsed.data.newPassword);
    const updated = await prisma.user.updateMany({ where: { id: actor.id, active: true, sessionVersion: actor.sessionVersion, password: user.password }, data: { password, sessionVersion: { increment: 1 } } });
    if (updated.count !== 1) throw new AccessError("UNAUTHENTICATED");
    passwordAttempts.clear(actor.id);
    return { ok: true, values: { ...emptyPasswordValues }, message: "Contraseña actualizada. Inicia sesión con tu nueva contraseña." };
  } catch (error) {
    return { ok: false, kind: "server", error: error instanceof AccessError ? error.message : "No se pudo cambiar la contraseña. Intenta nuevamente." };
  }
}
