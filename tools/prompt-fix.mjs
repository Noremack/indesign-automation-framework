#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { extractSignaturesAST } from "./extract-context.mjs";

export function readClipboardText() {
  try {
    if (process.platform === "win32") {
      const proc = spawnSync("powershell.exe", ["-NoProfile", "-Command", "Get-Clipboard"], {
        encoding: "utf8",
        timeout: 3000
      });
      if (proc.status === 0 && proc.stdout) {
        return proc.stdout.trim();
      }
    } else if (process.platform === "darwin") {
      const proc = spawnSync("pbpaste", { encoding: "utf8", timeout: 3000 });
      if (proc.status === 0 && proc.stdout) {
        return proc.stdout.trim();
      }
    } else if (process.platform === "linux") {
      const proc = spawnSync("xclip", ["-selection", "clipboard", "-o"], {
        encoding: "utf8",
        timeout: 3000
      });
      if (proc.status === 0 && proc.stdout) {
        return proc.stdout.trim();
      }
    }
  } catch (_) {}
  return "";
}

export function writeClipboardText(text) {
  try {
    if (process.platform === "win32") {
      const proc = spawnSync("clip", { input: text, encoding: "utf8", timeout: 3000 });
      return proc.status === 0;
    } else if (process.platform === "darwin") {
      const proc = spawnSync("pbcopy", { input: text, encoding: "utf8", timeout: 3000 });
      return proc.status === 0;
    } else if (process.platform === "linux") {
      const proc = spawnSync("xclip", ["-selection", "clipboard"], {
        input: text,
        encoding: "utf8",
        timeout: 3000
      });
      return proc.status === 0;
    }
  } catch (_) {}
  return false;
}

export function findMatchingService(errorText, serviceDir = "src/services") {
  if (!fs.existsSync(serviceDir)) return null;

  const files = fs.readdirSync(serviceDir).filter(f => f.endsWith(".ts"));
  for (const file of files) {
    const baseName = file.replace(/\.ts$/, "");
    const pascalName = baseName
      .split("-")
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");

    if (
      errorText.includes(file) ||
      errorText.includes(baseName) ||
      errorText.includes(pascalName)
    ) {
      return path.join(serviceDir, file);
    }
  }
  return null;
}

export function recordRoadblock({
  code = "ERR_UNKNOWN",
  domain = "GENERAL",
  action = "UnknownAction",
  message = "",
  logPath = ".framework/telemetry.jsonl"
} = {}) {
  try {
    const fullLogPath = path.resolve(logPath);
    const dir = path.dirname(fullLogPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const entry = {
      timestamp: new Date().toISOString(),
      code,
      domain,
      action,
      message: message.slice(0, 300).replace(/\r?\n/g, " ")
    };

    fs.appendFileSync(fullLogPath, JSON.stringify(entry) + "\n", "utf8");
    return true;
  } catch (_) {
    return false;
  }
}

export function extractDiagnosticMeta(errorInput) {
  let code = "ERR_UNKNOWN";
  let domain = "GENERAL";
  let action = "UnknownAction";
  let message = "";

  try {
    const parsed = JSON.parse(errorInput);
    if (parsed && typeof parsed === "object") {
      code = parsed.errorCode || parsed.code || code;
      domain = parsed.domain || domain;
      action = parsed.action || action;
      message = parsed.message || "";
      return { code, domain, action, message };
    }
  } catch (_) {}

  const codeMatch = errorInput.match(/\b(ERR_[A-Z0-9_]+)\b/);
  if (codeMatch) code = codeMatch[1];

  const domainMatch = errorInput.match(/\b(DOM_INTEGRITY|TRANSACTION|PREFLIGHT|VALIDATION|IO)\b/);
  if (domainMatch) domain = domainMatch[1];

  const actionMatch = errorInput.match(/action["\s:]+([A-Za-z0-9_\s-]+)/i) || errorInput.match(/at\s+([A-Za-z0-9]+Service)/);
  if (actionMatch) action = actionMatch[1].trim();

  const msgLine = errorInput.split("\n").find(l => l.includes("Error:") || l.includes("message"));
  if (msgLine) message = msgLine.trim();

  return { code, domain, action, message };
}

export function generateFixPrompt({
  errorInput,
  servicePath = null,
  rulesPath = "antigravity.rules.json",
  typesPath = "src/core/types.ts",
  logPath = ".framework/telemetry.jsonl"
}) {
  if (!errorInput || typeof errorInput !== "string" || !errorInput.trim()) {
    throw new Error("No error diagnostic input provided.");
  }

  // Record roadblock metadata to telemetry ledger
  const meta = extractDiagnosticMeta(errorInput);
  recordRoadblock({
    code: meta.code,
    domain: meta.domain,
    action: meta.action,
    message: meta.message || errorInput,
    logPath
  });

  const resolvedRulesPath = path.resolve(rulesPath);
  const resolvedTypesPath = path.resolve(typesPath);

  const rules = fs.existsSync(resolvedRulesPath)
    ? fs.readFileSync(resolvedRulesPath, "utf8").trim()
    : "Follow InDesign UXP invariants: synchronous transactions, unit normalization, editable guards.";

  const types = fs.existsSync(resolvedTypesPath)
    ? fs.readFileSync(resolvedTypesPath, "utf8").trim()
    : "";

  let serviceContext = "";
  let resolvedService = servicePath;

  if (!resolvedService) {
    resolvedService = findMatchingService(errorInput);
  }

  if (resolvedService && fs.existsSync(resolvedService)) {
    const serviceContent = fs.readFileSync(resolvedService, "utf8");
    const relPath = path.relative(process.cwd(), resolvedService);
    // If service file is reasonably sized, include full content; otherwise extract AST signatures
    if (serviceContent.split("\n").length <= 150) {
      serviceContext = `// Source: ${relPath}\n${serviceContent}`;
    } else {
      const astSignatures = extractSignaturesAST(resolvedService);
      serviceContext = `// AST Signatures: ${relPath}\n${astSignatures}`;
    }
  }

  const prompt = `[ROLE]
You are an expert Adobe InDesign UXP engineer specializing in AI-assisted automation.
Repair the failed service implementation to resolve the reported error while strictly adhering to all framework architectural invariants.

[FRAMEWORK RULES]
${rules}

[CONTRACTS & TYPES]
${types}
${serviceContext ? `\n[TARGET SERVICE CONTEXT]\n${serviceContext}\n` : ""}
[DIAGNOSTIC ERROR REPORT]
${errorInput.trim()}

[REPAIR INSTRUCTIONS]
1. Analyze the root cause of the error against InDesign UXP invariants:
   - BaseService lifecycle & strictly synchronous runInTransaction
   - Automatic unit normalization (POINTS) and page origin
   - Element editability guards (isElementEditable) before mutating geometry or content
   - Backward loops (i--) when mutating or deleting items or text ranges
   - Strict vs Permissive failure policy handling
   - Banned APIs (no Folder, File, $.writeln, alert(), window, document, doc.allPageItems)
2. Provide the corrected service file that fixes the failure and handles the error gracefully.
3. Keep the fix minimal, maintainable, and backward-compatible with existing tests.`;

  return prompt;
}

// CLI Execution Support
if (
  process.argv[1] &&
  (process.argv[1].endsWith("prompt-fix.mjs") || process.argv[1].endsWith("prompt-fix"))
) {
  const args = process.argv.slice(2);
  let errorText = "";
  let servicePath = null;
  let filePath = null;
  let outPath = null;
  let fromClipboard = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--error" && args[i + 1]) {
      errorText = args[++i];
    } else if (args[i].startsWith("--error=")) {
      errorText = args[i].replace("--error=", "");
    } else if (args[i] === "--file" && args[i + 1]) {
      filePath = args[++i];
    } else if (args[i].startsWith("--file=")) {
      filePath = args[i].replace("--file=", "");
    } else if (args[i] === "--service" && args[i + 1]) {
      servicePath = args[++i];
    } else if (args[i].startsWith("--service=")) {
      servicePath = args[i].replace("--service=", "");
    } else if (args[i] === "--out" && args[i + 1]) {
      outPath = args[++i];
    } else if (args[i].startsWith("--out=")) {
      outPath = args[i].replace("--out=", "");
    } else if (args[i] === "--clipboard") {
      fromClipboard = true;
    }
  }

  // Check stdin if piped
  if (!errorText && !filePath && !process.stdin.isTTY) {
    try {
      errorText = fs.readFileSync(0, "utf8");
    } catch (_) {}
  }

  // Check file if specified
  if (!errorText && filePath) {
    if (fs.existsSync(filePath)) {
      errorText = fs.readFileSync(filePath, "utf8");
    } else {
      console.error(`Error: File not found at ${filePath}`);
      process.exit(1);
    }
  }

  // Fallback to clipboard if requested or if no error argument provided
  if (!errorText) {
    const clip = readClipboardText();
    if (clip && (clip.includes("ERR_") || clip.includes("FAILED") || clip.includes("Error:") || clip.includes("stack"))) {
      errorText = clip;
      fromClipboard = true;
      console.log("✔ Detected diagnostic payload from system clipboard.");
    }
  }

  if (!errorText) {
    console.log("================================================================================");
    console.log("InDesign Automation Framework - Self-Healing Prompt Generator");
    console.log("================================================================================");
    console.log("Usage:");
    console.log("  npm run prompt:fix -- --error=\"<diagnostic-json-or-stack>\"");
    console.log("  npm run prompt:fix -- --file=error.log");
    console.log("  npm run prompt:fix -- --clipboard");
    console.log("  cat error.log | npm run prompt:fix");
    console.log("\nTip: If you copy an InDesign error diagnostic dialog, running `npm run prompt:fix`");
    console.log("automatically picks up the clipboard contents and generates the repair prompt!\n");
    process.exit(1);
  }

  try {
    const prompt = generateFixPrompt({
      errorInput: errorText,
      servicePath
    });

    const copied = writeClipboardText(prompt);

    if (outPath) {
      fs.writeFileSync(path.resolve(outPath), prompt, "utf8");
      console.log(`✔ Self-healing prompt written to: ${outPath}`);
    }

    if (copied) {
      console.log("✔ Self-healing prompt copied to system clipboard! Paste directly into your AI assistant with Ctrl+V / Cmd+V.");
    } else {
      console.log("\n--- GENERATED REPAIR PROMPT ---\n");
      console.log(prompt);
      console.log("\n--- END REPAIR PROMPT ---\n");
    }

    console.log(`Prompt size: ~${Math.round(prompt.length / 4)} tokens (${prompt.length} characters)`);
  } catch (err) {
    console.error(`Error generating fix prompt: ${err.message}`);
    process.exit(1);
  }
}
