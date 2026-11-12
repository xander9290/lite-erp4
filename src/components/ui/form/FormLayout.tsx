"use client";

import { useCallback, useRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { flushSync } from "react-dom";
import {
  FormProvider,
  type FieldValues,
  type FieldPath,
  type SubmitErrorHandler,
  type SubmitHandler,
  type UseFormReturn,
} from "react-hook-form";
import { FormModelContext, type FormModel } from "./modelFields";
import { useModelReactions } from "./useModelReactions";
import useFormErrorToasts from "./useFormErrorToasts";
import { FormValidationContext, type FormFieldValidator, type FormFieldValidation } from "./formValidation";
import { focusInvalidField, invalidFormFields, revealNotebookFieldEvent } from "./notebookErrors";

export type FormLayoutProps<
  TFieldValues extends FieldValues,
  TContext = unknown,
  TTransformedValues = TFieldValues,
> = Omit<ComponentPropsWithoutRef<"form">, "onSubmit" | "onInvalid" | "children" | "autoComplete"> & {
  model?: FormModel;
  methods: UseFormReturn<TFieldValues, TContext, TTransformedValues>;
  onSubmit: SubmitHandler<TTransformedValues>;
  onInvalid?: SubmitErrorHandler<TFieldValues>;
  children: ReactNode;
  autoComplete?: "off";
  contentClassName?: string;
  onSubmitError?: (error: unknown) => void | Promise<void>;
  onSubmitSettled?: () => void | Promise<void>;
  silentErrorTypes?: readonly string[];
};

export default function FormLayout<
  TFieldValues extends FieldValues,
  TContext = unknown,
  TTransformedValues = TFieldValues,
>({
  methods,
  model,
  onSubmit,
  onInvalid,
  children,
  className = "",
  noValidate = true,
  contentClassName = "grid grid-cols-1 items-start gap-4 @2xl/form:grid-cols-2",
  onSubmitError,
  onSubmitSettled,
  silentErrorTypes,
  ...formProps
}: FormLayoutProps<TFieldValues, TContext, TTransformedValues>) {
  useFormErrorToasts(methods, silentErrorTypes);
  const reactions=useModelReactions(methods,model?.reactions);
  const formRef = useRef<HTMLFormElement>(null);
  const validators = useRef(new Map<string, FormFieldValidation>());
  const registerValidator = useCallback((name: string, validate: FormFieldValidator, errorType: string) => {
    const entry = { validate, errorType };
    validators.current.set(name, entry);
    return () => {
      if (validators.current.get(name) === entry) validators.current.delete(name);
    };
  }, []);

  function validateFields(focus: boolean) {
    let invalid = false;
    for (const [name, { validate, errorType }] of validators.current) {
      const path = name as FieldPath<TFieldValues>;
      const message = validate(methods.getValues(path));
      if (message) {
        if (!methods.getFieldState(path).error) {
          methods.setError(path, { type: errorType, message }, { shouldFocus: focus && !invalid });
        }
        invalid = true;
      }
    }
    return invalid;
  }

  return (
    <FormProvider {...methods}>
      <FormModelContext.Provider value={model?{...model,reactionState:reactions.state,retryReaction:reactions.retry}:undefined}>
      <FormValidationContext.Provider value={registerValidator}>
      <form
        {...formProps}
        ref={formRef}
        autoComplete="off"
        className={`@container/form min-w-0 ${className}`}
        noValidate={noValidate}
        onSubmit={async (submitEvent) => {
          try {
            if(!await reactions.settle()){methods.setError("root.reaction",{type:"reaction",message:"Revisa los datos relacionados o reintenta su consulta."});return;}
            methods.clearErrors("root.reaction");
            await methods.handleSubmit(async (data, event) => {
              if (validateFields(true)) {
                await onInvalid?.(methods.getErrors(), event);
                return;
              }
              return onSubmit(data, event);
            }, async (_errors, event) => {
              validateFields(false);
              await onInvalid?.(methods.getErrors(), event);
            })(submitEvent);
          } catch (error) {
            if (onSubmitError) await onSubmitError(error);
            else throw error;
          } finally {
            await onSubmitSettled?.();
            const form = formRef.current;
            if (form) {
              const first = invalidFormFields(form, methods.getErrors()).find(element => !element.closest('[data-notebook-disabled="true"]'));
              if (first && (first.closest("[data-notebook-panel]") || first.querySelector("[data-one2many-root]"))) {
                // Reveal enclosing pages synchronously so the field can receive focus.
                flushSync(() => first.dispatchEvent(new CustomEvent(revealNotebookFieldEvent, { bubbles: true })));
                if (!first.closest("[hidden], [inert]")) focusInvalidField(first, name => methods.setFocus(name as FieldPath<TFieldValues>));
              }
            }
          }
        }}
      >
        <div className={contentClassName}>{children}</div>
      </form>
      </FormValidationContext.Provider>
    </FormModelContext.Provider>
    </FormProvider>
  );
}
