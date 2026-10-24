# InDesign UXP AI Assistant Development Rules & Guidelines

This repository is a production-grade, packagable automation framework and AI-assisted development toolkit for Adobe InDesign UXP (v18+).

---

## 1. Environment & Architecture Invariants

- **Runtime Target**: InDesign UXP (v18+). Uses modern JavaScript/TypeScript (ES2020), bundled to CommonJS for script execution (`.idjs`) and UXP plugins.
- **NOT ExtendScript**: Never use legacy ExtendScript APIs (`Folder`, `File`, `$.writeln`, `alert()`, `app.doScript(..., ScriptLanguage.JAVASCRIPT)`).
- **NOT Web DOM**: Never use browser globals (`window`, `document`).
- **Base Class**: ALL domain automation features MUST extend `BaseService<TOptions, TReport>`. Never create freestanding unmanaged scripts.
- **Transactions**: `process()` MUST be strictly synchronous. Never use `async/await` or return Promises inside transaction boundaries.
- **Units & Rulers**: Units are automatically normalized to `POINTS` and ruler origin to `PAGE_ORIGIN` by `BaseService`. Original document units are guaranteed to restore upon completion.
- **DOM Mutation & Text Replacement**: Snapshot live collections using `.everyItem().getElements()`. Always iterate backwards (`for (let i = items.length - 1; i >= 0; i--)`) when mutating or deleting items, and when replacing text ranges or GREP matches to prevent character offset drift.
- **Failure Policy Execution**: When implementing Permissive failure ([B]), wrap per-element logic in a `try/catch` within the service loop, recording skipped items to the report. When implementing Strict failure ([A]), re-throw unhandled errors so `runInTransaction` triggers an atomic `UndoModes.ENTIRE_SCRIPT` host rollback.
- **Element Guard**: ALWAYS verify `isElementEditable(item)` before modifying geometric bounds, contents, or styles.
- **Text Layout**: ALWAYS call `doc.recompose()` before reading `.overflows`, `.lines`, or geometry.
- **Selection**: ALWAYS pass raw selections through `SelectionResolver.resolve()` or `SelectionResolver.resolveAll()`.
- **Creation**: Use `DomResolver.getOrCreateColor`, `DomResolver.getOrCreateLayer`, and `DomResolver.getParagraphStyleSafely` (never blind `.add()`).
- **Search**: Wrap GREP and Text queries inside `withFindChangeScope()`.
- **Paths**: Use `PathUtils` for all path manipulations (zero-dependency, safe in InDesign UXP).
- **Memory**: Never call unscoped `doc.allPageItems`. Iterate hierarchically by `Spread` or `Page`.
- **Dry-Run Simulation**: Support `dryRun?: boolean` in `BaseBatchOptions`. Check `if (!options.dryRun)` before applying DOM mutations so services can perform non-destructive layout simulations and dry runs.
- **Pipeline Composability**: Chain sequential multi-service operations using `PipelineService` to maintain a single atomic transaction and unified progress reporting.
- **Clipboard Notice & Usability**: NEVER write to or overwrite the system clipboard silently. Always provide prominent, unmistakable notice (`[Notice] ...`) in the terminal or host dialog explaining what was copied and why. Respect `autoCopyDiagnostics: false` in `BaseBatchOptions`.
- **Error Diagnostics & Self-Healing**: On execution failure, `BaseService` serializes a structured diagnostic payload to the system clipboard with explicit notice. Run `npm run prompt:fix` or `npm run test:fix` for instant self-healing AI repair prompts.

---

## 2. Mandatory Intake Questionnaire & Presets (Rule Zero)

If a user request lacks scope, override policy, geometry units, or failure policy, clarify the 4 points before generating code, or allow invocation via standard presets:

### Standard Presets (Quick Prompting)
- **Default Safe Preset** (`default preset`): `1C, 2A, 3D, 4B` (Active Spread, Preserve Overrides, No Geometry, Permissive)
- **Page Strict Preset** (`page strict`): `1B, 2A, 3D, 4A` (Active Page, Preserve Overrides, No Geometry, Strict Abort)
- **Doc Hygiene Preset** (`doc hygiene`): `1D, 2B, 3D, 4B` (Entire Document, Clear Overrides, No Geometry, Permissive)

### 4-Point Intake Questionnaire
1. **Scope**: [A] Selection [B] Active Page [C] Active Spread [D] Entire Document
2. **Overrides**: [A] Preserve all [B] Clear all [C] Isolate character styles, clear para [D] N/A
3. **Geometry**: [A] Relative delta in Points [B] Absolute Points [y1,x1,y2,x2] [C] Snap to margins [D] N/A
4. **Failure**: [A] Strict Abort (revert transaction) [B] Permissive (skip & report)

---

## 3. Toolkit Commands & Developer Workflow

| Command | Description |
|---|---|
| `npm run prompt:new` | Interactive CLI wizard for 4-point intake, presets, and token-capped prompt assembly |
| `npm run prompt:fix` | Assembles a self-healing AI prompt from clipboard error diagnostics, logs, or stack traces |
| `npm run test:fix` | Runs test suite and automatically generates an AI repair prompt on any failure with notice |
| `npm run lint:invariants` | Static AST scanner that validates code against InDesign UXP invariants and banned APIs |
| `npm run dev` | Continuous Rollup watch mode that auto-rebuilds scripts to the linked Scripts Panel |
| `npm run scaffold <Name> [-- --type=layout\|text\|hygiene]` | Generates a new service extending `BaseService` and its companion unit test |
| `npm run link:host` | Discovers installed InDesign versions and creates zero-privilege NTFS directory junctions in the Scripts Panel |
| `npm run type-check` | Runs `tsc --noEmit` across all source and test files |
| `npm run test:unit` | Runs the full Vitest suite with offline InDesign mock DOM |
| `npm run build` | Compiles `.idjs` script, UXP plugin, and library distributions |
| `npm run validate` | Runs invariant lint, type-check, tests, and build in sequence (pre-commit gate) |
| `npm run prompt:pack` | Packs rules, types, and task into a token-capped prompt for LLMs |
| `npm run roadblocks` | Analyzes local failure telemetry to identify recurring roadblocks and friction points |
| `npm run context:extract` | Extracts TypeScript AST interface signatures without token bloat |

---

## 4. Banned APIs (Strict Blacklist)

Do not generate code containing any of the following:
- `Folder`
- `File`
- `$.writeln`
- `app.doScript(..., JAVASCRIPT)`
- `alert()`
- `window`
- `document`
- `itemByName(...)` without checking `.isValid`
- `doc.allPageItems`
