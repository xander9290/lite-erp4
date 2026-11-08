import { relative } from "node:path";
import { loadAppGenerationProfile } from "../src/lib/orm/generator/profile";
import { installModels } from "../src/lib/orm/generator/install";

async function main() {
  const [id, ...flags] = process.argv.slice(2);
  if (!id || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id) || new Set(flags).size !== flags.length || flags.some(flag => !["--write", "--update"].includes(flag))) throw new Error("Uso: npm run orm:install -- id [--update] [--write]. Sin --write sólo revisa el plan.");
  const root = process.cwd();
  const profile = await loadAppGenerationProfile(root, id);
  if (!profile) throw new Error("No existe una aplicación con orm.config.ts. Los ejemplos no se instalan.");
  const plan = await installModels(root, profile, flags.includes("--write"), flags.includes("--update"));
  console.log(`${id}: ${plan.changes.length ? flags.includes("--write") ? "esquema incorporado a Prisma" : "plan de instalación" : "esquema ya instalado sin cambios"}.`);
  for (const change of plan.changes) console.log(`  ${relative(root, change.path)}`);
  if (plan.changes.length) console.log(plan.sql);
  console.log("No se ejecutó SQL ni se regeneró Prisma Client. La instalación del esquema no activa la persistencia de las vistas.");
  if (flags.includes("--write")) console.log(`Siguiente paso: revisar git diff y ejecutar npm run db:migrate -- --name install_${id.replaceAll("-", "_")}; después npm run db:generate.`);
}
main().catch(error => { console.error(error instanceof Error ? error.message : "No se pudo instalar el esquema."); process.exitCode = 1; });
