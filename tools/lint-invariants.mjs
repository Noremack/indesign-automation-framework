#!/usr/bin/env node
import fs from "fs";
import path from "path";

export function lintFile(filePath, content) {
  const violations = [];
  const lines = content.split("\n");

  const bannedPatterns = [
    {
      regex: /\bFolder\b/,
      rule: "BANNED_API_FOLDER",
      message: "Legacy ExtendScript 'Folder' is forbidden in InDesign UXP. Use PathUtils or UXP storage APIs."
    },
    {
      regex: /\bnew\s+File\b|\bFile\s*\(/,
      rule: "BANNED_API_FILE",
      message: "Legacy ExtendScript 'File' constructor is forbidden in InDesign UXP. Use PathUtils or UXP storage APIs."
    },
    {
      regex: /\$\.writeln\b/,
      rule: "BANNED_API_WRITELN",
      message: "Legacy ExtendScript '$.writeln' is forbidden. Use console.log or StandardLogger."
    },
    {
      regex: /ScriptLanguage\.JAVASCRIPT\b/,
      rule: "BANNED_API_LEGACY_JS",
      message: "app.doScript with ScriptLanguage.JAVASCRIPT executes legacy ExtendScript. Use ScriptLanguage.UXP_SCRIPT."
    },
    {
      regex: /\balert\s*\(/,
      rule: "BANNED_API_ALERT",
      message: "'alert()' is forbidden in InDesign UXP. Use uxp.dialogs.showAlert() or StandardLogger."
    },
    {
      regex: /\b(?:window|document)\.(?!isValid\b|colors\b|layers\b|pages\b|spreads\b|stories\b|viewPreferences\b|zeroPoint\b|recompose\b|save\b|close\b)/,
      rule: "BANNED_WEB_GLOBALS",
      message: "Browser globals 'window' and 'document' do not exist in InDesign UXP."
    },
    {
      regex: /\bdoc\.allPageItems\b|\bdocument\.allPageItems\b/,
      rule: "BANNED_UNSCOPED_PAGEITEMS",
      message: "Unscoped 'doc.allPageItems' causes memory exhaustion. Iterate hierarchically by Spread or Page."
    }
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comment lines
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
      continue;
    }

    for (const pattern of bannedPatterns) {
      if (pattern.regex.test(line)) {
        violations.push({
          file: filePath,
          line: i + 1,
          rule: pattern.rule,
          message: pattern.message,
          snippet: line.trim()
        });
      }
    }
  }

  return violations;
}

export function lintDirectory(dirPath = "src") {
  const allViolations = [];

  function traverse(currentDir) {
    if (!fs.existsSync(currentDir)) return;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".js")) && !entry.name.endsWith(".d.ts")) {
        const content = fs.readFileSync(fullPath, "utf8");
        const violations = lintFile(fullPath, content);
        allViolations.push(...violations);
      }
    }
  }

  traverse(path.resolve(dirPath));
  return allViolations;
}

// CLI Execution Support
if (
  process.argv[1] &&
  (process.argv[1].endsWith("lint-invariants.mjs") || process.argv[1].endsWith("lint-invariants"))
) {
  const targetDir = process.argv[2] || "src";
  console.log(`Scanning '${targetDir}' for architectural invariant violations and banned APIs...`);

  const violations = lintDirectory(targetDir);

  if (violations.length === 0) {
    console.log("✔ All files strictly adhere to InDesign UXP invariants and rules!");
    process.exit(0);
  } else {
    console.error(`\n✖ Found ${violations.length} invariant violation(s):\n`);
    for (const v of violations) {
      const relPath = path.relative(process.cwd(), v.file);
      console.error(`  ${relPath}:${v.line} - [${v.rule}]`);
      console.error(`    Snippet: ${v.snippet}`);
      console.error(`    Fix:     ${v.message}\n`);
    }
    process.exit(1);
  }
}
