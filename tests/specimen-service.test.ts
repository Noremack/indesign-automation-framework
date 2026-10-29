import { describe, it, expect, beforeEach } from "vitest";
import { MockDocument, MockApplication } from "./mocks/indesign-mock";
import { QgdsSpecimenService } from "../src/core/qgds-specimen-service";
import { QgdsBrandEngineService } from "../src/core/qgds-brand-engine";

describe("QgdsSpecimenService", () => {
  let doc: MockDocument;
  let service: QgdsSpecimenService;
  let brandEngine: QgdsBrandEngineService;

  beforeEach(() => {
    (global as any).app = new MockApplication();
    doc = new MockDocument();
    service = new QgdsSpecimenService();
    brandEngine = new QgdsBrandEngineService();

    // Populate styles and swatches for specimen formatting
    brandEngine.execute(doc, { theme: "Blue" });
  });

  it("injects a typography specimen text frame with correct bounds and properties", () => {
    const result = service.execute(doc, { pageIndex: 0 });
    expect(result.success).toBe(true);
    expect(result.data?.specimenFramesCreated).toBe(1);
    expect(result.data?.paragraphsFormatted).toBeGreaterThan(0);

    const frame = doc.pages[0].textFrames.itemByName("Typography Specimen");
    expect(frame.isValid).toBe(true);
    expect(frame.label).toBe("DynamicBrandSpecimen");
    expect(frame.geometricBounds[2]).toBeGreaterThan(frame.geometricBounds[0]);
    expect(frame.geometricBounds[3]).toBeGreaterThan(frame.geometricBounds[1]);

    // Verify corresponding paragraph style was applied to paragraphs
    expect(frame.paragraphs.length).toBeGreaterThan(0);
    const firstPara = frame.paragraphs[0];
    expect(firstPara.appliedParagraphStyle).toBeDefined();
    expect(firstPara.appliedParagraphStyle.isValid).toBe(true);
    expect(firstPara.appliedParagraphStyle.name).toContain("Title");
  });

  it("injects accessible specimen tables with header rows and cells", () => {
    const result = service.execute(doc, { pageIndex: 0, injectTables: true });
    expect(result.success).toBe(true);
    expect(result.data?.tablesInjected).toBe(2);

    const frame = doc.pages[0].textFrames.itemByName("Typography Specimen");
    expect(frame.isValid).toBe(true);
    expect(frame.tables.length).toBe(2);
    expect(frame.tables[0].rows[0].cells[0].contents).toBe("Metric / Indicator");
  });

  it("injects component archetype containers when enabled", () => {
    const result = service.execute(doc, { pageIndex: 0, injectComponentArchetypes: true });
    expect(result.success).toBe(true);
    expect(result.data?.componentsInjected).toBeGreaterThanOrEqual(1);

    const callout = doc.pages[0].textFrames.itemByName("Component Archetype - Callout");
    expect(callout.isValid).toBe(true);
    expect(callout.label).toBe("DynamicBrandComponent");
  });

  it("supports dryRun layout simulation without creating frames", () => {
    const beforeCount = doc.pages[0].textFrames.length;
    const result = service.execute(doc, { dryRun: true });
    expect(result.success).toBe(true);
    expect(doc.pages[0].textFrames.length).toBe(beforeCount);
    expect(result.data?.details.some(d => d.includes("[DryRun]"))).toBe(true);
  });
});
