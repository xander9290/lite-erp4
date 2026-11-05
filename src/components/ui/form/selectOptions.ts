export type FieldSelectValue = string | number;

export type FieldSelectOption<TValue extends FieldSelectValue = FieldSelectValue> = {
  value: TValue;
  label: string;
  disabled?: boolean;
};

export function prepareSelectOptions<TValue extends FieldSelectValue>(options: readonly FieldSelectOption<TValue>[]) {
  const keys = new Set<string>();

  return options.map((option) => {
    if (typeof option.value !== "string" && (typeof option.value !== "number" || !Number.isFinite(option.value))) {
      throw new TypeError("El value de cada opción debe ser texto o un número finito.");
    }
    const key = `${typeof option.value}:${option.value}`;
    if (keys.has(key)) throw new Error("Cada opción debe tener un value único.");
    keys.add(key);
    return { ...option, key };
  });
}
