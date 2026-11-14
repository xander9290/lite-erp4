import { z } from "zod";
import { formatPhone } from "@/components/ui/form/phone";
import { Fields } from "@/lib/orm/fields";

export const headerSampleSchema = z.object({
  name: z.string().trim().min(1, "Nombre: escribe el título del registro.").max(300),
});
export type HeaderSampleValues = z.infer<typeof headerSampleSchema>;

export const stackSampleSchema = z.object({
  name: z.string().trim().min(1, "Nombre: campo obligatorio.").max(120),
  plate: z.string().trim().min(1, "Matrícula: campo obligatorio.").max(20),
  model: z.string().trim().min(1, "Modelo: campo obligatorio.").max(120),
  active: z.boolean(),
});
export type StackSampleValues = z.infer<typeof stackSampleSchema>;

export const invisibleSampleFields = {
  reference: Fields.Text({ label: "Referencia", required: true, maxLength: 40, invisible: true }),
  notes: Fields.Text({ label: "Observaciones", maxLength: 240 }),
};
export const invisibleSampleSchema = z.object({
  showDetails: z.boolean(),
  reference: invisibleSampleFields.reference.schema,
  notes: invisibleSampleFields.notes.schema,
});
export type InvisibleSampleInput = z.input<typeof invisibleSampleSchema>;
export type InvisibleSampleValues = z.output<typeof invisibleSampleSchema>;

export const emailSampleSchema = z.object({
  email: z.email({ error: "Correo: escribe una dirección válida." }).max(254),
});
export type EmailSampleValues = z.infer<typeof emailSampleSchema>;

export const phoneSampleSchema = z.object({
  phone: z.string().transform(formatPhone).pipe(z.string().regex(/^\+52 \d{2} \d{4} \d{4}$/, "Teléfono: escribe diez dígitos mexicanos, con prefijo +52 opcional.")),
});
export type PhoneSampleValues = z.infer<typeof phoneSampleSchema>;

const uniqueIds = (maximum: number) => z.array(z.string().min(1)).max(maximum, `Selecciona como máximo ${maximum} registros.`)
  .refine(ids => new Set(ids).size === ids.length, "La selección contiene registros duplicados.");
export const relationTagSampleSchema = z.object({
  partnerIds: uniqueIds(5).min(1, "Contactos: selecciona al menos un registro."),
  userIds: uniqueIds(8),
});
export type RelationTagSampleValues = z.infer<typeof relationTagSampleSchema>;

export const many2OneSampleSchema = z.object({
  userId: z.string().min(1).nullable().refine(value => value !== null, "Usuario: selecciona un registro."),
  partnerId: z.string().min(1).nullable(),
});
export type Many2OneSampleInput = z.input<typeof many2OneSampleSchema>;
export type Many2OneSampleValues = z.output<typeof many2OneSampleSchema>;

export const booleanSampleSchema = z.object({
  notifications: z.boolean({ error: "Notificaciones: se espera true o false." }),
  confirmation: z.boolean().refine(value => value === true, "Activa la confirmación de la configuración."),
  quietMode: z.boolean(),
  locked: z.boolean(),
  unavailable: z.boolean().optional(),
});
export type BooleanSampleInput = z.input<typeof booleanSampleSchema>;
export type BooleanSampleValues = z.output<typeof booleanSampleSchema>;
export const booleanSampleDefaults: BooleanSampleInput = {
  notifications: false, confirmation: false, quietMode: false, locked: true, unavailable: true,
};
export const booleanSampleExample: BooleanSampleValues = {
  notifications: false, confirmation: true, quietMode: true, locked: true, unavailable: true,
};

export const imageSampleField = Fields.Image({ label: "Imagen", folder: "lite-erp/samples", required: true });
export const imageSampleSchema = z.object({ image: imageSampleField.schema });
export type ImageSampleInput = z.input<typeof imageSampleSchema>;
export type ImageSampleValues = z.output<typeof imageSampleSchema>;

export const textSampleSchema = z.object({
  username: z.string().trim().min(3, "Usuario: escribe al menos 3 caracteres."),
  password: z.string().min(8, "Contraseña: escribe al menos 8 caracteres."),
  alias: z.string().max(30, "Alias: el máximo es de 30 caracteres."),
});
export type TextSampleValues = z.infer<typeof textSampleSchema>;
export const textSampleDefaults: TextSampleValues = { username: "", password: "", alias: "" };
export const textSampleExample: TextSampleValues = { username: "demo", password: "Ejemplo2026!", alias: "Consulta de Fields" };

export const longTextSampleSchema = z.object({
  description: z.string().trim().min(20, "Descripción: escribe al menos 20 caracteres.").max(500, "Descripción: el máximo es de 500 caracteres."),
  notes: z.string().max(240, "Notas: el máximo es de 240 caracteres."),
});
export type LongTextSampleValues = z.infer<typeof longTextSampleSchema>;
export const longTextSampleDefaults: LongTextSampleValues = { description: "", notes: "" };
export const longTextSampleExample: LongTextSampleValues = {
  description: "Entrega del pedido en recepción.\nAvisar al contacto antes de llegar y verificar que todos los artículos estén completos.",
  notes: "Atención de lunes a viernes.\nConservar el comprobante de entrega.",
};

export const numberSampleSchema = z.object({
  quantity: z.number({ error: "Cantidad: introduce un número." })
    .int("Cantidad: debe ser un entero.").min(1, "Cantidad: el mínimo es 1.")
    .nullable().refine(value => value !== null, "Cantidad: es requerida."),
  measurement: z.number({ error: "Medida: introduce un número." })
    .min(0, "Medida: no puede ser negativa.")
    .nullable().refine(value => value !== null, "Medida: es requerida."),
  price: z.number({ error: "Precio: introduce un número." })
    .min(0.01, "Precio: debe ser mayor que cero.")
    .nullable().refine(value => value !== null, "Precio: es requerido."),
});
export type NumberSampleValues = z.infer<typeof numberSampleSchema>;
export type NumberSampleInput = z.input<typeof numberSampleSchema>;
export const numberSampleDefaults: NumberSampleInput = { quantity: 0, measurement: 0, price: 0 };
export const numberSampleExample: NumberSampleValues = { quantity: 5, measurement: 12.345, price: 1250.5 };

export const selectSampleSchema = z.object({
  role: z.enum(["user", "admin", "public"], { error: "Rol: selecciona una opción válida." })
    .nullable().refine(value => value !== null, "Rol: es requerido."),
  day: z.union([z.literal(1), z.literal(2), z.literal(3)], { error: "Día: selecciona una opción válida." })
    .nullable().refine(value => value !== null, "Día: es requerido."),
});
export type SelectSampleValues = z.infer<typeof selectSampleSchema>;
export type SelectSampleInput = z.input<typeof selectSampleSchema>;
export const selectSampleDefaults: SelectSampleInput = { role: null, day: null };
export const selectSampleExample: SelectSampleValues = { role: "user", day: 2 };

const requiredDate = z.iso.date({ error: "Fecha: usa una fecha válida." })
  .nullable().refine(value => value !== null, "Fecha: es requerida.");
const requiredDatetime = z.iso.datetime({ error: "Fecha y hora: usa un ISO UTC válido." })
  .nullable().refine(value => value !== null, "Fecha y hora: son requeridas.");

export const dateSampleSchema = z.object({
  date: requiredDate,
  datetime: requiredDatetime,
  isoDate: requiredDatetime,
  dateRange: z.object({ start: requiredDate, end: requiredDate })
    .refine(({ start, end }) => !start || !end || end >= start, {
      path: ["end"], message: "Periodo: la fecha final no puede ser anterior a la inicial.",
    }),
  datetimeRange: z.object({ start: requiredDatetime, end: requiredDatetime })
    .refine(({ start, end }) => !start || !end || Date.parse(end) >= Date.parse(start), {
      path: ["end"], message: "Horario: el final no puede ser anterior al inicio.",
    }),
});
export type DateSampleValues = z.infer<typeof dateSampleSchema>;
export type DateSampleInput = z.input<typeof dateSampleSchema>;
export const dateSampleDefaults: DateSampleInput = {
  date: null, datetime: null, isoDate: null,
  dateRange: { start: null, end: null },
  datetimeRange: { start: null, end: null },
};
export const dateSampleExample: DateSampleValues = {
  date: "2026-11-02",
  datetime: "2026-11-03T02:46:00.000Z",
  isoDate: "2026-11-02T00:00:00.000Z",
  dateRange: { start: "2026-11-02", end: "2026-11-10" },
  datetimeRange: { start: "2026-11-03T02:46:00.000Z", end: "2026-11-03T03:46:00.000Z" },
};
