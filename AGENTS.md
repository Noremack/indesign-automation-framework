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

---

## 2. Mandatory Intake Questionnaire (Rule Zero)

If a user request lacks scope, override policy, geometry units, or failure policy, clarify the 4 points before generating code:
1. **Scope**: [A] Selection [B] Active Page [C] Active Spread [D] Entire Document
2. **Overrides**: [A] Preserve all [B] Clear all [C] Isolate character styles, clear para [D] N/A
3. **Geometry**: [A] Relative delta in Points [B] Absolute Points [y1,x1,y2,x2] [C] Snap to margins [D] N/A
4. **Failure**: [A] Strict Abort (revert transaction) [B] Permissive (skip & report)

---

## 3. Toolkit Commands & Developer Workflow

| Command | Description |
|---|---|
| `npm run scaffold <Name>` | Generates a new service extending `BaseService` and its companion unit test |
| `npm run type-check` | Runs `tsc --noEmit` across all source and test files |
| `npm run test:unit` | Runs the full Vitest suite with offline InDesign mock DOM |
| `npm run build` | Compiles `.idjs` script, UXP plugin, and library distributions |
| `npm run validate` | Runs type-check, tests, and build in sequence (pre-commit gate) |
| `npm run prompt:pack` | Packs rules, types, and task into a token-capped prompt for LLMs |
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
