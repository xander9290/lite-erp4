import { loadAppGenerationProfile } from "../src/lib/orm/generator/profile";
import { bindRepositories } from "../src/lib/orm/generator/bind";
async function main() {
  const [id, ...flags] = process.argv.slice(2);
  if (!id || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id) || flags.length > 1 || flags.some(flag => flag !== "--write")) throw new Error("Uso: npm run orm:bind -- id [--write].");
  const root = process.cwd(), profile = await loadAppGenerationProfile(root, id);
  if (!profile) throw new Error("No existe un perfil de aplicación para enlazar.");
  const plan = await bindRepositories(root, profile, flags.includes("--write"));
  for (const change of plan.changes) console.log(`${change.action} ${change.name}`);
  console.log(flags.includes("--write") ? "Acceso a Prisma generado y compilado. Los servicios conservan sus permisos y reglas propias." : "Plan compilado. Añade --write para incorporarlo.");
}
main().catch(error => { console.error(error instanceof Error ? error.message : "No se pudo enlazar el modelo."); process.exitCode = 1; });
