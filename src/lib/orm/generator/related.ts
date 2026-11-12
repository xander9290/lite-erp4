import "server-only";
import { relationFieldName } from "../display";
import type { GenerationModel, ModuleGeneration } from "./generate";

type Guard = { model: string; field: string; target?: string };
export type RelatedPlan = { root: string; target: string; outputs: Record<string, string>; policy: Record<string, Guard[]> };

/** Resolve declared field names to Prisma aliases, checking every publication boundary. */
export function relatedProjectionPlan(module: ModuleGeneration, entry: GenerationModel): RelatedPlan[] {
  const groups = new Map<string, RelatedPlan>();
  for (const [name, descriptor] of Object.entries(entry.model.relatedFields ?? {})) {
    const path = descriptor.metadata.related!;
    const parts = path.split(".");
    let current = entry;
    const guards: Guard[] = [], projection: string[] = [];
    let group: RelatedPlan | undefined;
    for (let index = 0; index < parts.length; index++) {
      const segment = parts[index];
      // Public declaration names are canonical; accept existing relation aliases too.
      const fieldName = Object.hasOwn(current.model.metadata, segment) ? segment
        : Object.keys(current.model.metadata).find(key => current.model.metadata[key].kind === "many2one" && relationFieldName(key) === segment);
      const field = fieldName ? current.model.metadata[fieldName] : undefined;
      if (!fieldName || !field || field.sensitive || !current.clientFields.includes(fieldName)) throw new Error(`${entry.model.name}.${name}: related ${path} cruza un campo no publicado o sensible.`);
      const leaf = index === parts.length - 1;
      if (leaf) {
        if (field.kind === "many2one" || field.kind !== descriptor.metadata.kind) throw new Error(`${entry.model.name}.${name}: el tipo de related no coincide con ${path}.`);
        guards.push({model:current.model.name, field:fieldName});
        projection.push(fieldName);
      } else {
        if (field.kind !== "many2one") throw new Error(`${entry.model.name}.${name}: related sólo atraviesa Many2one.`);
        const target = module.models.find(candidate => candidate.model.name === field.target);
        if (!target) throw new Error(`${entry.model.name}.${name}: related requiere destinos declarativos del mismo perfil.`);
        guards.push({model:current.model.name, field:fieldName, target:field.target});
        if (index === 0) {
          // The first dependency is always a persisted local ID, never an alias.
          if (fieldName !== segment) throw new Error(`${name}: usa el nombre del Field local como raíz de related.`);
          group = groups.get(fieldName) ?? {root:fieldName, target:field.target, outputs:{}, policy:{}};
          groups.set(fieldName, group);
        } else projection.push(relationFieldName(fieldName));
        current = target;
      }
    }
    if (!group) throw new Error(`${name}: related necesita una relación.`);
    const selected = projection.join(".");
    group.outputs[name] = selected;
    group.policy[selected] = guards;
  }
  return [...groups.values()];
}

