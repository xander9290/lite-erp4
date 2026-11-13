import "server-only";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import ts from "typescript";

/** next typegen refreshes .next/types, while a running dev server owns
 * .next/dev/types. Validate all configured sources and the fresh route types,
 * without letting a stale dev validator import routes just removed on disk.
 */
export function verifyOperationTypes(root: string) {
  const fatal: ts.Diagnostic[] = [];
  const config = ts.getParsedCommandLineOfConfigFile(join(root, "tsconfig.json"), { noEmit: true, incremental: false }, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: error => { fatal.push(error); } });
  if (!config || fatal.length || config.errors.length) throw new Error("No se pudo leer la configuración TypeScript para verificar la operación.");
  const devTypes = resolve(root, ".next/dev/types");
  const fileNames = config.fileNames.filter(path => {
    const inside = relative(devTypes, resolve(path));
    return inside.startsWith(`..${sep}`) || inside === ".." || isAbsolute(inside);
  });
  const program = ts.createProgram({ rootNames: fileNames, options: config.options, projectReferences: config.projectReferences });
  if (ts.getPreEmitDiagnostics(program).length) throw new Error("La retirada se preparó pero TypeScript no pudo verificarse. Conserva el mantenimiento y revisa las referencias restantes.");
}
