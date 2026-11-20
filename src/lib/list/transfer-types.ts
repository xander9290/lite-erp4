export type TransferFormat = "csv" | "xlsx";
export type TransferFile = { name: string; mime: string; base64: string };
export type TransferRow = { row: number; key: string; operation: "create" | "update" | "unchanged" | "error"; values?: Record<string, unknown>; errors?: Record<string, string> };
export type TransferPlan = { rows: TransferRow[]; token?: string };
export type TransferResult<T> = { ok: true; data: T } | { ok: false; error: string };
export type ListTransfer = {
  fields: readonly string[];
  canImport: boolean;
  canExport: boolean;
  download: (format: TransferFormat, state: unknown, selection: readonly string[], template: boolean) => Promise<TransferResult<TransferFile>>;
  review: (file: FormData) => Promise<TransferResult<TransferPlan>>;
  apply: (token: string) => Promise<TransferResult<{ created: number; updated: number; unchanged: number }>>;
};
