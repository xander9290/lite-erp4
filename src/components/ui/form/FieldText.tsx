"use client";

import { useId, useState, type ComponentPropsWithoutRef } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useController, useFormContext, type FieldValues } from "react-hook-form";
import type { BaseFieldProps } from "./field.types";

export type FieldTextProps<TFieldValues extends FieldValues = FieldValues> = BaseFieldProps<TFieldValues, string> &
  Omit<ComponentPropsWithoutRef<"input">, keyof BaseFieldProps<TFieldValues, string> | "type" | "value" | "defaultValue" | "children"> & {
    type?: "text" | "password";
  };

export default function FieldText<TFieldValues extends FieldValues = FieldValues>({
  name,
  label,
  type = "text",
  direction = "block",
  onChange,
  onBlur,
  id,
  disabled,
  className = "",
  style,
  "aria-describedby": describedBy,
  ...inputProps
}: FieldTextProps<TFieldValues>) {
  const generatedId = useId();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const { control } = useFormContext<TFieldValues>();
  const { field, fieldState } = useController({ name, control, disabled });
  const errorMessage = fieldState.error?.message || `${label}: valor inválido.`;
  const visibilityLabel = passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña";

  return (
    <div className={direction === "inline" ? "grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-3" : "flex min-w-0 flex-col gap-1.5"}>
      <label htmlFor={inputId} className="label whitespace-normal wrap-anywhere text-sm font-medium text-base-content">
        {label}
      </label>
      <div className="relative min-w-0">
        <input
          {...inputProps}
          {...field}
          id={inputId}
          autoComplete="off"
          type={type === "password" && passwordVisible ? "text" : type}
          value={field.value ?? ""}
          className={`input w-full min-w-0 rounded-none border-0 border-b-2 border-base-content/20 bg-transparent shadow-none transition-colors duration-150 hover:border-base-content/40 focus:border-base-content focus:bg-transparent focus:shadow-none focus:outline-none focus-within:border-base-content focus-within:shadow-none focus-within:outline-none disabled:border-base-content/10 disabled:bg-transparent disabled:text-base-content/40 motion-reduce:transition-none ${type === "password" ? "px-10 [&::-ms-reveal]:hidden" : "px-1"} ${className}`}
          style={type === "password" ? { ...style, textAlign: "center" } : style}
          aria-invalid={fieldState.invalid || inputProps["aria-invalid"]}
          aria-describedby={[describedBy, fieldState.invalid ? errorId : undefined].filter(Boolean).join(" ") || undefined}
          onChange={(event) => {
            const value = event.currentTarget.value;
            field.onChange(value);
            onChange?.(value);
          }}
          onBlur={(event) => {
            field.onBlur();
            onBlur?.(event);
          }}
        />
        {type === "password" && (
          <button
            type="button"
            disabled={field.disabled}
            aria-label={visibilityLabel}
            aria-controls={inputId}
            aria-pressed={passwordVisible}
            title={visibilityLabel}
            className="btn btn-ghost btn-square btn-sm absolute end-1 top-1/2 -translate-y-1/2 rounded-full text-base-content/60 hover:text-base-content focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-base-content"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setPasswordVisible((visible) => !visible)}
          >
            {passwordVisible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        )}
        {fieldState.invalid && (
          <span id={errorId} className="sr-only">
            {errorMessage}
          </span>
        )}
      </div>
    </div>
  );
}
