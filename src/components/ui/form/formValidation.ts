"use client";

import { createContext, useContext, useEffect } from "react";

export type FormFieldValidator = (value: unknown) => string | null;
export type FormFieldValidation = { validate: FormFieldValidator; errorType: string };
type RegisterValidator = (name: string, validate: FormFieldValidator, errorType: string) => () => void;

export const FormValidationContext = createContext<RegisterValidator | null>(null);

export function useFormFieldValidation(name: string, validate: FormFieldValidator, errorType = "fieldValidation") {
  const register = useContext(FormValidationContext);
  useEffect(() => register?.(name, validate, errorType), [register, name, validate, errorType]);
}
