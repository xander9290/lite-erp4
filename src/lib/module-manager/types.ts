export const moduleKinds = [
  { value: "declarative", label: "Módulo declarativo" },
  { value: "scaffold", label: "Aplicación anterior" },
  { value: "manual", label: "Aplicación nativa" },
  { value: "unknown", label: "Sin identificar" },
] as const;

export const moduleStatuses = [
  { value: "installed", label: "Instalado" },
  { value: "available", label: "No instalado" },
  { value: "pending", label: "Sincronización pendiente" },
  { value: "unregistered", label: "Fuera del catálogo" },
  { value: "empty", label: "Sin modelos" },
  { value: "review", label: "Requiere revisión" },
  { value: "retained", label: "Retirado · datos conservados" },
] as const;
export type ModuleKind = typeof moduleKinds[number]["value"];
export type ModuleStatus = typeof moduleStatuses[number]["value"];
export type ManagedModule = {
  id: string;
  name: string;
  description: string;
  version: string;
  kind: ModuleKind;
  status: ModuleStatus;
  registered: boolean;
  managed: boolean;
  models: string[];
  depends: string[];
  dependents: string[];
  missingDependencies: string[];
  tables: { model: string; name: string; present: boolean; missingColumns: string[] }[];
  issues: string[];
};

export const statusLabel = (value: string) => moduleStatuses.find(item => item.value === value)?.label ?? value;
export const kindLabel = (value: string) => moduleKinds.find(item => item.value === value)?.label ?? value;
