"use client";

import { useId, useMemo, type HTMLAttributes } from "react";
import { useController, useFormContext, type FieldValues } from "react-hook-form";
import { ChevronRight } from "lucide-react";
import { useModelField } from "./modelFields";
import FieldVisibility from "./FieldVisibility";
import type { BaseFieldProps } from "./field.types";
import { fieldDirectionClassName, fieldLabelClassName, fieldSelectClassName } from "./field.styles";
import { prepareSelectOptions, type FieldSelectOption, type FieldSelectValue } from "./selectOptions";

export type { FieldSelectOption, FieldSelectValue } from "./selectOptions";

export type FieldSelectProps<
  TFieldValues extends FieldValues = FieldValues,
  TValue extends FieldSelectValue = FieldSelectValue,
> = BaseFieldProps<TFieldValues, TValue | null> &
  Omit<HTMLAttributes<HTMLElement>, keyof BaseFieldProps<TFieldValues, TValue | null> | "children" | "defaultValue" | "defaultChecked" | "dangerouslySetInnerHTML"> & {
    type?: "dropdown" | "optional";
    widget?: "statebar";
    /** Statebars are read-only by default; use actions for server-side transitions. */
    readOnly?: boolean;
    options?: readonly FieldSelectOption<TValue>[];
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    form?: string;
  };

export default function FieldSelect<
  TFieldValues extends FieldValues = FieldValues,
  TValue extends FieldSelectValue = FieldSelectValue,
>(props: FieldSelectProps<TFieldValues, TValue>) {
  const { invisible, ...controlProps } = props;
  return <FieldVisibility name={props.name} invisible={invisible}><SelectControl {...controlProps} /></FieldVisibility>;
}

function SelectControl<TFieldValues extends FieldValues = FieldValues, TValue extends FieldSelectValue = FieldSelectValue>(props: FieldSelectProps<TFieldValues, TValue>) {
  const {
  name,
  label,
  type = "dropdown",
  widget,
  readOnly = widget === "statebar",
  options,
  placeholder = "Selecciona una opción",
  direction = "block",
  onChange,
  onBlur,
  onFocus,
  id,
  disabled,
  required,
  form,
  autoFocus,
  className = "",
  style,
  "aria-label": ariaLabel,
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
  ...controlProps
} = useModelField(props, "selection");
  if (!options) throw new Error(`FieldSelect ${name} requiere options o un contrato de modelo Selection.`);
  delete controlProps.autoComplete;
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const labelId = `${inputId}-label`;
  const errorId = `${inputId}-error`;
  const { control } = useFormContext<TFieldValues>();
  const { field, fieldState } = useController({ name, control, disabled });
  const { name: fieldName, value: fieldValue, ref: fieldRef, disabled: fieldDisabled, onChange: updateField, onBlur: blurField } = field;
  const prepared = useMemo(() => prepareSelectOptions(options), [options]);
  const selected = prepared.find((option) => option.value === fieldValue);
  const focusOption = (selected && !selected.disabled ? selected : undefined) ?? prepared.find((option) => !option.disabled);
  const fieldLabel = label?.trim();
  const errorMessage = fieldState.error?.message || `${fieldLabel || name}: valor inválido.`;
  const accessibleLabel = ariaLabel || (!fieldLabel && !labelledBy ? name : undefined);
  const description = [describedBy, fieldState.invalid ? errorId : undefined].filter(Boolean).join(" ") || undefined;

  function changeSelection(key: string) {
    if (fieldDisabled || readOnly) return;
    if (key === "") {
      if (required) return;
      updateField(null);
      onChange?.(null);
      return;
    }
    const option = prepared.find((item) => item.key === key);
    if (!option || option.disabled) return;
    updateField(option.value);
    onChange?.(option.value);
  }

  return (
    <div data-form-field={name} className={fieldDirectionClassName(direction, fieldLabel)}>
      {fieldLabel && (type === "dropdown" && widget !== "statebar" ? (
        <label id={labelId} htmlFor={inputId} className={fieldLabelClassName(direction)}>{fieldLabel}</label>
      ) : (
        <span id={labelId} className={fieldLabelClassName(direction)}>{fieldLabel}</span>
      ))}
      <div className="min-w-0">
        {widget === "statebar" ? (
          <div
            {...controlProps}
            id={inputId}
            ref={readOnly ? fieldRef : undefined}
            tabIndex={readOnly ? 0 : undefined}
            role={readOnly ? "group" : "radiogroup"}
            className={`max-w-full overflow-x-auto rounded-xl border border-base-300 bg-base-200/60 p-1 outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary ${fieldDisabled ? "opacity-45" : ""} ${className}`}
            style={style}
            aria-label={accessibleLabel}
            aria-labelledby={labelledBy || (!ariaLabel && fieldLabel ? labelId : undefined)}
            aria-required={!readOnly ? required : undefined}
            aria-disabled={fieldDisabled}
            aria-invalid={fieldState.invalid || controlProps["aria-invalid"]}
            aria-describedby={description}
            onBlur={event => {
              if (!event.currentTarget.contains(event.relatedTarget)) { blurField(); onBlur?.(event); }
            }}
            onFocus={event => {
              if (!event.currentTarget.contains(event.relatedTarget)) onFocus?.(event);
            }}
          >
            <ol className="m-0 flex w-max min-w-full list-none items-center p-0">
              {prepared.length === 0 && <li className="px-3 py-2 text-sm text-base-content/50">No hay estados disponibles</li>}
              {prepared.map((option, index) => {
                const checked = selected?.key === option.key;
                const optionDisabled = fieldDisabled || option.disabled;
                const segment = <span className={`block rounded-lg px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors motion-reduce:transition-none sm:text-sm ${checked ? "bg-primary text-primary-content shadow-sm" : "text-base-content/60"}`}>{option.label}</span>;
                return <li key={option.key} className="flex shrink-0 items-center gap-0.5" aria-current={checked && readOnly ? "step" : undefined}>
                  {index > 0 && <ChevronRight aria-hidden="true" size={13} className="mx-0.5 text-base-content/30" />}
                  {readOnly ? <span className={option.disabled ? "opacity-45" : undefined}>{segment}</span> : <label className={`rounded-lg ${optionDisabled ? "cursor-not-allowed opacity-45" : "cursor-pointer hover:bg-base-300/60"} has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary`}>
                    <input type="radio" id={`${inputId}-${index}`} name={fieldName} value={option.key}
                      checked={checked} disabled={optionDisabled} required={required} form={form} autoComplete="off"
                      autoFocus={autoFocus && option.key === focusOption?.key}
                      ref={option.key === focusOption?.key ? fieldRef : undefined}
                      className="sr-only" aria-describedby={description} onChange={() => changeSelection(option.key)} />
                    {segment}
                  </label>}
                </li>;
              })}
            </ol>
          </div>
        ) : type === "dropdown" ? (
          <select
            {...controlProps}
            id={inputId}
            name={fieldName}
            ref={fieldRef}
            form={form}
            required={required}
            disabled={fieldDisabled || readOnly}
            autoFocus={autoFocus}
            autoComplete="off"
            value={selected?.key ?? ""}
            className={`${fieldSelectClassName} ${className}`}
            style={style}
            aria-label={accessibleLabel}
            aria-labelledby={labelledBy}
            aria-invalid={fieldState.invalid || controlProps["aria-invalid"]}
            aria-describedby={description}
            onChange={(event) => changeSelection(event.currentTarget.value)}
            onBlur={(event) => { blurField(); onBlur?.(event); }}
            onFocus={onFocus}
          >
            <option value="" disabled={required}>{placeholder}</option>
            {prepared.map((option) => (
              <option key={option.key} value={option.key} disabled={option.disabled}>{option.label}</option>
            ))}
          </select>
        ) : (
          <div
            {...controlProps}
            id={inputId}
            role="radiogroup"
            className={`flex min-h-10 w-full min-w-0 flex-wrap items-center gap-2 ${className}`}
            style={style}
            aria-label={accessibleLabel}
            aria-labelledby={labelledBy || (!ariaLabel && fieldLabel ? labelId : undefined)}
            aria-required={required}
            aria-disabled={fieldDisabled || readOnly}
            aria-invalid={fieldState.invalid || controlProps["aria-invalid"]}
            aria-describedby={description}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                blurField();
                onBlur?.(event);
              }
            }}
            onFocus={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) onFocus?.(event);
            }}
          >
            {prepared.length === 0 && <span className="text-sm text-base-content/50">No hay opciones disponibles</span>}
            {prepared.map((option, index) => {
              const checked = selected?.key === option.key;
              const optionDisabled = fieldDisabled || readOnly || option.disabled;
              return (
                <label
                  key={option.key}
                  className={`flex min-h-10 max-w-full min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors motion-reduce:transition-none ${checked ? "border-primary/40 bg-primary/10" : "border-base-300 bg-base-100"} ${optionDisabled ? "cursor-not-allowed opacity-45" : "cursor-pointer hover:border-base-content/30"}`}
                >
                  <input
                    id={`${inputId}-${index}`}
                    type="radio"
                    name={fieldName}
                    value={option.key}
                    checked={checked}
                    disabled={optionDisabled}
                    required={required}
                    form={form}
                    autoComplete="off"
                    autoFocus={autoFocus && option.key === focusOption?.key}
                    ref={option.key === focusOption?.key ? fieldRef : undefined}
                    aria-describedby={description}
                    className="radio radio-primary radio-sm shrink-0"
                    onChange={() => changeSelection(option.key)}
                  />
                  <span className="min-w-0 wrap-anywhere">{option.label}</span>
                </label>
              );
            })}
          </div>
        )}
        {fieldState.invalid && <span id={errorId} className="sr-only">{errorMessage}</span>}
      </div>
    </div>
  );
}
