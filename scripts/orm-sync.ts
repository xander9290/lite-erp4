import { createInterface } from "node:readline/promises";
import { syncApplication } from "../src/lib/orm/generator/sync";

const usage = "Uso: npm run orm:sync -- id [--name nombre_migracion] [--plan]";
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === "--help") { console.log(usage); return; }
  const id = args.shift();
  let plan = false, name: string | undefined;
  while (args.length) {
    const flag = args.shift();
    if (flag === "--plan" && !plan) plan = true;
    else if (flag === "--name" && name === undefined && args[0] && !args[0].startsWith("--")) name = args.shift();
    else throw new Error(usage);
  }
  if (!id || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)) throw new Error(usage);
  if (!plan && (!process.stdin.isTTY || !process.stdout.isTTY)) throw new Error("Abre una terminal interactiva para revisar y aprobar el SQL. Para revisar fuentes sin escribir usa --plan. No existe --yes.");
  const terminal = plan ? null : createInterface({ input: process.stdin, output: process.stdout });
  try {
    await syncApplication(process.cwd(), id, { plan, name, log: console.log, confirm: async message => (await terminal!.question(`${message}: `)).trim().toLowerCase() === "aplicar" });
  } finally { terminal?.close(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "No se pudo sincronizar."); process.exitCode = 1; });
