import { describe, it, expect } from "vitest";
import { MockDocument, MockPage, MockTextFrame } from "./mocks/indesign-mock";
import {
  QgdsLayoutEngineService,
  analyzeDocumentMetrics
} from "../src/core/qgds-layout-engine";

describe("QGDS Layout & Master Spread Engine", () => {
  it("detects standard A4 portrait format from page bounds", () => {
    const doc = new MockDocument();
    // Default MockDocument page bounds are A4: 297x210 mm (841.89x595.28 pt)
    const result = analyzeDocumentMetrics(doc);

    expect(result.metrics.name).toBe("A4");
    expect(result.orientation).toBe("portrait");
    expect(result.metrics.margin).toBe(12);
    expect(result.metrics.gutter).toBe(12);
  });

  it("detects A3 landscape format from modified page bounds", () => {
    const doc = new MockDocument();
    // A3 dimensions: 420 x 297 mm in points -> 1190.55 x 841.89 pt
    doc.pages[0].bounds = [0, 0, 841.89, 1190.55];

    const result = analyzeDocumentMetrics(doc);
    expect(result.metrics.name).toBe("A3");
    expect(result.orientation).toBe("landscape");
    expect(result.metrics.margin).toBe(17);
  });

  it("provides calculated fallback metrics for unrecognized custom page dimensions", () => {
    const doc = new MockDocument();
    // Non-standard bounds: 500 x 500 mm in points
    doc.pages[0].bounds = [0, 0, 1417.32, 1417.32];

    const result = analyzeDocumentMetrics(doc);
    expect(result.metrics.name).toBe("Custom");
    expect(result.metrics.margin).toBeGreaterThanOrEqual(12);
    expect(result.metrics.masters).toContain("Cover");
  });

  it("executes layout pipeline: creates masters, enforces margins, and remaps pages", () => {
    const doc = new MockDocument();
    // Add 2 more body pages (total 3 pages)
    doc.pages.add(new MockPage({ id: 2, name: "2" }));
    doc.pages.add(new MockPage({ id: 3, name: "3" }));

    const service = new QgdsLayoutEngineService();
    const result = service.execute(doc, {
      publicationTitle: "Department Annual Report",
      autoCopyDiagnostics: false,
      notifyOnCompletion: false
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    const data = result.data!;
    expect(data.matchedFormat).toBe("A4");
    expect(data.orientation).toBe("portrait");
    expect(data.marginMm).toBe(12);

    // Masters should be verified/created
    const masterNames = doc.masterSpreads.everyItem().getElements().map(m => m.name);
    expect(masterNames.some(n => n.includes("Cover"))).toBe(true);
    expect(masterNames.some(n => n.includes("Content"))).toBe(true);

    // Page 1 should be mapped to Cover, subsequent to Content
    expect(doc.pages[0].appliedMaster).toBeDefined();
    expect(doc.pages[0].appliedMaster.name).toContain("Cover");
    expect(doc.pages[1].appliedMaster.name).toContain("Content");
    expect(doc.pages[2].appliedMaster.name).toContain("Content");

    // Margins should be set to 12mm
    expect(doc.pages[0].marginPreferences.top).toBe("12mm");
    expect(doc.pages[0].marginPreferences.left).toBe("12mm");

    // Footers should be injected on B-Content
    expect(data.footersInjected).toBeGreaterThan(0);
  });

  it("cleans existing master page items when cleanMasters is enabled", () => {
    const doc = new MockDocument();
    const coverMaster = doc.masterSpreads.add({ namePrefix: "A", baseName: "Cover" });
    const oldFrame = coverMaster.pages[0].textFrames.add(new MockTextFrame({
      name: "Old Artifact",
      contents: "Old Master Content"
    }));
    expect(coverMaster.pages[0].pageItems.length).toBeGreaterThan(0);

    const service = new QgdsLayoutEngineService();
    const result = service.execute(doc, {
      publicationTitle: "Test Report",
      cleanMasters: true,
      injectDecorations: false,
      autoCopyDiagnostics: false,
      notifyOnCompletion: false
    });

    expect(result.success).toBe(true);
    expect(oldFrame.isValid).toBe(false);
    expect(coverMaster.pages[0].pageItems.length).toBe(0);
  });

  it("respects dry-run simulation without modifying document DOM", () => {
    const doc = new MockDocument();
    const service = new QgdsLayoutEngineService();

    const result = service.execute(doc, {
      dryRun: true,
      autoCopyDiagnostics: false,
      notifyOnCompletion: false
    });

    expect(result.success).toBe(true);
    expect(result.data!.matchedFormat).toBe("A4");
    // In dryRun, no master spreads should be added
    expect(doc.masterSpreads.length).toBe(1);
    expect(result.data!.footersInjected).toBe(0);
  });

  it("injects brand decorations (brand bar, footer banner) onto cover master spread", () => {
    const doc = new MockDocument();
    const service = new QgdsLayoutEngineService();

    const result = service.execute(doc, {
      publicationTitle: "Brand Report",
      injectDecorations: true,
      autoCopyDiagnostics: false,
      notifyOnCompletion: false
    });

    expect(result.success).toBe(true);
    const coverMaster = doc.masterSpreads.everyItem().getElements().find(m => m.name.includes("Cover"));
    expect(coverMaster).toBeDefined();
    const coverPage = coverMaster!.pages[0];
    const coverItems = coverPage.pageItems.everyItem().getElements();
    expect(coverItems.length).toBeGreaterThanOrEqual(1);
  });
});

