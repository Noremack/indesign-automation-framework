#!/usr/bin/env node
import fs from "fs";
import path from "path";

const args = process.argv.slice(2);
let nameArg = "";
let typeArg = "layout"; // default: layout

for (const arg of args) {
  if (arg.startsWith("--type=")) {
    typeArg = arg.replace("--type=", "").toLowerCase();
  } else if (!arg.startsWith("--")) {
    nameArg = arg;
  }
}

if (!nameArg) {
  console.log("Usage: npm run scaffold <ServiceName> [-- --type=layout|text|hygiene]");
  console.log("Examples:");
  console.log("  npm run scaffold FrameAligner -- --type=layout");
  console.log("  npm run scaffold ClearOverrides -- --type=text");
  console.log("  npm run scaffold SwatchPurger -- --type=hygiene");
  process.exit(1);
}

// Convert input to PascalCase and kebab-case
const cleanName = nameArg.replace(/[^a-zA-Z0-9]/g, "");
const pascalName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
const kebabName = cleanName
  .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
  .toLowerCase();

const serviceDir = path.resolve("src/services");
const testDir = path.resolve("tests");

if (!fs.existsSync(serviceDir)) {
  fs.mkdirSync(serviceDir, { recursive: true });
}
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

const serviceFile = path.join(serviceDir, `${kebabName}.ts`);
const testFile = path.join(testDir, `${kebabName}.test.ts`);

let serviceTemplate = "";
let testTemplate = "";

if (typeArg === "text") {
  serviceTemplate = `import { BaseService } from "../core/base-service";
import { BaseBatchOptions } from "../core/types";
import { withFindChangeScope } from "../core/find-change-scope";
import { isElementEditable } from "../core/app-state";

export interface ${pascalName}Options extends BaseBatchOptions {
  searchPattern?: string;
  replacePattern?: string;
}

export interface ${pascalName}Report {
  storiesScanned: number;
  replacementsMade: number;
  skippedCount: number;
  details: string[];
}

export class ${pascalName}Service extends BaseService<${pascalName}Options, ${pascalName}Report> {
  protected readonly actionName = "${pascalName} Text Automation";

  protected process(doc: any, options: ${pascalName}Options): ${pascalName}Report {
    const report: ${pascalName}Report = {
      storiesScanned: 0,
      replacementsMade: 0,
      skippedCount: 0,
      details: []
    };

    doc.recompose();

    const stories = doc.stories ? doc.stories.everyItem().getElements() : [];
    const totalStories = stories.length;

    // Wrap in withFindChangeScope to ensure preferences are cleanly restored
    withFindChangeScope("GREP", () => {
      for (let s = 0; s < totalStories; s++) {
        const story = stories[s];
        this.reportProgress(options, "Scanning stories", s + 1, totalStories);

        try {
          if (!isElementEditable(story)) {
            report.skippedCount++;
            continue;
          }

          report.storiesScanned++;

          // Invariant: Always loop backwards over text matches to prevent offset drift
          const paragraphs = story.paragraphs ? story.paragraphs.everyItem().getElements() : [];
          for (let p = paragraphs.length - 1; p >= 0; p--) {
            const para = paragraphs[p];
            if (!isElementEditable(para)) continue;

            // Example text mutation (respecting dryRun)
            if (!options.dryRun) {
              // Apply domain text mutation here
            }
            report.replacementsMade++;
          }
        } catch (storyErr: any) {
          if (options.failurePolicy === "strict") {
            throw storyErr;
          }
          report.skippedCount++;
          report.details.push(\`Story \${story?.id || s} skipped: \${storyErr.message}\`);
        }
      }
    });

    doc.recompose();
    return report;
  }
}
`;

  testTemplate = `import { describe, it, expect } from "vitest";
import { MockDocument, MockTextFrame } from "./mocks/indesign-mock";
import { ${pascalName}Service } from "../src/services/${kebabName}";

describe("${pascalName}Service (Text Archetype)", () => {
  it("processes document stories and respects dryRun", () => {
    const service = new ${pascalName}Service();
    const doc = new MockDocument();

    const frame = new MockTextFrame();
    const story = frame.parentStory;
    doc.stories = {
      everyItem: () => ({ getElements: () => [story] })
    } as any;

    const result = service.execute(doc, { dryRun: true });
    expect(result.success).toBe(true);
    expect(result.data?.storiesScanned).toBe(1);
  });
});
`;
} else if (typeArg === "hygiene") {
  serviceTemplate = `import { BaseService } from "../core/base-service";
import { BaseBatchOptions } from "../core/types";

export interface ${pascalName}Options extends BaseBatchOptions {
  purgeUnused?: boolean;
}

export interface ${pascalName}Report {
  colorsInspected: number;
  layersInspected: number;
  purgedCount: number;
  skippedCount: number;
  details: string[];
}

export class ${pascalName}Service extends BaseService<${pascalName}Options, ${pascalName}Report> {
  protected readonly actionName = "${pascalName} Document Hygiene";

  protected process(doc: any, options: ${pascalName}Options): ${pascalName}Report {
    const report: ${pascalName}Report = {
      colorsInspected: 0,
      layersInspected: 0,
      purgedCount: 0,
      skippedCount: 0,
      details: []
    };

    // 1. Inspect colors/swatches backwards
    const colors = doc.colors ? doc.colors.everyItem().getElements() : [];
    for (let c = colors.length - 1; c >= 0; c--) {
      const color = colors[c];
      report.colorsInspected++;

      try {
        // Protect system swatches ('None', 'Black', 'Registration', 'Paper')
        const reservedNames = new Set(["None", "Black", "Registration", "Paper"]);
        if (reservedNames.has(color.name)) continue;

        if (options.purgeUnused && !options.dryRun) {
          // Perform purge action
          report.purgedCount++;
        }
      } catch (err: any) {
        if (options.failurePolicy === "strict") throw err;
        report.skippedCount++;
        report.details.push(\`Color \${color?.name} skipped: \${err.message}\`);
      }
    }

    return report;
  }
}
`;

  testTemplate = `import { describe, it, expect } from "vitest";
import { MockDocument, MockColor } from "./mocks/indesign-mock";
import { ${pascalName}Service } from "../src/services/${kebabName}";

describe("${pascalName}Service (Hygiene Archetype)", () => {
  it("scans and purges document assets respecting system reserves", () => {
    const service = new ${pascalName}Service();
    const doc = new MockDocument();
    doc.colors.add(new MockColor({ name: "UnusedSwatch" }));

    const result = service.execute(doc, { purgeUnused: true, dryRun: false });
    expect(result.success).toBe(true);
    expect(result.data?.colorsInspected).toBeGreaterThan(0);
  });
});
`;
} else {
  // Default: layout archetype
  serviceTemplate = `import { BaseService } from "../core/base-service";
import { BaseBatchOptions } from "../core/types";
import { isElementEditable } from "../core/app-state";

export interface ${pascalName}Options extends BaseBatchOptions {
  snapToMargins?: boolean;
}

export interface ${pascalName}Report {
  processedCount: number;
  skippedCount: number;
  details: string[];
}

export class ${pascalName}Service extends BaseService<${pascalName}Options, ${pascalName}Report> {
  protected readonly actionName = "${pascalName} Layout Automation";

  protected process(doc: any, options: ${pascalName}Options): ${pascalName}Report {
    const report: ${pascalName}Report = {
      processedCount: 0,
      skippedCount: 0,
      details: []
    };

    // Always recompose prior to layout inspections
    doc.recompose();

    // Iterate pages or spreads hierarchically (avoid doc.allPageItems)
    const pages = doc.pages ? doc.pages.everyItem().getElements() : [];
    const total = pages.length;

    for (let p = 0; p < total; p++) {
      const page = pages[p];
      this.reportProgress(options, "Processing pages", p + 1, total);

      // Snapshot items and loop backwards if mutating
      const items = page.pageItems ? page.pageItems.everyItem().getElements() : [];
      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];

        try {
          if (!isElementEditable(item)) {
            report.skippedCount++;
            continue;
          }

          // Domain layout transformation (respecting dryRun)
          if (!options.dryRun) {
            // Apply bounds/geometry adjustment
          }

          report.processedCount++;
        } catch (itemErr: any) {
          if (options.failurePolicy === "strict") {
            // Strict policy: Re-throw to trigger atomic UndoModes.ENTIRE_SCRIPT rollback
            throw itemErr;
          }
          // Permissive policy: Report item failure and continue batch
          report.skippedCount++;
          report.details.push(\`Item \${item?.id || i} skipped: \${itemErr.message}\`);
        }
      }
    }

    doc.recompose();
    return report;
  }
}
`;

  testTemplate = `import { describe, it, expect } from "vitest";
import { MockDocument, MockTextFrame } from "./mocks/indesign-mock";
import { ${pascalName}Service } from "../src/services/${kebabName}";

describe("${pascalName}Service (Layout Archetype)", () => {
  it("executes successfully against a mock document and respects dryRun", () => {
    const service = new ${pascalName}Service();
    const doc = new MockDocument();
    
    const page = doc.pages[0];
    page.pageItems = {
      everyItem: () => ({
        getElements: () => [new MockTextFrame({ name: "HeaderFrame" })]
      })
    };

    const progressReports: any[] = [];
    const result = service.execute(doc, {
      dryRun: true,
      onProgress: (p) => progressReports.push(p)
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.processedCount).toBe(1);
    expect(progressReports.length).toBeGreaterThan(0);
  });
});
`;
}

if (fs.existsSync(serviceFile)) {
  console.error(`Error: Service file already exists at ${serviceFile}`);
  process.exit(1);
}

fs.writeFileSync(serviceFile, serviceTemplate, "utf8");
console.log(`+ Created service (${typeArg}): ${path.relative(process.cwd(), serviceFile)}`);

if (!fs.existsSync(testFile)) {
  fs.writeFileSync(testFile, testTemplate, "utf8");
  console.log(`+ Created test:              ${path.relative(process.cwd(), testFile)}`);
}

console.log(`\nService scaffolded successfully [archetype: ${typeArg}]!`);
console.log(`To verify:`);
console.log(`  npm run test:unit`);
