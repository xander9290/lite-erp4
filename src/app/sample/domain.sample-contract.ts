import { Fields } from "@/lib/orm/fields";
export const domainSampleFields = {
  paisId: Fields.Many2one("SamplePais", { label: "País" }),
  estadoId: Fields.Many2one("SampleEstado", { label: "Estado", domain: d => d.eq("paisId", d.draft("paisId")) }),
};
export const domainSampleMany = {
  estados: Fields.Many2many("SampleEstado", { label: "Estados adicionales", domain: d => d.eq("paisId", d.draft("paisId")) }),
};
export const domainSampleTargets = { paisId: Fields.Many2one("SamplePais", { required: true }).metadata };
export const recordDomainSampleFields = {
  parentId: Fields.Many2one("SampleContact", { label: "Contacto principal", domain: d => d.neq("id", d.record.id) }),
};
export const recordDomainSampleContacts = [
  { id: "contact-a", name: "Contacto A" },
  { id: "contact-b", name: "Contacto B" },
  { id: "contact-c", name: "Contacto C" },
];
export const domainSampleCountries = [{ id: "mx", name: "México" }, { id: "ca", name: "Canadá" }];
export const domainSampleStates = [
  { id: "jal", name: "Jalisco", paisId: "mx" }, { id: "yuc", name: "Yucatán", paisId: "mx" },
  { id: "ont", name: "Ontario", paisId: "ca" }, { id: "que", name: "Quebec", paisId: "ca" },
];
