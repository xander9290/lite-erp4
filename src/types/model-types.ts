import type { ModelContext } from "@/lib/orm";

export type ModelTypes = {
  values: Readonly<Record<string, unknown>>;
  context: ModelContext;
};
