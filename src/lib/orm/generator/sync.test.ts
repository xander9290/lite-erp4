import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";
import { pendingMigrations, assertSyncSQL } from "./sync";

const sql = "CREATE TABLE example (id TEXT PRIMARY KEY);\n";
const file = { name: "20261111000000_example", sql };
const applied = { migration_name: file.name, checksum: createHash("sha256").update(sql).digest("hex"), finished_at: new Date(), rolled_back_at: null };

test("pending migrations include the whole project and reject edited/missing/failed history", () => {
  assert.deepEqual(pendingMigrations([file], []), [file]);
  assert.deepEqual(pendingMigrations([file], [applied]), []);
  assert.deepEqual(pendingMigrations([{ ...file, sql: sql.replaceAll("\n", "\r\n") }], [applied]), []);
  assert.throws(() => pendingMigrations([], [applied]), /Falta/);
  assert.throws(() => pendingMigrations([{ ...file, sql: sql.replace("TEXT", "INT") }], [applied]), /modificó/);
  assert.throws(() => pendingMigrations([file], [{ ...applied, finished_at: null }]), /falló/);
  assert.deepEqual(pendingMigrations([file], [{ ...applied, finished_at: null, rolled_back_at: new Date() }]), [file]);
});

test("sync keeps destructive SQL on the manual path", () => {
  assert.doesNotThrow(() => assertSyncSQL(sql));
  for (const sql of ["DROP TABLE test", "ALTER TABLE test DROP COLUMN name", "DROP INDEX foo", "TRUNCATE test", "DELETE FROM test"]) assert.throws(() => assertSyncSQL(sql), /manual/);
});

test("CLI rejects noninteractive writes, unsafe IDs and approval bypasses before starting", () => {
  for (const args of [["flota"], ["../flota", "--plan"], ["flota", "--yes"], ["flota", "--plan", "--plan"]]) {
    const child = spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", join(process.cwd(), "scripts/orm-sync.ts"), ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    assert.equal(child.status, 1); assert.match(child.stderr, /Uso:|interactiva/);
  }
});
