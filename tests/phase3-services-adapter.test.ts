import { describe, it, expect, beforeEach } from "vitest";
import { MockDocument, MockApplication } from "./mocks/indesign-mock";
import { BrandThemeAdapter } from "../src/core/theme-adapter";
import { TenantBrandPackage } from "../src/core/theme-schema";
import { QgdsBrandEngineService } from "../src/core/qgds-brand-engine";
import { QgdsSpecimenService } from "../src/core/qgds-specimen-service";
import { QgdsTemplateBuilderService } from "../src/core/qgds-template-builder";
import { remediateDocumentContrast } from "../src/core/contrast-engine";
import { UserDirectoryStorageAdapter } from "../src/adapters/user-storage";

const sampleTenantPkg: TenantBrandPackage = {
  manifest: {
    schemaVersion: "2.0.0",
    tenantId: "corp-media",
    tenantName: "Corporate Media Network",
    namespacePrefix: "CMN",
    defaultTheme: "Emerald",
    availableThemes: ["Emerald", "Sapphire"]
  },
  swatches: [
    { name: "Emerald - White", space: "RGB", value: [245, 255, 250] },
    { name: "Emerald - Light", space: "RGB", value: [160, 230, 200] },
    { name: "Emerald - Medium", space: "RGB", value: [46, 139, 87], cmykValue: [80, 20, 80, 10] },
    { name: "Emerald - Dark", space: "RGB", value: [20, 90, 50], cmykValue: [90, 40, 90, 40] },
    { name: "Emerald - Extra Dark", space: "RGB", value: [10, 50, 30], cmykValue: [95, 60, 90, 60] },
    { name: "Sapphire - White", space: "RGB", value: [240, 248, 255] },
    { name: "Sapphire - Medium", space: "RGB", value: [15, 82, 186] },
    { name: "Sapphire - Dark", space: "RGB", value: [8, 40, 100] },
    { name: "Neutral - White", space: "RGB", value: [255, 255, 255] },
    { name: "Neutral - Extra Dark", space: "RGB", value: [25, 25, 25] }
  ],
  gradients: [
    {
      name: "Emerald - Hero Gradient",
      type: "Linear",
      stops: [
        { color: "Emerald - Light", location: 0 },
        { color: "Emerald - Dark", location: 100 }
      ]
    },
    {
      name: "Sapphire - Hero Gradient",
      type: "Linear",
      stops: [
        { color: "Sapphire - Medium", location: 0 },
        { color: "Sapphire - Dark", location: 100 }
      ]
    }
  ],
  themeMatrices: {
    Emerald: {
      standard: {
        primaryTextColor: "Neutral - Extra Dark",
        primaryHeadingColor: "Emerald - Medium",
        secondaryHeadingColor: "Emerald - Dark",
        accentColor: "Emerald - Medium",
        subtleStrokeColor: "Neutral - White",
        frameFillColor: "Emerald - White",
        tableHeaderBG: "Emerald - Medium",
        tableHeaderText: "Neutral - White",
        tableBodyHorizontalBorderColor: "Neutral - Extra Dark",
        tableBodyVerticalBorderColor: "Neutral - White",
        tableZebraColor: "Emerald - White"
      },
      reverse: {
        primaryTextColor: "Neutral - White",
        primaryHeadingColor: "Neutral - White",
        secondaryHeadingColor: "Emerald - White",
        accentColor: "Emerald - Light",
        subtleStrokeColor: "Neutral - Extra Dark",
        frameFillColor: "Emerald - Extra Dark",
        tableHeaderBG: "Emerald - White",
        tableHeaderText: "Emerald - Dark",
        tableBodyHorizontalBorderColor: "Neutral - White",
        tableBodyVerticalBorderColor: "Neutral - White",
        tableZebraColor: "Emerald - Extra Dark"
      }
    },
    Sapphire: {
      standard: {
        primaryTextColor: "Neutral - Extra Dark",
        primaryHeadingColor: "Sapphire - Medium",
        secondaryHeadingColor: "Sapphire - Dark",
        accentColor: "Sapphire - Medium",
        subtleStrokeColor: "Neutral - White",
        frameFillColor: "Sapphire - White",
        tableHeaderBG: "Sapphire - Medium",
        tableHeaderText: "Neutral - White",
        tableBodyHorizontalBorderColor: "Neutral - Extra Dark",
        tableBodyVerticalBorderColor: "Neutral - White",
        tableZebraColor: "Sapphire - White"
      },
      reverse: {
        primaryTextColor: "Neutral - White",
        primaryHeadingColor: "Neutral - White",
        secondaryHeadingColor: "Sapphire - White",
        accentColor: "Sapphire - Medium",
        subtleStrokeColor: "Neutral - Extra Dark",
        frameFillColor: "Sapphire - Dark",
        tableHeaderBG: "Sapphire - White",
        tableHeaderText: "Sapphire - Dark",
        tableBodyHorizontalBorderColor: "Neutral - White",
        tableBodyVerticalBorderColor: "Neutral - White",
        tableZebraColor: "Sapphire - Dark"
      }
    }
  },
  typography: {
    primaryFont: { family: "Helvetica Neue", postScriptName: "HelveticaNeue" },
    scales: {
      h1: { pointSize: 28, leading: 34, fontStyle: "Bold" },
      body: { pointSize: 11, leading: 16, fontStyle: "Regular" }
    }
  },
  styles: {
    paragraph: [
      {
        name: "CMN / Heading 1",
        group: "Headings",
        roleColor: "primaryHeadingColor",
        properties: { pointSize: 28, leading: 34 }
      },
      {
        name: "CMN / Body Text",
        group: "Body",
        roleColor: "primaryTextColor",
        properties: { pointSize: 11, leading: 16 }
      }
    ]
  },
  layoutPresets: [
    {
      name: "Corporate Report A4",
      shortEdgeMm: 210,
      longEdgeMm: 297,
      marginMm: 15,
      gutterMm: 15,
      bleedMm: 3,
      baseFontPt: 11,
      isFacingPages: true,
      masterSpreads: [
        { prefix: "A", name: "Cover", injectFolio: false },
        { prefix: "B", name: "Content", injectFolio: true }
      ]
    }
  ],
  exportPresets: {
    printPdfPreset: "CMN Print Quality",
    digitalPdfPreset: "CMN Screen View",
    outputDirectoryPattern: "CMN_Deliverables"
  }
};

describe("Phase 3 Multi-Tenant Services & Adapter Integration", () => {
  let doc: MockDocument;
  let adapter: BrandThemeAdapter;

  beforeEach(() => {
    (global as any).app = new MockApplication();
    doc = new MockDocument();
    adapter = new BrandThemeAdapter(sampleTenantPkg);
  });

  it("QgdsBrandEngineService injects selective swatches and gradients for tenant package", () => {
    const brandEngine = new QgdsBrandEngineService();
    const result = brandEngine.execute(doc, {
      adapter,
      theme: "Emerald"
    });

    expect(result.success).toBe(true);
    expect(result.data?.themeApplied).toBe("Emerald");

    // Emerald + Neutral swatches should exist
    expect(doc.colors.itemByName("Emerald - Medium").isValid).toBe(true);
    expect(doc.colors.itemByName("Neutral - Extra Dark").isValid).toBe(true);

    // Sapphire should NOT be injected when Emerald is active
    expect(doc.colors.itemByName("Sapphire - Medium").isValid).toBe(false);

    // Gradient for Emerald should exist
    expect(doc.gradients.itemByName("Emerald - Hero Gradient").isValid).toBe(true);
    expect(doc.gradients.itemByName("Sapphire - Hero Gradient").isValid).toBe(false);

    // Paragraph styles should be created under CMN namespace
    expect(result.data?.paragraphStylesCreated).toBe(2);
  });

  it("QgdsBrandEngineService remaps swatches dynamically between tenant registered themes", () => {
    const brandEngine = new QgdsBrandEngineService();

    // Step 1: Apply Sapphire first
    brandEngine.execute(doc, { adapter, theme: "Sapphire" });
    expect(doc.colors.itemByName("Sapphire - Medium").isValid).toBe(true);

    // Step 2: Switch to Emerald
    brandEngine.execute(doc, { adapter, theme: "Emerald" });
    expect(doc.colors.itemByName("Emerald - Medium").isValid).toBe(true);

    // Sapphire - Medium should have been remapped and removed
    expect(doc.colors.itemByName("Sapphire - Medium").isValid).toBe(false);
  });

  it("QgdsSpecimenService formats typography frames and components using tenant metadata", () => {
    const brandEngine = new QgdsBrandEngineService();
    brandEngine.execute(doc, { adapter, theme: "Emerald" });

    const specimenService = new QgdsSpecimenService();
    const result = specimenService.execute(doc, {
      adapter,
      injectTables: true,
      injectComponentArchetypes: true
    });

    expect(result.success).toBe(true);
    expect(result.data?.specimenFramesCreated).toBe(1);

    const frame = doc.pages[0].textFrames.itemByName("Corporate Media Network Specimen");
    expect(frame.isValid).toBe(true);
    expect(frame.label).toBe("corp-media_BrandSpecimen");

    // Callout box archetype
    const callout = doc.pages[0].textFrames.itemByName("Component Archetype - Callout");
    expect(callout.isValid).toBe(true);
    expect(callout.label).toBe("corp-media_BrandComponent");
  });

  it("QgdsTemplateBuilderService generates output targeting tenant deliverable folder and layout preset", () => {
    const builder = new QgdsTemplateBuilderService();
    const result = builder.execute(doc, {
      adapter,
      theme: "Emerald",
      dryRun: true
    });

    expect(result.success).toBe(true);
    expect(result.data?.templatesGenerated).toBeGreaterThan(0);
    expect(result.data?.formatsProcessed).toContain("Corporate Report A4");
    expect(result.data?.outputFiles.some(f => f.includes("corp-media_Deliverables"))).toBe(true);
  });

  it("remediateDocumentContrast safely applies Neutral - Extra Dark to low-contrast text styles", () => {
    const brandEngine = new QgdsBrandEngineService();
    brandEngine.execute(doc, { adapter, theme: "Emerald" });

    // Set a style to a low-contrast yellow color
    const badStyle = doc.paragraphStyles.add({
      name: "LowContrastStyle",
      pointSize: 12,
      fillColor: { name: "Yellow", colorValue: [255, 255, 200] }
    });

    const remediated = remediateDocumentContrast(doc, "Neutral - Extra Dark");
    expect(remediated).toBeGreaterThanOrEqual(1);
    expect(badStyle.fillColor.name).toBe("Neutral - Extra Dark");
  });

  it("UserDirectoryStorageAdapter resolves tenant-branded output directory", () => {
    const outDir = UserDirectoryStorageAdapter.resolveSafeOutputDirectory(null, "Deliverables", "corp-media");
    expect(outDir).toContain("corp-media_Deliverables");
  });
});
