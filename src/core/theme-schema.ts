/**
 * Core Tenant Brand & Layout Configuration Schema
 * Abstracts all hardcoded design, typography, geometry, and export parameters
 * into a portable, multi-tenant JSON configuration interface.
 */

export type ColorSpaceMode = "RGB" | "CMYK";

export interface TenantManifest {
  schemaVersion: "2.0.0";
  tenantId: string;           // e.g. "qld-gov", "nsw-health", "enterprise-corp"
  tenantName: string;         // e.g. "Queensland Government", "NSW Health"
  namespacePrefix: string;    // e.g. "QGDS", "NSW", "CORP"
  defaultTheme: string;
  availableThemes: string[];
}

export interface SwatchToken {
  name: string;
  space: ColorSpaceMode;
  value: [number, number, number];             // RGB [0..255]
  cmykValue?: [number, number, number, number]; // CMYK [0..100]
}

export interface ThemeRoleMappings {
  primaryTextColor: string;
  primaryHeadingColor: string;
  secondaryHeadingColor: string;
  accentColor: string;
  subtleStrokeColor: string;
  frameFillColor: string;
  tableHeaderBG: string;
  tableHeaderText: string;
  tableBodyHorizontalBorderColor: string;
  tableBodyVerticalBorderColor: string;
  tableZebraColor: string;
  themeWhiteColor?: string;
  themeExtraDarkColor?: string;
}

export interface GradientStopToken {
  color: string;
  location: number; // 0..100
  midpoint?: number; // 0..100
}

export interface GradientToken {
  name: string;
  type: "Linear" | "Radial";
  stops: GradientStopToken[];
}

export interface FontDefinition {
  family: string;
  regularStyle?: string;
  boldStyle?: string;
  italicStyle?: string;
  postScriptName?: string;
  capToEmRatio?: number;
}

export interface TypographyScaleItem {
  pointSize: number;
  leading: number;
  tracking?: number;
  fontStyle?: string;
  scaleStep?: number;
}

export interface StyleDeclaration {
  name: string;
  group: string;
  basedOn?: string;
  roleColor?: keyof ThemeRoleMappings;
  role?: string;
  scaleRole?: "display" | "title" | "h1" | "h2" | "h3" | "h4" | "lead" | "body" | "listItem" | "small" | "caption" | "footer";
  headerRegionCell?: string;
  bodyRegionCell?: string;
  properties: {
    fontFamily?: string;
    fontStyle?: string;
    pointSize?: number;
    leading?: number;
    alignment?: string;
    spaceBefore?: number;
    spaceAfter?: number;
    spaceBetweenParagraphsOfSameStyle?: number;
    spaceBetweenParagraphsForSameStyle?: number;
    alignToBaseline?: boolean;
    hyphenation?: boolean;
    justification?: any;
    composer?: string;
    tracking?: number;
    keepWithNext?: number;
    ruleBelow?: boolean;
    ruleBelowLineWeight?: number;
    fillColor?: any;
    strokeColor?: any;
  };
  exportTagMap?: {
    exportType: "EPUB" | "HTML";
    exportTag: string;
    exportClass?: string;
  };
}

export interface MasterSpreadSpec {
  prefix: string;
  name: string;
  injectFolio: boolean;
}

export interface LayoutFormatPreset {
  name: string;
  shortEdgeMm: number;
  longEdgeMm: number;
  marginMm: number;
  gutterMm: number;
  bleedMm: number;
  baseFontPt: number;
  isFacingPages: boolean;
  baselineGridPt?: number;
  baseBodyCapHeightMm?: number;
  scaleRatio?: number;
  opticalTrackingOffset?: number;
  masterSpreads: MasterSpreadSpec[];
}

export interface ExportPresets {
  printPdfPreset?: string;
  digitalPdfPreset?: string;
  outputDirectoryPattern?: string;
}

export interface TenantBrandPackage {
  manifest: TenantManifest;
  swatches: SwatchToken[];
  themeMatrices: Record<string, {
    standard: ThemeRoleMappings;
    reverse: ThemeRoleMappings;
  }>;
  gradients?: GradientToken[];
  typography?: {
    primaryFont: FontDefinition;
    secondaryFont?: FontDefinition;
    scales: Record<string, TypographyScaleItem>;
  };
  styles?: {
    paragraph?: StyleDeclaration[];
    character?: StyleDeclaration[];
    cell?: StyleDeclaration[];
    table?: StyleDeclaration[];
  };
  layoutPresets?: LayoutFormatPreset[];
  exportPresets?: ExportPresets;
  layers?: Array<{ name: string; zIndex?: number; locked?: boolean }>;
  specimenStyles?: Array<{ text: string; style: string }>;
}

