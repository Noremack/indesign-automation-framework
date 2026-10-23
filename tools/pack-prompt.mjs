import fs from "fs";
import path from "path";

const MAX_TOKENS = 1600;
const CHAR_LIMIT = MAX_TOKENS * 4;

export function packPrompt({
  rulesPath = "antigravity.rules.json",
  typesPath = "src/core/types.ts",
  taskDescription = "Implement InDesign domain service.",
  snapshotPath = null,
  maxTokens = MAX_TOKENS
} = {}) {
  const charLimit = maxTokens * 4;

  const resolvedRulesPath = path.resolve(rulesPath);
  const resolvedTypesPath = path.resolve(typesPath);

  if (!fs.existsSync(resolvedRulesPath)) {
    throw new Error(`Rules file not found at: ${resolvedRulesPath}`);
  }
  if (!fs.existsSync(resolvedTypesPath)) {
    throw new Error(`Types contract file not found at: ${resolvedTypesPath}`);
  }

  const rules = fs.readFileSync(resolvedRulesPath, "utf8").trim();
  const types = fs.readFileSync(resolvedTypesPath, "utf8").trim();

  let payload = `[RULES]\n${rules}\n\n[CONTRACTS]\n${types}`;

  if (snapshotPath) {
    const resolvedSnapshotPath = path.resolve(snapshotPath);
    if (fs.existsSync(resolvedSnapshotPath)) {
      const snapshot = fs.readFileSync(resolvedSnapshotPath, "utf8").trim();
      payload += `\n\n[DOM_SNAPSHOT]\n${snapshot}`;
    }
  }

  payload += `\n\n[TASK]\n${taskDescription}`;

  if (payload.length > charLimit) {
    throw new Error(
      `Token budget breached! Payload size (${payload.length} chars) exceeds ceiling (~${charLimit} chars for ${maxTokens} tokens).`
    );
  }

  return payload;
}

// CLI Execution Support
if (process.argv[1] && (process.argv[1].endsWith("pack-prompt.mjs") || process.argv[1].endsWith("pack-prompt"))) {
  const args = process.argv.slice(2);
  let task = "";
  let rules = "antigravity.rules.json";
  let types = "src/core/types.ts";
  let snapshot = null;
  let out = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--rules" && args[i + 1]) {
      rules = args[++i];
    } else if (args[i] === "--types" && args[i + 1]) {
      types = args[++i];
    } else if (args[i] === "--snapshot" && args[i + 1]) {
      snapshot = args[++i];
    } else if (args[i] === "--out" && args[i + 1]) {
      out = args[++i];
    } else if (!args[i].startsWith("--")) {
      task = args[i];
    }
  }

  if (!task) {
    task = "Implement domain service extending BaseService adhering to framework invariants.";
  }

  try {
    const packed = packPrompt({
      rulesPath: rules,
      typesPath: types,
      taskDescription: task,
      snapshotPath: snapshot
    });

    if (out) {
      fs.writeFileSync(path.resolve(out), packed, "utf8");
      console.log(`Packed prompt saved to: ${out} (~${Math.round(packed.length / 4)} tokens)`);
    } else {
      console.log(packed);
    }
  } catch (err) {
    console.error(`Error packing prompt: ${err.message}`);
    process.exit(1);
  }
}
