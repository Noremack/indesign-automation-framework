import fs from "fs";
import path from "path";
import ts from "typescript";

export function extractSignaturesAST(filePath) {
  const fullPath = path.resolve(filePath);
  const sourceCode = fs.readFileSync(fullPath, "utf8");
  const sourceFile = ts.createSourceFile(fullPath, sourceCode, ts.ScriptTarget.ES2020, true);
  const buffer = [];

  function visit(node) {
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node)) {
      buffer.push(node.getFullText(sourceFile).trim());
      buffer.push("\n");
      return;
    }
    if (ts.isClassDeclaration(node)) {
      const className = node.name ? node.name.text : "Anonymous";
      buffer.push(`export class ${className} {`);
      for (const member of node.members) {
        if (ts.isMethodDeclaration(member)) {
          const name = member.name.getText(sourceFile);
          const params = member.parameters.map(p => p.getText(sourceFile)).join(", ");
          const type = member.type ? member.type.getText(sourceFile) : "void";
          const modifier = member.modifiers ? member.modifiers.map(m => m.getText(sourceFile)).join(" ") + " " : "";
          buffer.push(`  ${modifier}${name}(${params}): ${type};`);
        }
      }
      buffer.push("}\n");
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return buffer.join("\n");
}

if (process.argv[1] && (process.argv[1].endsWith("extract-context.mjs") || process.argv[1].endsWith("extract-context"))) {
  const target = process.argv[2] || "src/core/base-service.ts";
  console.log(extractSignaturesAST(target));
}
