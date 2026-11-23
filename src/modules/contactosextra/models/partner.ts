import "server-only";
import { Fields, constraint, ModelValidationError, type ModelContext } from "@/lib/orm";
import { extendModel } from "@/lib/modules/extend";
import { Partner } from "@/lib/core/models/partner";
import type { ModelTypes } from "@/types/model-types";

export const PartnerExtra = extendModel(Partner, (Base) => {
  class PartnerExtra extends Base {
    street = Fields.Text({
      label: "Calle",
      maxLength: 160,
      tracking: true,
    });
    exteriorNumber = Fields.Text({
      label: "Número exterior",
      maxLength: 20,
      tracking: true,
    });
    interiorNumber = Fields.Text({
      label: "Número interior",
      maxLength: 20,
      tracking: true,
    });
    zip = Fields.Text({
      label: "Código postal",
      minLength: 5,
      maxLength: 5,
      tracking: true,
    });
    vat = Fields.Text({
      label: "R.F.C.",
      tracking: true,
    });
    curp = Fields.Text({
      label: "CURP",
      tracking: true,
    });
    paisId = Fields.Many2one("UbicacionesPais", {
      label: "País",
      onDelete: "Restrict",
      tracking: true,
    });
    estadoId = Fields.Many2one("UbicacionesEstado", {
      label: "Estado",
      onDelete: "Restrict",
      tracking: true,
      domain: (d) => d.eq("paisId", d.draft("paisId")),
    });
    municipioId = Fields.Many2one("UbicacionesMunicipio", {
      label: "Municipio",
      onDelete: "Restrict",
      tracking: true,
      domain: (d) => d.eq("estadoId", d.draft("estadoId")),
    });
    localidadId = Fields.Many2one("UbicacionesLocalidad", {
      label: "Localidad",
      onDelete: "Restrict",
      tracking: true,
      domain: (d) => d.eq("municipioId", d.draft("municipioId")),
    });
    tagIds = Fields.Many2many("ContactosextraPartnertags", {
      label: "Etiquetas",
      maxSelected: 20,
      create: true,
    });
    saleUserId = Fields.Many2one("User", {
      label: "Vendedor",
      tracking: true,
      domain: (d) => d.eq("active", true),
    });
    purchaseUserId = Fields.Many2one("User", {
      label: "Comprador",
      tracking: true,
      domain: (d) => d.eq("active", true),
    });
    partnerType = Fields.Selection(
      [
        { value: "contact", label: "Contacto" },
        { value: "delivery", label: "Entrega" },
        { value: "invoice", label: "Facturación" },
      ],
      {
        label: "Tipo de contacto",
        required: true,
        default: "contact",
        tracking: true,
      },
    );
    parentId = Fields.Many2one("Partner", {
      label: "Contacto principal",
      onDelete: "Restrict",
      tracking: true,
      domain: (d) => d.neq("id", d.record.id),
    });
    childIds = Fields.One2many("Partner", {
      label: "Subcontactos",
      inverse: "parentId",
      readonly: true,
    });

    normalize(values: Readonly<Record<string, unknown>>) {
      const normalized = super.normalize?.(values) ?? values;

      return {
        ...normalized,
        curp: typeof normalized.curp === "string" ? normalized.curp.trim().toUpperCase() : normalized.curp,
      };
    }

    @constraint("parentId")
    async validarContactoPrincipal(values: ModelTypes["values"], context: ModelTypes["context"]) {
      let actualId = typeof values.parentId === "string" ? values.parentId : null;

      const visitados = new Set<string>();
      if (context.id) visitados.add(context.id);

      while (actualId) {
        if (visitados.has(actualId)) {
          throw new ModelValidationError("Revisa el contacto principal.", {
            parentId: "La relación entre contactos no puede formar un ciclo.",
          });
        }

        visitados.add(actualId);

        const contacto: { parentId: string | null } | null = await context.tx.contactosextraCorePartner.findUnique({
          where: { recordId: actualId },
          select: { parentId: true },
        });

        actualId = contacto?.parentId ?? null;
      }
    }

    @constraint("paisId", "estadoId")
    async validarPaisEstado(values: Readonly<Record<string, unknown>>, context: ModelContext) {
      if (!values.estadoId) return;

      if (!values.paisId) {
        throw new ModelValidationError("Selecciona un país.", {
          paisId: "El país es obligatorio cuando seleccionas un estado.",
        });
      }

      const { authorizeModel } = await import("@/lib/access/engine");

      const scope = await authorizeModel(context.tx, context.actor, "ubicaciones.estado", "read");

      const estado = await context.tx.ubicacionesEstado.findFirst({
        where: {
          AND: [{ id: String(values.estadoId) }, ...(scope ? [scope] : [])],
        },
        select: { paisId: true },
      });

      if (!estado || estado.paisId !== values.paisId) {
        throw new ModelValidationError("Revisa el estado.", {
          estadoId: "Selecciona un estado disponible del país indicado.",
        });
      }
    }

    @constraint("zip")
    validarCodigoPostar(values: Readonly<Record<string, unknown>>) {
      const zip = values.zip;

      if (typeof zip === "string" && zip !== "" && !/^[0-9]{5}$/.test(zip)) {
        throw new ModelValidationError("Revisa el código postal.", {
          zip: "Introduce exactamente cinco dígitos",
        });
      }
    }

    @constraint("vat")
    validarRFC(values: Readonly<Record<string, unknown>>) {
      const vat = values.vat;

      if (typeof vat === "string" && vat !== "" && !/^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(vat)) {
        throw new ModelValidationError("Revisa el RFC.", {
          vat: "Introduce un RFC de 12 o 13 caracteres en mayúsculas.",
        });
      }
    }
  }

  return PartnerExtra;
});
