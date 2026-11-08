import "server-only";

/** Preserve offsets while hiding comments and quoted strings from structural scanning. */
export function maskPrisma(source: string) {
  const chars = source.split("");
  let quoted = false, comment = false, block = 0;
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i], next = chars[i + 1];
    const blank = () => { if (chars[i] !== "\n" && chars[i] !== "\r") chars[i] = " "; };
    if (comment) { blank(); if (char === "\n") comment = false; continue; }
    if (block) {
      blank();
      if (char === "/" && next === "*") { chars[++i] = " "; block++; }
      else if (char === "*" && next === "/") { chars[++i] = " "; block--; }
      continue;
    }
    if (quoted) {
      blank();
      if (char === "\\") { if (i + 1 < chars.length) chars[++i] = " "; }
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') { quoted = true; blank(); }
    else if (char === "/" && next === "/") { comment = true; blank(); chars[++i] = " "; }
    else if (char === "/" && next === "*") { block = 1; blank(); chars[++i] = " "; }
  }
  if (quoted || block) throw new Error("El esquema Prisma contiene un string o comentario sin cerrar.");
  return chars.join("");
}

export function prismaBlocks(source: string) {
  const masked = maskPrisma(source);
  const pattern = /\b(model|enum|datasource|generator|view|type)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/g;
  const blocks: { kind: string; name: string; start: number; end: number; body: string; maskedBody: string }[] = [];
  for (let match = pattern.exec(masked); match; match = pattern.exec(masked)) {
    const open = pattern.lastIndex - 1;
    let depth = 1, end = open + 1;
    while (end < masked.length && depth) {
      if (masked[end] === "{") depth++;
      if (masked[end] === "}") depth--;
      end++;
    }
    if (depth) throw new Error(`Bloque Prisma sin cerrar: ${match[2]}.`);
    blocks.push({ kind: match[1], name: match[2], start: match.index, end, body: source.slice(open + 1, end - 1), maskedBody: masked.slice(open + 1, end - 1) });
    pattern.lastIndex = end;
  }
  return blocks;
}
