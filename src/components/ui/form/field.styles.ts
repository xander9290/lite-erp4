import type { FieldDirection } from "./field.types";

const fieldControlClassName =
  "w-full min-w-0 rounded-none border-0 border-b-2 border-base-content/20 bg-transparent shadow-none transition-colors duration-150 hover:border-base-content/40 focus:border-base-content focus:bg-transparent focus:shadow-none focus:outline-none focus-within:border-base-content focus-within:shadow-none focus-within:outline-none disabled:border-base-content/10 disabled:bg-transparent disabled:text-base-content/40 motion-reduce:transition-none";

// Set daisyUI's size token, keeping explicit h-* classes (e.g. One2many cells) authoritative.
export const fieldInputClassName = `input [--size:var(--form-control-height,calc(var(--size-field,0.25rem)*var(--in-size-mul,10)))] ${fieldControlClassName}`;
export const fieldTextareaClassName = `textarea ${fieldControlClassName} min-h-32 resize-none rounded-t-xl! bg-base-200/60! px-4 py-3 text-sm leading-relaxed placeholder:text-base-content/40`;
export const fieldSelectClassName = `select [--size:var(--form-control-height,calc(var(--size-field,0.25rem)*var(--sl-size-mul,10)))] ${fieldControlClassName} pl-1 pr-8 [&::picker(select)]:bg-base-100 [&::picker(select)]:text-base-content`;

export function fieldDirectionClassName(direction: FieldDirection, label?: string) {
  return direction === "inline" && Boolean(label?.trim())
    ? "grid w-full min-w-0 grid-cols-[minmax(0,7rem)_minmax(0,1fr)] items-center gap-2"
    : "flex w-full min-w-0 flex-col gap-[var(--form-block-gap,0.375rem)]";
}

export function fieldLabelClassName(direction: FieldDirection) {
  const base = "label whitespace-normal wrap-anywhere text-sm font-medium text-base-content";
  return direction === "inline"
    ? `${base} justify-start text-left`
    : base;
}
