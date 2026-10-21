// Small syntax-tree questions about the core, read through the pinned 5.x typescript (ADR-0014).
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import ts from "typescript5";
import { filesUnder } from "./import-scan.ts";

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
}

// The names of the core files in which the identifier appears (as a name, a property or a call).
export function filesUsingIdentifier(coreDir: string, name: string): string[] {
  const found: string[] = [];
  for (const file of filesUnder(coreDir)) {
    let seen = false;
    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node) && node.text === name) seen = true;
      ts.forEachChild(node, visit);
    };
    visit(parse(file));
    if (seen) found.push(basename(file));
  }
  return found.sort();
}

// The names of the core files that build `new <Name>(...)`.
export function filesConstructing(coreDir: string, name: string): string[] {
  const found: string[] = [];
  for (const file of filesUnder(coreDir)) {
    let seen = false;
    const visit = (node: ts.Node): void => {
      if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name) seen = true;
      ts.forEachChild(node, visit);
    };
    visit(parse(file));
    if (seen) found.push(basename(file));
  }
  return found.sort();
}
