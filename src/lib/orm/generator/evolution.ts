import "server-only";
import { maskPrisma, prismaBlocks } from "./prisma-source";

/** First evolution policy: additions only; existing storage definitions cannot change. */
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
    if (lines.some(line => !proposed.includes(line))) throw new Error(`No se permite retirar o modificar campos, índices o mapeos existentes de ${block.name}.`);
    for (const line of proposed.filter(line => !lines.includes(line) && !line.startsWith("@@"))) {
      const match = /^(\w+)\s+(\w+)(\?|\[\])?\s*(.*)$/.exec(line);
      if (!match) throw new Error("Definición nueva de campo no reconocida.");
      const [, name, type, modifier, attributes] = match;
      if (modifier === "?" || modifier === "[]" || /@relation\b/.test(maskPrisma(attributes))) continue;
      if (!/@default\s*\(/.test(attributes)) throw new Error(`${block.name}.${name} (${type}) necesita ser opcional o tener un default para los registros existentes.`);
    }
  }
}
