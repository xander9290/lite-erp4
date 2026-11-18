import "server-only";
import { z } from "zod";
import { Fields, Model, ModelValidationError, constraint, type ReactionValues, type ModelContext } from "../../orm";
import { advanceContactUserRevision } from "../contact-revision";

const email = z.email();

/** Shared by Partner and the contact fields User delegates to it. */
export function assertContactEmail(value: unknown) {
  if (typeof value === "string" && value && !email.safeParse(value).success) throw new ModelValidationError("Revisa el correo.", { email: "Escribe un correo válido." });
}

/**
 * Shared contact (Odoo res.partner): companies, users, customers and suppliers. Native model of
 * `core` over the hand-written `partners` table; other modules relate to it with
 * `Fields.Many2one("Partner")` and extend it with `extendModel(Partner, ...)`.
 */
export class Partner extends Model {
  name = Fields.Text({ label: "Nombre", required: true, trim: true, minLength: 2, maxLength: 120, tracking: true, searchable: true });
  email = Fields.Text({ label: "Correo", trim: true, maxLength: 254, tracking: true, searchable: true });
  phone = Fields.Text({ label: "Teléfono", trim: true, maxLength: 40, tracking: true });
  avatarUrl = Fields.Image({ label: "Avatar", folder: "avatars" });

  @constraint("email")
  validEmail(values: ReactionValues) { assertContactEmail(values.email); }

  async afterSave(record: Readonly<Record<string, unknown>>, context: ModelContext) {
    await advanceContactUserRevision(context.tx, String(record.id), new Date(String(record.revision)));
  }
}
