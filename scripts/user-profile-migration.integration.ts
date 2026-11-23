import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { parse } from "dotenv";
import { Client } from "pg";

// Only synthetic rows in a schema created and removed by this fixture.
const variables = parse(await readFile(".env.local"));
const connection = process.env.DATABASE_URL ?? variables.DATABASE_URL;
if (!connection) throw new Error("Configura DATABASE_URL para la prueba aislada.");
const schema = `user_profile_test_${randomBytes(8).toString("hex")}`;
const db = new Client({ connectionString: connection, connectionTimeoutMillis: 10000 });
let created = false;
try {
  await db.connect();
  await db.query(`CREATE SCHEMA "${schema}"`); created = true;
  await db.query(`SET search_path TO "${schema}"`);
  await db.query(`
    CREATE TABLE partners (id text PRIMARY KEY, name text NOT NULL, email text, phone text, avatar_url text, updated_at timestamp NOT NULL);
    CREATE TABLE users (id text PRIMARY KEY, login text UNIQUE NOT NULL, password text NOT NULL, session_version integer NOT NULL DEFAULT 0, partner_id text UNIQUE, updated_at timestamp NOT NULL,
      CONSTRAINT users_partner_id_fkey FOREIGN KEY (partner_id) REFERENCES partners(id) ON DELETE RESTRICT);
    INSERT INTO partners VALUES ('linked','Nombre original','test@example.test','555','https://example.test/avatar.webp','2026-11-23 12:00:01'), ('orphan','Contacto sin usuario',null,null,null,'2026-11-23 12:00:00');
    INSERT INTO users VALUES ('one','cuenta','hash-conservado',3,'linked','2026-11-23 12:00:00'), ('two','sin-contacto','otro-hash',0,null,'2026-11-23 12:00:00');
  `);
  const contacts = (await db.query("SELECT * FROM partners ORDER BY id")).rows;
  await db.query(await readFile("prisma/migrations/20261123220000_user_standalone_profile/migration.sql", "utf8"));
  const rows = (await db.query("SELECT * FROM users ORDER BY id")).rows;
  assert.equal(rows[0].name, "Nombre original"); assert.equal(rows[0].email, "test@example.test");
  assert.equal(rows[0].phone, "555"); assert.equal(rows[0].avatar_url, "https://example.test/avatar.webp");
  assert.equal(rows[0].password, "hash-conservado"); assert.equal(rows[0].session_version, 3);
  assert.equal(rows[0].partner_id, "linked");
  assert.equal(rows[0].updated_at.getTime(), contacts.find(row => row.id === "linked").updated_at.getTime() + 1);
  assert.equal(rows[1].name, "sin-contacto"); assert.equal(rows[1].email, null);
  assert.deepEqual((await db.query("SELECT * FROM partners ORDER BY id")).rows, contacts);
  assert.equal((await db.query("SELECT count(*)::int AS count FROM information_schema.table_constraints WHERE constraint_schema=$1 AND table_name='users' AND constraint_type='FOREIGN KEY'", [schema])).rows[0].count, 0);
  await db.query("INSERT INTO users(id,login,password,updated_at,name) VALUES ('new','nueva','hash',now(),'Nueva cuenta')");
  assert.equal((await db.query("SELECT partner_id FROM users WHERE id='new'")).rows[0].partner_id, null);
  assert.deepEqual((await db.query("SELECT * FROM partners ORDER BY id")).rows, contacts);
  console.log("✓ Migración: perfiles copiados, revisión avanzada, credenciales/enlaces/contactos conservados y nueva cuenta sin Partner.");
} finally {
  try { if (created) { await db.query("ROLLBACK"); await db.query(`DROP SCHEMA "${schema}" CASCADE`); } }
  finally { await db.end(); }
}
