import type { CollectionField } from "@/components/ui/collection/types";

export const recordColumns = [{"field":"name","label":"Nombre","type":"text","sortable":true},
{"field":"logo","label":"Logotipo","type":"text","sortable":true},
{"field":"active","label":"Activo","type":"boolean","sortable":true,"groupable":true} ] as const satisfies readonly CollectionField[];
export const recordSearchFields = ["name","logo"] as const;
