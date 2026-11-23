/** Type-only brand: references remain plain serializable data, never executable methods. */
declare const reference: unique symbol;
export type ModelActionReference<Model extends string = string, Name extends string = string> = {
  readonly model: Model;
  readonly name: Name;
  readonly [reference]: true;
};

/** Used by generated contracts; manual forms may declare their own finite action set. */
export function defineActionReferences<const Model extends string, const Names extends readonly string[]>(model: Model, names: Names): {
  readonly [Name in Names[number]]: ModelActionReference<Model, Name>;
} {
  if (!/^[A-Z][A-Za-z0-9]*$/.test(model) || new Set(names).size !== names.length || names.some(name => !/^[a-z][A-Za-z0-9]*$/.test(name) || ["constructor", "prototype", "__proto__"].includes(name))) throw new Error("Referencias de acciones inválidas.");
  return Object.freeze(Object.fromEntries(names.map(name => [name, Object.freeze({ model, name })]))) as { readonly [Name in Names[number]]: ModelActionReference<Model, Name> };
}

/** Fail closed for JavaScript callers, stale references and buttons from another model. */
export function actionReferenceName(action: ModelActionReference, model: string | undefined): string | null {
  return model && action && typeof action === "object" && action.model === model && typeof action.name === "string" && /^[a-z][A-Za-z0-9]*$/.test(action.name) ? action.name : null;
}
