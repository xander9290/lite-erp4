"use client";

import { createContext, useContext, type ReactNode } from "react";
import { FormModelContext } from "./modelFields";

const FieldVisibilityContext = createContext(false);
export const useFieldInvisible = () => useContext(FieldVisibilityContext);

/** Keep controls mounted: visibility must not unregister, clear or disable their values. */
export default function FieldVisibility({ name, invisible, children }: { name?: string; invisible?: boolean; children: ReactNode }) {
  const model = useContext(FormModelContext);
  const inherited = useFieldInvisible();
  const metadata = name ? (model?.fields[name] ?? model?.readFields?.[name])?.metadata : undefined;
  const hidden = inherited || (invisible ?? metadata?.invisible ?? false);
  return <FieldVisibilityContext.Provider value={hidden}>
    <div hidden={hidden} className={hidden ? "hidden!" : "contents"}>{children}</div>
  </FieldVisibilityContext.Provider>;
}
