import { z } from "zod";

export const formViewSchema = z.object({
  reference: z.string().trim().min(3, "Referencia: mínimo 3 caracteres.").max(30).transform(value => value.toUpperCase()),
  customer: z.string().trim().min(3, "Cliente: mínimo 3 caracteres.").max(120),
  amount: z.number({ error: "Importe: escribe un número." }).min(0.01, "El importe debe ser mayor que cero."),
  notes: z.string().trim().max(500, "Notas: máximo 500 caracteres."),
  delivery: z.object({
    email: z.email("Escribe un correo de contacto válido."),
    instructions: z.string().trim().max(300, "Indicaciones: máximo 300 caracteres."),
  }),
  priority: z.enum(["normal", "high"]),
  active: z.boolean(),
  state: z.enum(["draft", "confirmed", "cancelled"]),
});

export type FormViewSampleValues = z.infer<typeof formViewSchema>;
export const formViewDefaults: FormViewSampleValues = {
  reference: "DOC-001", customer: "Cliente de ejemplo", amount: 1250,
  notes: "Una vista ligera para trabajar con tus documentos.", priority: "normal", active: true, state: "draft",
  delivery: { email: "contacto@ejemplo.com", instructions: "Entregar en recepción." },
};
export const newFormViewDefaults: FormViewSampleValues = {
  reference: "", customer: "", amount: 0, notes: "", priority: "normal", active: true, state: "draft",
  delivery: { email: "", instructions: "" },
};
export const documentStates = [
  { value: "draft", label: "Borrador" },
  { value: "confirmed", label: "Confirmado" },
  { value: "cancelled", label: "Cancelado" },
] as const;

export const selectableStateSchema = z.object({ stage: z.union([z.literal(0), z.literal(1), z.literal(2)]) });
export type SelectableStateValues = z.infer<typeof selectableStateSchema>;

export function canTransition(from: FormViewSampleValues["state"], to: FormViewSampleValues["state"]) {
  return ({ draft: ["confirmed", "cancelled"], confirmed: ["cancelled"], cancelled: ["draft"] } as const)[from].some(state => state === to);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

/** No scripts or external assets; every value is escaped before entering srcDoc. */
export function createExampleReport(values: FormViewSampleValues) {
  const state = documentStates.find(item => item.value === values.state)!.label;
  const amount = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(values.amount);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Documento ${escapeHtml(values.reference)}</title><style>
    body{font:15px/1.6 system-ui,sans-serif;color:#17212b;margin:0;padding:36px}small{color:#64748b}h1{font-size:28px;margin:8px 0}dl{display:grid;grid-template-columns:120px 1fr;gap:12px;margin:30px 0}dt{color:#64748b}dd{margin:0;overflow-wrap:anywhere}.notes{white-space:pre-wrap;overflow-wrap:anywhere;border-top:1px solid #e2e8f0;padding-top:20px}@page{size:A4;margin:18mm}@media print{body{padding:0}}
    </style></head><body><small>LITE · DOCUMENTO DE EJEMPLO</small><h1>${escapeHtml(values.reference)}</h1><p>${escapeHtml(state)}</p><dl><dt>Cliente</dt><dd>${escapeHtml(values.customer)}</dd><dt>Importe</dt><dd>${escapeHtml(amount)}</dd><dt>Prioridad</dt><dd>${values.priority === "high" ? "Alta" : "Normal"}</dd></dl><p class="notes">${escapeHtml(values.notes)}</p><small>Reporte de demostración · sin persistencia</small></body></html>`;
}
