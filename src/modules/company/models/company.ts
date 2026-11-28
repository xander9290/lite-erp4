import "server-only";
import { constraint, displayName, Fields, Model, ModelValidationError, type ModelContext } from "@/lib/orm";
import { z } from "zod";
import type { ModelTypes } from "@/types/model-types";

export class Company extends Model {
  name = Fields.Text({
    label: "Nombre",
    required: true,
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

  normalize(values: ModelTypes["values"]) {
    const trim = (value: unknown) => typeof value === "string" ? value.trim() : value;
    const upper = (value: unknown) => typeof value === "string" ? value.trim().toUpperCase() : value;
    return {
      ...values,
      name: upper(values.name),
      code: upper(values.code),
      vat: upper(values.vat),
      email: trim(values.email),
      phone: trim(values.phone),
      zipNumber: trim(values.zipNumber),
    };
  }

  @constraint("email")
  validarCorreo(values: ModelTypes["values"]) {
    if (values.email && !z.email().safeParse(values.email).success) {
      throw new ModelValidationError("Revisa el correo.", { email: "Introduce un correo válido." });
    }
  }

  @constraint("countryId", "vat", "zipNumber")
  async validarDatosMexicanos(values: ModelTypes["values"], context: ModelContext) {
    if (typeof values.countryId !== "string" || !values.countryId || (!values.vat && !values.zipNumber)) return;
    // El servicio ya autorizó la referencia antes de las constraints. Esta lectura mínima
    // sólo elige la regla de integridad; no publica datos ni exige entrada al catálogo.
    const country = await context.tx.ubicacionesPais.findUnique({ where: { id: values.countryId }, select: { codigo: true } });
    if (country?.codigo !== "MX") return;
    const errors: Record<string, string> = {};
    if (values.zipNumber && (typeof values.zipNumber !== "string" || !/^\d{5}$/.test(values.zipNumber))) {
      errors.zipNumber = "Introduce exactamente cinco dígitos para México.";
    }
    if (values.vat) {
      const vat = values.vat;
      // Estructura y fecha, sin consulta ni certificación fiscal. Admite personas físicas y morales.
      const match = typeof vat === "string" && /^[A-ZÑ&]{3,4}(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[A-Z0-9]{3}$/.exec(vat);
      if (!match) errors.vat = "Introduce un RFC de 12 o 13 caracteres con estructura válida.";
      else {
        const year = 2000 + Number(match[1]), month = Number(match[2]), day = Number(match[3]);
        const date = new Date(Date.UTC(year, month - 1, day));
        if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
          errors.vat = "El RFC contiene una fecha de calendario inválida.";
        }
      }
    }
    if (Object.keys(errors).length) throw new ModelValidationError("Revisa los datos de México.", errors);
  }

  @constraint("parentId")
  async validarJerarquia(values: ModelTypes["values"], context: ModelContext) {
    if (typeof values.parentId !== "string" || !values.parentId) return;
    const reject = () => {
      throw new ModelValidationError("Revisa la empresa matriz.", {
        parentId: "Selecciona una matriz distinta. Una empresa con sucursales no puede ser sucursal de otra.",
      });
    };
    if (values.parentId === context.id) reject();
    // Comprobación de integridad sobre todas las filas, incluso hijos ocultos por reglas.
    // No publica datos ni sustituye la autorización de referencias del servicio.
    const parent = await context.tx.companyCompany.findUnique({ where: { id: values.parentId }, select: { parentId: true } });
    if (!parent || parent.parentId) reject();
    if (context.id && await context.tx.companyCompany.findFirst({ where: { parentId: context.id }, select: { id: true } })) reject();
  }
}
