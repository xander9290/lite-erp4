"use client";

import { useId, useMemo, useState, type ComponentPropsWithoutRef } from "react";
import { useController, useFormContext, type FieldValues } from "react-hook-form";
import { useModelField } from "./modelFields";
import ReadFieldValue, { type ReadFieldProps } from "./ReadFieldValue";
import FieldVisibility from "./FieldVisibility";
import type { BaseFieldProps } from "./field.types";
import { fieldDirectionClassName, fieldInputClassName, fieldLabelClassName } from "./field.styles";
import { createNumberFormat, type ParsedNumber } from "./numberFormat";

type NumberVariant =
  | { type: "integer"; decimals?: never; currency?: never }
  | { type: "float"; decimals: number; currency?: never }
  | { type: "monetary"; decimals: number; currency?: string };

type EditableFieldNumberProps<TFieldValues extends FieldValues = FieldValues> = BaseFieldProps<TFieldValues, number | null> &
  Omit<
    ComponentPropsWithoutRef<"input">,
    keyof BaseFieldProps<TFieldValues, number | null> | "type" | "value" | "defaultValue" | "children" | "inputMode" | "dir" | "min" | "max" | "step"
  > & NumberVariant & {
    locale?: string;
    allowNegative?: boolean;
    mode?:"edit";
  };
type DisplayNumberProps = ReadFieldProps & NumberVariant & {locale?:string};
export type FieldNumberProps<TFieldValues extends FieldValues = FieldValues> = EditableFieldNumberProps<TFieldValues> | DisplayNumberProps;

type EditingNumber = ParsedNumber & { name: string; formatKey: string };

export default function FieldNumber<TFieldValues extends FieldValues = FieldValues>(props: FieldNumberProps<TFieldValues>) {
  const { invisible, ...controlProps } = props;
  return <FieldVisibility name={props.name} invisible={invisible}><NumberControl {...controlProps} /></FieldVisibility>;
}

function NumberControl<TFieldValues extends FieldValues = FieldValues>(props: FieldNumberProps<TFieldValues>) {
  if (props.mode === "display") {
    const formatter=createNumberFormat({type:props.type,decimals:props.decimals,currency:props.currency,locale:props.locale??"es-MX",allowNegative:true});
    return <ReadFieldValue {...props} kind="integer" format={formatter.format} />;
  }
  return <EditableNumber {...props} />;
}

function EditableNumber<TFieldValues extends FieldValues = FieldValues>(props:EditableFieldNumberProps<TFieldValues>) {
  const {
  name,
  label,
  type,
  decimals,
  currency,
  locale = "es-MX",
  allowNegative = false,
  direction = "block",
  onChange,
  onFocus,
  onBlur,
  id,
  disabled,
  className = "",
  style,
  "aria-describedby": describedBy,
  mode,
  ...inputProps
} = useModelField(props, "integer");
  void mode;
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const currencyId = `${inputId}-currency`;
  const { control } = useFormContext<TFieldValues>();
  const { field, fieldState } = useController({ name, control, disabled });
  const [focused, setFocused] = useState(false);
  const [editing, setEditing] = useState<EditingNumber | null>(null);
  const formatter = useMemo(
    () => createNumberFormat({ type, decimals, currency, locale, allowNegative }),
    [type, decimals, currency, locale, allowNegative],
  );
  const value = typeof field.value === "number" && Number.isFinite(field.value) ? field.value : null;
  const currentDraft = editing?.name === name && editing.formatKey === formatter.key && Object.is(editing.value, value);
  const displayValue = focused && !inputProps.readOnly
    ? currentDraft ? editing.text : formatter.toInput(value)
    : formatter.format(value);
  const fieldLabel = label?.trim();
  const errorMessage = fieldState.error?.message || `${fieldLabel || name}: valor inválido.`;

  return (
    <div data-form-field={name} className={fieldDirectionClassName(direction, fieldLabel)}>
      {fieldLabel && (
        <label htmlFor={inputId} className={fieldLabelClassName(direction)}>
          {fieldLabel}
        </label>
      )}
      <div className="relative min-w-0">
        {formatter.currencySymbol && (
          <span aria-hidden="true" title={formatter.currencyCode} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 select-none text-sm font-medium text-base-content/55">
            {formatter.currencySymbol}
          </span>
        )}
        <input
          {...inputProps}
          {...field}
          id={inputId}
          type="text"
          dir="ltr"
          autoComplete="off"
          inputMode={allowNegative ? "text" : formatter.decimals === 0 ? "numeric" : "decimal"}
          value={displayValue}
          className={`${fieldInputClassName} tabular-nums ${formatter.currencySymbol ? "pl-14 pr-1" : "px-1"} ${className}`}
          style={{ ...style, textAlign: "right" }}
          aria-label={inputProps["aria-label"] || (!fieldLabel && !inputProps["aria-labelledby"] ? name : undefined)}
          aria-invalid={fieldState.invalid || inputProps["aria-invalid"]}
          aria-describedby={[describedBy, formatter.currencyCode ? currencyId : undefined, fieldState.invalid ? errorId : undefined].filter(Boolean).join(" ") || undefined}
          onFocus={(event) => {
            setFocused(true);
            setEditing({ name, text: formatter.toInput(value), value, formatKey: formatter.key });
            onFocus?.(event);
          }}
          onChange={(event) => {
            const parsed = formatter.parseInput(event.currentTarget.value);
            if (!parsed) return;
            setEditing({ ...parsed, name, formatKey: formatter.key });
            field.onChange(parsed.value);
            onChange?.(parsed.value);
          }}
          onBlur={(event) => {
            setFocused(false);
            setEditing(null);
            const rounded = formatter.round(value);
            if (!Object.is(rounded, field.value)) {
              field.onChange(rounded);
              onChange?.(rounded);
            }
            field.onBlur();
            onBlur?.(event);
          }}
        />
        {formatter.currencyCode && <span id={currencyId} className="sr-only">Moneda: {formatter.currencyCode}</span>}
        {fieldState.invalid && <span id={errorId} className="sr-only">{errorMessage}</span>}
      </div>
    </div>
  );
}
