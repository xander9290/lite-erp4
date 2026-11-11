import assert from "node:assert/strict";
import test from "node:test";
import type { z } from "zod";
import { Fields, Model, defineModel } from "./index";
import { generateModule, fieldExpression } from "./generator/generate";
import { repositoryFiles } from "./generator/bind";
import { trackedChanges, activityChangeSchema } from "./activity";
import { compileListDomain } from "./domain";
import { fieldListType } from "./service";

test("Image infers nullable/required values and validates HTTPS URLs, empty values and defaults", () => {
  const optional = Fields.Image({ folder: "tests/images" });
  const required = Fields.Image({ folder: "tests/required", required: true });
  type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
  const inference: [Equal<z.output<typeof optional.schema>, string | null>, Equal<z.output<typeof required.schema>, string>, Equal<z.input<typeof required.schema>, string | null>] = [true, true, true];
  assert.deepEqual(inference, [true, true, true]);
  assert.equal(optional.createDefault(), null);
  assert.equal(required.createDefault(), null);
  for (const empty of [null, "", "   "]) {
    assert.equal(optional.schema.parse(empty), null);
    assert.equal(required.schema.safeParse(empty).success, false);
  }
  const url = "https://images.example.test/logo.webp";
  assert.equal(required.schema.parse(` ${url} `), url);
  assert.equal(Fields.Image({ folder: "tests", required: true, default: url }).createDefault(), url);
  for (const value of ["http://example.test/a.png", "blob:https://example.test/a", "data:image/png;base64,abc", "https://user:password@example.test/a", "https://example.test/" + "a".repeat(2048), "not a URL", {}, 123]) assert.equal(optional.schema.safeParse(value).success, false);
  assert.throws(() => Fields.Image({ folder: "tests", default: "http://example.test/a" }));
  assert.throws(() => Fields.Image({ folder: "tests", required: true, default: null }));
  assert.equal(Fields.Image({ folder: "tests", maxLength: url.length }).schema.safeParse(url).success, true);
  assert.equal(Fields.Image({ folder: "tests", maxLength: url.length - 1 }).schema.safeParse(url).success, false);
});

test("Image rejects unsafe folder names, invalid configuration and sensitive tracking", () => {
  for (const folder of [undefined, "", "../outside", "a//b", "/a", "a/", "a&timestamp=1", "a\\b", "a\nb", "a".repeat(201)]) assert.throws(() => Fields.Image({ folder } as never));
  for (const maxLength of [0, -1, 2049, NaN, 1.5]) assert.throws(() => Fields.Image({ folder: "tests", maxLength }));
  assert.throws(() => Fields.Image({ folder: "tests", upload: () => "secret" } as never), /desconocida/);
  assert.throws(() => Fields.Image({ folder: "tests", sensitive: true, tracking: true }), /sensible/);
});

test("Image generates a scalar Prisma URL, equivalent client contract and scalar bindings", () => {
  const model = defineModel(class extends Model {
    name = Fields.Text({ required: true });
    logo = Fields.Image({ folder: "tests/logos", tracking: true });
    cover = Fields.Image({ folder: "tests/covers", required: true, maxLength: 512, default: "https://example.test/cover.png" });
  }, { name: "ImageExample", table: "image_examples" });
  const profile = { id: "image-test", depends: [], models: [{ model, clientFields: Object.keys(model.fields) }] };
  const generated = generateModule(profile, { schema: 'datasource db {\n provider = "postgresql"\n}\nmodel User {\n id String @id\n}\n', owners: {} });
  assert.match(generated["models.prisma"], /logo String\? @db.VarChar\(2048\)/);
  assert.match(generated["models.prisma"], /cover String .*@db.VarChar\(512\)/);
  assert.doesNotMatch(generated["models.prisma"], /logoRecord|ImageExample_logo/);
  assert.match(generated["ImageExample.schema.ts"], /Fields.Image\(.*"folder":"tests\/logos"/);
  assert.match(fieldExpression(model.metadata.cover), /"maxLength":512/);
  const binding = repositoryFiles(profile)["ImageExample.store.ts"];
  assert.match(binding, /logo: record.logo/);
  assert.match(binding, /logo: values.logo/);
  assert.match(binding, /case "logo"/);
  assert.equal(fieldListType(model.metadata.logo), "text");
  assert.deepEqual(compileListDomain(model.metadata, [{ field: "logo", operator: "eq", value: null }]), { AND: [{ logo: { equals: null } }] });
  assert.throws(() => compileListDomain(model.metadata, [{ field: "logo", operator: "contains", value: "logo" }]));
  const [change] = trackedChanges(model.metadata, { logo: null }, { logo: "https://example.test/logo.png" });
  assert.equal(change.type, "image");
  assert.equal(activityChangeSchema.safeParse(change).success, true);
});
