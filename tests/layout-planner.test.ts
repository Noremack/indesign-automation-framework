import { describe, it, expect } from "vitest";
import { LayoutPlanner } from "../src/core/layout-planner";
import { BrandThemeAdapter } from "../src/core/theme-adapter";
import { TenantBrandPackage } from "../src/core/theme-schema";

const mockTenantPackage: TenantBrandPackage = {
  manifest: {
    schemaVersion: "2.0.0",
    tenantId: "corp-dept",
    tenantName: "Corporate Department",
    namespacePrefix: "CORP",
    defaultTheme: "Slate",
    availableThemes: ["Slate"]
  },
  swatches: [
    { name: "Slate - Medium", space: "RGB", value: [100, 110, 120] },
    { name: "Neutral - White", space: "RGB", value: [255, 255, 255] }
  ],
  themeMatrices: {
    Slate: {
      standard: {
        primaryTextColor: "Slate - Medium",
        primaryHeadingColor: "Slate - Medium",
        secondaryHeadingColor: "Slate - Medium",
        accentColor: "Slate - Medium",
        subtleStrokeColor: "Neutral - White",
        frameFillColor: "Neutral - White",
        tableHeaderBG: "Slate - Medium",
        tableHeaderText: "Neutral - White",
        tableBodyHorizontalBorderColor: "Slate - Medium",
        tableBodyVerticalBorderColor: "Neutral - White",
        tableZebraColor: "Neutral - White"
      },
      reverse: {
        primaryTextColor: "Neutral - White",
        primaryHeadingColor: "Neutral - White",
        secondaryHeadingColor: "Neutral - White",
        accentColor: "Slate - Medium",
        subtleStrokeColor: "Neutral - White",
        frameFillColor: "Slate - Medium",
        tableHeaderBG: "Neutral - White",
        tableHeaderText: "Slate - Medium",
        tableBodyHorizontalBorderColor: "Neutral - White",
        tableBodyVerticalBorderColor: "Neutral - White",
        tableZebraColor: "Slate - Medium"
      }
    }
  },
  typography: {
    primaryFont: {
      family: "Inter",
      regularStyle: "Regular",
      boldStyle: "Bold",
      italicStyle: "Italic"
    },
    scales: {
      body: { pointSize: 10, leading: 14 }
    }
  },
  layoutPresets: [
    {
      name: "Corporate Report",
      shortEdgeMm: 210,
      longEdgeMm: 297,
      marginMm: 20,
      gutterMm: 8,
      bleedMm: 3,
      baseFontPt: 11,
      isFacingPages: true,
      masterSpreads: [
        { prefix: "A", name: "FrontCover", injectFolio: false },
        { prefix: "B", name: "BodyContent", injectFolio: true }
      ]
    }
  ]
};

describe("LayoutPlanner (Pure Mathematical Geometry & Decoupling)", () => {
  it("purely analyzes standard A4 dimensions without any DOM dependency", () => {
    // A4 portrait in points: 595.28 x 841.89
    const analysis = LayoutPlanner.analyzeDimensions(595.28, 841.89);
    expect(analysis.widthMm).toBe(210);
    expect(analysis.heightMm).toBe(297);
    expect(analysis.shortEdgeMm).toBe(210);
    expect(analysis.longEdgeMm).toBe(297);
    expect(analysis.orientation).toBe("portrait");
  });

  it("purely analyzes A3 landscape dimensions", () => {
    // A3 landscape: 1190.55 x 841.89 pt (420 x 297 mm)
    const analysis = LayoutPlanner.analyzeDimensions(1190.55, 841.89);
    expect(analysis.widthMm).toBe(420);
    expect(analysis.heightMm).toBe(297);
    expect(analysis.orientation).toBe("landscape");
  });

  it("calculates a complete LayoutExecutionPlan for standard document without DOM", () => {
    const plan = LayoutPlanner.calculatePlan({
      widthPt: 595.28,
      heightPt: 841.89,
      pageCount: 3,
      publicationTitle: "Strategic Roadmap 2026",
      presets: [
        { name: "A4", shortEdge: 210, longEdge: 297, margin: 12, gutter: 12, baseFont: 12 }
      ]
    });

    expect(plan.matchedFormat).toBe("A4");
    expect(plan.dimensionsMm.width).toBe(210);
    expect(plan.dimensionsMm.height).toBe(297);
    expect(plan.orientation).toBe("portrait");
    expect(plan.marginMm).toBe(12);
    expect(plan.scalingFactor).toBe(1.0);

    // Master plans
    expect(plan.masterPlans.length).toBe(3);
    const coverMaster = plan.masterPlans.find(m => m.prefix === "A");
    expect(coverMaster).toBeDefined();
    expect(coverMaster?.isCover).toBe(true);
    expect(coverMaster?.marginsMm.top).toBe(18); // 1.5 * 12mm
    expect(coverMaster?.folios.length).toBe(0);

    const contentMaster = plan.masterPlans.find(m => m.prefix === "B");
    expect(contentMaster).toBeDefined();
    expect(contentMaster?.isCover).toBe(false);
    expect(contentMaster?.marginsMm.top).toBe(12);
    expect(contentMaster?.folios.length).toBeGreaterThanOrEqual(1);

    const folio = contentMaster?.folios.find(f => f.text.includes("Strategic Roadmap 2026"))!;
    expect(folio).toBeDefined();
    expect(folio.text).toContain("Strategic Roadmap 2026");
    expect(folio.geometricBounds[0]).toBeGreaterThan(0); // top
    expect(folio.geometricBounds[1]).toBeGreaterThan(0); // left
    expect(folio.geometricBounds[2]).toBeGreaterThan(folio.geometricBounds[0]); // bottom > top
    expect(folio.geometricBounds[3]).toBeGreaterThan(folio.geometricBounds[1]); // right > left

    // Page remappings: page 0 to Cover, pages 1 and 2 to Content
    expect(plan.pageRemappings.length).toBe(3);
    expect(plan.pageRemappings[0].targetMasterPrefix).toBe("A");
    expect(plan.pageRemappings[1].targetMasterPrefix).toBe("B");
    expect(plan.pageRemappings[2].targetMasterPrefix).toBe("B");

    // Stratification layers
    expect(plan.layers.length).toBe(3);
    expect(plan.layers.map(l => l.name)).toContain("Artwork / Content");
    expect(plan.layers.map(l => l.name)).toContain("Headers & Footers");
  });

  it("calculates plan using BrandThemeAdapter layout presets and custom overrides", () => {
    const adapter = new BrandThemeAdapter(mockTenantPackage);
    const plan = LayoutPlanner.calculatePlan({
      widthPt: 595.28,
      heightPt: 841.89,
      pageCount: 2,
      publicationTitle: "Tenant Annual Report",
      adapter,
      marginOverrideMm: 25
    });

    expect(plan.matchedFormat).toBe("Corporate Report");
    expect(plan.marginMm).toBe(25); // Respected margin override
    expect(plan.masterPlans.length).toBe(2);
    expect(plan.masterPlans[0].fullName).toBe("A-FrontCover");
    expect(plan.masterPlans[1].fullName).toBe("B-BodyContent");
  });

  it("calculates fallback layout plan for custom non-standard dimensions", () => {
    // 500 x 500 mm in points: ~1417.32 x 1417.32
    const plan = LayoutPlanner.calculatePlan({
      widthPt: 1417.32,
      heightPt: 1417.32,
      pageCount: 1
    });

    expect(plan.matchedFormat).toBe("Custom");
    expect(plan.marginMm).toBeGreaterThanOrEqual(12);
    expect(plan.masterPlans.length).toBe(3);
  });
});

