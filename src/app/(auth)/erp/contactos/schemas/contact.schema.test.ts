import assert from "node:assert/strict";
import test from "node:test";
import { contactSchema, newContactDefaults } from "./contact.schema";
import { userSchema, newUserDefaults } from "@/schemas/user.schema";
import { profileSchema } from "@/schemas/profile.schema";

const valid = { ...newContactDefaults, name: "Contacto de prueba" };
const revision = "2026-11-05T07:00:00.000Z";

test("new contact defaults support empty controls but require a name on submission", () => {
  assert.equal(Object.hasOwn(newContactDefaults, "id"), false);
  assert.equal(newContactDefaults.email, "");
  assert.equal(newContactDefaults.phone, "");
  assert.equal(newContactDefaults.avatarUrl, null);
  assert.equal(contactSchema.safeParse(newContactDefaults).success, false);
  assert.equal(contactSchema.safeParse(valid).success, true);
});

test("contact values trim text, allow blank optional fields and preserve phone formatting", () => {
  const value = contactSchema.parse({ ...valid, name: "  Empresa Ejemplo  ", email: "  ventas@example.test  ", phone: "  +52 (55) 1234-5678 ext. 9  " });
  assert.equal(value.name, "Empresa Ejemplo");
  assert.equal(value.email, "ventas@example.test");
  assert.equal(value.phone, "+52 (55) 1234-5678 ext. 9");
  assert.equal(contactSchema.parse({ ...valid, email: "  ", phone: "  " }).email, "");
});

test("contact input rejects malformed values, excess data and account modifications", () => {
  for (const patch of [
    { name: " " }, { name: "A" }, { name: "a".repeat(121) }, { email: "invalid" },
    { email: "a".repeat(255) }, { phone: "1".repeat(41) }, { phone: 123 },
    { email: null }, { avatarUrl: "http://example.test/image.webp" }, { avatarUrl: "javascript:alert(1)" },
    { user: { create: { login: "injected" } } }, { userId: "another-user" }, { login: "admin" },
    { password: "anything" }, { isAdmin: true }, { active: false }, { darkMode: true },
  ]) assert.equal(contactSchema.safeParse({ ...valid, ...patch }).success, false, JSON.stringify(patch));
  assert.equal(contactSchema.safeParse({ ...valid, avatarUrl: "https://example.test/image.webp" }).success, true);
});

test("editing requires the record revision; new contacts cannot reuse one", () => {
  assert.equal(contactSchema.safeParse({ ...valid, id: "contact-id", revision }).success, true);
  for (const value of ["", "2026-11-05", "invalid", "2026-99-99T00:00:00.000Z"]) {
    const result = contactSchema.safeParse({ ...valid, id: "contact-id", revision: value });
    assert.equal(result.success, false);
    if (!result.success) assert.ok(result.error.issues.some(issue => issue.path[0] === "revision"));
  }
  assert.equal(contactSchema.safeParse({ ...valid, revision }).success, false);
  assert.equal(contactSchema.safeParse({ ...valid, id: " " }).success, false);
  assert.equal(contactSchema.safeParse({ ...valid, id: "a".repeat(101), revision }).success, false);
});

test("Contacts, Users and Profile share the same contact validation rules", () => {
  for (const fields of [
    { name: "  Mi contacto  ", email: "  contacto@example.test ", phone: " +52 555-0100 ", avatarUrl: null },
    { name: "Mi contacto", email: "", phone: "", avatarUrl: "https://example.test/avatar.webp" },
    { name: " ", email: "", phone: "", avatarUrl: null },
    { name: "Mi contacto", email: "incorrecto", phone: "", avatarUrl: null },
  ]) {
    const contact = contactSchema.safeParse({ ...valid, ...fields });
    const user = userSchema.safeParse({ ...newUserDefaults, login: "sample", password: "Test-password-123", ...fields });
    const profile = profileSchema.safeParse({ revision, partnerRevision: null, ...fields });
    assert.equal(contact.success, user.success);
    assert.equal(contact.success, profile.success);
    if (contact.success && user.success && profile.success) {
      for (const field of ["name", "email", "phone", "avatarUrl"] as const) {
        assert.equal(contact.data[field], user.data[field]);
        assert.equal(contact.data[field], profile.data[field]);
      }
    }
  }
});
