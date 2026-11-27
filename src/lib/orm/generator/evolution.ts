import "server-only";
import { maskPrisma, prismaBlocks } from "./prisma-source";

/** Only widening a bounded String is permitted; every other field attribute stays identical. */
function widensVarchar(previous: string, next: string) {
  const parse = (line: string) => {
    const masked = maskPrisma(line);
    if (!/^\w+ String\??\s/.test(masked)) return null;
    const matches = [...masked.matchAll(/@db\.VarChar\(\s*(\d+)\s*\)/g)];
    if (matches.length !== 1) return null;
    const match = matches[0], length = Number(match[1]);
    if (!Number.isSafeInteger(length) || length < 1) return null;
    return { length, rest: line.slice(0, match.index) + "@db.VarChar(*)" + line.slice(match.index + match[0].length) };
  };
  const before = parse(previous), after = parse(next);
  return !!before && !!after && after.length > before.length && before.rest === after.rest;
}

/**
 * Explicit force still keeps field identity, defaults, mapping and scalar type unchanged.
 * Adding or retiring a single-field @unique is admitted: retiring only drops its index.
 */
function reviewedStringChange(previous: string, next: string) {
  const parse = (line: string) => {
    const match = /^(\w+) String(\?)?(?:\s+(.*))?$/.exec(line);
    if (!match) return null;
    const attributes = match[3] ?? "";
    const unique = /@unique(?:\s|$)/.test(attributes);
    const length = /@db\.VarChar\(\s*(\d+)\s*\)/.exec(attributes);
    const rest = attributes.replace(/@unique(?=\s|$)/g, "").replace(/@db\.VarChar\(\s*\d+\s*\)/g, "").trim().replace(/\s+/g, " ");
    return { name: match[1], unique, length: length ? Number(length[1]) : null, rest };
  };
  const before = parse(previous), after = parse(next);
  return !!before && !!after && before.name === after.name && before.rest === after.rest
    && (after.length === null || Number.isSafeInteger(after.length) && after.length > 0);
}

/** Owning single-column relation; inverse/list relations and implicit delete policies stay strict. */
function owningRelation(line: string) {
  const match = /^(\w+) (\w+)(\?)? (.+)$/.exec(line);
  if (!match || ["String", "Int", "Boolean", "DateTime", "Float", "Decimal", "BigInt", "Bytes", "Json"].includes(match[2])) return null;
  const attributes = maskPrisma(match[4]);
  const foreign = /\bfields\s*:\s*\[\s*(\w+)\s*\]/.exec(attributes);
  if (!/@relation\s*\(/.test(attributes) || !foreign || !/\breferences\s*:\s*\[\s*\w+\s*\]/.test(attributes)
    || !/\bonDelete\s*:\s*(?:Restrict|Cascade|NoAction)\b/.test(attributes)) return null;
  return { name: match[1], target: match[2], optional: !!match[3], attributes: match[4], foreign: foreign[1] };
}

/** A reviewed relation may only mirror the nullability change of its existing String FK. */
function reviewedRelationChange(previous: string, next: string, before: readonly string[], after: readonly string[]) {
  const old = owningRelation(previous), proposed = owningRelation(next);
  if (!old || !proposed || old.name !== proposed.name || old.target !== proposed.target || old.attributes !== proposed.attributes
    || old.optional === proposed.optional || old.foreign !== proposed.foreign) return false;
  const scalar = (lines: readonly string[], name: string) => lines.find(line => line.startsWith(`${name} String `) || line === `${name} String` || line.startsWith(`${name} String? `) || line === `${name} String?`);
  const foreignBefore = scalar(before, old.foreign), foreignAfter = scalar(after, old.foreign);
  return !!foreignBefore && !!foreignAfter && reviewedStringChange(foreignBefore, foreignAfter)
    && /^\w+ String\?/.test(foreignBefore) === old.optional
    && /^\w+ String\?/.test(foreignAfter) === proposed.optional;
}

/** Changing a relation FK also requires its existing owning descriptor to change consistently. */
function mirrorsForeignKeyChange(previous: string, next: string, before: readonly string[], after: readonly string[]) {
  if (/^\w+ String\?/.test(previous) === /^\w+ String\?/.test(next)) return true;
  const name = /^(\w+) String/.exec(previous)?.[1];
  return before.filter(line => name && owningRelation(line)?.foreign === name)
    .every(relation => after.some(candidate => reviewedRelationChange(relation, candidate, before, after)));
}

/** Additive by default; force admits reviewed String constraints and matching relation nullability. */
export function assertAdditiveEvolution(previous: string, next: string, force = false) {
  const before = prismaBlocks(previous), after = prismaBlocks(next);
  const normalize = (line: string) => line.trim().replace(/\s+/g, " ");
  for (const block of before) {
    const replacement = after.find(item => item.kind === block.kind && item.name === block.name);
    if (!replacement) throw new Error(`No se permite eliminar o renombrar ${block.name} en una actualización aditiva.`);
    if (block.kind === "enum") {
      const values = block.body.split("\n").map(normalize).filter(Boolean);
      const proposed = replacement.body.split("\n").map(normalize).filter(Boolean);
      if (values.some(value => !proposed.includes(value))) throw new Error(`No se permite retirar o cambiar valores de ${block.name}.`);
      continue;
    }
    if (block.kind !== "model") throw new Error("El fragmento instalado sólo puede contener modelos y enums.");
    const lines = block.body.split("\n").map(normalize).filter(Boolean);
    const proposed = replacement.body.split("\n").map(normalize).filter(Boolean);
    const retained = new Set(lines);
    for (const line of lines) {
      if (proposed.includes(line)) continue;
      const widened = proposed.find(candidate => (widensVarchar(line, candidate) || force && ((reviewedStringChange(line, candidate) && mirrorsForeignKeyChange(line, candidate, lines, proposed)) || reviewedRelationChange(line, candidate, lines, proposed))));
      if (!widened) throw new Error(`No se permite retirar o modificar campos, índices o mapeos existentes de ${block.name}. Sólo se admite ampliar VARCHAR sin otros cambios. Para unicidad, longitud o nulabilidad de String revisa orm:sync --force; no permite borrar ni renombrar campos.`);
      retained.add(widened);
    }
    for (const line of proposed.filter(line => !retained.has(line) && !line.startsWith("@@"))) {
      const match = /^(\w+)\s+(\w+)(\?|\[\])?\s*(.*)$/.exec(line);
      if (!match) throw new Error("Definición nueva de campo no reconocida.");
      const [, name, type, modifier, attributes] = match;
      if (modifier === "?" || modifier === "[]" || /@relation\b/.test(maskPrisma(attributes))) continue;
      if (!/@default\s*\(/.test(attributes)) throw new Error(`${block.name}.${name} (${type}) necesita ser opcional o tener un default para los registros existentes.`);
    }
  }
}
