import "server-only";
import { Fields, Model, type DisplayRecord } from "@/lib/orm";

export class Partner extends Model {
  name = Fields.Text({
    label: "Nombre",
    required: true,
    maxLength: 120,
    tracking: true,
  });
  emails = Fields.Text({
    label: "Correo(s)",
    maxLength: 200,
    tracking: true,
  });
  phones = Fields.Text({
    label: "Teléfono(s)",
    maxLength: 200,
    tracking: true,
  });
  street = Fields.Text({
    label: "Calle",
    maxLength: 100,
    tracking: true,
  });
  crossStreets = Fields.Text({
    label: "Entre calles",
    maxLength: 150,
    tracking: true,
  });
  streetNumber = Fields.Text({
    label: "N° Exterior",
    maxLength: 10,
    tracking: true,
  });
  unitNumber = Fields.Text({
    label: "N° Interior",
    maxLength: 10,
    tracking: true,
  });
  zipNumber = Fields.Text({
    label: "Código Postal",
    tracking: true,
  });
  active = Fields.Boolean({
    label: "Activo",
    default: true,
    tracking: true,
  });

  displayName(record: DisplayRecord<Partner, "name">): string {
    return record.name;
  }
  // Define aquí normalize, beforeSave y afterSave cuando tu negocio lo necesite.
}
