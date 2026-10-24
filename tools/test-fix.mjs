#!/usr/bin/env node
import { spawnSync } from "child_process";
import { generateFixPrompt, writeClipboardText } from "./prompt-fix.mjs";

export function runTestsAndHeal() {
  console.log("Running offline unit tests (vitest)...");

  // Run vitest synchronously capturing output
  const testProc = spawnSync("npx", ["vitest", "run"], {
    shell: true,
    encoding: "utf8"
  });

  const fullOutput = (testProc.stdout || "") + "\n" + (testProc.stderr || "");

  if (testProc.status === 0) {
    console.log(testProc.stdout);
    console.log("✔ All unit tests passed! No repairs required.");
    return { success: true, healed: false };
  }

  console.error(testProc.stdout || "");
  console.error(testProc.stderr || "");

  console.log("\n⚡ Test failure detected! Generating self-healing repair prompt...");

  try {
    const prompt = generateFixPrompt({
      errorInput: fullOutput
    });

    const copied = writeClipboardText(prompt);

    console.log("\n================================================================================");
    console.log("📋 [NOTICE] Test Failure Detected & Self-Healing Prompt Assembled");
    console.log("================================================================================");
    if (copied) {
      console.log("✔ A repair prompt has been copied to your system clipboard!");
      console.log("👉 Paste directly into your AI assistant with Ctrl+V / Cmd+V for an instant fix.");
    } else {
      console.log("--- GENERATED REPAIR PROMPT ---\n");
      console.log(prompt);
      console.log("\n--- END REPAIR PROMPT ---");
    }
    console.log(`Payload size: ~${Math.round(prompt.length / 4)} tokens (${prompt.length} chars)`);
    console.log("================================================================================\n");

    return { success: false, healed: true, prompt };
  } catch (err) {
    console.error(`Failed to generate fix prompt: ${err.message}`);
    return { success: false, healed: false, error: err.message };
  }
}

// CLI Execution Support
if (
  process.argv[1] &&
  (process.argv[1].endsWith("test-fix.mjs") || process.argv[1].endsWith("test-fix"))
) {
  const result = runTestsAndHeal();
  process.exit(result.success ? 0 : 1);
}
