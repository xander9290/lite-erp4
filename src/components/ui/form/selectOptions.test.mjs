import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const { prepareSelectOptions } = createRequire(import.meta.url)("./selectOptions.ts");

test("string and numeric options retain their original values", () => {
  const options = prepareSelectOptions([{ value: "MX", label: "México" }, { value: 10, label: "Diez" }]);
  assert.equal(options[0].value, "MX");
  assert.equal(options[1].value, 10);
});

test("zero is selectable and is distinct from the string zero", () => {
  const options = prepareSelectOptions([{ value: 0, label: "Número cero" }, { value: "0", label: "Texto cero" }]);
  assert.notEqual(options[0].key, options[1].key);
  assert.equal(options.find((option) => option.key === "number:0").value, 0);
  assert.equal(options.find((option) => option.key === "string:0").value, "0");
});

test("an empty string option is distinct from the empty selection token", () => {
  const [option] = prepareSelectOptions([{ value: "", label: "Vacío" }]);
  assert.notEqual(option.key, "");
  assert.equal(option.value, "");
});

test("option keys are stable when options are reordered", () => {
  const options = [{ value: "active", label: "Activo" }, { value: "inactive", label: "Inactivo" }];
  const first = prepareSelectOptions(options);
  const reordered = prepareSelectOptions([...options].reverse());
  assert.equal(first[0].key, reordered[1].key);
});

test("disabled flags are preserved without mutating the supplied options", () => {
  const option = Object.freeze({ value: 1, label: "Inactivo", disabled: true });
  const input = Object.freeze([option]);
  const [prepared] = prepareSelectOptions(input);
  assert.equal(prepared.disabled, true);
  assert.notEqual(prepared, option);
  assert.equal(Object.hasOwn(option, "key"), false);
});

test("duplicate values are rejected", () => {
  assert.throws(() => prepareSelectOptions([{ value: 1, label: "Uno" }, { value: 1, label: "Otro" }]), /único/);
  assert.throws(() => prepareSelectOptions([{ value: "a", label: "A" }, { value: "a", label: "B" }]), /único/);
});

test("unsupported values and non-finite numeric values are rejected", () => {
  for (const value of [null, undefined, true, {}, Number.NaN, Infinity, -Infinity]) {
    assert.throws(() => prepareSelectOptions([{ value, label: "Inválido" }]), TypeError);
  }
});
