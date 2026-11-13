import { relative } from "node:path";
import { createModel } from "../src/lib/scaffold/models";
import { createModuleModel, isDeclarativeModule } from "../src/lib/modules/scaffold";

async function main() {
  const [app, name, flag, ...extra] = process.argv.slice(2);
  if (!app || !name || extra.length || (flag && flag !== "--dry-run")) throw new Error("Uso: npm run create:model -- app Modelo [--dry-run]");
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(app)) throw new Error("ID de aplicación inválido.");
  const declarative = await isDeclarativeModule(process.cwd(), app);
  const result = await (declarative ? createModuleModel : createModel)(process.cwd(), app, name, flag === "--dry-run");
  console.log(`${flag ? "Plan" : "Modelo creado"}: ${result.identity.name}`);
  for (const change of result.changes) console.log(`  ${change.before === null ? "create" : "update"} ${relative(process.cwd(), change.path)}`);
  console.log(declarative
    ? `Personaliza sus campos/reglas; después npm run orm:sync -- ${app}. Lista y formulario se resuelven por convención; reinicia dev después de sincronizar.`
    : `Personaliza sus campos/reglas y clientFields; después npm run create:views -- ${app} ${name}.`);
  console.log("No se ejecutó SQL ni se generó Prisma Client. Los archivos existentes de vistas se conservan.");
}
main().catch(error => { console.error(error instanceof Error ? error.message : "No se pudo crear el modelo."); process.exitCode = 1; });
