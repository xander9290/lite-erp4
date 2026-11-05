export const revealNotebookFieldEvent = "form:reveal-notebook-field";

/** Ignore RHF refs/types: only validation paths belong to a page. */
export function formErrorPaths(value: unknown, path = ""): string[] {
  if (!value || typeof value !== "object") return [];
  const error = value as Record<string, unknown>;
  const isError = typeof error.type === "string" || typeof error.message === "string";
  const paths = path && isError ? [path] : [];
  for (const [key, child] of Object.entries(error)) {
    if (isError && ["ref", "type", "message", "types"].includes(key)) continue;
    paths.push(...formErrorPaths(child, path ? `${path}.${key}` : key));
  }
  return paths;
}

export function fieldHasError(name: string, paths: readonly string[]) {
  return paths.some(path => path === name || path.startsWith(`${name}.`) || name.startsWith(`${path}.`));
}

export function invalidFormFields(root: HTMLElement, errors: unknown) {
  const paths = formErrorPaths(errors);
  const elements = [...root.querySelectorAll<HTMLElement>("[data-form-field]")];
  const names = invalidFieldNames(elements.map(element => element.dataset.formField!), paths);
  return elements.filter(element => names.has(element.dataset.formField!));
}

/** Prefer a row's actual Field over its containing one2many; aggregate errors keep the group. */
export function invalidFieldNames(names: readonly string[], paths: readonly string[]) {
  const selected = new Set<string>();
  for (const path of paths) {
    const ancestors = names.filter(name => name === path || path.startsWith(`${name}.`));
    const longest = Math.max(-1, ...ancestors.map(name => name.length));
    for (const name of longest >= 0 ? ancestors.filter(name => name.length === longest) : names.filter(name => name.startsWith(`${path}.`))) selected.add(name);
  }
  return selected;
}

export function focusInvalidField(element: HTMLElement, setFocus: (name: string) => void) {
  setFocus(element.dataset.formField!);
  if (!element.contains(document.activeElement)) {
    const target = element.hasAttribute("tabindex") ? element : element.querySelector<HTMLElement>('input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), [tabindex="0"]');
    target?.focus();
  }
}
