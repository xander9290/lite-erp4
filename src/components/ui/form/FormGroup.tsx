"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { useInsertionAnchor } from "./insertions/Insertions";

export type FormGroupProps = Omit<ComponentPropsWithoutRef<"fieldset">, "children"> & {
  children: ReactNode;
  legend?: ReactNode;
  fullWidth?: boolean;
};

export default function FormGroup({
  children,
  legend,
  fullWidth = false,
  className = "",
  ...fieldsetProps
}: FormGroupProps) {
  // With `id`, the group is an insertion anchor (`group:<id>`) for extensions.
  const anchor = useInsertionAnchor(fieldsetProps.id ? `group:${fieldsetProps.id}` : undefined);
  return anchor.wrap(
    <fieldset
      {...fieldsetProps}
      className={`m-0 flex min-w-0 flex-col gap-[var(--form-layout-gap,1rem)] rounded-box border border-base-300 bg-base-200/40 p-[var(--form-group-padding,1rem)] shadow-xs ${fullWidth ? "col-span-full" : ""} ${className}`}
    >
      {legend != null && <legend className="px-2 text-sm font-semibold text-base-content">{legend}</legend>}
      {children}
      {anchor.inside}
    </fieldset>
  );
}
