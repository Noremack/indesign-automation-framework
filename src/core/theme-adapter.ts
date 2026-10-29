import {
  TenantBrandPackage,
  ThemeRoleMappings,
  SwatchToken,
  GradientToken,
  LayoutFormatPreset,
  StyleDeclaration
} from "./theme-schema";

export class ThemeValidationError extends Error {
  constructor(public readonly missingFields: string[]) {
    super(
      `[ThemeAdapter] Invalid brand configuration package. Missing required tokens/fields:\n  - ${missingFields.join("\n  - ")}`
    );
    this.name = "ThemeValidationError";
  }
}

/**
 * Enterprise Adapter isolating tenant-specific brand definitions,
 * color matrices, and layout metrics from core automation logic.
 */
export class BrandThemeAdapter {
  constructor(private readonly pkg: TenantBrandPackage) {
    this.validate();
  }

  /**
   * Validates the tenant configuration package and throws a detailed ThemeValidationError
   * if any required structure or token is missing.
   */
  public validate(): void {
    const missing: string[] = [];

    if (!this.pkg) {
      throw new ThemeValidationError(["TenantBrandPackage object"]);
    }

    if (!this.pkg.manifest) {
      missing.push("manifest");
    } else {
      if (!this.pkg.manifest.tenantId) missing.push("manifest.tenantId");
      if (!this.pkg.manifest.namespacePrefix) missing.push("manifest.namespacePrefix");
      if (!this.pkg.manifest.defaultTheme) missing.push("manifest.defaultTheme");
      if (!Array.isArray(this.pkg.manifest.availableThemes) || this.pkg.manifest.availableThemes.length === 0) {
        missing.push("manifest.availableThemes");
      }
    }

    if (!Array.isArray(this.pkg.swatches) || this.pkg.swatches.length === 0) {
      missing.push("swatches (non-empty array)");
    }

    if (!this.pkg.themeMatrices || Object.keys(this.pkg.themeMatrices).length === 0) {
      missing.push("themeMatrices (non-empty mapping of theme roles)");
    } else if (this.pkg.manifest?.defaultTheme) {
      const defTheme = this.pkg.manifest.defaultTheme;
      if (!this.pkg.themeMatrices[defTheme]) {
        missing.push(`themeMatrices entry for defaultTheme "${defTheme}"`);
      }
    }

    if (!this.pkg.typography?.primaryFont?.family) {
      missing.push("typography.primaryFont.family");
    }

    if (!Array.isArray(this.pkg.layoutPresets) || this.pkg.layoutPresets.length === 0) {
      missing.push("layoutPresets (non-empty array)");
    }

    if (missing.length > 0) {
      throw new ThemeValidationError(missing);
    }
  }

  public get package(): TenantBrandPackage {
    return this.pkg;
  }

  public get manifest() {
    return this.pkg.manifest;
  }

  public get tenantId(): string {
    return this.pkg.manifest.tenantId;
  }

  public get tenantName(): string {
    return this.pkg.manifest.tenantName;
  }

  public get namespacePrefix(): string {
    return this.pkg.manifest.namespacePrefix;
  }

  public get defaultTheme(): string {
    return this.pkg.manifest.defaultTheme;
  }

  public getAvailableThemes(): string[] {
    return this.pkg.manifest.availableThemes || Object.keys(this.pkg.themeMatrices);
  }

  /**
   * Resolves context-aware role colors for the requested theme and mode.
   */
  public resolveRoleColors(themeName: string, isReverse: boolean = false): ThemeRoleMappings {
    const targetTheme = this.pkg.themeMatrices[themeName]
      ? themeName
      : this.pkg.manifest.defaultTheme;

    const matrix = this.pkg.themeMatrices[targetTheme];
    if (!matrix) {
      throw new Error(`[ThemeAdapter] Theme "${themeName}" is not registered in tenant package.`);
    }

    return isReverse ? matrix.reverse : matrix.standard;
  }

  /**
   * Returns swatches filtered specifically for the active theme plus neutral colors.
   */
  public getSwatchesForTheme(themeName: string): SwatchToken[] {
    const themePrefix = `${themeName} -`;
    return (this.pkg.swatches || []).filter(
      s => s.name.startsWith("Neutral") || s.name.startsWith(themePrefix)
    );
  }

  /**
   * Returns gradients filtered specifically for the active theme plus neutral gradients.
   */
  public getGradientsForTheme(themeName: string): GradientToken[] {
    const themePrefix = `${themeName} -`;
    return (this.pkg.gradients || []).filter(
      g => g.name.startsWith("Neutral") || g.name.startsWith(themePrefix)
    );
  }

  /**
   * Returns paragraph styles declared for this tenant.
   */
  public getParagraphStyles(): StyleDeclaration[] {
    return this.pkg.styles?.paragraph || [];
  }

  /**
   * Returns character styles declared for this tenant.
   */
  public getCharacterStyles(): StyleDeclaration[] {
    return this.pkg.styles?.character || [];
  }

  /**
   * Returns cell styles declared for this tenant.
   */
  public getCellStyles(): StyleDeclaration[] {
    return this.pkg.styles?.cell || [];
  }

  /**
   * Returns table styles declared for this tenant.
   */
  public getTableStyles(): StyleDeclaration[] {
    return this.pkg.styles?.table || [];
  }

  /**
   * Returns object styles declared for this tenant.
   */
  public getObjectStyles(): StyleDeclaration[] {
    return this.pkg.styles?.object || [];
  }

  /**
   * Returns layer hierarchy specifications declared for this tenant.
   */
  public getLayers(): Array<{ name: string; zIndex?: number; locked?: boolean }> {
    return this.pkg.layers || [
      { name: "Layer 1", zIndex: 0 },
      { name: "Brand Assets", zIndex: 1 },
      { name: "Content", zIndex: 2 },
      { name: "Header & Footer", zIndex: 3 }
    ];
  }

  /**
   * Returns specimen styles and sample texts declared for this tenant.
   */
  public getSpecimenStyles(): Array<{ text: string; style: string }> {
    return this.pkg.specimenStyles || [];
  }

  /**
   * Matches document dimensions against configured layout presets with tolerance.
   * If no preset matches, returns a calculated fallback layout.
   */
  public matchLayoutPreset(
    shortEdgeMm: number,
    longEdgeMm: number,
    toleranceMm: number = 3.0
  ): LayoutFormatPreset {
    const presets = this.pkg.layoutPresets || [];
    for (const preset of presets) {
      if (
        Math.abs(shortEdgeMm - preset.shortEdgeMm) <= toleranceMm &&
        Math.abs(longEdgeMm - preset.longEdgeMm) <= toleranceMm
      ) {
        return preset;
      }
    }

    const fallbackMargin = Math.max(10, Math.round(shortEdgeMm * 0.05));
    return {
      name: "Custom",
      shortEdgeMm,
      longEdgeMm,
      marginMm: fallbackMargin,
      gutterMm: fallbackMargin,
      bleedMm: 3,
      baseFontPt: 12,
      isFacingPages: shortEdgeMm <= 425,
      baselineGridPt: 4,
      baseBodyCapHeightMm: 2.4,
      scaleRatio: 1.25,
      masterSpreads: [
        { prefix: "A", name: "Cover", injectFolio: false },
        { prefix: "B", name: "Content", injectFolio: true }
      ]
    };
  }

  /**
   * Returns export presets or default fallback.
   */
  public getExportPresets() {
    return this.pkg.exportPresets || {
      printPdfPreset: "[High Quality Print]",
      digitalPdfPreset: "[Smallest File Size]",
      outputDirectoryPattern: "Deliverables"
    };
  }
}

