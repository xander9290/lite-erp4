import "server-only";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { FieldPath } from "react-hook-form";
import type { FormViewLoadResult } from "@/components/ui/form/FormViewLoader";
import type { FormViewResult } from "@/components/ui/form/formView.types";
import { AccessError } from "@/lib/auth/policy";
import { contactIdSchema, contactSchema, type ContactValues } from "../schemas/contact.schema";
import { contactFormSelect, contactFormValues, contactWriteData } from "./partner";

type Actor = { id: string; sessionVersion: number };
class ContactValidationError extends Error {}
const conflictMessage = "El contacto cambió desde que lo abriste. Recarga sus datos antes de guardar.";

/** Actor identity is supplied by the server action; permissions are rechecked in the transaction. */
async function assertActor(tx: Prisma.TransactionClient, actor: Actor, write: boolean) {
  const current = await tx.user.findUnique({ where: { id: actor.id }, select: { active: true, isAdmin: true, sessionVersion: true } });
  if (!current?.active || current.sessionVersion !== actor.sessionVersion) throw new AccessError("UNAUTHENTICATED");
  if (write && !current.isAdmin) throw new AccessError("FORBIDDEN");
}

function errorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error ? error.code : undefined;
}

export async function readContactRecord(prisma: PrismaClient, actor: Actor, input: unknown): Promise<FormViewLoadResult<ContactValues>> {
  const id = contactIdSchema.safeParse(input);
  if (!id.success) return { ok: false, kind: "validation", error: "El contacto no es válido." };
  try {
    const record = await prisma.$transaction(async tx => {
      await assertActor(tx, actor, false);
      return tx.partner.findUnique({ where: { id: id.data }, select: contactFormSelect });
    }, { isolationLevel: "RepeatableRead" });
    return record ? { ok: true, values: contactFormValues(record) } : { ok: false, error: "No se encontró este contacto." };
  } catch (error) {
    return { ok: false, kind: "server", error: error instanceof AccessError ? error.message : "No se pudo cargar el contacto. Intenta nuevamente." };
  }
}

export async function saveContactRecord(prisma: PrismaClient, actor: Actor, input: unknown): Promise<FormViewResult<ContactValues>> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Partial<Record<FieldPath<ContactValues>, string>> = {};
    for (const issue of parsed.error.issues) {
      if (issue.path.length) fieldErrors[issue.path.join(".") as FieldPath<ContactValues>] ??= issue.message;
    }
    return { ok: false, kind: "validation", error: "Revisa los datos del contacto.", fieldErrors };
  }
  const values = parsed.data;
  try {
    const record = await prisma.$transaction(async tx => {
      await assertActor(tx, actor, true);
      const data = contactWriteData(values);
      if (!values.id) return tx.partner.create({ data, select: contactFormSelect });

      const current = await tx.partner.findUnique({ where: { id: values.id }, select: { id: true, updatedAt: true } });
      if (!current) throw new ContactValidationError("Este contacto ya no está disponible.");
      if (current.updatedAt.toISOString() !== values.revision) throw new ContactValidationError(conflictMessage);
      return tx.partner.update({
        where: { id: current.id, updatedAt: current.updatedAt },
        // Advance even when two edits arrive in the same millisecond.
        data: { ...data, updatedAt: new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)) },
        select: contactFormSelect,
      });
    }, { isolationLevel: "Serializable" });
    return { ok: true, values: contactFormValues(record), message: values.id ? "Contacto actualizado." : "Contacto creado." };
  } catch (error) {
    if (error instanceof AccessError) return { ok: false, kind: "server", error: error.message };
    if (error instanceof ContactValidationError) return { ok: false, kind: "validation", error: error.message };
    if (["P2025", "P2034"].includes(String(errorCode(error)))) return { ok: false, kind: "validation", error: conflictMessage };
    return { ok: false, kind: "server", error: "No se pudo guardar el contacto. Recarga los datos e intenta nuevamente." };
  }
}
