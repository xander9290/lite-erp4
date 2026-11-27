import "server-only";
import { displayName, Fields, Model } from "@/lib/orm";

export class Company extends Model {
  readonly uniqueTogether = [["code", "name"]] as const;
  name = Fields.Text({
    label: "Nombre",
    required: true,
    unique: true,
    maxLength: 120,
    tracking: true,
  });
  code = Fields.Text({
    label: "Código",
    unique: true,
    required: true,
    maxLength: 5,
    tracking: true,
  });
  image = Fields.Image({
    label: "Imagen",
    folder: "lite-erp/company",
    tracking: true,
  });
  street = Fields.Text({
    label: "Calle",
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
  vat = Fields.Text({
    label: "R.F.C.",
    maxLength: 13,
    tracking: true,
  });
  email = Fields.Text({
    label: "Correo",
    maxLength: 200,
    tracking: true,
  });
  phone = Fields.Text({
    label: "Teléfono",
    maxLength: 200,
    tracking: true,
  });
  countryId = Fields.Many2one("UbicacionesPais", {
    label: "País",
    tracking: true,
  });
  provinceId = Fields.Many2one("UbicacionesEstado", {
    label: "Estado",
    tracking: true,
    domain: (d) => d.eq("paisId", d.draft("countryId")),
  });
  countyId = Fields.Many2one("UbicacionesMunicipio", {
    label: "Municipio",
    tracking: true,
    domain: (d) => d.eq("estadoId", d.draft("provinceId")),
  });
  townId = Fields.Many2one("UbicacionesLocalidad", {
    label: "Localidad",
    tracking: true,
    domain: (d) => d.eq("municipioId", d.draft("countyId")),
  });
  parentId = Fields.Many2one("CompanyCompany", {
    label: "Empresa matriz",
    tracking: true,
    onDelete: "Restrict",
    domain: (d) => d.all(d.neq("id", d.record.id), d.eq("parentId", null)),
  });
  childIds = Fields.One2many("CompanyCompany", {
    label: "Sucursales",
    inverse: "parentId",
    readonly: true,
  });
  active = Fields.Boolean({ label: "Activo", default: true, tracking: true });

  @displayName("parent.code", "name")
  nombreCompleto(
    record: Readonly<{
      parent: Readonly<{ code: string }> | null;
      name: string;
    }>,
  ): string {
    return [record.parent?.code ?? "", record.name].filter(Boolean).join(" · ");
  }
  // Define aquí normalize, beforeSave y afterSave cuando tu negocio lo necesite.
}
