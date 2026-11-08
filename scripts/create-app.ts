import { createAppTemplate } from "../src/lib/scaffold/templates";
import { createApplication } from "../src/lib/scaffold/create";
import { prepareModuleArtifacts } from "../src/lib/orm/generator/prepare";

async function main() {
  const [name, option, ...extra] = process.argv.slice(2);
  if (!name || extra.length || (option !== undefined && option !== "--dry-run")) throw new Error('Uso: npm run create:app -- "Nombre" [--dry-run].');
  const root = process.cwd(), template = createAppTemplate(name);
  const artifacts = await prepareModuleArtifacts(root, template.profile, {});
  const plan = await createApplication(root, template, artifacts, option === "--dry-run");
  console.log(`${option === "--dry-run" ? "Plan de creación" : "Aplicación creada"}: ${template.app.name} (${template.app.id})`);
  for (const path of plan.paths) console.log(`  ${path}`);
  console.log(option === "--dry-run" ? "No se escribieron archivos del proyecto." : `Ruta: /erp/${template.app.id}. Acceso inicial: administradores. Consulta el README de tu aplicación.`);
  console.log("No se aplicaron migraciones ni se habilitó persistencia. Las vistas y acciones iniciales indican que está en preparación.");
}
main().catch(error => { console.error(error instanceof Error ? error.message : "No se pudo crear la aplicación."); process.exitCode = 1; });
