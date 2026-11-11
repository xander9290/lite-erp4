import "server-only";
import { displayFieldPaths, displayPathParts, displayRelation } from "../display";
import type { GenerationModel, ModuleGeneration } from "./generate";

type Guard = { model: string; field: string; target?: string };

/** Only declarations in this admin baseline/profile are trusted; no Prisma schema inference of privacy. */
export function lookupProjectionPlan(module: ModuleGeneration, entry: GenerationModel) {
  const models = new Map(module.models.map(model => [model.model.name, model]));
  const policy: Record<string, Guard[]> = { id: [] };
  for (const name of entry.clientFields) {
    const field = entry.model.metadata[name];
    if (field && !field.sensitive) policy[name] = [{ model: entry.model.name, field: name }];
  }
  const paths = displayFieldPaths(entry.model.metadata, entry.model.displayFields).filter(path => path.includes("."));
  for (const path of paths) {
    const parts = displayPathParts(path), guards: Guard[] = [];
    let current = entry;
    for (let index = 0; index < parts.length; index++) {
      const name = parts[index];
      if (index === parts.length - 1) {
        if (name !== "id") {
          const field = Object.hasOwn(current.model.metadata, name) ? current.model.metadata[name] : undefined;
          if (!field || field.sensitive || !current.clientFields.includes(name)) throw new Error(`${entry.model.name}.displayFields: ${path} no es un escalar publicado y no sensible.`);
          guards.push({ model: current.model.name, field: name });
        }
      } else {
        const [field, metadata] = displayRelation(current.model.metadata, name);
        if (!current.clientFields.includes(field)) throw new Error(`${entry.model.name}.displayFields: ${path} cruza una relación no publicada.`);
        guards.push({ model: current.model.name, field, target: metadata.target });
        const target = models.get(metadata.target);
        if (!target) throw new Error(`${entry.model.name}.displayFields: registra ${metadata.target} en el mismo perfil para resolver ${path}; modelos manuales/externos requieren un lookup propio.`);
        current = target;
      }
    }
    policy[path] = guards;
  }
  return { paths, policy };
}
