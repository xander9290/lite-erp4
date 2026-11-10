"use client";

import { useEffect, useRef } from "react";

export default function SelectionCheckbox({ checked, mixed = false, disabled = false, label, onChange }: {
  checked: boolean; mixed?: boolean; disabled?: boolean; label: string; onChange: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (input.current) input.current.indeterminate = mixed; }, [mixed]);
  return <input ref={input} type="checkbox" autoComplete="off" aria-label={label} aria-checked={mixed ? "mixed" : checked}
    checked={checked} disabled={disabled} onChange={onChange} className="checkbox checkbox-primary checkbox-sm align-middle" />;
}
