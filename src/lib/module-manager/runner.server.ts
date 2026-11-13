import "server-only";
import { spawn } from "node:child_process";
import { join } from "node:path";
import type { ModelActor } from "../orm/context";
import type { OperationResult } from "./operation.types";

/** Fixed executable/script/working directory. Browser payloads never choose a
 * binary, shell command, path, environment, database URL or SQL statement.
 */
export function runModuleOperation(actor: ModelActor, request: { command: "review" | "apply" | "status" | "finish"; input?: unknown; id?: string; fingerprint?: string; confirmedModule?: string; maintenanceConfirmed?: true }): Promise<OperationResult> {
  if (process.env.NODE_ENV === "production") return Promise.resolve({ ok: false, error: "Las operaciones de esquema están disponibles sólo en desarrollo." });
  return new Promise(resolve => {
    const root = process.cwd();
    const child = spawn(process.execPath, ["--conditions=react-server", "--import", "tsx", join(root, "scripts/module-operation.ts"), "--worker"], { cwd: root, env: process.env, shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    child.stdout.on("data", chunk => { stdout += chunk; if (stdout.length > 2_000_000) child.kill(); });
    child.stderr.resume();
    child.stdin.on("error", () => {});
    child.once("error", () => resolve({ ok: false, error: "No se pudo iniciar el ejecutor local de módulos." }));
    child.once("close", () => {
      const marker = stdout.lastIndexOf("MODULE_OPERATION_RESULT:");
      try {
        if (marker < 0) throw new Error();
        const result = JSON.parse(stdout.slice(marker + "MODULE_OPERATION_RESULT:".length).trim()) as OperationResult;
        if (typeof result.ok !== "boolean") throw new Error();
        resolve(result);
      } catch { resolve({ ok: false, error: "El ejecutor terminó sin un resultado confirmado. Consulta la operación antes de reintentar." }); }
    });
    child.stdin.end(JSON.stringify({ ...request, actor }));
  });
}
