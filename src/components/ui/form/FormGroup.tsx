import type { ComponentPropsWithoutRef, ReactNode } from "react";

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
  return (
    <fieldset
      {...fieldsetProps}
      className={`m-0 flex min-w-0 flex-col gap-4 rounded-box border border-base-300 bg-base-200/40 p-4 shadow-xs ${fullWidth ? "col-span-full" : ""} ${className}`}
    >
      {legend != null && <legend className="px-2 text-sm font-semibold text-base-content">{legend}</legend>}
      {children}
    </fieldset>
  );
}
