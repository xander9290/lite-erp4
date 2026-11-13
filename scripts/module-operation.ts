import { config } from "dotenv";
import { z } from "zod";

config({ path: ".env.local", quiet: true }); config({ quiet: true });
const requestSchema = z.strictObject({
  command: z.enum(["review", "apply", "status", "finish"]),
  actor: z.strictObject({ id: z.string().min(1).max(100), sessionVersion: z.number().int().min(0) }),
  input: z.unknown().optional(), id: z.string().regex(/^[a-f0-9]{32}$/).optional(), fingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  confirmedModule: z.string().optional(), maintenanceConfirmed: z.literal(true).optional(),
});

export async function executeModuleRequest(input: unknown) {
  if (process.env.NODE_ENV === "production") throw new Error("Las operaciones de esquema están disponibles sólo en desarrollo.");
  const request = requestSchema.parse(input);
  const engine = await import("../src/lib/module-manager/operation-engine");
  const root = process.cwd();
  switch (request.command) {
    case "review": return engine.reviewModuleOperation(root, request.actor, request.input);
    case "status": return (await engine.readModuleOperation(root, request.actor, request.id ?? "")).view;
    case "finish": {
      if (!request.maintenanceConfirmed) throw new Error("Confirma primero el reinicio de las instancias.");
      return engine.finishModuleMaintenance(root, request.actor, request.id ?? "");
    }
    case "apply": {
      if (!request.maintenanceConfirmed) throw new Error("Confirma el cierre de otras instancias y tareas antes de aplicar.");
      return engine.applyModuleOperation(root, request.actor, request.id ?? "", request.fingerprint ?? "", request.confirmedModule ?? "");
    }
  }
}

async function main() {
  let value: unknown;
  if (process.argv.includes("--worker")) {
    let input = "";
    for await (const chunk of process.stdin) { input += chunk; if (input.length > 10000) throw new Error("Solicitud demasiado grande."); }
    value = JSON.parse(input);
  } else {
    const [command, target, ...args] = process.argv.slice(2);
    const options = new Map<string, string>();
    for (let i = 0; i < args.length; i += 2) {
      if (!args[i]?.startsWith("--") || !args[i + 1] || options.has(args[i])) throw new Error("Opciones inválidas.");
      options.set(args[i], args[i + 1]);
    }
    const allowed = ["--actor", "--session", "--operation", "--data", "--fingerprint", "--confirm", "--maintenance"];
    if ([...options.keys()].some(key => !allowed.includes(key))) throw new Error("Opción desconocida.");
    value = { command, actor: { id: options.get("--actor"), sessionVersion: Number(options.get("--session")) }, ...(command === "review"
      ? { input: { module: target, operation: options.get("--operation"), policy: options.get("--data") ?? "keep" } }
      : { id: target, ...(options.has("--fingerprint") ? { fingerprint: options.get("--fingerprint") } : {}), ...(options.has("--confirm") ? { confirmedModule: options.get("--confirm") } : {}), ...(options.get("--maintenance") === "confirmado" ? { maintenanceConfirmed: true } : {}) }) };
  }
  const plan = await executeModuleRequest(value);
  process.stdout.write(`\nMODULE_OPERATION_RESULT:${JSON.stringify({ ok: true, plan })}\n`);
}
main().catch(error => {
  let message = error instanceof z.ZodError ? "Solicitud de operación inválida." : error instanceof Error ? error.message : "No se pudo completar la operación.";
  if (process.env.DATABASE_URL) message = message.replaceAll(process.env.DATABASE_URL, "[base de datos]");
  process.stdout.write(`\nMODULE_OPERATION_RESULT:${JSON.stringify({ ok: false, error: message })}\n`);
  process.exitCode = 1;
}).finally(async () => { if (process.env.DATABASE_URL) { const { prisma } = await import("../src/lib/prisma"); await prisma.$disconnect(); } });
