/** Compare generated SQL while ignoring formatting/comments outside literals.
 * Whitespace and comment markers inside values remain significant.
 */
export function normalizedSQL(value: string) {
  const sql = value.replace(/\r\n/g, "\n");
  let output = "", quoted = "", dollar = "", block = 0, line = false, escape = false;
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i], next = sql[i + 1];
    if (line) { if (char === "\n") { line = false; if (!output.endsWith(" ")) output += " "; } continue; }
    if (block) {
      if (char === "/" && next === "*") { block++; i++; }
      else if (char === "*" && next === "/") { block--; i++; if (!block && !output.endsWith(" ")) output += " "; }
      continue;
    }
    if (dollar) {
      if (sql.startsWith(dollar, i)) { output += dollar; i += dollar.length - 1; dollar = ""; }
      else output += char;
      continue;
    }
    if (quoted) {
      output += char;
      if (escape && char === "\\" && next) { output += next; i++; }
      else if (char === quoted) { if (next === quoted) { output += next; i++; } else quoted = ""; }
      continue;
    }
    if (char === "-" && next === "-") { line = true; i++; continue; }
    if (char === "/" && next === "*") { block = 1; i++; continue; }
    if (char === "'" || char === '"') { quoted = char; escape = char === "'" && /(?:^|\W)E$/i.test(output); output += char; continue; }
    const tag = char === "$" ? /^\$[A-Za-z_0-9]*\$/.exec(sql.slice(i))?.[0] : undefined;
    if (tag) { dollar = tag; output += tag; i += tag.length - 1; continue; }
    if (/\s/.test(char)) { if (!output.endsWith(" ")) output += " "; }
    else output += char;
  }
  if (quoted || dollar || block) throw new Error("SQL de revisión incompleto.");
  return output.trim();
}
