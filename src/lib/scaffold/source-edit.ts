import ts from "typescript";

export function sourceFile(text: string, name = "source.ts") {
  const diagnostics = ts.transpileModule(text, { fileName: name, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).diagnostics ?? [];
  if (diagnostics.some(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error)) throw new Error(`Corrige la sintaxis de ${name} antes de generar archivos.`);
  return ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}
export function unwrap(node: ts.Expression): ts.Expression {
  return ts.isSatisfiesExpression(node) || ts.isAsExpression(node) || ts.isParenthesizedExpression(node) ? unwrap(node.expression) : node;
}
export function variable(file: ts.SourceFile, name: string): ts.Expression {
  const declarations = file.statements.filter(ts.isVariableStatement).flatMap(statement => [...statement.declarationList.declarations]);
  const matches = declarations.filter(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === name);
  if (matches.length !== 1 || !matches[0].initializer) throw new Error(`No se puede ubicar ${name} de forma inequívoca.`);
  return unwrap(matches[0].initializer);
}
export function object(node: ts.Expression): ts.ObjectLiteralExpression {
  node = unwrap(node);
  if (!ts.isObjectLiteralExpression(node) || node.properties.some(ts.isSpreadAssignment)) throw new Error("Se requiere una declaración literal sin spreads para editarla con seguridad; conserva la configuración propia y registra el modelo/menú manualmente.");
  return node;
}
export function property(node: ts.ObjectLiteralExpression, name: string): ts.Expression {
  const matches = node.properties.filter(p => p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) && p.name.text === name);
  if (matches.length !== 1 || !ts.isPropertyAssignment(matches[0])) throw new Error(`Se requiere la propiedad literal ${name}.`);
  return unwrap(matches[0].initializer);
}
export function array(node: ts.Expression): ts.ArrayLiteralExpression {
  node = unwrap(node);
  if (!ts.isArrayLiteralExpression(node) || node.elements.some(ts.isSpreadElement)) throw new Error("Se requiere un array literal sin spreads para registrar el cambio.");
  return node;
}
export function literal(node: ts.Expression): string {
  if (!ts.isStringLiteral(node)) throw new Error("Se requiere texto literal en esta configuración.");
  return node.text;
}
export function append(text: string, node: ts.ArrayLiteralExpression | ts.ObjectLiteralExpression, entry: string) {
  const items = ts.isArrayLiteralExpression(node) ? node.elements : node.properties;
  const suffix = `${items.length && !items.hasTrailingComma ? "," : ""}\n    ${entry},\n  `;
  return text.slice(0, node.end - 1) + suffix + text.slice(node.end - 1);
}
export function manifestObject(file: ts.SourceFile) {
  const candidates = file.statements.filter(ts.isVariableStatement).filter(statement => statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)).flatMap(statement => [...statement.declarationList.declarations]).flatMap(declaration => declaration.initializer ? [unwrap(declaration.initializer)] : []).filter(node => ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "defineApplication");
  const declaration = candidates[0];
  if (candidates.length !== 1 || !ts.isCallExpression(declaration) || declaration.arguments.length !== 1) throw new Error("El manifest debe exportar una única llamada a defineApplication con un objeto literal.");
  return object(declaration.arguments[0]);
}
