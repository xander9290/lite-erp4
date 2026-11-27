import "server-only";
import {
  Fields,
  Model,
  ModelValidationError as Err,
  type DisplayRecord,
  constraint,
} from "@/lib/orm";
import { ModelTypes } from "@/types/model-types";

export class Partner extends Model {
  name = Fields.Text({
    label: "Nombre",
    required: true,
    maxLength: 120,
    tracking: true,
  });
  active = Fields.Boolean({
    label: "Activo",
    default: true,
    tracking: true,
  });
  emails = Fields.Text({
    label: "Correo",
    maxLength: 200,
    tracking: true,
  });
  phones = Fields.Text({
    label: "Teléfono",
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
  vat = Fields.Text({
    label: "R.F.C.",
    maxLength: 13,
    tracking: true,
  });
  curp = Fields.Text({
    label: "CURP",
    maxLength: 18,
    tracking: true,
  });
  partnerType = Fields.Selection(
    [
      { label: "Persona", value: "person" },
      { label: "Empresa", value: "company" },
    ],
    { label: "Tipo de empresa", required: true, tracking: true },
  );
  type = Fields.Selection(
    [
      { label: "Contacto", value: "contact" },
      { label: "Entrega", value: "delivery" },
      { label: "Facturación", value: "invoice" },
    ],
    {
      label: "Tipo de contacto",
      tracking: true,
      default: "contact",
    },
  );
  image = Fields.Image({
    label: "Imagen",
    folder: "lite-erp/directory",
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
  completeAddress = Fields.Text({
    label: "Dirección completa",
    maxLength: 500,
  });
  parentId = Fields.Many2one("DirectoryPartner", {
    label: "Contacto principal",
    tracking: true,
    onDelete: "Restrict",
    domain: (d) => d.neq("id", d.record.id),
  });
  childIds = Fields.One2many("DirectoryPartner", {
    label: "Otras direcciones",
    inverse: "parentId",
    readonly: true,
  });
  tagIds = Fields.Many2many("DirectoryPartnertags", {
    label: "Etiquetas",
    maxSelected: 10,
    create: true,
  });
  activityIds = Fields.Many2many("DirectoryBusinessactivity", {
    label: "Actividad empresarial",
    maxSelected: 3,
  });
  saleUserId = Fields.Many2one("User", {
    label: "Vendedor",
    onDelete: "Restrict",
    domain: (d) => d.eq("active", true),
    tracking: true,
  });
  purchaseUserId = Fields.Many2one("User", {
    label: "Comprador",
    onDelete: "Restrict",
    domain: (d) => d.eq("active", true),
    tracking: true,
  });
  emailIds = Fields.One2many("DirectoryPartneremails", {
    label: "Correos adicionales",
    inverse: "partnerId",
    maxRows: 10,
  });
  phoneIds = Fields.One2many("DirectoryPartnerphones", {
    label: "Teléfonos adicionales",
    inverse: "partnerId",
    maxRows: 20,
  });
  isCustomer = Fields.Boolean({
    label: "Cliente",
    default: false,
    tracking: true,
  });

  isSupplier = Fields.Boolean({
    label: "Proveedor",
    default: false,
    tracking: true,
  });

  displayName(record: DisplayRecord<Partner, "name">): string {
    return record.name;
  }

  // SE NORMALIZA CURP Y RFC EN MAYÚSCULA
  normalize(values: ModelTypes["values"]) {
    const normalizeCode = (value: unknown) =>
      typeof value === "string" ? value.trim().toUpperCase() : value;

    return {
      ...values,
      vat: normalizeCode(values.vat),
      curp: normalizeCode(values.curp),
      street: normalizeCode(values.street),
      crossStreets: normalizeCode(values.crossStreets),
    };
  }

  // SE VALIDA RFC
  @constraint("vat", "partnerType")
  validateRfc(values: ModelTypes["values"]) {
    const { vat, partnerType } = values;

    // El RFC continúa siendo opcional.
    if (vat == null || vat === "") return;

    const pattern =
      partnerType === "person"
        ? /^[A-ZÑ&]{4}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[A-Z0-9]{3}$/
        : /^[A-ZÑ&]{3}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[A-Z0-9]{3}$/;

    if (typeof vat !== "string" || !pattern.test(vat)) {
      throw new Err("Revisa el RFC.", {
        vat:
          partnerType === "person"
            ? "Introduce un RFC de persona física de 13 caracteres."
            : "Introduce un RFC de persona moral de 12 caracteres.",
      });
    }

    const start = partnerType === "person" ? 4 : 3;
    const year = 2000 + Number(vat.slice(start, start + 2));
    const month = Number(vat.slice(start + 2, start + 4));
    const day = Number(vat.slice(start + 4, start + 6));

    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new Err("Revisa el RFC.", {
        vat: "El RFC contiene una fecha de calendario inválida.",
      });
    }
  }

  // SE VALIDA CURP
  @constraint("curp")
  validateCurp(values: ModelTypes["values"]) {
    const { curp } = values;

    // La CURP continúa siendo opcional.
    if (curp == null || curp === "") return;

    const pattern =
      /^[A-Z][AEIOUX][A-Z]{2}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[HMX]([ABCMTZ]S|[BCJMOT]C|[CNPST]L|[GNQ]T|[GQS]R|C[MH]|[MY]N|[DH]G|NE|VZ|DF|SP)[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9][0-9]$/;

    if (typeof curp !== "string" || !pattern.test(curp)) {
      throw new Err("Revisa la CURP.", {
        curp: "Introduce una CURP con estructura válida de 18 caracteres.",
      });
    }

    const century = /^[0-9]$/.test(curp[16]) ? 1900 : 2000;
    const year = century + Number(curp.slice(4, 6));
    const month = Number(curp.slice(6, 8));
    const day = Number(curp.slice(8, 10));

    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new Err("Revisa la CURP.", {
        curp: "La CURP contiene una fecha de calendario inválida.",
      });
    }
  }

  // SE VALIDA CP
  @constraint("zipNumber")
  validateZip(values: ModelTypes["values"]) {
    const { zipNumber } = values;

    // Continúa siendo opcional.
    if (zipNumber == null || zipNumber === "") return;

    if (typeof zipNumber !== "string" || !/^[0-9]{5}$/.test(zipNumber)) {
      throw new Err("Revisa el código postal.", {
        zipNumber: "Introduce exactamente cinco dígitos.",
      });
    }
  }

  @constraint("parentId")
  async validateParent(
    values: ModelTypes["values"],
    context: ModelTypes["context"],
  ) {
    const parentId = values.parentId;

    if (typeof parentId !== "string" || !parentId) return;

    const reject = (message: string) => {
      throw new Err("Revisa el contacto principal.", {
        parentId: message,
      });
    };

    if (parentId === context.id) {
      reject("Un contacto no puede ser su propio principal.");
    }

    const parent = await context.tx.directoryPartner.findUnique({
      where: { id: parentId },
      select: { parentId: true },
    });

    if (!parent) {
      reject("El contacto principal no está disponible.");
    }

    if (parent?.parentId) {
      reject("Selecciona un contacto principal, no una dirección adicional.");
    }

    if (context.id) {
      const child = await context.tx.directoryPartner.findFirst({
        where: { parentId: context.id },
        select: { id: true },
      });

      if (child) {
        reject(
          "Un contacto con direcciones adicionales no puede depender de otro.",
        );
      }
    }
  }

  async beforeSave(
    values: ModelTypes["values"],
    context: ModelTypes["context"],
  ) {
    const [municipio, estado, pais] = await Promise.all([
      typeof values.countyId === "string"
        ? context.tx.ubicacionesMunicipio.findUnique({
            where: { id: values.countyId },
            select: { name: true },
          })
        : null,

      typeof values.provinceId === "string"
        ? context.tx.ubicacionesEstado.findUnique({
            where: { id: values.provinceId },
            select: { name: true },
          })
        : null,

      typeof values.countryId === "string"
        ? context.tx.ubicacionesPais.findUnique({
            where: { id: values.countryId },
            select: { name: true },
          })
        : null,
    ]);

    const calle = [values.street, values.streetNumber]
      .filter(Boolean)
      .join(" ");

    const completeAddress = [
      calle,
      values.zipNumber,
      municipio?.name,
      estado?.name,
      pais?.name,
    ]
      .filter(Boolean)
      .join(", ");

    return {
      ...values,
      completeAddress: completeAddress || null,
    };
  }
}
