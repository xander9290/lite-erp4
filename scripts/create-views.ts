import { relative } from "node:path";
import { createViews } from "../src/lib/scaffold/models";
import type { ViewOptions, ViewKind } from "../src/lib/scaffold/resource-templates";

async function main() {
  const [app, name, ...flags] = process.argv.slice(2);
  if (!app || !name) throw new Error("Uso: npm run create:views -- app Modelo [--views list,form,card,kanban] [--form page|modal] [--group campo] [--label Nombre] [--lookup campo=modulo#exportAsync] [--dry-run]");
  const options: ViewOptions = {};
  const lookups: Record<string, string> = {};
  const seen = new Set<string>();
  let dryRun = false;
  while (flags.length) {
    const flag = flags.shift()!;
    if (seen.has(flag) && flag !== "--lookup") throw new Error(`Opción repetida: ${flag}`);
    seen.add(flag);
    if (flag === "--dry-run") { dryRun = true; continue; }
    const value = flags.shift();
    if (!value || value.startsWith("--")) throw new Error(`Falta valor para ${flag}.`);
    if (flag === "--views") options.views = value.split(",") as ViewKind[];
    else if (flag === "--form") options.form = value as "page" | "modal";
    else if (flag === "--group") options.group = value;
    else if (flag === "--label") options.label = value;
    else if (flag === "--lookup") {
      const split = value.indexOf("=");
      const field = value.slice(0, split);
      if (split < 1 || !/^[a-z][A-Za-z0-9]*$/.test(field) || Object.hasOwn(lookups, field)) throw new Error("Usa --lookup campo=modulo#exportAsync sin repetir el campo.");
      lookups[field] = value.slice(split + 1);
    } else throw new Error(`Opción desconocida: ${flag}`);
  }
  options.lookups = lookups;
  const result = await createViews(process.cwd(), app, name, options, dryRun);
  console.log(`${dryRun ? "Plan" : "Vistas creadas"}: ${result.identity.name}`);
  for (const change of result.changes) console.log(`  ${change.before === null ? "create" : "update"} ${relative(process.cwd(), change.path)}`);
  console.log(`Archivos TS/TSX editables. Siguiente paso: npm run orm:sync -- ${app}.`);
  console.log("No se ejecutó SQL, no se generaron bindings y no se sobrescribieron vistas existentes.");
}
main().catch(error => { console.error(error instanceof Error ? error.message : "No se pudieron generar las vistas."); process.exitCode = 1; });
