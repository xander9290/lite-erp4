import type { BaseSyntheticEvent } from "react";
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import type { RecordAudit } from "@/lib/orm/audit";

export type FormViewResult<TValues extends FieldValues> =
  | { ok: true; values: TValues; message?: string; audit?: RecordAudit; displayName?: string }
  | { ok: false; error: string; kind?: "validation" | "server"; fieldErrors?: Partial<Record<FieldPath<TValues>, string>> };

export type FormViewSubmit<TValues extends FieldValues, TOutput = TValues> =
  (values: TOutput, event?: BaseSyntheticEvent) => FormViewResult<TValues> | Promise<FormViewResult<TValues>>;

export type FormViewContext<TValues extends FieldValues, TContext = unknown, TOutput = TValues> = {
  methods: UseFormReturn<TValues, TContext, TOutput>;
  isDirty: boolean;
  busy: boolean;
  readOnly: boolean;
};
