"use client";

import { useId, useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useController, useFormContext, type FieldValues } from "react-hook-form";
import { useModelField } from "./modelFields";
import type { BaseFieldProps } from "./field.types";
import { formatPhone } from "./phone";
import { fieldDirectionClassName, fieldInputClassName, fieldTextareaClassName, fieldLabelClassName } from "./field.styles";

type TextControl = HTMLInputElement | HTMLTextAreaElement;
type ControlledProps<TFieldValues extends FieldValues> = keyof BaseFieldProps<TFieldValues, string> | "type" | "value" | "defaultValue" | "children";
export type FieldTextProps<TFieldValues extends FieldValues = FieldValues> = BaseFieldProps<TFieldValues, string> & (
  | (Omit<InputHTMLAttributes<TextControl>, ControlledProps<TFieldValues>> & { widget?: "text" | "password" | "phone" | "email"; type?: never })
  | (Omit<TextareaHTMLAttributes<TextControl>, ControlledProps<TFieldValues>> & { widget: "long"; type?: never })
);

export default function FieldText<TFieldValues extends FieldValues = FieldValues>(props: FieldTextProps<TFieldValues>) {
  const {
    name,
    label,
    widget = "text",
    direction = "block",
    onChange,
    onBlur,
    id,
    disabled,
    className = "",
    style,
    "aria-describedby": describedBy,
    ...inputProps
  } = useModelField(props, "text");
  const generatedId = useId();
  const [passwordVisible, setPasswordVisible] = useState(false);
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const { control } = useFormContext<TFieldValues>();
  const { field, fieldState } = useController({ name, control, disabled });
  const { name: fieldName, value: fieldValue, ref: fieldRef, disabled: fieldDisabled, onChange: updateField, onBlur: blurField } = field;
  const fieldLabel = label?.trim();
  const errorMessage = fieldState.error?.message || `${fieldLabel || name}: valor inválido.`;
  const visibilityLabel = passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña";
  const isPassword = widget === "password";
  const inputType = widget === "phone" ? "tel" : isPassword && !passwordVisible ? "password" : widget === "email" ? "email" : "text";

  return (
    <div data-form-field={name} className={fieldDirectionClassName(direction, fieldLabel)}>
      {fieldLabel && (
        <label htmlFor={inputId} className={fieldLabelClassName(direction)}>
          {fieldLabel}
        </label>
      )}
      <div className="relative min-w-0">
        {widget === "long" ? (
          <textarea
            rows={4}
            {...inputProps}
            name={fieldName}
            ref={fieldRef}
            disabled={fieldDisabled}
            id={inputId}
            autoComplete="off"
            value={fieldValue ?? ""}
            className={`${fieldTextareaClassName} ${className}`}
            style={style}
            aria-label={inputProps["aria-label"] || (!fieldLabel && !inputProps["aria-labelledby"] ? name : undefined)}
            aria-invalid={fieldState.invalid || inputProps["aria-invalid"]}
            aria-describedby={[describedBy, fieldState.invalid ? errorId : undefined].filter(Boolean).join(" ") || undefined}
            onChange={event => { const value = event.currentTarget.value; updateField(value); onChange?.(value); }}
            onBlur={event => { blurField(); onBlur?.(event); }}
          />
        ) : <input
          {...inputProps}
          name={fieldName}
          ref={fieldRef}
          disabled={fieldDisabled}
          id={inputId}
          autoComplete="off"
          type={inputType}
          inputMode={widget === "phone" ? "tel" : widget === "email" ? "email" : inputProps.inputMode}
          value={fieldValue ?? ""}
          className={`${fieldInputClassName} ${isPassword ? "px-10 [&::-ms-reveal]:hidden" : "px-1"} ${className}`}
          style={isPassword ? { ...style, textAlign: "center" } : style}
          aria-label={inputProps["aria-label"] || (!fieldLabel && !inputProps["aria-labelledby"] ? name : undefined)}
          aria-invalid={fieldState.invalid || inputProps["aria-invalid"]}
          aria-describedby={[describedBy, fieldState.invalid ? errorId : undefined].filter(Boolean).join(" ") || undefined}
          onChange={(event) => {
            const value = event.currentTarget.value;
            updateField(value);
            onChange?.(value);
          }}
          onBlur={(event) => {
            if (widget === "phone" && !inputProps.readOnly) {
              const value = formatPhone(event.currentTarget.value);
              if (value !== event.currentTarget.value) {
                updateField(value);
                onChange?.(value);
              }
            }
            blurField();
            onBlur?.(event);
          }}
        />}
        {isPassword && (
          <button
            type="button"
            disabled={fieldDisabled}
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
