import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import { hashPassword } from "../src/lib/auth/password";
import { saveUserRecord, userFormSelect, userFormValues } from "../src/lib/users/service";
import { loadOwnProfile, saveOwnProfile } from "../src/lib/auth/profile-service";
import { readContactRecord, saveContactRecord } from "../src/app/(auth)/erp/contactos/models/contact.service";
import { newContactDefaults } from "../src/app/(auth)/erp/contactos/schemas/contact.schema";

config({ path: ".env.local", quiet: true }); config({ quiet: true });
const { prisma } = await import("../src/lib/prisma");
const { listRegistry } = await import("../src/lib/list/registry");
const { lookupRegistry } = await import("../src/lib/many2one/registry");
const userIds: string[] = [];
const partnerIds = new Set<string>();

try {
  // Independent disposable accounts; no seeded/admin password or business record is used.
  const password = await hashPassword(randomUUID());
  for (const isAdmin of [true, false]) {
    const user = await prisma.user.create({ data: {
      login: `contacts_test_${randomUUID().replaceAll("-", "").slice(0, 12)}`, password, isAdmin,
      partner: { create: { name: isAdmin ? "Administrador temporal" : "Usuario temporal" } },
    } });
    userIds.push(user.id); partnerIds.add(user.partnerId!);
  }
  const admin = await prisma.user.findUniqueOrThrow({ where: { id: userIds[0] } });
  const reader = await prisma.user.findUniqueOrThrow({ where: { id: userIds[1] } });
  const actor = { id: admin.id, sessionVersion: admin.sessionVersion };
  const readerActor = { id: reader.id, sessionVersion: reader.sessionVersion };
  const usersBeforeContact = await prisma.user.count();
  const created = await saveContactRecord(prisma, actor, { ...newContactDefaults, name: "  Contacto temporal  ", email: " ", phone: " ", avatarUrl: "https://example.test/avatar.webp" });
  assert.ok(created.ok);
  partnerIds.add(created.values.id!);
  assert.ok(created.values.id); assert.ok(created.values.revision);
  assert.equal(created.values.name, "Contacto temporal");
  const stored = await prisma.partner.findUniqueOrThrow({ where: { id: created.values.id } });
  assert.equal(stored.email, null); assert.equal(stored.phone, null);
  assert.equal(await prisma.user.count(), usersBeforeContact);

  const opened = await readContactRecord(prisma, readerActor, stored.id);
  assert.ok(opened.ok); assert.deepEqual(opened.values, created.values);
  assert.equal(Object.hasOwn(opened.values, "user"), false);
  const linked = await readContactRecord(prisma, readerActor, reader.partnerId);
  assert.ok(linked.ok);
  for (const key of ["password", "user", "login", "isAdmin", "sessionVersion"]) assert.equal(Object.hasOwn(linked.values, key), false);
  for (const invalid of [null, "", " ", "x".repeat(101), { id: stored.id }]) assert.equal((await readContactRecord(prisma, actor, invalid)).ok, false);
  assert.equal((await readContactRecord(prisma, actor, `missing_${randomUUID()}`)).ok, false);

  const countBeforeInvalid = await prisma.partner.count();
  const invalid = await saveContactRecord(prisma, actor, { ...newContactDefaults, name: "A", email: "invalid" });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) { assert.equal(invalid.kind, "validation"); assert.ok(invalid.fieldErrors?.name); assert.ok(invalid.fieldErrors?.email); }
  for (const patch of [{ isAdmin: true }, { user: { connect: { id: reader.id } } }, { password: "injected" }]) {
    assert.equal((await saveContactRecord(prisma, actor, { ...newContactDefaults, name: "Inyección", ...patch })).ok, false);
  }
  const forgedAdmin = { ...readerActor, isAdmin: true };
  assert.equal((await saveContactRecord(prisma, forgedAdmin, { ...newContactDefaults, name: "No autorizado" })).ok, false);
  assert.equal((await saveContactRecord(prisma, forgedAdmin, { ...created.values, name: "No autorizado" })).ok, false);
  assert.equal(await prisma.partner.count(), countBeforeInvalid);
  assert.deepEqual(await prisma.partner.findUniqueOrThrow({ where: { id: stored.id } }), stored);

  const changed = await saveContactRecord(prisma, actor, { ...created.values, name: "Contacto actualizado", email: "  mail@example.test  ", phone: "+52 (55) 5555-0100" });
  assert.ok(changed.ok);
  assert.ok(Date.parse(changed.values.revision) > Date.parse(created.values.revision));
  assert.equal(changed.values.email, "mail@example.test");
  const listConfig = { model: "partner" as const, searchFields: ["id", "email", "phone"], columns: [
    { field: "name", label: "Nombre" }, { field: "email", label: "Correo", sortable: true }, { field: "phone", label: "Teléfono", sortable: true },
  ] };
  const listState = { query: stored.id, page: 1, pageSize: 10, sort: "email", direction: "asc" as const, filters: [] };
  const listed = await listRegistry.partner(listConfig, listState);
  assert.equal(listed.total, 1);
  assert.equal(listed.rows[0].email, changed.values.email);
  assert.equal(listed.rows[0].phone, changed.values.phone);
  assert.equal((await listRegistry.partner(listConfig, { ...listState, query: changed.values.email })).rows.some(row => row.id === stored.id), true);
  assert.equal((await listRegistry.partner(listConfig, { ...listState, query: changed.values.phone })).rows.some(row => row.id === stored.id), true);
  for (const [field, query] of [["email", changed.values.email], ["phone", changed.values.phone]]) {
    const found = await lookupRegistry.partner({ model: "partner", searchFields: [field], displayName: "{name}", query, page: 1, pageSize: 10 });
    assert.equal(found.records.some(record => record.id === stored.id), true);
    assert.equal(found.records.some(record => Object.hasOwn(record, "dentalAppointments")), false);
  }
  assert.equal((await listRegistry.partner(listConfig, { ...listState, sort: "phone", filters: [{ field: "email", operator: "empty" }] })).total, 0);
  const stale = await saveContactRecord(prisma, actor, { ...created.values, name: "Edición antigua" });
  assert.equal(stale.ok, false); if (!stale.ok) assert.equal(stale.kind, "validation");
  assert.equal((await prisma.partner.findUniqueOrThrow({ where: { id: stored.id } })).name, changed.values.name);

  const race = await Promise.all([
    saveContactRecord(prisma, actor, { ...changed.values, name: "Edición simultánea A" }),
    saveContactRecord(prisma, actor, { ...changed.values, name: "Edición simultánea B" }),
  ]);
  assert.equal(race.filter(result => result.ok).length, 1);
  assert.equal(race.filter(result => !result.ok && result.kind === "validation").length, 1);

  // A Partner edit must also invalidate an old User editor and an old self-service profile.
  const userSnapshot = userFormValues(await prisma.user.findUniqueOrThrow({ where: { id: reader.id }, select: userFormSelect }));
  const profileSnapshot = await loadOwnProfile(prisma, readerActor);
  const accountBeforeContact = await prisma.user.findUniqueOrThrow({ where: { id: reader.id } });
  const contactUpdate = await saveContactRecord(prisma, actor, { ...linked.values, name: "Contacto compartido actualizado" });
  assert.ok(contactUpdate.ok);
  assert.deepEqual(await prisma.user.findUniqueOrThrow({ where: { id: reader.id } }), accountBeforeContact);
  const staleUser = await saveUserRecord(prisma, actor, { ...userSnapshot, name: "Usuario antiguo" });
  const staleProfile = await saveOwnProfile(prisma, readerActor, { ...profileSnapshot.values, name: "Perfil antiguo" });
  assert.equal(staleUser.ok, false); if (!staleUser.ok) assert.equal(staleUser.kind, "validation");
  assert.equal(staleProfile.ok, false); if (!staleProfile.ok) assert.equal(staleProfile.kind, "validation");

  const userValues = userFormValues(await prisma.user.findUniqueOrThrow({ where: { id: reader.id }, select: userFormSelect }));
  const userUpdate = await saveUserRecord(prisma, actor, { ...userValues, name: "Contacto desde Usuarios" });
  assert.ok(userUpdate.ok);
  assert.equal((await saveContactRecord(prisma, actor, { ...contactUpdate.values, name: "Contacto antiguo" })).ok, false);
  const beforeProfile = await readContactRecord(prisma, actor, reader.partnerId);
  assert.ok(beforeProfile.ok);
  const currentProfile = await loadOwnProfile(prisma, readerActor);
  assert.ok((await saveOwnProfile(prisma, readerActor, { ...currentProfile.values, name: "Contacto desde Perfil" })).ok);
  assert.equal((await saveContactRecord(prisma, actor, { ...beforeProfile.values, name: "Contacto antiguo" })).ok, false);

  const deleted = await saveContactRecord(prisma, actor, { ...newContactDefaults, name: "Contacto para retirar" });
  assert.ok(deleted.ok); partnerIds.add(deleted.values.id!);
  await prisma.partner.delete({ where: { id: deleted.values.id } });
  assert.equal((await saveContactRecord(prisma, actor, { ...deleted.values, name: "No recrear" })).ok, false);
  assert.equal((await readContactRecord(prisma, actor, deleted.values.id)).ok, false);

  assert.equal((await saveContactRecord(prisma, { ...actor, sessionVersion: actor.sessionVersion + 1 }, created.values)).ok, false);
  assert.equal((await readContactRecord(prisma, { ...readerActor, sessionVersion: readerActor.sessionVersion + 1 }, stored.id)).ok, false);
  await prisma.user.update({ where: { id: reader.id }, data: { active: false } });
  assert.equal((await readContactRecord(prisma, readerActor, stored.id)).ok, false);
  await prisma.user.update({ where: { id: admin.id }, data: { isAdmin: false } });
  assert.equal((await saveContactRecord(prisma, actor, { ...newContactDefaults, name: "Permisos retirados" })).ok, false);
  console.log("Contacts integration passed: create/read/update, validation, permissions, concurrent saves, shared Partner revisions and revoked access.");
} finally {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.partner.deleteMany({ where: { id: { in: [...partnerIds] } } });
  await prisma.$disconnect();
}
