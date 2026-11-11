import assert from "node:assert/strict";
import test from "node:test";
import { safeErpRedirect, assertUserChange } from "./policy";
import { createLoginLimiter } from "./attempts";
import { hashPassword, verifyPassword } from "./password";
import { loginSchema } from "../../schemas/login.schema";
import { userSchema, newUserDefaults } from "../../schemas/user.schema";
import { avatarUrlSchema } from "../../schemas/partner.schema";
import { changePasswordSchema, profileSchema } from "../../schemas/profile.schema";

test("login normalizes identifiers and rejects malformed or oversized credentials", () => {
  assert.equal(loginSchema.parse({ login: "  ADMIN ", password: "1234" }).login, "admin");
  assert.equal(loginSchema.safeParse({ login: "admin", password: "Legacy-password-123" }).success, true);
  for (const login of ["", "a b", "<script>", "a".repeat(65)]) assert.equal(loginSchema.safeParse({ login, password: "1234" }).success, false);
  assert.equal(loginSchema.safeParse({ login: "admin", password: "é".repeat(37) }).success, false);
});

test("passwords use salted hashes and reject wrong, plaintext and truncated credentials", async () => {
  const hash = await hashPassword("1234");
  assert.notEqual(hash, "1234");
  assert.equal(await verifyPassword("1234", hash), true);
  assert.equal(await verifyPassword("incorrect", hash), false);
  assert.equal(await verifyPassword("1234", "1234"), false);
  assert.equal(await verifyPassword("x".repeat(73), hash), false);
});

test("post-login redirects cannot leave the ERP or redirect to external sites", () => {
  assert.equal(safeErpRedirect("/erp/usuarios?page=2"), "/erp/usuarios?page=2");
  for (const path of ["https://evil.example", "//evil.example/erp", "/\\evil.example", "/erp/../auth", "/erp/%2e%2e/auth", "/erp-other", "/auth", "javascript:alert(1)", undefined]) assert.equal(safeErpRedirect(path), "/erp");
});

test("users require a new password on create and keep it optional on edit", () => {
  const valid = { ...newUserDefaults, name: "Ejemplo", login: "example", password: "abcd1234" };
  assert.equal(userSchema.safeParse(valid).success, true);
  for (const password of ["1234", "abcdefgh", "abcd", "aB!2", "  ab", "éééé"]) assert.equal(userSchema.safeParse({ ...valid, password }).success, true);
  for (const password of ["", "123", "123456789"]) assert.equal(userSchema.safeParse({ ...valid, password }).success, false);
  for (const password of ["123", "123456789"]) assert.equal(userSchema.safeParse({ ...valid, id: "existing", revision: "2026-11-05T01:00:00.000Z", password }).success, false);
  assert.equal(userSchema.safeParse({ ...valid, id: "existing", revision: "2026-11-05T01:00:00.000Z", password: "" }).success, true);
  assert.equal(userSchema.safeParse({ ...valid, id: "existing", revision: "", password: "" }).success, false);
  assert.equal(userSchema.safeParse({ ...valid, sessionVersion: 99 }).success, false);
  assert.equal(userSchema.safeParse({ ...valid, partnerRevision: "2026-11-05T01:00:00.000Z" }).success, false);
  assert.equal(userSchema.safeParse({ ...valid, id: "existing", revision: "2026-11-05T01:00:00.000Z", password: "", partnerRevision: undefined }).success, false);
});

test("a caller cannot disable themselves or remove the last active administrator", () => {
  const target = { id: "admin", active: true, isAdmin: true };
  assert.ok(assertUserChange("admin", target, { active: false, isAdmin: true }, 2));
  assert.ok(assertUserChange("other", target, { active: true, isAdmin: false }, 1));
  assert.equal(assertUserChange("other", target, { active: true, isAdmin: false }, 2), null);
});

test("partner avatars accept public HTTPS URLs or null, never local files or executable schemes", () => {
  assert.equal(avatarUrlSchema.safeParse(null).success, true);
  assert.equal(avatarUrlSchema.safeParse("https://images.example.test/avatar.webp").success, true);
  for (const url of ["", "http://images.example.test/avatar.webp", "blob:https://erp.local/image", "data:image/png;base64,abc", "javascript:alert(1)", "https://images.example.test/" + "x".repeat(2048)]) {
    assert.equal(avatarUrlSchema.safeParse(url).success, false);
  }
});

test("login attempts are limited within the window, expire and reset after success", () => {
  const limiter = createLoginLimiter(2, 1000, 10);
  assert.equal(limiter.allow("admin", 0), true);
  assert.equal(limiter.allow("admin", 1), true);
  assert.equal(limiter.allow("admin", 2), false);
  assert.equal(limiter.allow("admin", 1001), true);
  limiter.clear("admin");
  assert.equal(limiter.allow("admin", 1002), true);
});

test("self-service profiles cannot submit a different user, credentials or permissions", () => {
  const input = { revision: "2026-11-05T00:00:00.000Z", partnerRevision: null, name: "Mi perfil", email: "", phone: "", avatarUrl: null };
  assert.equal(profileSchema.safeParse(input).success, true);
  for (const patch of [{ id: "another-user" }, { isAdmin: true }, { active: false }, { login: "someone-else" }, { password: "anything" }]) assert.equal(profileSchema.safeParse({ ...input, ...patch }).success, false);
});

test("password changes require current credentials, matching confirmation and a distinct bounded password", () => {
  const input = { currentPassword: "Legacy-password-123", newPassword: "abcd", confirmPassword: "abcd" };
  assert.equal(changePasswordSchema.safeParse(input).success, true);
  for (const password of ["1234", "abcdefgh", "aB!2", "  ab", "éééé"]) assert.equal(changePasswordSchema.safeParse({ ...input, newPassword: password, confirmPassword: password }).success, true);
  for (const patch of [{ currentPassword: "" }, { newPassword: "123", confirmPassword: "123" }, { newPassword: "123456789", confirmPassword: "123456789" }, { confirmPassword: "different" }, { currentPassword: input.newPassword }, { newPassword: "é".repeat(37), confirmPassword: "é".repeat(37) }, { id: "another-user" }]) assert.equal(changePasswordSchema.safeParse({ ...input, ...patch }).success, false);
});
