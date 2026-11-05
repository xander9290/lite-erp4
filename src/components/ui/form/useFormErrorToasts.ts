"use client";

import { useEffect, useId } from "react";
import toast from "react-hot-toast";
import type { FieldErrors, FieldValues, UseFormReturn } from "react-hook-form";

const noSilentErrors: readonly string[] = [];
function collectErrors(value: unknown, silentTypes: readonly string[], path = "", errors = new Map<string, string>()) {
  if (!value || typeof value !== "object") return errors;

  const entry = value as Record<string, unknown>;
  const isFieldError = typeof entry.type === "string" || typeof entry.message === "string";

  if (isFieldError && !silentTypes.includes(String(entry.type))) {
    const message = typeof entry.message === "string" && entry.message.trim()
      ? entry.message
      : path ? `El campo "${path}" no es válido.` : "El formulario contiene un error.";
    errors.set(path, message);
  }

  for (const [key, child] of Object.entries(entry)) {
    if (isFieldError && ["type", "message", "types", "ref"].includes(key)) continue;
    collectErrors(child, silentTypes, path ? `${path}.${key}` : key, errors);
  }

  return errors;
}

export default function useFormErrorToasts<TFieldValues extends FieldValues>({
  getErrors,
  subscribe,
}: Pick<UseFormReturn<TFieldValues>, "getErrors" | "subscribe">, silentTypes: readonly string[] = noSilentErrors) {
  const formId = useId();

  useEffect(() => {
    let previousErrors = new Map<string, string>();
    let previousSubmitCount = 0;
    const toastId = (name: string) => `form-error-${formId}-${name}`;

    function syncErrors(errors: FieldErrors<TFieldValues>, submitCount = previousSubmitCount) {
      const currentErrors = collectErrors(errors, silentTypes);
      const submittedAgain = submitCount > previousSubmitCount;

      for (const name of previousErrors.keys()) {
        if (!currentErrors.has(name)) toast.dismiss(toastId(name));
      }

      for (const [name, message] of currentErrors) {
        if (submittedAgain || previousErrors.get(name) !== message) {
          toast.error(message, { id: toastId(name) });
        }
      }

      previousErrors = currentErrors;
      previousSubmitCount = submitCount;
    }

    const unsubscribe = subscribe({
      formState: { errors: true, submitCount: true },
      callback: ({ errors, submitCount }) => syncErrors(errors ?? getErrors(), submitCount),
    });
    syncErrors(getErrors());

    return () => {
      unsubscribe();
      for (const name of previousErrors.keys()) toast.dismiss(toastId(name));
    };
  }, [formId, getErrors, subscribe, silentTypes]);
}
