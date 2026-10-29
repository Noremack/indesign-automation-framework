import { describe, it, expect, beforeEach } from "vitest";
import { MockDocument, MockApplication } from "./mocks/indesign-mock";
import { BrandThemeAdapter } from "../src/core/theme-adapter";
import { TenantBrandPackage } from "../src/core/theme-schema";
import { QgdsBrandEngineService } from "../src/core/qgds-brand-engine";
import { QgdsLayoutEngineService } from "../src/core/qgds-layout-engine";
import { QgdsSpecimenService } from "../src/core/qgds-specimen-service";
import { QgdsTemplateBuilderService } from "../src/core/qgds-template-builder";
import { LayoutPlanner } from "../src/core/layout-planner";
import { DomResolver } from "../src/core/dom-resolver";
import { UserDirectoryStorageAdapter } from "../src/adapters/user-storage";

const tenantQGDS: TenantBrandPackage = {
  manifest: {
    schemaVersion: "2.0.0",
    tenantId: "qgds",
    tenantName: "Queensland Government Design System",
    namespacePrefix: "QGDS",
    defaultTheme: "Blue",
    availableThemes: ["Blue", "Gum", "Sand", "BVRT"]
  },
  swatches: [
    { name: "Blue - White", space: "RGB", value: [240, 245, 255] },
    { name: "Blue - Light", space: "RGB", value: [100, 150, 240] },
    { name: "Blue - Medium", space: "RGB", value: [0, 85, 180] },
    { name: "Blue - Dark", space: "RGB", value: [0, 50, 120] },
    { name: "Blue - Extra Dark", space: "RGB", value: [0, 25, 60] },
    { name: "Gum - Medium", space: "RGB", value: [40, 120, 70] },
    { name: "Neutral - White", space: "RGB", value: [255, 255, 255] },
    { name: "Neutral - Extra Dark", space: "RGB", value: [20, 20, 20] }
  ],
  gradients: [
    {
      name: "Blue - Hero Gradient",
      type: "Linear",
      stops: [
        { color: "Blue - Light", location: 0 },
        { color: "Blue - Dark", location: 100 }
      ]
    }
  ],
  themeMatrices: {
    Blue: {
      standard: {
        primaryTextColor: "Neutral - Extra Dark",
        primaryHeadingColor: "Blue - Medium",
        secondaryHeadingColor: "Blue - Dark",
        accentColor: "Blue - Medium",
        subtleStrokeColor: "Neutral - White",
        frameFillColor: "Blue - White",
        tableHeaderBG: "Blue - Medium",
        tableHeaderText: "Neutral - White",
        tableBodyHorizontalBorderColor: "Neutral - Extra Dark",
        tableBodyVerticalBorderColor: "Neutral - White",
        tableZebraColor: "Blue - White"
      },
      reverse: {
        primaryTextColor: "Neutral - White",
        primaryHeadingColor: "Neutral - White",
        secondaryHeadingColor: "Blue - White",
        accentColor: "Blue - Light",
        subtleStrokeColor: "Neutral - Extra Dark",
        frameFillColor: "Blue - Extra Dark",
        tableHeaderBG: "Blue - White",
        tableHeaderText: "Blue - Dark",
        tableBodyHorizontalBorderColor: "Neutral - White",
        tableBodyVerticalBorderColor: "Neutral - White",
        tableZebraColor: "Blue - Extra Dark"
      }
    },
    Gum: {
      standard: {
        primaryTextColor: "Neutral - Extra Dark",
        primaryHeadingColor: "Gum - Medium",
        secondaryHeadingColor: "Gum - Medium",
        accentColor: "Gum - Medium",
        subtleStrokeColor: "Neutral - White",
        frameFillColor: "Neutral - White",
        tableHeaderBG: "Gum - Medium",
        tableHeaderText: "Neutral - White",
        tableBodyHorizontalBorderColor: "Neutral - Extra Dark",
        tableBodyVerticalBorderColor: "Neutral - White",
        tableZebraColor: "Neutral - White"
      },
      reverse: {
        primaryTextColor: "Neutral - White",
        primaryHeadingColor: "Neutral - White",
        secondaryHeadingColor: "Neutral - White",
        accentColor: "Gum - Medium",
        subtleStrokeColor: "Neutral - Extra Dark",
        frameFillColor: "Neutral - Extra Dark",
        tableHeaderBG: "Neutral - White",
        tableHeaderText: "Gum - Medium",
        tableBodyHorizontalBorderColor: "Neutral - White",
        tableBodyVerticalBorderColor: "Neutral - White",
        tableZebraColor: "Neutral - Extra Dark"
      }
    }
  },
  typography: {
    primaryFont: { family: "Noto Sans", regularStyle: "Regular", boldStyle: "Bold", italicStyle: "Italic" },
    scales: {
      h1: { pointSize: 32, leading: 38 },
      body: { pointSize: 12, leading: 18 }
    }
  },
  styles: {
    paragraph: [
      {
        name: "QGDS / Heading 1",
        group: "Headings",
        roleColor: "primaryHeadingColor",
        properties: { pointSize: 32, leading: 38 }
      },
      {
        name: "QGDS / Body",
        group: "Body",
        roleColor: "primaryTextColor",
        properties: { pointSize: 12, leading: 18 }
      }
    ]
  },
  layoutPresets: [
    {
      name: "Standard A4",
      shortEdgeMm: 210,
      longEdgeMm: 297,
      marginMm: 12,
      gutterMm: 12,
      bleedMm: 3,
      baseFontPt: 12,
      isFacingPages: true,
      masterSpreads: [
        { prefix: "A", name: "Cover", injectFolio: false },
        { prefix: "B", name: "Content", injectFolio: true }
      ]
    }
  ]
};

const tenantEnterpriseHealth: TenantBrandPackage = {
  manifest: {
    schemaVersion: "2.0.0",
    tenantId: "health-care",
    tenantName: "Global Healthcare Services",
    namespacePrefix: "GHS",
    defaultTheme: "Teal",
    availableThemes: ["Teal", "Coral"]
  },
  swatches: [
    { name: "Teal - White", space: "RGB", value: [240, 255, 250] },
    { name: "Teal - Light", space: "RGB", value: [120, 220, 200] },
    { name: "Teal - Medium", space: "RGB", value: [0, 130, 120] },
    { name: "Teal - Dark", space: "RGB", value: [0, 80, 70] },
    { name: "Teal - Extra Dark", space: "RGB", value: [0, 40, 35] },
    { name: "Coral - Medium", space: "RGB", value: [235, 90, 75] },
    { name: "Neutral - White", space: "RGB", value: [255, 255, 255] },
    { name: "Neutral - Extra Dark", space: "RGB", value: [15, 20, 25] }
  ],
  gradients: [
    {
      name: "Teal - Hero Gradient",
      type: "Linear",
      stops: [
        { color: "Teal - Light", location: 0 },
        { color: "Teal - Dark", location: 100 }
      ]
    }
  ],
  themeMatrices: {
    Teal: {
      standard: {
        primaryTextColor: "Neutral - Extra Dark",
        primaryHeadingColor: "Teal - Medium",
        secondaryHeadingColor: "Teal - Dark",
        accentColor: "Teal - Medium",
        subtleStrokeColor: "Neutral - White",
        frameFillColor: "Teal - White",
        tableHeaderBG: "Teal - Medium",
        tableHeaderText: "Neutral - White",
        tableBodyHorizontalBorderColor: "Neutral - Extra Dark",
        tableBodyVerticalBorderColor: "Neutral - White",
        tableZebraColor: "Teal - White"
      },
      reverse: {
        primaryTextColor: "Neutral - White",
        primaryHeadingColor: "Neutral - White",
        secondaryHeadingColor: "Teal - White",
        accentColor: "Teal - Light",
        subtleStrokeColor: "Neutral - Extra Dark",
        frameFillColor: "Teal - Extra Dark",
        tableHeaderBG: "Teal - White",
        tableHeaderText: "Teal - Dark",
        tableBodyHorizontalBorderColor: "Neutral - White",
        tableBodyVerticalBorderColor: "Neutral - White",
        tableZebraColor: "Teal - Extra Dark"
      }
    },
    Coral: {
      standard: {
        primaryTextColor: "Neutral - Extra Dark",
        primaryHeadingColor: "Coral - Medium",
        secondaryHeadingColor: "Coral - Medium",
        accentColor: "Coral - Medium",
        subtleStrokeColor: "Neutral - White",
        frameFillColor: "Neutral - White",
        tableHeaderBG: "Coral - Medium",
        tableHeaderText: "Neutral - White",
        tableBodyHorizontalBorderColor: "Neutral - Extra Dark",
        tableBodyVerticalBorderColor: "Neutral - White",
        tableZebraColor: "Neutral - White"
      },
      reverse: {
        primaryTextColor: "Neutral - White",
        primaryHeadingColor: "Neutral - White",
        secondaryHeadingColor: "Neutral - White",
        accentColor: "Coral - Medium",
        subtleStrokeColor: "Neutral - Extra Dark",
        frameFillColor: "Neutral - Extra Dark",
        tableHeaderBG: "Neutral - White",
        tableHeaderText: "Coral - Medium",
        tableBodyHorizontalBorderColor: "Neutral - White",
        tableBodyVerticalBorderColor: "Neutral - White",
        tableZebraColor: "Neutral - Extra Dark"
      }
    }
  },
  typography: {
    primaryFont: { family: "Arial", regularStyle: "Regular", boldStyle: "Bold", italicStyle: "Italic" },
    scales: {
      h1: { pointSize: 30, leading: 36 },
      body: { pointSize: 11, leading: 16 }
    }
  },
  styles: {
    paragraph: [
      {
        name: "GHS / Heading 1",
        group: "Headings",
        roleColor: "primaryHeadingColor",
        properties: { pointSize: 30, leading: 36 }
      },
      {
        name: "GHS / Body Text",
        group: "Body",
        roleColor: "primaryTextColor",
        properties: { pointSize: 11, leading: 16 }
      }
    ]
  },
  layoutPresets: [
    {
      name: "Healthcare Clinical Report",
      shortEdgeMm: 210,
      longEdgeMm: 297,
      marginMm: 16,
      gutterMm: 16,
      bleedMm: 3,
      baseFontPt: 11,
      isFacingPages: false,
      masterSpreads: [
        { prefix: "A", name: "Cover", injectFolio: false },
        { prefix: "B", name: "ReportBody", injectFolio: true }
      ]
    }
  ],
  exportPresets: {
    printPdfPreset: "Healthcare Print Standard",
    digitalPdfPreset: "Healthcare Screen Standard",
    outputDirectoryPattern: "Health_Deliverables"
  }
};

describe("Multi-Tenant Dynamic Re-Theming & Layout Pipeline", () => {
  let doc: MockDocument;

  beforeEach(() => {
    (global as any).app = new MockApplication();
    doc = new MockDocument();
  });

  it("switches cleanly from Queensland Government tenant to Healthcare tenant", () => {
    const qgdsAdapter = new BrandThemeAdapter(tenantQGDS);
    const healthAdapter = new BrandThemeAdapter(tenantEnterpriseHealth);

    const brandEngine = new QgdsBrandEngineService();
    const layoutEngine = new QgdsLayoutEngineService();
    const specimenService = new QgdsSpecimenService();

    // 1. Initial State: Apply QGDS Blue Theme
    brandEngine.execute(doc, { adapter: qgdsAdapter, theme: "Blue" });
    layoutEngine.execute(doc, { adapter: qgdsAdapter });
    specimenService.execute(doc, { adapter: qgdsAdapter });

    expect(doc.colors.itemByName("Blue - Medium").isValid).toBe(true);
    expect(doc.colors.itemByName("Teal - Medium").isValid).toBe(false);

    const qgdsSpecimen = doc.pages[0].textFrames.itemByName("Queensland Government Design System Specimen");
    expect(qgdsSpecimen.isValid).toBe(true);
    expect(qgdsSpecimen.label).toBe("qgds_BrandSpecimen");

    // 2. Migration: Apply Global Healthcare Services (GHS) Teal Theme
    brandEngine.execute(doc, { adapter: healthAdapter, theme: "Teal" });
    layoutEngine.execute(doc, { adapter: healthAdapter });
    specimenService.execute(doc, { adapter: healthAdapter });

    // New swatches should be present
    expect(doc.colors.itemByName("Teal - Medium").isValid).toBe(true);

    // Old specimen frame should have been removed and replaced by healthcare specimen
    const healthSpecimen = doc.pages[0].textFrames.itemByName("Global Healthcare Services Specimen");
    expect(healthSpecimen.isValid).toBe(true);
    expect(healthSpecimen.label).toBe("health-care_BrandSpecimen");

    // Paragraph styles for GHS should exist
    const ghsHeading = DomResolver.getParagraphStyleSafely(doc, "Heading 1", "GHS");
    expect(ghsHeading).toBeDefined();
    expect(ghsHeading.isValid).toBe(true);
  });

  it("LayoutPlanner produces distinct execution plans for different tenant layout presets", () => {
    const qgdsAdapter = new BrandThemeAdapter(tenantQGDS);
    const healthAdapter = new BrandThemeAdapter(tenantEnterpriseHealth);

    // Standard A4 facing-pages
    const planQGDS = LayoutPlanner.calculatePlan({
      widthPt: 595.28,
      heightPt: 841.89,
      pageCount: 4,
      adapter: qgdsAdapter
    });
    expect(planQGDS.matchedFormat).toBe("Standard A4");
    expect(planQGDS.marginMm).toBe(12);
    expect(planQGDS.isFacingPages).toBe(true);

    // Healthcare custom margins and non-facing pages
    const planHealth = LayoutPlanner.calculatePlan({
      widthPt: 595.28,
      heightPt: 841.89,
      pageCount: 4,
      adapter: healthAdapter
    });
    expect(planHealth.matchedFormat).toBe("Healthcare Clinical Report");
    expect(planHealth.marginMm).toBe(16);
    expect(planHealth.isFacingPages).toBe(false);
  });

  it("UserDirectoryStorageAdapter respects tenant delivery directories", () => {
    const outQGDS = UserDirectoryStorageAdapter.resolveSafeOutputDirectory(null, "Deliverables", tenantQGDS.manifest.tenantId);
    const outHealth = UserDirectoryStorageAdapter.resolveSafeOutputDirectory(null, "Deliverables", tenantEnterpriseHealth.manifest.tenantId);

    expect(outQGDS).toContain("qgds_Deliverables");
    expect(outHealth).toContain("health-care_Deliverables");
  });
});
