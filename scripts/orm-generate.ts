import { resolve } from "node:path";
import { vehicleModel } from "../src/lib/orm/examples/fleet-vehicle";
import type { ModuleGeneration } from "../src/lib/orm/generator/generate";
import { artifactPlan, writeArtifacts } from "../src/lib/orm/generator/write";
import { prepareModuleArtifacts } from "../src/lib/orm/generator/prepare";
import { loadAppGenerationProfile } from "../src/lib/orm/generator/profile";

const profiles: Record<string, ModuleGeneration> = {
  flota: { id: "flota", depends: ["contactos"], models: [{ model: vehicleModel, clientFields: ["plate", "brand", "mileage", "driverId", "active", "state", "nextServiceAt"] }] },
};
// Explicit bridge to existing Prisma models. Keep this CLI independent of React/icon imports.
// Installation will validate ownership against the application catalog in a later phase.
const externalOwners: Record<string, Readonly<Record<string, string>>> = { flota: { Partner: "contactos" } };

async function main() {
  const [id, ...flags] = process.argv.slice(2);
  if (!id || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id) || new Set(flags).size !== flags.length || flags.some(flag => !["--write", "--check", "--example"].includes(flag)) || (flags.includes("--write") && flags.includes("--check"))) throw new Error("Uso: npm run orm:generate -- id [--write | --check] [--example]. Sin flags sólo revisa el plan.");
  const mode = flags.includes("--write") ? "--write" : flags.includes("--check") ? "--check" : undefined;
  const root = process.cwd();
  const application = flags.includes("--example") ? null : await loadAppGenerationProfile(root, id);
  if (!application && !Object.hasOwn(profiles, id)) throw new Error("No existe un orm.config.ts para esta aplicación ni un ejemplo con ese nombre.");
  const files = await prepareModuleArtifacts(root, application?.module ?? profiles[id], application?.externalOwners ?? externalOwners[id]);
  const directory = application ? resolve(root, "src/generated/orm/apps", id) : resolve(root, "src/generated/orm", id);
  const plan = mode === "--write" ? await writeArtifacts(directory, id, files) : await artifactPlan(directory, id, files);
  console.log(`Prisma validó la propuesta de ${id}. ${mode === "--write" ? "Artefactos escritos" : "Plan de generación"}:`);
  for (const change of plan.changes) console.log(`  ${change.action.padEnd(9)} ${change.name}`);
  console.log("No se modificó prisma/models, no se aplicaron migraciones y no se instaló ninguna aplicación.");
  if (mode === "--check" && (plan.manifestChanged || plan.changes.some(change => change.action !== "unchanged"))) process.exitCode = 2;
}

main().catch(error => { console.error(error instanceof Error ? error.message : "No se pudo generar el módulo."); process.exitCode = 1; });
