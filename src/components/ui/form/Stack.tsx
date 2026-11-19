"use client";

import type { ComponentPropsWithoutRef } from "react";
import { FieldDirectionContext } from "./fieldDirection";
import { useInsertionAnchor } from "./insertions/Insertions";

export type StackProps = ComponentPropsWithoutRef<"div"> & {
  direction?: "block";
};

/** Two columns when the container has room; Fields always use block direction. */
export default function Stack({ children, direction = "block", className = "", ...props }: StackProps) {
  // With `id`, the stack is an insertion anchor (`stack:<id>`) for extensions.
  const anchor = useInsertionAnchor(props.id ? `stack:${props.id}` : undefined);
  return anchor.wrap(
    <FieldDirectionContext.Provider value={direction}>
      <div {...props} className={`@container/stack col-span-full w-full min-w-0 ${className}`}>
        <div className="grid min-w-0 grid-cols-1 items-start gap-4 @sm/stack:grid-cols-2">
          {children}
          {anchor.inside}
        </div>
      </div>
    </FieldDirectionContext.Provider>
  );
}
