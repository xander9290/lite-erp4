import type { FieldPath, FieldValues } from "react-hook-form";

export type FieldDirection = "inline" | "block";

export type BaseFieldProps<TFieldValues extends FieldValues = FieldValues, TValue = string> = {
  name: FieldPath<TFieldValues>;
  label: string;
  direction?: FieldDirection;
  autoComplete?: "off";
  onChange?: (value: TValue) => void;
};
