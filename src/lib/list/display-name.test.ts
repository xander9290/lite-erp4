import assert from "node:assert/strict";
import test from "node:test";
import { readListValue, readListDisplayValue, recordDisplayName } from "./types";
import { recordCardTitle } from "../../components/ui/collection/record-title";

test("collection names are presentation metadata; explicit fields, formats and images remain usable", () => {
  const row = { id: "v1", name: "model-id", $displayName: "Toyota · Corolla", photo: "https://example.com/car.png", $labels: { name: { value: "model-id", label: "Corolla" } } };
  const name = { field: "name", label: "Modelo", widget: "many2one" as const };
  assert.equal(readListValue(row, "name"), "model-id");
  assert.equal(readListDisplayValue(row, name), "Toyota · Corolla");
  assert.equal(readListDisplayValue(row, { ...name, displayName: false }), "Corolla");
  assert.equal(readListDisplayValue(row, { field: "id", label: "ID", displayName: false }), "v1");
  assert.equal(readListDisplayValue(row, { field: "photo", label: "Photo", widget: "image" }), row.photo);
  assert.equal(readListDisplayValue({ ...row, name: row.photo }, { field: "name", label: "Photo", widget: "image" }), row.photo);
  assert.equal(recordDisplayName(row), row.$displayName);
  assert.equal(recordCardTitle(row), row.$displayName);
  assert.equal(recordCardTitle(row, "name", [name]), "Corolla");
  assert.equal(recordDisplayName({ id: "1", name: "Plain" }), "Plain");
  assert.equal(recordDisplayName({ id: "1", name: "Plain" }, "Other column"), "Plain");
  assert.equal(recordDisplayName({ id: "1" }), "1");
});
