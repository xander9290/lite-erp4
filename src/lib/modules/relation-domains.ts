import "server-only";
import { z } from "zod";
import type { ModuleDefinition, ModuleModel } from "./define";
import { nativeModule } from "./define";
import { compileRelationDomain, validateRelationDomain } from "../orm/domain";
import { domainDependencies, type DomainExpression, type DomainRecord } from "../orm/domain-builder";
import { ModelValidationError } from "../orm/context";

export function relationDomains(entry: ModuleModel): readonly { field: string; target: string; domain: DomainExpression; many: boolean }[] {
  return [
    ...Object.entries(entry.metadata).flatMap(([field, metadata]) => metadata.kind === "many2one" && metadata.domain ? [{ field, target: metadata.target, domain: metadata.domain, many: false }] : []),
    ...Object.entries(entry.contract.many2manyFields).flatMap(([field, descriptor]) => descriptor.many2many.domain ? [{ field, target: descriptor.many2many.target, domain: descriptor.many2many.domain, many: true }] : []),
  ];
}

/** Validate after composition, with the final owner fields and registered destinations. */
export function validateModuleDomains(definitions: readonly ModuleDefinition[]) {
  const models = new Map(definitions.flatMap(definition => definition.models.map(model => [model.contract.name, model] as const)));
  for (const definition of definitions) for (const entry of definition.models) for (const relation of relationDomains(entry)) {
    const target = models.get(relation.target);
    const owner = entry.extensions.find(extension => extension.fields.includes(relation.field))?.module ?? entry.module;
    const depends = definitions.find(module => module.id === owner)?.application.depends ?? [];
    if (!target || target.module !== owner && target.module !== nativeModule && !depends.includes(target.module)) throw new Error(`${entry.id}.${relation.field}: domain requiere destino declarativo registrado y depends.`);
    validateRelationDomain(relation.domain, queryDomainMetadata(target), entry.metadata);
    if (domainDependencies(relation.domain).some(name => !entry.clientFields.includes(name))) throw new Error(`${entry.id}.${relation.field}: dependencia no publicada.`);
  }
  return definitions;
}

export function relationDomainWhere(entry: ModuleModel, target: ModuleModel, domain: DomainExpression, input: unknown, record: DomainRecord = {}) {
  const dependencies = domainDependencies(domain);
  const fields = entry.contract.fields as Readonly<Record<string, import("../orm/fields").Field>>;
  const schema = z.strictObject(Object.fromEntries(dependencies.map(name => [name, z.preprocess(value => value === "" ? null : value, fields[name].schema.nullable().optional())])));
  const values = schema.parse(input);
  if (JSON.stringify(values).length > 16000) throw new ModelValidationError("El borrador del dominio supera el tamaño permitido.");
  return compileRelationDomain(domain, queryDomainMetadata(target), entry.metadata, values, record);
}

function queryDomainMetadata(entry: ModuleModel) {
  const extended = new Set(entry.extensions.flatMap(extension => extension.fields));
  return Object.fromEntries(Object.entries(entry.metadata).map(([name, field]) => [name, extended.has(name) ? { ...field, required: false } : field]));
}
