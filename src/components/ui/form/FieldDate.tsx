"use client";

import { useCallback, useId, useMemo, useState, useSyncExternalStore, type ComponentPropsWithoutRef, type FocusEventHandler } from "react";
import { useController, useFormContext, type FieldError, type FieldValues } from "react-hook-form";
import { useModelField } from "./modelFields";
import FieldVisibility from "./FieldVisibility";
import type { BaseFieldProps } from "./field.types";
import { fieldDirectionClassName, fieldInputClassName, fieldLabelClassName } from "./field.styles";
import { createFieldDateFormat, readFieldDateRange, type FieldDateEndpoint, type FieldDateRange } from "./dateValues";
import { useFormFieldValidation } from "./formValidation";

export type { FieldDateRange } from "./dateValues";

type DateKind = { type?: "date"; valueFormat?: "date" | "iso" } | { type: "datetime"; valueFormat?: never };
type DateSelection =
  | { range?: false; onChange?: (value: string | null) => void }
  | { range: true; onChange?: (value: FieldDateRange) => void };

export type FieldDateProps<TFieldValues extends FieldValues = FieldValues> =
  Omit<BaseFieldProps<TFieldValues>, "onChange"> &
  Omit<ComponentPropsWithoutRef<"input">, keyof BaseFieldProps<TFieldValues> | "type" | "value" | "defaultValue" | "children" | "min" | "max" | "step" | "onFocus" | "onBlur"> &
  DateKind & DateSelection & {
    min?: string;
    max?: string;
    step?: number | "any";
    startLabel?: string;
    endLabel?: string;
    onFocus?: FocusEventHandler<HTMLElement>;
    onBlur?: FocusEventHandler<HTMLElement>;
  };

const subscribeHydration = () => () => {};
const clientHydrated = () => true;
const serverHydrated = () => false;

export default function FieldDate<TFieldValues extends FieldValues = FieldValues>(props: FieldDateProps<TFieldValues>) {
  const { invisible, ...controlProps } = props;
  return <FieldVisibility name={props.name} invisible={invisible}><DateControl {...controlProps} /></FieldVisibility>;
}

function DateControl<TFieldValues extends FieldValues = FieldValues>(props: FieldDateProps<TFieldValues>) {
  const {
    name, label, type = "date", valueFormat = "date", range,
    startLabel = "Desde", endLabel = "Hasta", min, max, step,
    direction = "block", onFocus, onBlur, id, disabled, required, readOnly, autoFocus,
    className = "", style, "aria-label": ariaLabel, "aria-labelledby": labelledBy,
    "aria-describedby": describedBy, ...inputProps
  } = useModelField(props, "datetime");
  delete inputProps.onChange;
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const labelId = `${inputId}-label`;
  const errorId = `${inputId}-error`;
  const timezoneId = `${inputId}-timezone`;
  const { control, setError, clearErrors, getFieldState } = useFormContext<TFieldValues>();
  const { field, fieldState } = useController({ name, control, disabled });
  const { value, ref: fieldRef, disabled: fieldDisabled, onChange: updateField, onBlur: blurField } = field;
  const hydrated = useSyncExternalStore(subscribeHydration, clientHydrated, serverHydrated);
  const ready = type === "date" || hydrated;
  const format = useMemo(() => createFieldDateFormat({ type, valueFormat, min, max }), [type, valueFormat, min, max]);
  const validate = useCallback((current: unknown) => {
    if (fieldDisabled || readOnly) return null;
    return (range ? format.validateRange(current, required) : format.validate(current, required))?.message ?? null;
  }, [fieldDisabled, readOnly, range, format, required]);
  useFormFieldValidation(name, validate, "fieldDate");

  const fieldLabel = label?.trim();
  const rangeValue = readFieldDateRange(value);
  const rangeIssue = range ? format.validateRange(value, required) : null;
  const nestedError = fieldState.error as (FieldError & { start?: FieldError; end?: FieldError }) | undefined;
  const [rejectedEndpoint, setRejectedEndpoint] = useState<FieldDateEndpoint | null>(null);
  const focusEndpoint = nestedError?.start ? "start" : nestedError?.end ? "end"
    : rejectedEndpoint && nestedError?.type === "fieldDate" ? rejectedEndpoint
      : rangeIssue?.endpoint ?? (!rangeValue.start ? "start" : !rangeValue.end ? "end" : "start");
  const errorMessage = nestedError?.message || nestedError?.start?.message || nestedError?.end?.message || `${fieldLabel || name}: fecha inválida.`;
  const description = [describedBy, type === "datetime" ? timezoneId : undefined, fieldState.invalid ? errorId : undefined].filter(Boolean).join(" ") || undefined;
  const accessibleLabel = ariaLabel || (!fieldLabel && !labelledBy ? name : undefined);

  function checkOnBlur() {
    const message = validate(value);
    if (message) setError(name, { type: "fieldDate", message });
    else if (getFieldState(name).error?.type === "fieldDate") clearErrors(name);
    blurField();
  }

  function changeDate(text: string, endpoint?: FieldDateEndpoint) {
    if (fieldDisabled || readOnly) return;
    const parsed = format.fromInput(text, endpoint ? rangeValue[endpoint] : value);
    if (parsed.error) {
      setRejectedEndpoint(endpoint ?? null);
      setError(name, { type: "fieldDate", message: parsed.error });
      return;
    }
    const next = props.range ? { ...rangeValue, [endpoint ?? "start"]: parsed.value } : parsed.value;
    if (getFieldState(name).error?.type === "fieldDate") {
      const message = validate(next);
      if (message) setError(name, { type: "fieldDate", message });
      else clearErrors(name);
    }
    setRejectedEndpoint(null);
    updateField(next);
    if (props.range) props.onChange?.(next as FieldDateRange);
    else props.onChange?.(parsed.value);
  }

  function dateInput(endpoint?: FieldDateEndpoint) {
    const current = endpoint ? rangeValue[endpoint] : value;
    const endpointLabel = endpoint === "start" ? startLabel.trim() : endLabel.trim();
    const nativeId = endpoint ? `${inputId}-${endpoint}` : inputId;
    const bounds = ready ? format.inputBounds(endpoint, rangeValue) : {};
    const summary = ready ? format.toDisplay(current) : "";
    return (
      <div className="relative min-w-0">
        <input
          {...inputProps}
          {...bounds}
          id={nativeId}
          name={endpoint ? `${name}.${endpoint}` : name}
          ref={!endpoint || focusEndpoint === endpoint ? fieldRef : undefined}
          type={type === "datetime" ? "datetime-local" : "date"}
          autoComplete="off"
          disabled={fieldDisabled || !ready}
          readOnly={readOnly}
          required={required}
          autoFocus={autoFocus && (!endpoint || focusEndpoint === endpoint)}
          step={step ?? (type === "datetime" ? "any" : 1)}
          value={ready ? format.toInput(current) : ""}
          className={`${fieldInputClassName} peer px-1 [color-scheme:inherit] transition-[border-color]! ${summary ? "not-focus:text-transparent not-focus:[-webkit-text-fill-color:transparent] not-focus:[&::-webkit-datetime-edit]:opacity-0" : ""} ${className}`}
          style={style}
          aria-label={endpoint ? (endpointLabel ? undefined : endpoint === "start" ? "Fecha inicial" : "Fecha final") : accessibleLabel}
          aria-labelledby={endpoint ? undefined : labelledBy}
          aria-invalid={fieldState.invalid || inputProps["aria-invalid"]}
          aria-describedby={description}
          onChange={(event) => changeDate(event.currentTarget.value, endpoint)}
          onFocus={range ? undefined : onFocus}
          onBlur={range ? undefined : (event) => { checkOnBlur(); onBlur?.(event); }}
        />
        {summary && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-8 left-1 flex min-w-0 items-center text-sm text-base-content peer-focus:invisible peer-disabled:opacity-40"
          >
            <span className="truncate">{summary}</span>
          </span>
        )}
      </div>
    );
  }

  return (
    <div data-form-field={name} className={fieldDirectionClassName(direction, fieldLabel)}>
      {fieldLabel && (range
        ? <span id={labelId} className={fieldLabelClassName(direction)}>{fieldLabel}</span>
        : <label htmlFor={inputId} className={fieldLabelClassName(direction)}>{fieldLabel}</label>)}
      <div className="min-w-0">
        {range ? (
          <div
            id={inputId}
            role="group"
            aria-label={accessibleLabel}
            aria-labelledby={labelledBy || (!ariaLabel && fieldLabel ? labelId : undefined)}
            aria-describedby={description}
            className="@container/date-range min-w-0"
            onFocus={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) onFocus?.(event); }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) { checkOnBlur(); onBlur?.(event); }
            }}
          >
            <div className={`grid min-w-0 gap-3 ${type === "datetime" ? "grid-cols-1 @2xl/date-range:grid-cols-2" : "grid-cols-1 @xs/date-range:grid-cols-2"}`}>
              {(["start", "end"] as const).map((endpoint) => {
                const text = (endpoint === "start" ? startLabel : endLabel).trim();
                return (
                  <div key={endpoint} className="flex min-w-0 flex-col gap-1">
                    {text && <label htmlFor={`${inputId}-${endpoint}`} className="text-xs font-medium text-base-content/60">{text}</label>}
                    {dateInput(endpoint)}
                  </div>
                );
              })}
            </div>
          </div>
        ) : dateInput()}
        {type === "datetime" && <span id={timezoneId} className="sr-only">Hora local del navegador.</span>}
        {fieldState.invalid && <span id={errorId} className="sr-only">{errorMessage}</span>}
      </div>
    </div>
  );
}
