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

/** Additions and bounded VARCHAR widening only; never narrow or silently change other attributes. */
export function assertAdditiveEvolution(previous: string, next: string) {
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
      const widened = proposed.find(candidate => widensVarchar(line, candidate));
      if (!widened) throw new Error(`No se permite retirar o modificar campos, índices o mapeos existentes de ${block.name}. Sólo se admite ampliar VARCHAR sin otros cambios.`);
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
