import "server-only";
import { Client } from "pg";

const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;

/** Detect database dependents not necessarily represented in Prisma. */
export async function inspectRemovalDatabase(connection: string, schema: string, names: readonly string[]) {
  const client = new Client({ connectionString: connection, connectionTimeoutMillis: 10000 });
  try {
    await client.connect(); await client.query("BEGIN READ ONLY");
    const blockers: string[] = [];
    const external = await client.query(`SELECT DISTINCT t.relname FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace tn ON tn.oid=t.relnamespace JOIN pg_class r ON r.oid=c.confrelid JOIN pg_namespace rn ON rn.oid=r.relnamespace WHERE c.contype='f' AND rn.nspname=$1 AND r.relname=ANY($2::text[]) AND NOT(tn.nspname=$1 AND t.relname=ANY($2::text[]))`, [schema, names]);
    for (const row of external.rows) blockers.push(`Una tabla externa referencia al módulo: ${row.relname}.`);
    const views = await client.query(`SELECT DISTINCT v.relname FROM pg_depend d JOIN pg_rewrite rw ON rw.oid=d.objid JOIN pg_class v ON v.oid=rw.ev_class JOIN pg_class t ON t.oid=d.refobjid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname=$1 AND t.relname=ANY($2::text[]) AND v.relkind IN ('v','m')`, [schema, names]);
    for (const row of views.rows) blockers.push(`Una vista de base de datos depende del módulo: ${row.relname}.`);
    const special = await client.query(`SELECT DISTINCT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname=ANY($2::text[]) AND (c.relkind<>'r' OR c.relispartition OR EXISTS(SELECT 1 FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal))`, [schema, names]);
    for (const row of special.rows) blockers.push(`La tabla ${row.relname} tiene particiones o triggers que necesitan revisión manual.`);
    const counts: { table: string; count: string }[] = [];
    for (const name of names) counts.push({ table: name, count: (await client.query(`SELECT COUNT(*)::text AS count FROM ${quote(schema)}.${quote(name)}`)).rows[0].count });
    return { blockers, counts };
  } finally { await client.end(); }
}
