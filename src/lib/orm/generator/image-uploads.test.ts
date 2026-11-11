import assert from "node:assert/strict";
import test from "node:test";
import { Fields, Model, defineModel } from "../index";
import { imageUploadFiles } from "./image-uploads";

test("managed image uploaders publish only configured non-sensitive images and use fixed authorized actions", () => {
  const model = defineModel(class extends Model {
    name = Fields.Text();
    photo = Fields.Image({ folder: "products/photos" });
    hidden = Fields.Image({ folder: "products/hidden" });
    privatePhoto = Fields.Image({ folder: "private", sensitive: true });
  }, { name: "PhotoItem", table: "photo_items" });
  const profile = { id: "photos", depends: [], models: [{ model, clientFields: ["name", "photo", "privatePhoto"] }] };
  const files = imageUploadFiles(profile);
  const client = files["PhotoItem.images.ts"], server = files["PhotoItem.images.actions.ts"];
  assert.match(client, /^"use client"/);
  assert.match(client, /photo: createSignedCloudinaryImageUploader\(\(\) => signImageUpload\("photo"\)\)/);
  assert.doesNotMatch(client, /hidden|privatePhoto|folder|SECRET|server-only|requireAdmin/);
  assert.match(server, /^"use server"/);
  assert.match(server, /authorize: requireAdmin/);
  assert.match(server, /photo: fields.photo.metadata/);
  assert.doesNotMatch(server, /hidden|privatePhoto|API_SECRET|orm.config|models\//);
  assert.deepEqual(imageUploadFiles(profile), files);
});

test("adding image fields updates the same helper; unpublishing removes capabilities without stale files", () => {
  const model = defineModel(class extends Model {
    photo = Fields.Image({ folder: "tests/photos" });
    detail = Fields.Image({ folder: "tests/details" });
  }, { name: "PhotoItem", table: "photo_items" });
  const generate = (clientFields: string[]) => imageUploadFiles({ id: "photos", depends: [], models: [{ model, clientFields }] });
  const before = generate(["photo"]), after = generate(["photo", "detail"]), removed = generate([]);
  assert.deepEqual(Object.keys(before), Object.keys(after));
  assert.match(after["PhotoItem.images.ts"], /detail: createSigned/);
  assert.match(after["PhotoItem.images.actions.ts"], /detail: fields.detail.metadata/);
  assert.deepEqual(Object.keys(before), Object.keys(removed));
  assert.doesNotMatch(removed["PhotoItem.images.ts"], /photo:|detail:/);
  assert.match(removed["PhotoItem.images.actions.ts"], /metadata: \{\n\n\} \}, \[\]/);
});
