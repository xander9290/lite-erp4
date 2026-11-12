/** Serializable client contracts. No Model, decorators, schema functions or private methods. */
export type ReactionRule = { fields: readonly string[]; reads: readonly string[]; writes: readonly string[]; preview: readonly string[] };
export type ReactionRequest = { field: string; values: Record<string, unknown>; id?: string; revision?: string };
export type ReactionResult = { ok: true; patch: Record<string, unknown>; preview: Record<string, string | number | boolean | null> } | { ok: false; error: string; fieldErrors?: Record<string,string> };
export type ReactionLoader = (request: ReactionRequest) => Promise<ReactionResult>;
