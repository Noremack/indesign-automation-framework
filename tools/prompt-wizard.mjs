#!/usr/bin/env node
import readline from "readline";
import { packPrompt } from "./pack-prompt.mjs";
import { readClipboardText, writeClipboardText } from "./prompt-fix.mjs";

const PRESETS = {
  "1": {
    name: "Default Safe Preset",
    code: "1C, 2A, 3D, 4B (Active Spread, Preserve Overrides, No Geometry, Permissive)",
    scope: "Active Spread",
    overrides: "Preserve all",
    geometry: "N/A",
    failure: "Permissive"
  },
  "2": {
    name: "Page Strict Preset",
    code: "1B, 2A, 3D, 4A (Active Page, Preserve Overrides, No Geometry, Strict Abort)",
    scope: "Active Page",
    overrides: "Preserve all",
    geometry: "N/A",
    failure: "Strict Abort"
  },
  "3": {
    name: "Doc Hygiene Preset",
    code: "1D, 2B, 3D, 4B (Entire Document, Clear Overrides, No Geometry, Permissive)",
    scope: "Entire Document",
    overrides: "Clear all",
    geometry: "N/A",
    failure: "Permissive"
  }
};

function askQuestion(rl, query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

/**
 * @param {{ presetChoice?: string; task?: string } | null} [injectedAnswers]
 */
export async function runPromptWizard(injectedAnswers = null) {
  console.log("================================================================================");
  console.log("InDesign Automation Framework - Interactive Prompt Intake Wizard");
  console.log("================================================================================");

  let presetChoice = "";
  let scope = "";
  let overrides = "";
  let geometry = "";
  let failure = "";
  let task = "";

  if (injectedAnswers) {
    presetChoice = injectedAnswers.presetChoice || "1";
    task = injectedAnswers.task || "Automation task";
  } else {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    try {
      console.log("\nSelect standard preset (Rule Zero):");
      console.log("  [1] Default Safe  - Active Spread, Preserve Overrides, Permissive (Recommended)");
      console.log("  [2] Page Strict   - Active Page, Preserve Overrides, Strict Abort");
      console.log("  [3] Doc Hygiene   - Entire Document, Clear Overrides, Permissive");
      console.log("  [4] Custom Intake - Specify all 4 parameters individually\n");

      presetChoice = (await askQuestion(rl, "Choose option [1-4] (default: 1): ")).trim() || "1";

      if (presetChoice === "4") {
        console.log("\n--- Custom 4-Point Intake ---");
        scope = (await askQuestion(rl, "1. Scope ([A] Selection, [B] Page, [C] Spread, [D] Document): ")).trim().toUpperCase() || "C";
        overrides = (await askQuestion(rl, "2. Overrides ([A] Preserve, [B] Clear all, [C] Clear para only, [D] N/A): ")).trim().toUpperCase() || "A";
        geometry = (await askQuestion(rl, "3. Geometry ([A] Delta pts, [B] Absolute pts, [C] Margins, [D] N/A): ")).trim().toUpperCase() || "D";
        failure = (await askQuestion(rl, "4. Failure Policy ([A] Strict Abort, [B] Permissive): ")).trim().toUpperCase() || "B";
      }

      task = (await askQuestion(rl, "\nDescribe the domain automation task: ")).trim();
      if (!task) {
        task = "Implement domain service adhering to framework invariants.";
      }
    } finally {
      rl.close();
    }
  }

  let intakeSummary = "";
  if (presetChoice in PRESETS) {
    const p = PRESETS[presetChoice];
    intakeSummary = `Preset: ${p.name} [${p.code}]`;
  } else {
    intakeSummary = `Scope: [${scope}], Overrides: [${overrides}], Geometry: [${geometry}], Failure: [${failure}]`;
  }

  // Check if clipboard contains a selection snapshot from dom-inspect.idjs
  let snapshot = null;
  const clip = readClipboardText();
  if (clip && clip.includes("constructorName") && (clip.includes("TextFrame") || clip.includes("PageItem") || clip.includes("geometricBounds"))) {
    snapshot = clip;
    console.log("✔ [Notice] Active DOM selection snapshot detected on clipboard and included in prompt!");
  }

  const taskDescriptionWithIntake = `[INTAKE SPECIFICATION]
${intakeSummary}

[TASK DESCRIPTION]
${task}`;

  const prompt = packPrompt({
    taskDescription: taskDescriptionWithIntake
  });

  const copied = writeClipboardText(prompt);

  console.log("\n================================================================================");
  console.log("📋 [NOTICE] Prompt Assembled & Copied to System Clipboard");
  console.log("================================================================================");
  if (copied) {
    console.log("✔ The prompt has been placed onto your system clipboard.");
    console.log("👉 Paste directly into your AI assistant with Ctrl+V / Cmd+V.");
  } else {
    console.log("--- GENERATED PROMPT ---");
    console.log(prompt);
  }
  console.log(`Summary: ${intakeSummary}`);
  console.log(`Prompt size: ~${Math.round(prompt.length / 4)} tokens (${prompt.length} chars)`);
  console.log("================================================================================\n");

  return { prompt, intakeSummary, copied };
}

// CLI Execution Support
if (
  process.argv[1] &&
  (process.argv[1].endsWith("prompt-wizard.mjs") || process.argv[1].endsWith("prompt-wizard"))
) {
  runPromptWizard().catch((err) => {
    console.error(`Wizard error: ${err.message}`);
    process.exit(1);
  });
}
