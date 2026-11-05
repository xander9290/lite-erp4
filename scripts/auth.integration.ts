import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { config } from "dotenv";
import { saveUserRecord, userFormSelect, userFormValues } from "../src/lib/users/service";
import { newUserDefaults } from "../src/schemas/user.schema";
import { verifyPassword } from "../src/lib/auth/password";
import { changeOwnPassword, loadOwnProfile, saveOwnProfile } from "../src/lib/auth/profile-service";

config({ path: ".env.local", quiet: true }); config({ quiet: true });
// Registry imports the shared server client; load it only after the environment.
const { prisma } = await import("../src/lib/prisma");
const { listRegistry } = await import("../src/lib/list/registry");
const base = process.env.TEST_AUTH_URL ?? "http://localhost:3000";
class Client {
  cookies = new Map<string, string>();
  async request(path: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers);
    headers.set("cookie", [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; "));
    const response = await fetch(new URL(path, base), { ...options, headers, redirect: "manual" });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(";"); const i = pair.indexOf("=");
      if (/max-age=0/i.test(cookie)) this.cookies.delete(pair.slice(0, i)); else this.cookies.set(pair.slice(0, i), pair.slice(i + 1));
    }
    return response;
  }
  async login(login: string, password: string) {
    const csrf = await (await this.request("/api/auth/csrf")).json();
    const response = await this.request("/api/auth/callback/credentials", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "x-auth-return-redirect": "1", origin: base }, body: new URLSearchParams({ login, password, csrfToken: csrf.csrfToken, callbackUrl: `${base}/erp` }) });
    return response.json();
  }
  async session() { return (await this.request("/api/auth/session")).json(); }
}

let fixtureId: string | undefined, fixturePartnerId: string | null | undefined;
try {
  const anonymous = new Client();
  for (const path of ["/erp", "/erp/usuarios", "/erp/usuarios/nuevo"]) {
    const response = await anonymous.request(path);
    assert.equal(response.status, 307); assert.ok(response.headers.get("location")?.startsWith("/auth?"));
  }
  const admin = await prisma.user.findUniqueOrThrow({ where: { login: "admin" } });
  assert.equal(admin.active && admin.isAdmin, true);
  assert.equal(await verifyPassword("1234", admin.password), true);
  const counts = await Promise.all([prisma.user.count(), prisma.partner.count()]);
  execFileSync(process.execPath, ["--import", "tsx", "prisma/seed.ts"], { stdio: "pipe" });
  const seededAgain = await prisma.user.findUniqueOrThrow({ where: { login: "admin" } });
  assert.deepEqual(seededAgain, admin);
  assert.deepEqual(await Promise.all([prisma.user.count(), prisma.partner.count()]), counts);
  const bad = await anonymous.login("admin", "wrong-password");
  assert.ok(String(bad.url).includes("CredentialsSignin"));
  assert.equal(await anonymous.session(), null);

  const adminClient = new Client(); await adminClient.login("admin", "1234");
  const session = await adminClient.session();
  assert.equal(session.user.id, admin.id); assert.equal(session.user.isAdmin, true);
  assert.equal(JSON.stringify(session).includes("password"), false);
  const authenticated = await adminClient.request("/erp/usuarios");
  assert.equal(authenticated.status, 200); await authenticated.text();

  const actor = { id: admin.id, sessionVersion: admin.sessionVersion };
  const login = `auth_test_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const avatarUrl = "https://images.example.test/avatar.webp";
  const saved = await saveUserRecord(prisma, actor, { ...newUserDefaults, login, name: "Prueba temporal de autenticación", password: "Test-password-123", avatarUrl });
  assert.equal(saved.ok, true);
  fixtureId = saved.values.id;
  const fixture = await prisma.user.findUniqueOrThrow({ where: { id: fixtureId } }); fixturePartnerId = fixture.partnerId;
  assert.ok(fixturePartnerId); assert.equal(await verifyPassword("Test-password-123", fixture.password), true);
  assert.equal(saved.values.password, ""); assert.equal(JSON.stringify(saved.values).includes(fixture.password), false);
  assert.equal(saved.values.avatarUrl, avatarUrl);
  assert.equal((await prisma.partner.findUniqueOrThrow({ where: { id: fixturePartnerId! } })).avatarUrl, avatarUrl);
  const listState = { query: login, page: 1, pageSize: 10, sort: "id", direction: "asc" as const, filters: [] };
  const listedUsers = await listRegistry.user({ model: "user", searchFields: ["login"], columns: [{ field: "partner.name", label: "Contacto", widget: "partner", avatarField: "partner.avatarUrl" }] }, listState);
  const listedUser = listedUsers.rows.find(row => row.id === fixtureId);
  assert.ok(listedUser?.partner && typeof listedUser.partner === "object" && !Array.isArray(listedUser.partner));
  assert.equal(listedUser.partner.avatarUrl, avatarUrl); assert.equal(Object.hasOwn(listedUser, "password"), false);
  const listedPartners = await listRegistry.partner({ model: "partner", searchFields: ["name"], columns: [{ field: "name", label: "Contacto", widget: "partner", avatarField: "avatarUrl" }] }, { ...listState, query: saved.values.name });
  assert.equal(listedPartners.rows.find(row => row.id === fixturePartnerId)?.avatarUrl, avatarUrl);

  const regular = new Client(); await regular.login(login, "Test-password-123");
  assert.equal((await regular.session()).user.isAdmin, false);
  assert.equal((await regular.session()).user.image, avatarUrl);
  for (const path of ["/erp/perfil", "/erp/perfil/contrasena"]) {
    const page = await regular.request(path); assert.equal(page.status, 200); await page.text();
  }
  const ownActor = { id: fixture.id, sessionVersion: fixture.sessionVersion };
  const ownProfile = await loadOwnProfile(prisma, ownActor);
  assert.equal(ownProfile.account.login, login);
  assert.equal((await saveOwnProfile(prisma, ownActor, { ...ownProfile.values, id: admin.id, isAdmin: true })).ok, false);
  const ownSaved = await saveOwnProfile(prisma, ownActor, { ...ownProfile.values, name: "Mi perfil actualizado", phone: "5551234567" });
  assert.equal(ownSaved.ok, true);
  assert.equal((await prisma.partner.findUniqueOrThrow({ where: { id: fixturePartnerId! } })).phone, "5551234567");
  assert.equal((await regular.session()).user.name, "Mi perfil actualizado");
  assert.equal((await saveOwnProfile(prisma, ownActor, ownProfile.values)).ok, false);
  const partnerSnapshot = await loadOwnProfile(prisma, ownActor);
  await prisma.partner.update({ where: { id: fixturePartnerId! }, data: { phone: "5557654321", updatedAt: new Date(Date.parse(partnerSnapshot.values.partnerRevision!) + 1000) } });
  assert.equal((await saveOwnProfile(prisma, ownActor, partnerSnapshot.values)).ok, false);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: fixture.id } })).isAdmin, false);
  const forbiddenPage = await regular.request("/erp/usuarios");
  assert.ok((await forbiddenPage.text()).includes("Necesitas permisos de administrador"));
  const denied = await saveUserRecord(prisma, { id: fixture.id, sessionVersion: fixture.sessionVersion }, { ...newUserDefaults, login: `${login}_evil`, name: "No autorizado", password: "Test-password-123", isAdmin: true });
  assert.equal(denied.ok, false);
  const duplicate = await saveUserRecord(prisma, actor, { ...newUserDefaults, login, name: "Duplicado", password: "Test-password-123" });
  assert.equal(duplicate.ok, false);

  let current = userFormValues(await prisma.user.findUniqueOrThrow({ where: { id: fixtureId }, select: userFormSelect }));
  const editedAvatar = "https://images.example.test/avatar-updated.webp";
  const edited = await saveUserRecord(prisma, actor, { ...current, name: "Nombre actualizado", avatarUrl: editedAvatar });
  assert.equal(edited.ok, true);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: fixtureId } })).password, fixture.password);
  assert.equal(userFormValues(await prisma.user.findUniqueOrThrow({ where: { id: fixtureId }, select: userFormSelect })).avatarUrl, editedAvatar);
  assert.equal((await regular.session()).user.image, editedAvatar);
  const stale = await saveUserRecord(prisma, actor, { ...current, name: "Edición anterior" });
  assert.equal(stale.ok, false);

  const cleared = await saveUserRecord(prisma, actor, { ...edited.values, avatarUrl: null });
  assert.equal(cleared.ok, true);
  assert.equal((await prisma.partner.findUniqueOrThrow({ where: { id: fixturePartnerId! } })).avatarUrl, null);
  assert.equal((await regular.session()).user.image, null);
  current = cleared.values;
  const changedPassword = await saveUserRecord(prisma, actor, { ...current, password: "Changed-password-123" });
  assert.equal(changedPassword.ok, true);
  assert.equal(await regular.session(), null);
  assert.equal((await regular.request("/erp")).status, 307);
  await regular.login(login, "Changed-password-123"); assert.ok((await regular.session()).user);

  const otherSession = new Client(); await otherSession.login(login, "Changed-password-123");
  const passwordActor = { id: fixture.id, sessionVersion: (await regular.session()).user.sessionVersion };
  const passwordChange = { currentPassword: "Changed-password-123", newPassword: "My-new-password-123", confirmPassword: "My-new-password-123" };
  assert.equal((await changeOwnPassword(prisma, passwordActor, { ...passwordChange, currentPassword: "Wrong-password" })).ok, false);
  assert.ok((await regular.session()).user);
  assert.equal((await changeOwnPassword(prisma, passwordActor, { ...passwordChange, id: admin.id })).ok, false);
  const selfChanges = await Promise.all([changeOwnPassword(prisma, passwordActor, passwordChange), changeOwnPassword(prisma, passwordActor, passwordChange)]);
  assert.equal(selfChanges.filter(result => result.ok).length, 1);
  const selfChanged = selfChanges.find(result => result.ok)!;
  assert.equal(JSON.stringify(selfChanged).includes(passwordChange.newPassword), false);
  assert.equal(await regular.session(), null); assert.equal(await otherSession.session(), null);
  await assert.rejects(loadOwnProfile(prisma, passwordActor));
  await regular.login(login, passwordChange.newPassword); assert.ok((await regular.session()).user);

  const fresh = userFormValues(await prisma.user.findUniqueOrThrow({ where: { id: fixtureId }, select: userFormSelect }));
  const disabled = await saveUserRecord(prisma, actor, { ...fresh, active: false });
  assert.equal(disabled.ok, true); assert.equal(await regular.session(), null);
  const inactive = await regular.login(login, "My-new-password-123"); assert.ok(String(inactive.url).includes("CredentialsSignin"));
  const adminRecord = userFormValues(await prisma.user.findUniqueOrThrow({ where: { id: admin.id }, select: userFormSelect }));
  assert.equal((await saveUserRecord(prisma, actor, { ...adminRecord, active: false })).ok, false);

  const tampered = new Client();
  for (const [key, value] of adminClient.cookies) tampered.cookies.set(key, key.includes("session-token") ? `${value.slice(0, 15)}${value[15] === "a" ? "b" : "a"}${value.slice(16)}` : value);
  assert.equal((await tampered.request("/erp")).status, 307);
  const csrf = await (await adminClient.request("/api/auth/csrf")).json();
  await adminClient.request("/api/auth/signout", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "x-auth-return-redirect": "1", origin: base }, body: new URLSearchParams({ csrfToken: csrf.csrfToken, callbackUrl: `${base}/auth` }) });
  assert.equal(await adminClient.session(), null);
  console.log("Integración correcta: proxy, login, sesión, permisos, perfiles propios, contraseñas, altas/edición, conflictos, revocación, cuentas inactivas, cookies alteradas y logout.");
} finally {
  if (fixtureId) await prisma.user.deleteMany({ where: { id: fixtureId } });
  if (fixturePartnerId) await prisma.partner.deleteMany({ where: { id: fixturePartnerId } });
  await prisma.$disconnect();
}
