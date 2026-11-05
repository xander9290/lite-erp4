import { z } from "zod";

export const lineProducts = [
  { id: "design", name: "Diseño de interfaz", price: 1250 },
  { id: "support", name: "Soporte técnico", price: 450 },
  { id: "training", name: "Capacitación", price: 800 },
] as const;

const money = z.number().nullable().pipe(z.number({ error: "Escribe un precio unitario." }).min(0, "El precio no puede ser negativo.").max(1_000_000, "El precio máximo es 1,000,000.").refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001, "Precio: máximo dos decimales."));
export const orderLineSchema = z.strictObject({
  id: z.string().min(1).optional(),
  productId: z.string().nullable().pipe(z.string({ error: "Selecciona un producto." }).refine(value => lineProducts.some(product => product.id === value), "Selecciona un producto disponible.")),
  description: z.string().trim().min(3, "Descripción: mínimo 3 caracteres.").max(200, "Descripción: máximo 200 caracteres."),
  quantity: z.number().nullable().pipe(z.number({ error: "Escribe una cantidad." }).positive("La cantidad debe ser mayor que cero.").max(10_000).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001, "Cantidad: máximo dos decimales.")),
  unitPrice: money,
});
export const one2manySchema = z.strictObject({
  reference: z.string().trim().min(3, "Referencia: mínimo 3 caracteres.").max(40).transform(value => value.toUpperCase()),
  notes: z.string().trim().max(500),
  lines: z.array(orderLineSchema).min(1, "Agrega al menos una línea al pedido.").max(20, "El máximo es de 20 líneas."),
});
export type One2manyInput = z.input<typeof one2manySchema>;
export type One2manyValues = z.output<typeof one2manySchema>;
export type OrderLineInput = z.input<typeof orderLineSchema>;
export const one2manyDefaults: One2manyInput = {
  reference: "PED-001", notes: "Pedido de demostración para consultar el comportamiento de las líneas.",
  lines: [
    { id: "demo-line-1", productId: "design", description: "Diseño de interfaz", quantity: 1, unitPrice: 1250 },
    { id: "demo-line-2", productId: "support", description: "Soporte técnico", quantity: 2, unitPrice: 450 },
  ],
};
export function createOrderLine(): OrderLineInput { return { productId: null, description: "", quantity: 1, unitPrice: 0 }; }
export function lineSubtotal(row: Pick<OrderLineInput, "quantity" | "unitPrice">) { return Math.round((row.quantity ?? 0) * (row.unitPrice ?? 0) * 100) / 100; }
export function orderTotal(rows: readonly OrderLineInput[]) { return rows.reduce((sum, row) => sum + Math.round(lineSubtotal(row) * 100), 0) / 100; }
