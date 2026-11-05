"use client";

import { useId, type ComponentPropsWithoutRef } from "react";
import { useController, useFormContext, type FieldValues } from "react-hook-form";
import type { BaseFieldProps } from "./field.types";
import { fieldDirectionClassName, fieldLabelClassName } from "./field.styles";

export type FieldBooleanProps<TFieldValues extends FieldValues = FieldValues> = BaseFieldProps<TFieldValues, boolean> &
  Omit<ComponentPropsWithoutRef<"input">,
    keyof BaseFieldProps<TFieldValues, boolean> | "type" | "value" | "defaultValue" | "checked" | "defaultChecked" | "children" | "role" | "aria-checked"
  > & { type?: "switch" };

export default function FieldBoolean<TFieldValues extends FieldValues = FieldValues>({
  name, label, type = "switch", direction = "block", onChange, onBlur, onClick,
  id, disabled, readOnly, className = "", "aria-describedby": describedBy, ...inputProps
}: FieldBooleanProps<TFieldValues>) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const { control } = useFormContext<TFieldValues>();
  const { field, fieldState } = useController({ name, control, disabled });
  const { name: fieldName, value: fieldValue, ref: fieldRef, disabled: fieldDisabled, onChange: updateField, onBlur: blurField } = field;
  const fieldLabel = label?.trim();
  const checked = fieldValue === true;

  return (
    <div data-form-field={name} className={fieldDirectionClassName(direction, fieldLabel)}>
      {fieldLabel && <label htmlFor={inputId} className={fieldLabelClassName(direction)}>{fieldLabel}</label>}
      <div className="flex min-h-10 w-full min-w-0 items-center">
        <input
          {...inputProps}
          name={fieldName}
          ref={fieldRef}
          id={inputId}
          type="checkbox"
          role={type}
          checked={checked}
          disabled={fieldDisabled}
          readOnly={readOnly}
          autoComplete="off"
          aria-checked={checked}
          aria-readonly={readOnly || undefined}
          aria-label={inputProps["aria-label"] || (!fieldLabel && !inputProps["aria-labelledby"] ? name : undefined)}
          aria-invalid={fieldState.invalid || inputProps["aria-invalid"]}
          aria-describedby={[describedBy, fieldState.invalid ? errorId : undefined].filter(Boolean).join(" ") || undefined}
          className={`toggle toggle-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-base-content motion-reduce:transition-none ${readOnly ? "cursor-default" : ""} ${className}`}
          onClick={event => { if (readOnly) event.preventDefault(); onClick?.(event); }}
          onChange={event => {
            if (fieldDisabled || readOnly) return;
            const value = event.currentTarget.checked;
            updateField(value);
            onChange?.(value);
          }}
          onBlur={event => { blurField(); onBlur?.(event); }}
        />
        {fieldState.invalid && <span id={errorId} className="sr-only">{fieldState.error?.message || `${fieldLabel || name}: valor inválido.`}</span>}
      </div>
    </div>
  );
}
