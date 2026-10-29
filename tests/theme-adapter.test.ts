import { describe, it, expect } from "vitest";
import { BrandThemeAdapter, ThemeValidationError } from "../src/core/theme-adapter";
import { TenantBrandPackage } from "../src/core/theme-schema";
import { DomResolver } from "../src/core/dom-resolver";

const mockValidPackage: TenantBrandPackage = {
  manifest: {
    schemaVersion: "2.0.0",
    tenantId: "nsw-health",
    tenantName: "NSW Health",
    namespacePrefix: "NSW",
    defaultTheme: "Teal",
    availableThemes: ["Teal", "Navy"]
  },
  swatches: [
    { name: "Teal - White", space: "RGB", value: [255, 255, 255] },
    { name: "Teal - Medium", space: "RGB", value: [0, 128, 128], cmykValue: [100, 0, 50, 10] },
    { name: "Teal - Dark", space: "RGB", value: [0, 80, 80], cmykValue: [100, 20, 60, 40] },
    { name: "Navy - Medium", space: "RGB", value: [0, 0, 128] },
    { name: "Neutral - White", space: "RGB", value: [255, 255, 255] },
    { name: "Neutral - Extra Dark", space: "RGB", value: [30, 30, 30] }
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
        accentColor: "Teal - White",
        subtleStrokeColor: "Neutral - Extra Dark",
        frameFillColor: "Teal - Dark",
        tableHeaderBG: "Teal - White",
        tableHeaderText: "Teal - Dark",
        tableBodyHorizontalBorderColor: "Neutral - White",
        tableBodyVerticalBorderColor: "Neutral - White",
        tableZebraColor: "Teal - Dark"
      }
    },
    Navy: {
      standard: {
        primaryTextColor: "Neutral - Extra Dark",
        primaryHeadingColor: "Navy - Medium",
        secondaryHeadingColor: "Navy - Medium",
        accentColor: "Navy - Medium",
        subtleStrokeColor: "Neutral - White",
        frameFillColor: "Neutral - White",
        tableHeaderBG: "Navy - Medium",
        tableHeaderText: "Neutral - White",
        tableBodyHorizontalBorderColor: "Neutral - Extra Dark",
        tableBodyVerticalBorderColor: "Neutral - White",
        tableZebraColor: "Neutral - White"
      },
      reverse: {
        primaryTextColor: "Neutral - White",
        primaryHeadingColor: "Neutral - White",
        secondaryHeadingColor: "Neutral - White",
        accentColor: "Navy - Medium",
        subtleStrokeColor: "Neutral - Extra Dark",
        frameFillColor: "Navy - Medium",
        tableHeaderBG: "Neutral - White",
        tableHeaderText: "Navy - Medium",
        tableBodyHorizontalBorderColor: "Neutral - White",
        tableBodyVerticalBorderColor: "Neutral - White",
        tableZebraColor: "Navy - Medium"
      }
    }
  },
  gradients: [
    {
      name: "Teal - Gradient",
      type: "Linear",
      stops: [
        { color: "Teal - Medium", location: 0 },
        { color: "Teal - Dark", location: 100 }
      ]
    },
    {
      name: "Navy - Gradient",
      type: "Linear",
      stops: [
        { color: "Navy - Medium", location: 0 },
        { color: "Neutral - Extra Dark", location: 100 }
      ]
    },
    {
      name: "Neutral - Gradient",
      type: "Linear",
      stops: [
        { color: "Neutral - White", location: 0 },
        { color: "Neutral - Extra Dark", location: 100 }
      ]
    }
  ],
  typography: {
    primaryFont: {
      family: "Public Sans",
      regularStyle: "Regular",
      boldStyle: "Bold",
      italicStyle: "Italic"
    },
    scales: {
      h1: { pointSize: 32, leading: 38 },
      body: { pointSize: 10, leading: 14 }
    }
  },
  styles: {
    paragraph: [
      {
        name: "H1 - Title",
        group: "Headings",
        roleColor: "primaryHeadingColor",
        properties: { pointSize: 32, leading: 38 }
      }
    ]
  },
  layoutPresets: [
    {
      name: "A4",
      shortEdgeMm: 210,
      longEdgeMm: 297,
      marginMm: 15,
      gutterMm: 10,
      bleedMm: 3,
      baseFontPt: 10,
      isFacingPages: true,
      masterSpreads: [
        { prefix: "A", name: "Cover", injectFolio: false },
        { prefix: "B", name: "Content", injectFolio: true }
      ]
    }
  ]
};

describe("BrandThemeAdapter (Portability & Decoupling)", () => {
  it("validates a complete tenant package without throwing", () => {
    expect(() => new BrandThemeAdapter(mockValidPackage)).not.toThrow();
  });

  it("fails fast with ThemeValidationError and descriptive missing fields when package is incomplete", () => {
    const invalidPkg = {
      manifest: {
        schemaVersion: "2.0.0"
      }
    } as any;

    expect(() => new BrandThemeAdapter(invalidPkg)).toThrowError(ThemeValidationError);

    try {
      new BrandThemeAdapter(invalidPkg);
    } catch (err: any) {
      expect(err).toBeInstanceOf(ThemeValidationError);
      expect(err.missingFields).toContain("manifest.tenantId");
      expect(err.missingFields).toContain("manifest.namespacePrefix");
      expect(err.missingFields).toContain("swatches (non-empty array)");
      expect(err.missingFields).toContain("themeMatrices (non-empty mapping of theme roles)");
      expect(err.missingFields).toContain("typography.primaryFont.family");
      expect(err.missingFields).toContain("layoutPresets (non-empty array)");
      expect(err.message).toContain("[ThemeAdapter] Invalid brand configuration package");
    }
  });

  it("resolves context-aware role colors for both standard and reverse modes", () => {
    const adapter = new BrandThemeAdapter(mockValidPackage);
    const standard = adapter.resolveRoleColors("Teal", false);
    expect(standard.primaryHeadingColor).toBe("Teal - Medium");
    expect(standard.primaryTextColor).toBe("Neutral - Extra Dark");

    const reverse = adapter.resolveRoleColors("Teal", true);
    expect(reverse.primaryHeadingColor).toBe("Neutral - White");
    expect(reverse.frameFillColor).toBe("Teal - Dark");
  });

  it("filters swatches strictly to active theme plus neutral swatches", () => {
    const adapter = new BrandThemeAdapter(mockValidPackage);
    const swatches = adapter.getSwatchesForTheme("Teal");

    const names = swatches.map(s => s.name);
    expect(names).toContain("Teal - Medium");
    expect(names).toContain("Neutral - Extra Dark");
    // Other theme swatches must NOT be included
    expect(names).not.toContain("Navy - Medium");
  });

  it("filters gradients strictly to active theme plus neutral gradients", () => {
    const adapter = new BrandThemeAdapter(mockValidPackage);
    const gradients = adapter.getGradientsForTheme("Teal");

    const names = gradients.map(g => g.name);
    expect(names).toContain("Teal - Gradient");
    expect(names).toContain("Neutral - Gradient");
    expect(names).not.toContain("Navy - Gradient");
  });

  it("matches configured layout preset by dimensions and provides fallback for custom sizes", () => {
    const adapter = new BrandThemeAdapter(mockValidPackage);

    // Exact A4 match within tolerance
    const a4 = adapter.matchLayoutPreset(210, 297);
    expect(a4.name).toBe("A4");
    expect(a4.marginMm).toBe(15);
    expect(a4.isFacingPages).toBe(true);

    // Unrecognized size -> calculated fallback
    const custom = adapter.matchLayoutPreset(400, 400);
    expect(custom.name).toBe("Custom");
    expect(custom.marginMm).toBe(20); // 5% of 400
    expect(custom.masterSpreads.length).toBe(2);
  });

  it("supports dynamic tenant namespace stripping in DomResolver", () => {
    // Strips custom tenant namespace "NSW"
    expect(DomResolver.cleanGroupPath("NSW / Headings / Sub", "NSW")).toBe("Headings / Sub");
    expect(DomResolver.cleanGroupPath("NSW / Narrative", "NSW")).toBe("Narrative");

    // Still strips legacy "QGDS" for backwards compatibility
    expect(DomResolver.cleanGroupPath("QGDS / Headings", "NSW")).toBe("Headings");
    expect(DomResolver.cleanGroupPath("QGDS / Headings")).toBe("Headings");

    // getStyleCandidates provides leaf and stripped names with tenant prefix
    const candidates = DomResolver.getStyleCandidates("NSW / Headings / H1 - Title", "NSW");
    expect(candidates).toContain("NSW / Headings / H1 - Title");
    expect(candidates).toContain("Headings / H1 - Title");
    expect(candidates).toContain("H1 - Title");
  });
});

