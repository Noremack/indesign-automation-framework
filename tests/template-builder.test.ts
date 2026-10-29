import { describe, it, expect, beforeEach } from "vitest";
import { MockDocument, MockApplication } from "./mocks/indesign-mock";
import { QgdsTemplateBuilderService } from "../src/core/qgds-template-builder";

describe("QgdsTemplateBuilderService", () => {
  let app: MockApplication;
  let activeDoc: MockDocument;
  let service: QgdsTemplateBuilderService;

  beforeEach(() => {
    app = new MockApplication();
    (global as any).app = app;
    activeDoc = app.documents[0];
    service = new QgdsTemplateBuilderService();
  });

  it("performs dry-run template generation across selected formats", () => {
    const result = service.execute(activeDoc, {
      outputFolder: "./Deliverables/Templates",
      targetFormats: ["A4", "A5"],
      theme: "Blue",
      styleMode: "standard",
      exportIndd: true,
      dryRun: true
    });

    expect(result.success).toBe(true);
    expect(result.data?.formatsProcessed).toContain("A4");
    expect(result.data?.formatsProcessed).toContain("A5");
    expect(result.data?.templatesGenerated).toBeGreaterThanOrEqual(2);
    expect(result.data?.documentsSaved).toBeGreaterThanOrEqual(2);
    expect(result.data?.outputFiles.some(f => f.endsWith(".indt"))).toBe(true);
    expect(result.data?.outputFiles.some(f => f.endsWith(".indd"))).toBe(true);
  });

  it("generates production templates headlessly with brand and layout applied", () => {
    const result = service.execute(activeDoc, {
      outputFolder: "./Deliverables/Templates",
      targetFormats: ["A6"],
      theme: "Gum",
      styleMode: "standard",
      includeOrientations: ["portrait"],
      exportIndt: true,
      exportIndd: false,
      injectSpecimen: true,
      dryRun: false
    });

    expect(result.success).toBe(true);
    expect(result.data?.templatesGenerated).toBe(1);
    expect(result.data?.formatsProcessed).toEqual(["A6"]);
    expect(result.data?.outputFiles[0]).toContain("flyer-a6-portrait-105x148mm.indt");
  });

  it("handles empty format matches gracefully", () => {
    const result = service.execute(activeDoc, {
      outputFolder: "./Deliverables",
      targetFormats: ["NonExistentFormat999"],
      dryRun: false
    });

    expect(result.success).toBe(true);
    expect(result.data?.templatesGenerated).toBe(0);
    expect(result.data?.details).toContain("No matching formats found in page matrix.");
  });
});

