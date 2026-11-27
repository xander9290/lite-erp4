import "server-only";
import { Fields, Model, type DisplayRecord } from "@/lib/orm";

export class PartnerPhones extends Model {
  name = Fields.Text({ label: "Número", required: true, maxLength: 20, tracking: true });
  type = Fields.Selection(
    [
      { label: "Móvil", value: "mobile" },
      { label: "Fijo", value: "landline" },
      { label: "Otro", value: "other" },
    ],
    {
      label: "Tipo",
      tracking: true,
    },
  );
  usage = Fields.Selection(
    [
      { label: "Ventas", value: "sales" },
      { label: "Compras", value: "purchase" },
      { label: "Cobranza", value: "collection" },
      { label: "Logística", value: "logistics" },
      { label: "General", value: "general" },
    ],
    {
      label: "Uso",
      required: true,
      tracking: true,
    },
  );
  contact = Fields.Text({
    label: "Contacto",
    tracking: true,
  });
  extension = Fields.Text({
    label: "Extensión",
    tracking: true,
  });
  partnerId = Fields.Many2one("DirectoryPartner", {
    label: "Contacto",
    required: true,
    onDelete: "Restrict",
    tracking: true,
  });
  active = Fields.Boolean({ label: "Activo", default: true, tracking: true });
  displayName(record: DisplayRecord<PartnerPhones, "name">): string {
    return record.name;
  }
  // Define aquí normalize, beforeSave y afterSave cuando tu negocio lo necesite.
}
