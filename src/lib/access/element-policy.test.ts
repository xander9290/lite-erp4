import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@/generated/prisma/client";
import { loadElementPolicies } from "./element-policy.server";
import { prepareFieldInput, publicFieldValues } from "../orm/element-access";
import { unrestrictedElements } from "../orm/element-access";
import { loadHiddenMenus } from "./menu-policy.server";

test("policies accumulate restrictions, ignore foreign models, and never grant writing from no-read", async () => {
  const tx = {
    accessFieldRestriction: { findMany: async () => [
      { groupId: "sample.reader", model: "sample.item", field: "secret", noRead: true, noWrite: false, invisible: false, readOnly: false },
      { groupId: "sample.base", model: "sample.item", field: "secret", noRead: false, noWrite: false, invisible: true, readOnly: false },
      { groupId: "other.role", model: "sample.item", field: "name", noRead: true, noWrite: true, invisible: false, readOnly: false },
    ] },
    accessActionRestriction: { findMany: async () => [{ groupId: "sample.reader", model: "sample.item", action: "confirm" }, { groupId: "other.role", model: "sample.item", action: "cancel" }] },
  } as unknown as Prisma.TransactionClient;
  const policies = await loadElementPolicies(tx, new Set(["sample.reader", "sample.base", "other.role"]));
  assert.deepEqual(policies.fieldAccess["sample.item"], { secret: { noRead: true, noWrite: true, invisible: true, readOnly: false } });
  assert.deepEqual(policies.blockedActions["sample.item"], ["confirm"]);
});

test("navigation policies query effective groups only; no groups (admin bypass) needs no query", async () => {
  const queries: unknown[] = [];
  const tx = { accessMenuHidden: { findMany: async (args: unknown) => { queries.push(args); return [{ application: "sample", menu: "items" }]; } } } as unknown as Prisma.TransactionClient;
  assert.deepEqual(await loadHiddenMenus(tx, new Set()), []);
  assert.deepEqual(queries, []);
  assert.deepEqual(await loadHiddenMenus(tx, new Set(["sample.reader", "sample.base"])), [{ application: "sample", menu: "items" }]);
  assert.deepEqual(queries, [{ where: { groupId: { in: ["sample.reader", "sample.base"] } }, select: { application: true, menu: true } }]);
});

test("protected inputs preserve snapshots and reject guessed secrets or forged changes", () => {
  const access = { ...unrestrictedElements, fields: { secret: { noRead: true, noWrite: true, invisible: false, readOnly: false }, code: { noRead: false, noWrite: true, invisible: false, readOnly: false } } };
  const previous = { secret: "private", code: "ABC", name: "Antes" };
  assert.deepEqual(prepareFieldInput({ name: "Después", code: "ABC" }, previous, access), { name: "Después", code: "ABC", secret: "private" });
  assert.throws(() => prepareFieldInput({ secret: "private" }, previous, access), /permiso/);
  assert.throws(() => prepareFieldInput({ code: "FORGED" }, previous, access), /permiso/);
  assert.deepEqual(previous, { secret: "private", code: "ABC", name: "Antes" });
});

test("public DTOs remove direct, nested and label properties without mutating server snapshots", () => {
  const source = { id: "one", secret: "private", createByUser: { login: "private login", id: "author" }, $labels: { secret: { label: "private" }, code: { label: "Public" } } };
  const policy = { ...unrestrictedElements, fields: { secret: { noRead: true, noWrite: true, invisible: false, readOnly: false } }, canRead: (paths: readonly string[]) => paths.every(path => path !== "createByUser.login") };
  const result = publicFieldValues(source, policy);
  assert.equal(JSON.stringify(result).includes("private"), false);
  assert.equal(source.secret, "private");
  assert.deepEqual(result.createByUser, { id: "author" });
});
