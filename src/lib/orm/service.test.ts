import assert from "node:assert/strict";
import test from "node:test";
import { Model, defineModel } from "./model";
import { Fields } from "./fields";
import { createModelService } from "./service";
import { unboundRepository } from "./repository";
import { recordAuditColumns } from "./audit";

const model = defineModel(class Example extends Model { name = Fields.Text({ required: true }); }, { name: "AuditExample", table: "audit_examples" });
const repository = unboundRepository<{ name: string }>();

test("audit presentation is opt-in and only accepts public paths and approved avatars", () => {
  assert.doesNotThrow(() => createModelService(model, repository, { audit: true, columns: recordAuditColumns, searchFields: ["createByUser.login", "createByUser.partner.name"] }));
  assert.throws(() => createModelService(model, repository, { columns: recordAuditColumns, searchFields: [] }), /auditoría habilitada/);
  for (const field of ["createByUser.password", "createByUser.sessionVersion", "createByUser.partner.email", "audit"]) {
    assert.throws(() => createModelService(model, repository, { audit: true, columns: [{ field, label: field }], searchFields: [] }), /auditoría habilitada/);
    assert.throws(() => createModelService(model, repository, { audit: true, columns: recordAuditColumns, searchFields: [field] }), /búsquedas de texto/);
  }
  assert.throws(() => createModelService(model, repository, { audit: true, columns: [{ ...recordAuditColumns[0], avatarField: "createByUser.password" }], searchFields: [] }), /auditoría habilitada/);
  assert.throws(() => createModelService(model, repository, { audit: true, columns: [{ ...recordAuditColumns[1], type: "text" }], searchFields: [] }), /auditoría habilitada/);
});
