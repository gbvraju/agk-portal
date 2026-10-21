// The import scan of SPEC-0003 rule 4: a syntax-tree allow-list. Only a relative path that stays inside the core
// directory is allowed; everything else, and anything the scan cannot parse or classify, is a violation (fail closed).
// It reads syntax trees through a pinned 5.x typescript (the package alias typescript5), because TypeScript 7 offers
// no JavaScript compiler API (ADR-0014).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import ts from "typescript5";

export interface Violation {
  file: string;
  specifier: string;
  reason: string;
}

export function filesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...filesUnder(path));
    else found.push(path);
  }
  return found.sort();
}

function inside(core: string, file: string, specifier: string): boolean {
  if (!(specifier.startsWith("./") || specifier.startsWith("../"))) return false;
  const target = resolve(dirname(file), specifier);
  return target === core || target.startsWith(core + sep);
}

function literal(node: ts.Node | undefined): string | undefined {
  if (node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) return node.text;
  return undefined;
}

export function scanFile(file: string, core: string): Violation[] {
  const text = readFileSync(file, "utf8");
  const violations: Violation[] = [];
  if (!file.endsWith(".ts")) {
    return [{ file, specifier: "", reason: "a core file must be a .ts file" }];
  }
  const transpiled = ts.transpileModule(text, { reportDiagnostics: true, fileName: file });
  if ((transpiled.diagnostics ?? []).length > 0) {
    return [{ file, specifier: "", reason: "the file cannot be parsed" }];
  }
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const check = (node: ts.Node | undefined): void => {
    const specifier = literal(node);
    if (specifier === undefined) {
      violations.push({ file, specifier: "<computed>", reason: "the specifier cannot be classified" });
    } else if (!inside(core, file, specifier)) {
      violations.push({ file, specifier, reason: "not a relative path inside the core" });
    }
  };
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) check(node.moduleSpecifier);
    else if (ts.isExportDeclaration(node) && node.moduleSpecifier) check(node.moduleSpecifier);
    else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      check(node.moduleReference.expression);
    } else if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (callee.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(callee) && callee.text === "require")) {
        check(node.arguments[0]);
      }
    } else if (ts.isImportTypeNode(node)) {
      const arg = node.argument;
      check(ts.isLiteralTypeNode(arg) ? arg.literal : undefined);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return violations;
}

export function scanCore(core: string): Violation[] {
  return filesUnder(core).flatMap((file) => scanFile(file, resolve(core)));
}
