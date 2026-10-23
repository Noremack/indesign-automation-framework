#!/usr/bin/env node
import fs from "fs";
import path from "path";

const nameArg = process.argv[2];

if (!nameArg) {
  console.log("Usage: npm run scaffold <ServiceName>");
  console.log("Example: npm run scaffold TextFrameCleaner");
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

const serviceTemplate = `import { BaseService } from "../core/base-service";
import { BaseBatchOptions } from "../core/types";
import { isElementEditable } from "../core/app-state";

export interface ${pascalName}Options extends BaseBatchOptions {
  dryRun?: boolean;
}

export interface ${pascalName}Report {
  processedCount: number;
  skippedCount: number;
  details: string[];
}

export class ${pascalName}Service extends BaseService<${pascalName}Options, ${pascalName}Report> {
  protected readonly actionName = "${pascalName} Automation";

  protected process(doc: any, options: ${pascalName}Options): ${pascalName}Report {
    const report: ${pascalName}Report = {
      processedCount: 0,
      skippedCount: 0,
      details: []
    };

    // Always recompose prior to layout or text inspections
    doc.recompose();

    // Iterate pages or spreads (avoid doc.allPageItems)
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

          // Domain mutation logic goes here
          report.processedCount++;
        } catch (itemErr: any) {
          if (options.failurePolicy === "strict") {
            // Strict policy: Re-throw to trigger atomic UndoModes.ENTIRE_SCRIPT transaction rollback
            throw itemErr;
          }
          // Permissive policy: Report item failure and continue batch
          report.skippedCount++;
          report.details.push(`Item ${item?.id || i} skipped: ${itemErr.message}`);
        }
      }
    }

    return report;
  }
}
`;

const testTemplate = `import { describe, it, expect } from "vitest";
import { MockDocument, MockTextFrame } from "./mocks/indesign-mock";
import { ${pascalName}Service } from "../src/services/${kebabName}";

describe("${pascalName}Service", () => {
  it("executes successfully against a mock document", () => {
    const service = new ${pascalName}Service();
    const doc = new MockDocument();
    
    // Add a mock text frame to the page
    const page = doc.pages[0];
    page.pageItems = {
      everyItem: () => ({
        getElements: () => [new MockTextFrame({ name: "Header" })]
      })
    };

    const progressReports: any[] = [];
    const result = service.execute(doc, {
      onProgress: (p) => progressReports.push(p)
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.processedCount).toBe(1);
    expect(progressReports.length).toBeGreaterThan(0);
  });
});
`;

if (fs.existsSync(serviceFile)) {
  console.error(`Error: Service file already exists at ${serviceFile}`);
  process.exit(1);
}

fs.writeFileSync(serviceFile, serviceTemplate, "utf8");
console.log(`+ Created service: ${path.relative(process.cwd(), serviceFile)}`);

if (!fs.existsSync(testFile)) {
  fs.writeFileSync(testFile, testTemplate, "utf8");
  console.log(`+ Created test:    ${path.relative(process.cwd(), testFile)}`);
}

console.log(`\nService scaffolded successfully!`);
console.log(`To verify:`);
console.log(`  npm run test:unit`);
