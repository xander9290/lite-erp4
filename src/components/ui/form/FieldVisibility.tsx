"use client";

import { createContext, useContext, type ReactNode } from "react";
import { FormModelContext, lineField } from "./modelFields";
import { InsertionAnchor } from "./insertions/Insertions";

const FieldVisibilityContext = createContext(false);
export const useFieldInvisible = () => useContext(FieldVisibilityContext);

/** Keep controls mounted: visibility must not unregister, clear or disable their values. */
export default function FieldVisibility({ name, invisible, children }: { name?: string; invisible?: boolean; children: ReactNode }) {
  const model = useContext(FormModelContext);
  const inherited = useFieldInvisible();
  const owner = name ? lineField(model, name) : undefined;
  const line = owner?.line?.fields[owner.key]?.metadata;
  const metadata = name ? (model?.fields[name] ?? model?.readFields?.[name])?.metadata ?? line : undefined;
  const hidden = inherited || (invisible ?? metadata?.invisible ?? false);
  // Top-level fields are insertion anchors (`field:<name>`); line cells (dotted names) are not.
  return <InsertionAnchor target={name && !name.includes(".") ? `field:${name}` : undefined}>
    <FieldVisibilityContext.Provider value={hidden}>
      <div hidden={hidden} className={hidden ? "hidden!" : "contents"}>{children}</div>
    </FieldVisibilityContext.Provider>
  </InsertionAnchor>;
}
