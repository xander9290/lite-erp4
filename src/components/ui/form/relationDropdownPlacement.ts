export type VerticalBounds = { top: number; bottom: number };

/** Prefer below when it fits; otherwise use the larger visible side. */
export function relationDropdownPlacement(anchor: VerticalBounds, bounds: VerticalBounds, contentHeight: number) {
  const gap = 8, padding = 4;
  const above = Math.max(0, anchor.top - bounds.top - gap - padding);
  const below = Math.max(0, bounds.bottom - anchor.bottom - gap - padding);
  const desired = Math.min(320, Math.max(0, contentHeight));
  const placement = below >= desired || below >= above ? "bottom" : "top";
  return {
    placement,
    maxHeight: Math.min(desired, placement === "bottom" ? below : above),
    visible: anchor.bottom > bounds.top && anchor.top < bounds.bottom,
    gap,
  };
}
