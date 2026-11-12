import { relative } from "node:path";
import { updateViews } from "../src/lib/scaffold/update-views";
async function main() {
  const [app, model, ...flags] = process.argv.slice(2);
  if (!app || !model || flags.some(flag => flag !== "--write") || flags.length > 1) throw new Error("Uso: npm run update:views -- app Modelo [--write]");
  const changes = await updateViews(process.cwd(), app, model, flags.includes("--write"));
  for (const change of changes) {
    const path = relative(process.cwd(), change.path);
    const before = (change.before ?? "").trimEnd().split("\n"), after = change.after.trimEnd().split("\n");
    let prefix=0;
    while (prefix < before.length && prefix < after.length && before[prefix]===after[prefix]) prefix++;
    let suffix=0;
    while (suffix < before.length-prefix && suffix < after.length-prefix && before[before.length-1-suffix]===after[after.length-1-suffix]) suffix++;
    const start=Math.max(0,prefix-3), beforeEnd=Math.min(before.length,before.length-suffix+3), afterEnd=Math.min(after.length,after.length-suffix+3);
    const lines=[...before.slice(start,prefix).map(line=>" "+line),...before.slice(prefix,before.length-suffix).map(line=>"-"+line),...after.slice(prefix,after.length-suffix).map(line=>"+"+line),...before.slice(before.length-suffix,beforeEnd).map(line=>" "+line)];
    console.log(`--- a/${path}\n+++ b/${path}\n@@ -${start+1},${beforeEnd-start} +${start+1},${afterEnd-start} @@\n${lines.join("\n")}`);
  }
  console.log(changes.length ? flags.includes("--write") ? "Cambios aplicados. Revisa el diff de Git." : "Sólo propuesta. Revisa el diff y aplica repitiendo con --write." : "Sin cambios propuestos.");
}
main().catch(error => { console.error(error instanceof Error ? error.message : "No se pudieron proponer vistas."); process.exitCode = 1; });
