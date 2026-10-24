# InDesign Automation Framework & AI Toolkit

> Production-grade, decoupled InDesign UXP automation framework and AI-assisted development toolkit.

[![Validate](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![Vitest](https://img.shields.io/badge/tested_with-Vitest-yellow.svg)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-ES2020-blue.svg)]()

This toolkit provides the core architectural foundation, invariants, offline test mocks, and CLI tooling for building bulletproof Adobe InDesign UXP automation scripts (`.idjs`) and UXP plugins.

---

## Key Features

- **BaseService Invariants**: Guaranteed transactional rollback, automatic unit normalization (`POINTS`, `PAGE_ORIGIN`), host version preflight checks, and progress reporting callbacks.
- **Offline Mock Environment**: Complete InDesign DOM mock collection enabling 100% offline unit testing in Vitest and CI pipelines without requiring Adobe InDesign to be installed.
- **Pure Zero-Dependency PathUtils**: Safe path utilities designed specifically for UXP where Node's native `path` module is absent.
- **DOM & Selection Resolvers**: Robust resolvers handling text ranges, text frames, table cells, graphic items, and recursive style groups.
- **Find/Change Scoping**: Safe scoped GREP and Text searches with guaranteed preference cleanup in `finally`.
- **Pipeline Composability (`PipelineService`)**: Execute sequential multi-service operations in a single atomic transaction with aggregated progress and error reporting.
- **Anti-Drift Invariant Linter (`npm run lint:invariants`)**: Static AST rule checker preventing legacy ExtendScript (`Folder`, `File`, `$.writeln`) and forbidden APIs (`doc.allPageItems`) from reaching production.
- **Live InDesign Host Linking (`npm run link:host`)**: Auto-discovers installed InDesign versions (2023–2026+) and creates zero-privilege NTFS directory junctions directly into your InDesign Scripts Panel.
- **Continuous Watch Mode (`npm run dev`)**: Sub-second Rollup watch compilation directly into the linked InDesign Scripts Panel folder.
- **Service Archetypes (`npm run scaffold`)**: Scaffold specialized domain templates for Layout transformations, Text/GREP replacements, or Document Hygiene.
- **Non-Destructive Simulation (`dryRun`)**: First-class `dryRun` mode in `BaseBatchOptions` to preview mutations and report affected items without modifying documents.
- **Clipboard Notice & Usability**: Full transparency policy—never writes to system clipboard silently. All operations provide prominent notices (`[Notice] ...`) and respect `autoCopyDiagnostics: false`.
- **Interactive Intake Wizard (`npm run prompt:new`)**: Interactive CLI wizard for 4-point questionnaire intake, standard presets, and token-budgeted prompt assembly.
- **One-Command Test Failure Healing (`npm run test:fix`)**: Automatically runs tests, catches failures, extracts failing service AST context, and packs an AI repair prompt with notice.
- **AI-Assisted Development Tools**:
  - `tools/prompt-wizard.mjs`: Interactive prompt intake wizard with clipboard snapshot detection.
  - `tools/prompt-fix.mjs`: Turn clipboard error diagnostics into immediate self-healing AI repair prompts.
  - `tools/test-fix.mjs`: One-command test failure repair prompt generator.
  - `tools/lint-invariants.mjs`: Fast AST invariant and banned API static linter.
  - `tools/scaffold.mjs`: Instantly generate new domain services and unit tests with archetype support.
  - `tools/link-host.mjs`: Link built scripts directly to InDesign without elevated permissions.
  - `tools/pack-prompt.mjs`: Pack token-budgeted prompts containing rules, contracts, and task specifications.
  - `tools/extract-context.mjs`: Extract minimal TypeScript AST signatures to feed AI models without token bloat.
  - `tools/dom-inspect.idjs`: Crash-proof DOM selection property dumper to run inside InDesign with clipboard copy notice.
- **Packagable**: Can be used as a standalone project template or installed as an npm package dependency (`npm pack`).

---

## Quick Start

### 1. Installation

```bash
git clone https://github.com/Noremack/indesign-automation-framework.git
cd indesign-automation-framework
npm install
```

### 2. Validate Setup

Run the full pre-commit validation suite (invariant linter, type checking, offline unit tests, and Rollup builds):

```bash
npm run validate
```

### 3. Connect to InDesign Scripts Panel

Auto-link the build directory to all installed InDesign versions with a single command (requires zero administrator privileges):

```bash
npm run link:host
```

Any build generated via `npm run build` or `npm run dev` will now instantly appear in InDesign's **Scripts Panel** under the `InDesignAutomation` folder.

### 4. Continuous Live Watch Mode

Start the live watcher to automatically recompile `.idjs` scripts upon code save:

```bash
npm run dev
```

### 5. Scaffold a New Service

Scaffold a domain service and its companion unit test using one of three archetypes:

```bash
# Layout archetype (default): geometric bounds, margin snapping, page items
npm run scaffold MarginAdjuster -- --type=layout

# Text archetype: story scanning, reverse GREP replacement, style override isolation
npm run scaffold ClearOverrides -- --type=text

# Document hygiene archetype: swatch cleanup, layer purging, system reserve protection
npm run scaffold SwatchPurger -- --type=hygiene
```

Verify your new service offline:

```bash
npm run test:unit
```

---

## Toolkit Commands

| Command | Purpose |
|---|---|
| `npm run prompt:new` | Interactive CLI wizard for 4-point intake, presets, and token-capped prompt assembly |
| `npm run prompt:fix` | Converts clipboard error diagnostics or logs into self-healing AI repair prompts |
| `npm run test:fix` | Runs test suite and automatically generates an AI repair prompt on any failure with notice |
| `npm run lint:invariants` | Static AST scanner that validates code against InDesign UXP invariants and banned APIs |
| `npm run dev` | Continuous Rollup watch mode that auto-rebuilds scripts to the linked Scripts Panel |
| `npm run validate` | Runs invariant lint, type-check, tests, and build in sequence (pre-flight gate) |
| `npm run type-check` | Runs `tsc --noEmit` across source and test files |
| `npm run test:unit` | Executes all Vitest unit tests offline |
| `npm run test:watch` | Runs unit tests in watch mode |
| `npm run build` | Compiles script (`.idjs`), plugin, and library distributions |
| `npm run build:script` | Builds `dist/scripts/InDesignAutomation.idjs` |
| `npm run build:plugin` | Builds `dist/plugins/InDesignAutomation/index.js` |
| `npm run build:lib` | Builds `dist/index.js` and `dist/index.cjs` |
| `npm run link:host` | Discovers installed InDesign versions and creates zero-privilege NTFS junctions in Scripts Panel |
| `npm run scaffold <Name>` | Scaffolds a new domain service and test suite (`--type=layout\|text\|hygiene`) |
| `npm run prompt:pack` | Packs rules, types, and task into a token-capped prompt for LLMs |
| `npm run context:extract` | Extracts concise AST signatures from a TypeScript file |

---

## Core Invariants

1. **Transactional Execution**: Domain logic resides in `process(doc, options)` and is executed synchronously via `app.doScript` with `UndoModes.ENTIRE_SCRIPT`. If an error occurs, mutations are rolled back atomically.
2. **Unit Normalization**: `withNormalizedUnits` locks horizontal/vertical measurement units to `POINTS`, ruler origin to `PAGE_ORIGIN`, and zero point to `[0, 0]`. Prior preferences are guaranteed to restore upon exit.
3. **Element Guard**: Always check `isElementEditable(item)` before mutating geometry, text contents, or styles. Handles text ranges, stories, locked layers, and nested groups.
4. **Text Layout Pre-check**: Always call `doc.recompose()` prior to checking `.overflows` or lines.
5. **Selection Resolver**: Always normalize selection objects through `SelectionResolver.resolve()` or `SelectionResolver.resolveAll()`.
6. **Reverse Iteration**: When mutating, deleting, or moving DOM items, loop backwards over the elements snapshot:
   ```typescript
   const items = page.pageItems.everyItem().getElements();
   for (let i = items.length - 1; i >= 0; i--) {
     const item = items[i];
     if (!isElementEditable(item)) continue;
     // mutate item
   }
   ```

---

## Best Practice Antigravity / AI Prompt Structure

LLMs suffer from legacy bias toward deprecated ExtendScript (ES3, 1999–2020) APIs (`Folder`, `File`, `$.writeln`, synchronous `ScriptUI`, `app.doScript(..., ScriptLanguage.JAVASCRIPT)`). To ensure generated code strictly complies with modern InDesign UXP (v18+) and this framework, always structure your prompts using the **4-Block Anti-Drift Envelope**.

### The 4-Block Prompt Architecture

```text
[RULES]
// Content from antigravity.rules.json or AI_MANIFESTO.json
- Target: InDesign UXP (v18+) with TypeScript (ES2020).
- Invariant: Extend BaseService<TOptions, TReport>.
- Transaction: Purely synchronous inside process(); never use async/await.
- Units: Locked to POINTS and PAGE_ORIGIN via BaseService.
- Guards: Always verify isElementEditable(item).
- Banned: Folder, File, $.writeln, alert(), window, document, doc.allPageItems.

[CONTRACTS]
// Extracted interface signatures (run: npm run context:extract)
export interface BaseBatchOptions {
  onProgress?: ProgressCallback;
  failurePolicy?: "strict" | "permissive";
  scope?: "selection" | "page" | "spread" | "document";
}
export interface ServiceResult<T> { success: boolean; data?: T; error?: FrameworkError; }

[DOM_SNAPSHOT] (Optional — required only when Scope = Active Selection)
// Output generated by running tools/dom-inspect.idjs in InDesign
{
  "constructorName": "TextFrame",
  "id": 842,
  "geometricBounds": [72, 72, 288, 504],
  "properties": { "contents": "Chapter 1", "pointSize": "14" }
}

[TASK]
// Your specific requirement answered against the 4-Point Intake Questionnaire:
1. Target Scope: [B] Current Active Page
2. Style Overrides: [C] Isolate character styles, clear paragraph overrides
3. Geometry: [D] Not applicable
4. Failure Policy: [B] Permissive (skip locked items and report)

Task: Implement a service that identifies all single-line headline text frames, clears paragraph overrides while preserving character italics, and reports processed count.
```

---

### The Mandatory 4-Point Intake Questionnaire & Presets (Rule Zero)

Whenever prompting an AI model for new services or modifying existing logic, you can specify individual parameters or simply invoke a **Standard Preset** to eliminate prompt friction:

#### Standard Presets (Fast Prompting)
* **Default Safe Preset** (`default preset`): `1C, 2A, 3D, 4B` — Active Spread, Preserve Overrides, No Geometry, Permissive Failure.
* **Page Strict Preset** (`page strict`): `1B, 2A, 3D, 4A` — Active Page, Preserve Overrides, No Geometry, Strict Abort.
* **Doc Hygiene Preset** (`doc hygiene`): `1D, 2B, 3D, 4B` — Entire Document, Clear Overrides, No Geometry, Permissive Failure.

#### 4-Point Questionnaire Breakdown
1. **Target Scope**:
   * `[A]` Active Selection *(Attach `dom-inspect.idjs` JSON snapshot)*
   * `[B]` Current Active Page
   * `[C]` Current Active Spread
   * `[D]` Entire Document *(Processed hierarchically spread-by-spread for memory safety)*
2. **Typographic & Style Override Policy**:
   * `[A]` Preserve all local character and paragraph overrides
   * `[B]` Clear all local overrides (Reset to applied style)
   * `[C]` Isolate character styles, reset paragraph overrides only
   * `[D]` Not applicable (No text manipulation)
3. **Geometric Normalization**:
   * `[A]` Relative delta in Points (e.g., `+12 pt` horizontal shift)
   * `[B]` Absolute dimensions in Points `[y1, x1, y2, x2]`
   * `[C]` Snap to active page margins
   * `[D]` Not applicable (No layout changes)
4. **Failure & Transaction Boundary**:
   * `[A]` Strict: Abort entire transaction and roll back if any single element fails
   * `[B]` Permissive: Skip locked or uneditable elements, record in `ServiceResult`, and continue

---

### Automated Prompt Assembly via CLI

You can automatically generate token-capped, compliant prompts using the built-in packer:

```bash
# Basic prompt with rules and types bundled automatically
npm run prompt:pack -- "Adjust margins of all text frames on active spread"

# Include a live InDesign selection snapshot
npm run prompt:pack -- --snapshot selection.json "Format selected callout boxes"

# Save directly to a file for prompt libraries or batch pipelines
npm run prompt:pack -- --out prompt.txt "Clean up unused swatches and empty layers"
```

---

### Automated Self-Healing AI Prompts (`npm run prompt:fix`)

When an execution error occurs in InDesign or a test fails, `BaseService` automatically serializes the full error diagnostic (code, domain, message, target element, and stack trace) to the system clipboard and alerts the user.

To immediately repair the service without manual prompt crafting:

```bash
# 1. Simply run prompt:fix — it auto-detects clipboard diagnostics!
npm run prompt:fix

# 2. Or pass an error string or log file directly:
npm run prompt:fix -- --error="ERR_ELEMENT_NOT_EDITABLE: Item 42 is locked"
npm run prompt:fix -- --file=test-failure.log

# 3. Or pipe from standard input:
cat test-failure.log | npm run prompt:fix
```

The tool:
1. Extracts the exact error payload.
2. Identifies the failing service in `src/services/` and extracts its TypeScript AST signatures.
3. Bundles framework rules and contracts.
4. Auto-copies the packed repair prompt back to your clipboard ready to paste (`Ctrl+V` / `Cmd+V`) into your AI assistant.

---

### Non-Destructive Dry-Run Simulation

All services extending `BaseService` support `dryRun?: boolean` in `BaseBatchOptions`. When `dryRun: true`:
- The service executes inside `runInTransaction` labeled with `(Dry Run)`.
- DOM mutations are bypassed (`if (!options.dryRun)`).
- Complete element counts, inspections, and report metrics are generated without altering the active document.
- InDesign displays a non-destructive confirmation: `Simulation completed successfully (no changes applied).`

Example:
```typescript
const result = service.execute(doc, {
  dryRun: true,
  notifyOnCompletion: true
});
```

### Pipeline Composability (`PipelineService`)

Chain sequential multi-service operations in an atomic transaction:

```typescript
import { PipelineService } from "indesign-automation-framework";
import { SwatchPurgerService } from "./services/swatch-purger";
import { ClearOverridesService } from "./services/clear-overrides";
import { MarginAdjusterService } from "./services/margin-adjuster";

const pipeline = new PipelineService([
  new SwatchPurgerService(),
  new ClearOverridesService(),
  new MarginAdjusterService()
], "Catalog Production Pipeline");

const result = pipeline.execute(doc, {
  failurePolicy: "strict",
  notifyOnCompletion: true
});

console.log(`Executed ${result.data?.stepsSucceeded} of ${result.data?.totalSteps} steps.`);
```

---

### Clipboard Usability & Transparency Policy

Silent clipboard modification creates severe friction and data loss for developers. This framework enforces strict clipboard visibility:
- **Never Silent**: Whenever an automated command writes to the clipboard, it logs a prominent terminal notice: `📋 [Notice] ...`.
- **InDesign Host Notices**: Host error alerts clearly declare: `[Notice] A diagnostic report was copied to your clipboard.`
- **Configurable Opt-Out**: Set `{ autoCopyDiagnostics: false }` in `BaseBatchOptions` to prevent automated clipboard writes entirely.

---

## Packaging as a Base Toolkit

To package this framework for distribution:

```bash
npm pack
```

Produces `indesign-automation-framework-1.0.0.tgz`, which can be installed in other projects:

```bash
npm install /path/to/indesign-automation-framework-1.0.0.tgz
```

Consumers can import the framework classes directly:

```typescript
import { BaseService, DomResolver, SelectionResolver, runInTransaction } from "indesign-automation-framework";
```

Or for offline testing:

```typescript
import { MockDocument, mockApp } from "indesign-automation-framework/mock";
```

---

## License

MIT
