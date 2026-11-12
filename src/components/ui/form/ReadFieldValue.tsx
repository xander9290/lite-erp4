"use client";
import { useId } from "react";
import { useModelReadField } from "./modelFields";
import { fieldDirectionClassName, fieldLabelClassName } from "./field.styles";

export type ReadFieldProps = {mode:"display";name:string;label?:string;direction?:"inline"|"block";className?:string};

/** Internal presentation shared by Text/Number. No input, form value or business calculation. */
export default function ReadFieldValue({name,label,direction="block",className="",kind,format}:{
  name:string;label?:string;direction?:"inline"|"block";className?:string;kind:"text"|"integer";
  format?:(value:number)=>string;
}) {
  const {metadata,value,state,retry}=useModelReadField(name,kind);
  const labelId=useId();
  const text=label??metadata.label??name;
  const rendered = value == null ? "—" : typeof value === "number" && format ? format(value) : String(value);
  return <div data-form-field={name} className={fieldDirectionClassName(direction,text)}>
    <span id={labelId} className={fieldLabelClassName(direction)}>{text}</span>
    <div className="min-w-0 space-y-1" aria-busy={state?.pending}>
      <output aria-labelledby={labelId} className={`block min-h-10 content-center whitespace-pre-wrap wrap-anywhere text-sm ${className}`}>{state?.pending ? "…" : rendered}</output>
      {state?.error && <p role="alert" className="text-sm text-error">{state.error} <button type="button" className="btn btn-ghost btn-xs" onClick={retry}>Reintentar</button></p>}
    </div>
  </div>;
}
