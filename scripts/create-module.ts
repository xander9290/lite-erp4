import { relative } from "node:path";
import { createModule } from "../src/lib/modules/scaffold";

async function main() {
  const [id, flag, ...extra] = process.argv.slice(2);
  if (!id || extra.length || (flag && flag !== "--dry-run")) throw new Error("Uso: npm run create:module -- id [--dry-run]");
  const result = await createModule(process.cwd(), id, flag === "--dry-run");
  console.log(`${flag ? "Plan" : "Módulo creado"}: ${id}`);
  for (const change of result.changes) console.log(`  ${change.before === null ? "create" : "update"} ${relative(process.cwd(), change.path)}`);
  console.log(`Siguiente: npm run create:model -- ${id} NombreDelModelo. No se ejecutó SQL.`);
}
main().catch(error => { console.error(error instanceof Error ? error.message : "No se pudo crear el módulo."); process.exitCode = 1; });
