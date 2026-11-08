import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { ContactValues } from "../schemas/contact.schema";

/** Explicit fields for opening Contactos; the related User is not part of this DTO. */
export const contactFormSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  avatarUrl: true,
  updatedAt: true,
} satisfies Prisma.PartnerSelect;

export type ContactFormRecord = Prisma.PartnerGetPayload<{ select: typeof contactFormSelect }>;

export function contactFormValues(record: ContactFormRecord): ContactValues {
  return {
    id: record.id,
    revision: record.updatedAt.toISOString(),
    name: record.name,
    email: record.email ?? "",
    phone: record.phone ?? "",
    avatarUrl: record.avatarUrl,
  };
}

/** Call only after contactSchema validation and authorization in the save service. */
export function contactWriteData(values: ContactValues) {
  return {
    name: values.name,
    email: values.email || null,
    phone: values.phone || null,
    avatarUrl: values.avatarUrl,
  } satisfies Pick<Prisma.PartnerCreateInput, "name" | "email" | "phone" | "avatarUrl">;
}
