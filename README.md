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
- **AI-Assisted Development Tools**:
  - `tools/scaffold.mjs`: Instantly generate new domain services and unit tests.
  - `tools/pack-prompt.mjs`: Pack token-budgeted prompts containing rules, contracts, and task specifications.
  - `tools/extract-context.mjs`: Extract minimal TypeScript AST signatures to feed AI models without token bloat.
  - `tools/dom-inspect.idjs`: Crash-proof DOM selection property dumper to run inside InDesign.
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

Run the full pre-commit validation suite (type checking, offline unit tests, and Rollup builds):

```bash
npm run validate
```

### 3. Scaffold a New Service

Generate a new domain service with its companion unit test:

```bash
npm run scaffold MarginAdjuster
```

This creates:
- `src/services/margin-adjuster.ts` (Extends `BaseService`, implements `process()`)
- `tests/margin-adjuster.test.ts` (Vitest unit test with `MockDocument`)

Verify your new service:

```bash
npm run test:unit
```

---

## Toolkit Commands

| Command | Purpose |
|---|---|
| `npm run validate` | Runs `type-check`, `test:unit`, and `build` (pre-flight gate) |
| `npm run type-check` | Runs `tsc --noEmit` across source and test files |
| `npm run test:unit` | Executes all Vitest unit tests |
| `npm run test:watch` | Runs unit tests in watch mode |
| `npm run build` | Compiles script (`.idjs`), plugin, and library distributions |
| `npm run build:script` | Builds `dist/scripts/InDesignAutomation.idjs` |
| `npm run build:plugin` | Builds `dist/plugins/InDesignAutomation/index.js` |
| `npm run build:lib` | Builds `dist/index.js` and `dist/index.cjs` |
| `npm run scaffold <Name>` | Scaffolds a new domain service and test suite |
| `npm run prompt:pack` | Packs rules and contracts into a token-capped prompt for LLMs |
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
