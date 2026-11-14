"use client";

import { createContext, useContext } from "react";
import type { FieldDirection } from "./field.types";

export const FieldDirectionContext = createContext<"block" | undefined>(undefined);

/** Layout containers may require labels above their controls. */
export function useFieldDirection(direction?: FieldDirection) {
  return useContext(FieldDirectionContext) ?? direction;
}
