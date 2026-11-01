"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import {
  FormProvider,
  type FieldValues,
  type SubmitErrorHandler,
  type SubmitHandler,
  type UseFormReturn,
} from "react-hook-form";
import useFormErrorToasts from "./useFormErrorToasts";

export type FormLayoutProps<
  TFieldValues extends FieldValues,
  TContext = unknown,
  TTransformedValues = TFieldValues,
> = Omit<ComponentPropsWithoutRef<"form">, "onSubmit" | "onInvalid" | "children" | "autoComplete"> & {
  methods: UseFormReturn<TFieldValues, TContext, TTransformedValues>;
  onSubmit: SubmitHandler<TTransformedValues>;
  onInvalid?: SubmitErrorHandler<TFieldValues>;
  children: ReactNode;
  autoComplete?: "off";
};

export default function FormLayout<
  TFieldValues extends FieldValues,
  TContext = unknown,
  TTransformedValues = TFieldValues,
>({
  methods,
  onSubmit,
  onInvalid,
  children,
  className = "",
  noValidate = true,
  ...formProps
}: FormLayoutProps<TFieldValues, TContext, TTransformedValues>) {
  useFormErrorToasts(methods);

  return (
    <FormProvider {...methods}>
      <form
        {...formProps}
        autoComplete="off"
        className={`@container/form min-w-0 ${className}`}
        noValidate={noValidate}
        onSubmit={methods.handleSubmit(onSubmit, onInvalid)}
      >
        <div className="grid grid-cols-1 items-start gap-4 @2xl/form:grid-cols-2">{children}</div>
      </form>
    </FormProvider>
  );
}
