import { BrandThemeAdapter } from "./theme-adapter";
import { LayoutFormatPreset } from "./theme-schema";

export interface GeometryBoundsPt {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface FolioPlan {
  geometricBounds: [number, number, number, number]; // [top, left, bottom, right] in points
  text: string;
  pointSize: number;
  label: string;
  name: string;
  layerName: string;
}

export interface MasterSpreadPlan {
  prefix: string;
  baseName: string;
  fullName: string;
  isCover: boolean;
  marginsMm: { top: number; bottom: number; left: number; right: number };
  marginsPt: { top: number; bottom: number; left: number; right: number };
  gutterMm: number;
  folios: FolioPlan[];
}

export interface PageRemapPlan {
  pageIndex: number;
  targetMasterPrefix: string;
  targetMasterBaseName: string;
}

export interface LayerStratificationPlan {
  name: string;
  color: number; // InDesign UI color FourCC
}

export interface LayoutExecutionPlan {
  matchedFormat: string;
  dimensionsMm: { width: number; height: number };
  dimensionsPt: { width: number; height: number };
  orientation: "portrait" | "landscape";
  scalingFactor: number;
  marginMm: number;
  marginPt: number;
  gutterMm: number;
  baselineGridPt: number;
  isFacingPages: boolean;
  layers: LayerStratificationPlan[];
  masterPlans: MasterSpreadPlan[];
  pageRemappings: PageRemapPlan[];
}

export interface LayoutPlannerParams {
  widthPt: number;
  heightPt: number;
  pageCount?: number;
  publicationTitle?: string;
  marginOverrideMm?: number;
  presets?: any[];
  adapter?: BrandThemeAdapter;
  layerNames?: {
    content?: string;
    headersFooters?: string;
    brandAssets?: string;
  };
}

/**
 * Pure, theme-agnostic layout planning engine.
 * Computes exact mathematical geometries, margins, folios, and master spread structures
 * as an intermediate data structure before touching the InDesign DOM.
 */
export class LayoutPlanner {
  public static readonly PT_TO_MM = 0.352778;

  /**
   * Analyzes raw dimensions in points and returns metric millimeters and orientation.
   */
  public static analyzeDimensions(
    widthPt: number,
    heightPt: number
  ): {
    widthMm: number;
    heightMm: number;
    shortEdgeMm: number;
    longEdgeMm: number;
    orientation: "portrait" | "landscape";
  } {
    const widthMm = Math.round(widthPt * this.PT_TO_MM * 100) / 100;
    const heightMm = Math.round(heightPt * this.PT_TO_MM * 100) / 100;
    const shortEdgeMm = Math.min(widthMm, heightMm);
    const longEdgeMm = Math.max(widthMm, heightMm);
    const orientation: "portrait" | "landscape" = widthMm >= heightMm ? "landscape" : "portrait";

    return { widthMm, heightMm, shortEdgeMm, longEdgeMm, orientation };
  }

  /**
   * Produces a comprehensive, side-effect-free LayoutExecutionPlan.
   */
  public static calculatePlan(params: LayoutPlannerParams): LayoutExecutionPlan {
    const { widthPt, heightPt, pageCount = 1, publicationTitle = "Publication" } = params;
    const { widthMm, heightMm, shortEdgeMm, longEdgeMm, orientation } = this.analyzeDimensions(
      widthPt,
      heightPt
    );

    // 1. Resolve preset via adapter, custom presets, or fallback
    let matchedFormat = "Custom";
    let marginMm = 12;
    let gutterMm = 12;
    let scalingFactor = 1.0;
    let baselineGridPt = 4;
    let isFacingPages = shortEdgeMm <= 425;
    let masterDefinitions: Array<{ prefix: string; name: string; injectFolio: boolean }> = [
      { prefix: "A", name: "Cover", injectFolio: false },
      { prefix: "B", name: "Content", injectFolio: true },
      { prefix: "C", name: "Back", injectFolio: false }
    ];

    if (params.adapter) {
      const preset: LayoutFormatPreset = params.adapter.matchLayoutPreset(shortEdgeMm, longEdgeMm);
      matchedFormat = preset.name;
      marginMm = preset.marginMm;
      gutterMm = preset.gutterMm;
      scalingFactor = preset.baseFontPt ? preset.baseFontPt / 12 : 1.0;
      if (preset.baselineGridPt) {
        baselineGridPt = preset.baselineGridPt;
      }
      if (preset.isFacingPages !== undefined) {
        isFacingPages = preset.isFacingPages;
      }
      if (preset.masterSpreads && preset.masterSpreads.length > 0) {
        masterDefinitions = preset.masterSpreads;
      }
    } else if (params.presets && params.presets.length > 0) {
      for (const p of params.presets) {
        const pShort = p.shortEdge || p.shortEdgeMm || 0;
        const pLong = p.longEdge || p.longEdgeMm || 0;
        if (Math.abs(shortEdgeMm - pShort) <= 3 && Math.abs(longEdgeMm - pLong) <= 3) {
          matchedFormat = p.name;
          marginMm = p.margin || p.marginMm || 12;
          gutterMm = p.gutter || p.gutterMm || marginMm;
          scalingFactor = p.scaleRatio || (p.baseFont ? p.baseFont / 12 : 1.0);
          if (p.baselineGridPt) {
            baselineGridPt = p.baselineGridPt;
          }
          if (p.isFacingPages !== undefined) {
            isFacingPages = Boolean(p.isFacingPages);
          } else if (p.name === "DL" || p.type === "card") {
            isFacingPages = false;
          }
          break;
        }
      }
    } else {
      marginMm = Math.max(12, Math.round(shortEdgeMm * 0.05));
      gutterMm = marginMm;
    }

    if (params.marginOverrideMm !== undefined && params.marginOverrideMm > 0) {
      marginMm = params.marginOverrideMm;
    }

    const marginPt = marginMm / this.PT_TO_MM;

    // 2. Compute Master Spread Plans
    const headerFooterLayer = params.layerNames?.headersFooters || "Headers & Footers";

    const masterPlans: MasterSpreadPlan[] = masterDefinitions.map(def => {
      const isCover = def.name.toLowerCase().includes("cover");
      const topM = isCover ? Math.round(marginMm * 1.5) : marginMm;
      const botM = isCover ? Math.round(marginMm * 1.5) : marginMm;

      const folios: FolioPlan[] = [];
      if (def.injectFolio) {
        const footerY1 = heightPt - marginPt;
        const footerY2 = heightPt - Math.max(10, marginPt / 2);

        folios.push({
          geometricBounds: [footerY1, marginPt, footerY2, widthPt - marginPt],
          text: `${publicationTitle}  |  Page \u0018`, // InDesign auto page number marker
          pointSize: Math.max(8, Math.round(9 * scalingFactor)),
          label: "DynamicContentFooter",
          name: "Running Folio",
          layerName: headerFooterLayer
        });
      }

      return {
        prefix: def.prefix,
        baseName: def.name,
        fullName: `${def.prefix}-${def.name}`,
        isCover,
        marginsMm: { top: topM, bottom: botM, left: marginMm, right: marginMm },
        marginsPt: {
          top: topM / this.PT_TO_MM,
          bottom: botM / this.PT_TO_MM,
          left: marginPt,
          right: marginPt
        },
        gutterMm,
        folios
      };
    });

    // 3. Page Remapping Plan (First page to Cover, subsequent to Content)
    const pageRemappings: PageRemapPlan[] = [];
    const coverPrefix = masterDefinitions[0]?.prefix || "A";
    const coverBase = masterDefinitions[0]?.name || "Cover";
    const contentPrefix = masterDefinitions[1]?.prefix || "B";
    const contentBase = masterDefinitions[1]?.name || "Content";

    for (let p = 0; p < pageCount; p++) {
      pageRemappings.push({
        pageIndex: p,
        targetMasterPrefix: p === 0 ? coverPrefix : contentPrefix,
        targetMasterBaseName: p === 0 ? coverBase : contentBase
      });
    }

    // 4. Layer Stratification Plan
    const layers: LayerStratificationPlan[] = [
      { name: params.layerNames?.content || "Artwork / Content", color: 1768846950 },
      { name: headerFooterLayer, color: 1684366699 },
      { name: params.layerNames?.brandAssets || "Brand Assets / Badges", color: 1836016741 }
    ];

    return {
      matchedFormat,
      dimensionsMm: { width: widthMm, height: heightMm },
      dimensionsPt: { width: widthPt, height: heightPt },
      orientation,
      scalingFactor,
      marginMm,
      marginPt,
      gutterMm,
      baselineGridPt,
      isFacingPages,
      layers,
      masterPlans,
      pageRemappings
    };
  }
}

