import assert from "node:assert/strict";
import test from "node:test";
import { contactFormSelect, contactFormValues, contactWriteData } from "./partner";
import { contactSchema, newContactDefaults } from "../schemas/contact.schema";

test("database records become serializable form values without exposing linked account data", () => {
  const record = {
    id: "contact-id", name: "Contacto", email: null, phone: null, avatarUrl: null,
    updatedAt: new Date("2026-11-05T07:00:00.000Z"),
    user: { login: "private-login", password: "private-hash", isAdmin: true },
  };
  const values = contactFormValues(record);
  assert.deepEqual(values, { id: record.id, name: record.name, email: "", phone: "", avatarUrl: null, revision: record.updatedAt.toISOString() });
  assert.deepEqual(JSON.parse(JSON.stringify(values)), values);
  assert.equal(contactSchema.safeParse(values).success, true);
  assert.equal(Object.hasOwn(contactFormSelect, "user"), false);
  assert.equal(JSON.stringify(values).includes("private-"), false);
});

test("write data stores empty controls as null and excludes identity, revision and relations", () => {
  const values = contactSchema.parse({ ...newContactDefaults, id: "contact-id", revision: "2026-11-05T07:00:00.000Z", name: "  Contacto  ", email: " ", phone: " " });
  const data = contactWriteData({ ...values, user: { connect: { id: "injected" } } } as typeof values);
  assert.deepEqual(data, { name: "Contacto", email: null, phone: null, avatarUrl: null });
  assert.equal(Object.hasOwn(data, "id"), false);
  assert.equal(Object.hasOwn(data, "revision"), false);
  assert.equal(Object.hasOwn(data, "updatedAt"), false);
  assert.equal(Object.hasOwn(data, "user"), false);
});

test("the nullable database to form to database conversion preserves contact data", () => {
  const record = {
    id: "contact-id", name: "Contacto", email: "mail@example.test", phone: "+52 555 0100",
    avatarUrl: "https://example.test/avatar.webp", updatedAt: new Date("2026-11-05T07:00:00.000Z"),
  };
  const data = contactWriteData(contactSchema.parse(contactFormValues(record)));
  assert.deepEqual(data, { name: record.name, email: record.email, phone: record.phone, avatarUrl: record.avatarUrl });
});
