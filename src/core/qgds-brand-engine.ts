import { BaseService } from "./base-service";
import { DomResolver } from "./dom-resolver";
import { QGDS_BRAND_TOKENS, DEFAULT_QGDS_OBJECT_STYLES } from "./qgds-tokens";
import { BrandThemeAdapter } from "./theme-adapter";
import { PhysicalTypographyEngine, TypographyRole } from "./typography-engine";
import { BaseBatchOptions } from "./types";

declare const indesign: any;

export type QgdsThemeName = "Blue" | "Gum" | "Sand" | "BVRT" | string;
export type QgdsStyleMode = "standard" | "reverse";

export interface ThemeColors {
  themeName: string;
  themeWhiteColor: string;
  themeExtraDarkColor: string;
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
}

/**
 * Resolves context-aware color tokens based on brand theme and style mode.
 */
export function getThemeColors(primaryTheme: string = "Blue", isReverse: boolean = false): ThemeColors {
  const hasExtraDark = ["Blue", "BVRT", "Gum", "Sand"].includes(primaryTheme);
  const extraDarkToken = hasExtraDark ? `${primaryTheme} - Extra Dark` : `${primaryTheme} - Black`;

  const baseData: ThemeColors = {
    themeName: primaryTheme,
    themeWhiteColor: `${primaryTheme} - White`,
    themeExtraDarkColor: extraDarkToken,
    primaryTextColor: "Neutral - Extra Dark",
    primaryHeadingColor: `${primaryTheme} - Medium`,
    secondaryHeadingColor: extraDarkToken,
    accentColor: `${primaryTheme} - Medium`,
    subtleStrokeColor: "Neutral - Light",
    frameFillColor: `${primaryTheme} - Extra Light`,
    tableHeaderBG: `${primaryTheme} - Medium`,
    tableHeaderText: "Neutral - White",
    tableBodyHorizontalBorderColor: "Neutral - Medium",
    tableBodyVerticalBorderColor: "Neutral - Light",
    tableZebraColor: "Neutral - Extra Light"
  };

  if (isReverse) {
    baseData.primaryTextColor = "Paper";
    baseData.primaryHeadingColor = "Paper";
    baseData.secondaryHeadingColor = `${primaryTheme} - Extra Light`;
    baseData.accentColor = `${primaryTheme} - Light`;
    baseData.subtleStrokeColor = "Neutral - Dark";
    baseData.frameFillColor = extraDarkToken;
    baseData.tableBodyHorizontalBorderColor = "Paper";
    baseData.tableBodyVerticalBorderColor = baseData.themeWhiteColor;
    baseData.tableHeaderBG = baseData.themeWhiteColor;
    baseData.tableHeaderText = extraDarkToken;
    baseData.tableZebraColor = `${primaryTheme} - Black`;
  }

  return baseData;
}

export interface BrandEngineOptions extends BaseBatchOptions {
  theme?: string;
  styleMode?: QgdsStyleMode;
  colorMode?: "RGB" | "CMYK";
  tokenScale?: number;
  adapter?: BrandThemeAdapter;
  baselineGridPt?: number;
  baseBodyCapHeightMm?: number;
  capToEmRatio?: number;
  scaleRatio?: number;
  opticalTrackingOffset?: number;
  applyColors?: boolean;
  applyGradients?: boolean;
  applyLayers?: boolean;
  applyParagraphStyles?: boolean;
  applyCharacterStyles?: boolean;
  applyTableStyles?: boolean;
  applyCellStyles?: boolean;
  applyObjectStyles?: boolean;
}

export interface BrandEngineReport {
  themeApplied: string;
  styleModeApplied: QgdsStyleMode;
  colorsCreated: number;
  gradientsCreated: number;
  layersCreated: number;
  paragraphStylesCreated: number;
  characterStylesCreated: number;
  cellStylesCreated: number;
  tableStylesCreated: number;
  objectStylesCreated: number;
  skippedCount: number;
  details: string[];
}

export class QgdsBrandEngineService extends BaseService<BrandEngineOptions, BrandEngineReport> {
  public override readonly actionName = "QGDS Brand Engine & Theme Styler";

  protected process(doc: any, options: BrandEngineOptions): BrandEngineReport {
    const adapter = options.adapter;
    const defaultTheme = adapter ? adapter.defaultTheme : "Blue";
    const theme = options.theme || defaultTheme;
    const mode = options.styleMode || "standard";
    const isReverse = mode === "reverse";
    const scale = options.tokenScale || 1.0;
    const namespacePrefix = adapter ? adapter.namespacePrefix : "QGDS";

    let themeColors: ThemeColors;
    if (adapter) {
      const resolved = adapter.resolveRoleColors(theme, isReverse);
      themeColors = {
        themeName: theme,
        themeWhiteColor: resolved.themeWhiteColor || `${theme} - White`,
        themeExtraDarkColor: resolved.themeExtraDarkColor || `${theme} - Extra Dark`,
        primaryTextColor: resolved.primaryTextColor,
        primaryHeadingColor: resolved.primaryHeadingColor,
        secondaryHeadingColor: resolved.secondaryHeadingColor,
        accentColor: resolved.accentColor,
        subtleStrokeColor: resolved.subtleStrokeColor,
        frameFillColor: resolved.frameFillColor,
        tableHeaderBG: resolved.tableHeaderBG,
        tableHeaderText: resolved.tableHeaderText,
        tableBodyHorizontalBorderColor: resolved.tableBodyHorizontalBorderColor,
        tableBodyVerticalBorderColor: resolved.tableBodyVerticalBorderColor,
        tableZebraColor: resolved.tableZebraColor
      };
    } else {
      themeColors = getThemeColors(theme, isReverse);
    }

    const report: BrandEngineReport = {
      themeApplied: theme,
      styleModeApplied: mode,
      colorsCreated: 0,
      gradientsCreated: 0,
      layersCreated: 0,
      paragraphStylesCreated: 0,
      characterStylesCreated: 0,
      cellStylesCreated: 0,
      tableStylesCreated: 0,
      objectStylesCreated: 0,
      skippedCount: 0,
      details: []
    };

    const colors = adapter
      ? adapter.getSwatchesForTheme(theme)
      : (QGDS_BRAND_TOKENS.colors || []).filter(c =>
          c.name.startsWith("Neutral") || c.name.startsWith(theme)
        );

    const gradients = adapter
      ? adapter.getGradientsForTheme(theme)
      : (QGDS_BRAND_TOKENS.gradients || []).filter(g =>
          g.name.startsWith("Neutral") || g.name.startsWith(theme)
        );

    const layers = adapter
      ? adapter.getLayers()
      : (QGDS_BRAND_TOKENS.layerMatrix || []);

    const pStyles = adapter
      ? adapter.getParagraphStyles()
      : (QGDS_BRAND_TOKENS.styles?.paragraph || []);

    const cStyles = adapter
      ? adapter.getCharacterStyles()
      : (QGDS_BRAND_TOKENS.styles?.character || []);

    const cellStyles = adapter
      ? adapter.getCellStyles()
      : (QGDS_BRAND_TOKENS.styles?.cell || []);

    const tableStyles = adapter
      ? adapter.getTableStyles()
      : (QGDS_BRAND_TOKENS.styles?.table || []);

    const objStyles = (adapter
      ? adapter.getObjectStyles()
      : (DEFAULT_QGDS_OBJECT_STYLES as unknown as any[])) || [];

    const totalSteps =
      (options.applyColors !== false ? colors.length : 0) +
      (options.applyGradients !== false ? gradients.length : 0) +
      (options.applyLayers !== false ? layers.length : 0) +
      (options.applyParagraphStyles !== false ? pStyles.length : 0) +
      (options.applyCharacterStyles !== false ? cStyles.length : 0) +
      (options.applyCellStyles !== false ? cellStyles.length : 0) +
      (options.applyTableStyles !== false ? tableStyles.length : 0) +
      (options.applyObjectStyles !== false ? objStyles.length : 0);

    let currentStep = 0;
    const isCMYK = options.colorMode === "CMYK";

    // 0. Synchronize Document Intent, Transparency Blending Space, and Default Swatches
    if (!options.dryRun) {
      if (doc.documentPreferences) {
        try {
          const printIntent = (typeof indesign !== "undefined" && (indesign as any).DocumentIntentOptions?.PRINT_INTENT) || 1886547822;
          const webIntent = (typeof indesign !== "undefined" && (indesign as any).DocumentIntentOptions?.WEB_INTENT) || 1986359924;
          doc.documentPreferences.intent = isCMYK ? printIntent : webIntent;
        } catch (_) {}
      }
      if (doc.transparencyPreferences) {
        try {
          const cmykSpace = (typeof indesign !== "undefined" && (indesign as any).BlendingSpace?.CMYK) || 1129142603;
          const rgbSpace = (typeof indesign !== "undefined" && (indesign as any).BlendingSpace?.RGB) || 1666336572;
          doc.transparencyPreferences.blendingSpace = isCMYK ? cmykSpace : rgbSpace;
        } catch (_) {}
      }
      try {
        const black = doc.colors?.itemByName("Black");
        if (black && black.isValid) {
          black.space = isCMYK ? 1129142603 : 1666336572;
          black.colorValue = isCMYK ? [0, 0, 0, 100] : [0, 0, 0];
        }
      } catch (_) {}
      try {
        const paper = doc.colors?.itemByName("Paper");
        if (paper && paper.isValid) {
          paper.space = isCMYK ? 1129142603 : 1666336572;
          paper.colorValue = isCMYK ? [0, 0, 0, 0] : [255, 255, 255];
        }
      } catch (_) {}
    }

    // 1. Ingest Swatches (Only Selected Theme + Neutral)
    if (options.applyColors !== false && doc.colors) {
      for (const col of colors) {
        currentStep++;
        this.reportProgress(options, `Injecting color "${col.name}"`, currentStep, totalSteps);
        try {
          const colValue = isCMYK && (col as any).cmykValue ? (col as any).cmykValue : col.value;
          const colSpace = isCMYK ? 1129142603 : 1666336572;
          if (!options.dryRun) {
            DomResolver.getOrCreateColor(doc, col.name, colValue as unknown as number[], colSpace);
          }
          report.colorsCreated++;
          report.details.push(`Configured color "${col.name}".`);
        } catch (err: any) {
          if (options.failurePolicy === "strict") throw err;
          report.skippedCount++;
        }
      }
    }

    // 1b. Remap Previous Theme Swatches (For Theme Updating in Existing Documents)
    if (!options.dryRun && doc.colors) {
      const allThemes = adapter ? adapter.getAvailableThemes() : ["Blue", "Gum", "Sand", "BVRT"];
      const otherThemes = allThemes.filter(t => t !== theme);
      const tones = ["White", "Extra Light", "Light", "Medium", "Dark", "Extra Dark", "Black"];

      if (adapter && Array.isArray(adapter.package?.swatches)) {
        for (const sw of adapter.package.swatches) {
          const parts = sw.name.split(" - ");
          if (parts.length > 1) {
            const toneSuffix = parts.slice(1).join(" - ");
            if (!tones.includes(toneSuffix)) tones.push(toneSuffix);
          }
        }
      }

      for (const otherTheme of otherThemes) {
        for (const tone of tones) {
          const oldColorName = `${otherTheme} - ${tone}`;
          const newColorName = `${theme} - ${tone}`;
          const oldColor = doc.colors.itemByName(oldColorName);
          const newColor = doc.colors.itemByName(newColorName);
          if (oldColor && oldColor.isValid && newColor && newColor.isValid) {
            try {
              oldColor.remove(newColor);
              report.details.push(`Remapped theme swatch "${oldColorName}" -> "${newColorName}".`);
            } catch (_) {}
          }
        }
      }
    }

    // 2. Ingest Gradients (Only Selected Theme + Neutral)
    if (options.applyGradients !== false && doc.gradients) {
      for (const grad of gradients) {
        currentStep++;
        this.reportProgress(options, `Injecting gradient "${grad.name}"`, currentStep, totalSteps);
        try {
          if (!options.dryRun) {
            DomResolver.getOrCreateGradient(doc, grad.name, grad.type, grad.stops as any);
          }
          report.gradientsCreated++;
          report.details.push(`Configured gradient "${grad.name}".`);
        } catch (err: any) {
          if (options.failurePolicy === "strict") throw err;
          report.skippedCount++;
        }
      }
    }

    // 2b. Remap Previous Theme Gradients
    if (!options.dryRun && doc.gradients) {
      const allThemes = adapter ? adapter.getAvailableThemes() : ["Blue", "Gum", "Sand", "BVRT"];
      const otherThemes = allThemes.filter(t => t !== theme);
      const gradTones = ["Gradient", "Gradient Light", "Gradient Dark"];

      if (adapter && Array.isArray(adapter.package?.gradients)) {
        for (const gr of adapter.package.gradients) {
          const parts = gr.name.split(" - ");
          if (parts.length > 1) {
            const toneSuffix = parts.slice(1).join(" - ");
            if (!gradTones.includes(toneSuffix)) gradTones.push(toneSuffix);
          }
        }
      }

      for (const otherTheme of otherThemes) {
        for (const gt of gradTones) {
          const oldGradName = `${otherTheme} - ${gt}`;
          const newGradName = `${theme} - ${gt}`;
          const oldGrad = doc.gradients.itemByName(oldGradName);
          const newGrad = doc.gradients.itemByName(newGradName);
          if (oldGrad && oldGrad.isValid && newGrad && newGrad.isValid) {
            try {
              oldGrad.remove(newGrad);
            } catch (_) {}
          }
        }
      }
    }

    // 3. Ingest Layers
    if (options.applyLayers !== false && doc.layers) {
      for (const layer of layers) {
        currentStep++;
        this.reportProgress(options, `Injecting layer "${layer.name}"`, currentStep, totalSteps);
        try {
          const existing = doc.layers.itemByName(layer.name);
          if (!existing || !existing.isValid) {
            if (!options.dryRun) {
              DomResolver.getOrCreateLayer(doc, layer.name);
            }
            report.layersCreated++;
            report.details.push(`Created layer "${layer.name}".`);
          }
        } catch (err: any) {
          if (options.failurePolicy === "strict") throw err;
          report.skippedCount++;
        }
      }
    }

    // 4. Ingest Paragraph Styles
    if (options.applyParagraphStyles !== false && doc.paragraphStyles) {
      const prefixRegex = new RegExp(`^\\s*(?:${namespacePrefix}\\s*[\\/\\\\]\\s*)+`, "i");

      // Compute physical typography and vertical rhythm configuration
      let docLongEdgeMm = 297;
      let docShortEdgeMm = 210;
      try {
        if (doc.pages && doc.pages.length > 0) {
          const b = doc.pages[0].bounds || [0, 0, 841.89, 595.28];
          const hMm = Math.abs(b[2] - b[0]) * PhysicalTypographyEngine.PT_TO_MM;
          const wMm = Math.abs(b[3] - b[1]) * PhysicalTypographyEngine.PT_TO_MM;
          docLongEdgeMm = Math.max(hMm, wMm);
          docShortEdgeMm = Math.min(hMm, wMm);
        }
      } catch (_) {}

      const capToEmRatio = options.capToEmRatio || (adapter?.package.typography?.primaryFont?.capToEmRatio) || PhysicalTypographyEngine.DEFAULT_CAP_TO_EM_RATIO;
      let baselineGridPt = options.baselineGridPt || PhysicalTypographyEngine.DEFAULT_BASELINE_GRID_PT;
      let baseBodyCapHeightMm = options.baseBodyCapHeightMm || PhysicalTypographyEngine.DEFAULT_BASE_CAP_HEIGHT_MM;
      let scaleRatio = options.scaleRatio || PhysicalTypographyEngine.DEFAULT_SCALE_RATIO;
      let opticalTrackingOffset = options.opticalTrackingOffset;

      if (adapter) {
        const matchedPreset = adapter.matchLayoutPreset(docShortEdgeMm, docLongEdgeMm);
        if (options.baselineGridPt === undefined && matchedPreset.baselineGridPt) {
          baselineGridPt = matchedPreset.baselineGridPt;
        }
        if (options.baseBodyCapHeightMm === undefined) {
          if (matchedPreset.baseBodyCapHeightMm) {
            baseBodyCapHeightMm = matchedPreset.baseBodyCapHeightMm;
          } else if (matchedPreset.baseFontPt) {
            baseBodyCapHeightMm = (matchedPreset.baseFontPt * capToEmRatio) * PhysicalTypographyEngine.PT_TO_MM;
          }
        }
        if (options.scaleRatio === undefined && matchedPreset.scaleRatio) {
          scaleRatio = matchedPreset.scaleRatio;
        }
        if (opticalTrackingOffset === undefined) {
          opticalTrackingOffset = matchedPreset.opticalTrackingOffset !== undefined
            ? matchedPreset.opticalTrackingOffset
            : PhysicalTypographyEngine.calculateOpticalTracking(docLongEdgeMm, matchedPreset.name);
        }
      } else {
        if (opticalTrackingOffset === undefined) {
          opticalTrackingOffset = PhysicalTypographyEngine.calculateOpticalTracking(docLongEdgeMm);
        }
      }

      for (const ps of pStyles) {
        currentStep++;
        this.reportProgress(options, `Configuring paragraph style "${ps.name}"`, currentStep, totalSteps);
        try {
          const cleanedGroup = DomResolver.cleanGroupPath(ps.group, namespacePrefix);
          const groupPath = isReverse
            ? (cleanedGroup ? `Reverse / ${cleanedGroup}` : "Reverse")
            : cleanedGroup;
          const cleanName = ps.name.replace(prefixRegex, "").split(/\s*[\/\\]\s*/).pop()?.trim() || ps.name;
          const rawPs = ps as any;
          const styleProps: any = { ...(rawPs.properties || {}) };

          // Apply Physical Typography Mathematics & Accessibility Mandates
          const role: TypographyRole = rawPs.scaleRole || PhysicalTypographyEngine.detectTypographyRole(cleanName, groupPath);
          PhysicalTypographyEngine.applyPhysicalTypographyRules(styleProps, role, {
            baseBodyCapHeightMm,
            capToEmRatio,
            scaleRatio,
            baselineGridPt,
            opticalTrackingOffset,
            longEdgeMm: docLongEdgeMm
          });

          // Resolve role color
          if (rawPs.roleColor) {
            const swatchName = (themeColors as any)[rawPs.roleColor];
            if (swatchName === "Paper") {
              styleProps.fillColor = "Paper";
            } else if (swatchName && doc.colors) {
              const sw = doc.colors.itemByName(swatchName);
              if (sw && sw.isValid) {
                styleProps.fillColor = sw;
              }
            }
          }

          if (!options.dryRun) {
            DomResolver.getOrCreateParagraphStyle(
              doc,
              cleanName,
              styleProps,
              groupPath,
              rawPs.exportTagMap as any
            );
          }
          report.paragraphStylesCreated++;
          report.details.push(`Configured paragraph style "${cleanName}".`);
        } catch (err: any) {
          if (options.failurePolicy === "strict") throw err;
          report.skippedCount++;
        }
      }
    }

    // 5. Ingest Character Styles
    if (options.applyCharacterStyles !== false && doc.characterStyles) {
      const prefixRegex = new RegExp(`^\\s*(?:${namespacePrefix}\\s*[\\/\\\\]\\s*)+`, "i");

      for (const cs of cStyles) {
        currentStep++;
        this.reportProgress(options, `Configuring character style "${cs.name}"`, currentStep, totalSteps);
        try {
          const charGroup = isReverse ? "Reverse / Character" : "Character";
          const cleanCharName = cs.name.replace(prefixRegex, "").split(/\s*[\/\\]\s*/).pop()?.trim() || cs.name;
          const rawCs = cs as any;
          const styleProps: any = { ...(rawCs.properties || {}) };
          if (rawCs.roleColor) {
            const swatchName = (themeColors as any)[rawCs.roleColor];
            if (swatchName && doc.colors) {
              const sw = doc.colors.itemByName(swatchName);
              if (sw && sw.isValid) {
                styleProps.fillColor = sw;
              }
            }
          }

          if (!options.dryRun) {
            DomResolver.getOrCreateCharacterStyle(
              doc,
              cleanCharName,
              styleProps,
              charGroup,
              rawCs.exportTagMap as any
            );
          }
          report.characterStylesCreated++;
          report.details.push(`Configured character style "${cleanCharName}".`);
        } catch (err: any) {
          if (options.failurePolicy === "strict") throw err;
          report.skippedCount++;
        }
      }
    }

    // 6. Ingest Cell Styles
    if (options.applyCellStyles !== false && doc.cellStyles) {
      const prefixRegex = new RegExp(`^\\s*(?:${namespacePrefix}\\s*[\\/\\\\]\\s*)+`, "i");

      for (const cell of cellStyles) {
        currentStep++;
        this.reportProgress(options, `Configuring cell style "${cell.name}"`, currentStep, totalSteps);
        try {
          const cleanCellName = cell.name.replace(prefixRegex, "").split(/\s*[\/\\]\s*/).pop()?.trim() || cell.name;
          const cellProps: any = {};
          const rawCell = cell as any;
          if (rawCell.role && String(rawCell.role).includes("header")) {
            const hBg = doc.colors?.itemByName(themeColors.tableHeaderBG);
            if (hBg && hBg.isValid) cellProps.fillColor = hBg;
          }
          if (!options.dryRun) {
            DomResolver.getOrCreateCellStyle(doc, cleanCellName, cellProps, "Tables");
          }
          report.cellStylesCreated++;
          report.details.push(`Configured cell style "${cleanCellName}".`);
        } catch (err: any) {
          if (options.failurePolicy === "strict") throw err;
          report.skippedCount++;
        }
      }
    }

    // 7. Ingest Table Styles
    if (options.applyTableStyles !== false && doc.tableStyles) {
      const prefixRegex = new RegExp(`^\\s*(?:${namespacePrefix}\\s*[\\/\\\\]\\s*)+`, "i");

      for (const tbl of tableStyles) {
        currentStep++;
        this.reportProgress(options, `Configuring table style "${tbl.name}"`, currentStep, totalSteps);
        try {
          const cleanTblName = tbl.name.replace(prefixRegex, "").split(/\s*[\/\\]\s*/).pop()?.trim() || tbl.name;
          const tblProps: any = {};
          const rawTbl = tbl as any;
          if (rawTbl.headerRegionCell && doc.cellStyles) {
            const cleanHeaderCell = rawTbl.headerRegionCell.replace(prefixRegex, "").split(/\s*[\/\\]\s*/).pop()?.trim() || rawTbl.headerRegionCell;
            const hc = doc.cellStyles.itemByName(cleanHeaderCell) || doc.cellStyles.itemByName(rawTbl.headerRegionCell);
            if (hc && hc.isValid) tblProps.headerRegionCellStyle = hc;
          }
          if (rawTbl.bodyRegionCell && doc.cellStyles) {
            const cleanBodyCell = rawTbl.bodyRegionCell.replace(prefixRegex, "").split(/\s*[\/\\]\s*/).pop()?.trim() || rawTbl.bodyRegionCell;
            const bc = doc.cellStyles.itemByName(cleanBodyCell) || doc.cellStyles.itemByName(rawTbl.bodyRegionCell);
            if (bc && bc.isValid) tblProps.bodyRegionCellStyle = bc;
          }
          if (!options.dryRun) {
            DomResolver.getOrCreateTableStyle(doc, cleanTblName, tblProps, "Tables");
          }
          report.tableStylesCreated++;
          report.details.push(`Configured table style "${cleanTblName}".`);
        } catch (err: any) {
          if (options.failurePolicy === "strict") throw err;
          report.skippedCount++;
        }
      }
    }

    // 8. Ingest Object Styles (Frames - Radius Large/Medium/Small, Callouts, Cards)
    if (options.applyObjectStyles !== false && doc.objectStyles) {
      const prefixRegex = new RegExp(`^\\s*(?:${namespacePrefix}\\s*[\\/\\\\]\\s*)+`, "i");

      for (const objDef of objStyles) {
        currentStep++;
        this.reportProgress(options, `Configuring object style "${objDef.name}"`, currentStep, totalSteps);
        try {
          const cleanObjName = objDef.name.replace(prefixRegex, "").split(/\s*[\/\\]\s*/).pop()?.trim() || objDef.name;
          const cleanedGroup = DomResolver.cleanGroupPath(objDef.group, namespacePrefix);
          const rawObj = objDef as any;
          const styleProps: any = { ...(rawObj.properties || {}) };

          if (rawObj.roleColor) {
            const swatchName = (themeColors as any)[rawObj.roleColor];
            if (swatchName === "Paper") {
              styleProps.fillColor = "Paper";
            } else if (swatchName && doc.colors) {
              const sw = doc.colors.itemByName(swatchName);
              if (sw && sw.isValid) styleProps.fillColor = sw;
            }
          }

          if (!options.dryRun) {
            DomResolver.getOrCreateObjectStyle(
              doc,
              cleanObjName,
              styleProps,
              cleanedGroup
            );
          }
          report.objectStylesCreated++;
          report.details.push(`Configured object style "${cleanObjName}".`);
        } catch (err: any) {
          if (options.failurePolicy === "strict") throw err;
          report.skippedCount++;
        }
      }
    }

    return report;
  }
}
