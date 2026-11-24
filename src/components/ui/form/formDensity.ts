import type { CSSProperties } from "react";

export type FormDensity = "normal" | "compact";

/** Each form owns its density; normal clears any inherited compact tokens. */
export function formDensityStyle(density: FormDensity): CSSProperties {
  const compact = density === "compact";
  return {
    "--form-control-height": compact ? "2rem" : "initial",
    "--form-block-gap": compact ? "0.25rem" : "initial",
    "--form-layout-gap": compact ? "0.5rem" : "initial",
    "--form-group-padding": compact ? "0.75rem" : "initial",
    "--form-option-px": compact ? "0.5rem" : "initial",
    "--form-option-py": compact ? "0.25rem" : "initial",
    "--form-tags-input-height": compact ? "1.5rem" : "initial",
    "--form-tags-min-height": compact ? "2rem" : "initial",
    "--form-tag-min-height": compact ? "1.5rem" : "initial",
    "--form-tag-py": compact ? "0.125rem" : "initial",
  } as CSSProperties;
}
