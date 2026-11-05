import type { Many2OneOption } from "../../../lib/many2one/types";

export function relationTagIds(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string" && id.length > 0))] : [];
}

export function toggleRelationTag(options: readonly Many2OneOption[], option: Many2OneOption, maximum = 100): Many2OneOption[] {
  if (options.some(current => current.value === option.value)) return options.filter(current => current.value !== option.value);
  return options.length < maximum ? [...options, option] : [...options];
}

/** Return public records in the exact order of the form's IDs; never drop missing IDs silently. */
export function resolveRelationTags(ids: readonly string[], options: readonly Many2OneOption[]): Many2OneOption[] | null {
  const byId = new Map(options.map(option => [option.value, option]));
  const ordered = ids.map(id => byId.get(id));
  return ordered.every((option): option is Many2OneOption => Boolean(option)) ? ordered : null;
}
