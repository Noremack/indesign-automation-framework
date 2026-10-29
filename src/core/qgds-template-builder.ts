import { PathUtils } from "../adapters/path-utils";
import { BaseService } from "./base-service";
import { QgdsBrandEngineService, QgdsStyleMode, QgdsThemeName } from "./qgds-brand-engine";
import { QgdsLayoutEngineService } from "./qgds-layout-engine";
import { QgdsSpecimenService } from "./qgds-specimen-service";
import { QGDS_BRAND_TOKENS } from "./qgds-tokens";
import { BrandThemeAdapter } from "./theme-adapter";
import { BaseBatchOptions } from "./types";

declare const app: any;

export interface TemplateBuilderOptions extends BaseBatchOptions {
  targetFormats?: string[];
  outputFolder?: string;
  theme?: string;
  styleMode?: QgdsStyleMode;
  colorMode?: "RGB" | "CMYK";
  adapter?: BrandThemeAdapter;
  exportIndt?: boolean;
  exportIndd?: boolean;
  injectSpecimen?: boolean;
  injectComponentArchetypes?: boolean;
  includeOrientations?: Array<"portrait" | "landscape">;
}

export interface TemplateBuilderReport {
  templatesGenerated: number;
  documentsSaved: number;
  formatsProcessed: string[];
  outputFiles: string[];
  skippedCount: number;
  details: string[];
}

/**
 * Headless Base Template Generator. Generates production InDesign templates (.indt)
 * and documents (.indd) across configured page formats with layout geometry,
 * master spreads, brand style matrices, and typography specimens applied.
 */
export class QgdsTemplateBuilderService extends BaseService<TemplateBuilderOptions, TemplateBuilderReport> {
  protected actionName = "Headless Base Template Generator";

  protected process(activeDoc: any, options: TemplateBuilderOptions): TemplateBuilderReport {
    const report: TemplateBuilderReport = {
      templatesGenerated: 0,
      documentsSaved: 0,
      formatsProcessed: [],
      outputFiles: [],
      skippedCount: 0,
      details: []
    };

    const adapter = options.adapter;
    const tenantFolder = adapter ? `${adapter.tenantId}_Deliverables` : "Deliverables";
    const outputFolder = options.outputFolder || `./${tenantFolder}`;

    let pageMatrix: any[];
    if (adapter && Array.isArray(adapter.package?.layoutPresets) && adapter.package.layoutPresets.length > 0) {
      pageMatrix = adapter.package.layoutPresets.map(p => ({
        name: p.name,
        formatStr: p.name.replace(/\s+/g, ""),
        type: "document",
        shortEdge: p.shortEdgeMm,
        longEdge: p.longEdgeMm,
        margin: p.marginMm,
        gutter: p.gutterMm,
        bleed: p.bleedMm,
        baseFont: p.baseFontPt,
        isFacingPages: p.isFacingPages,
        orientation: ["portrait", "landscape"]
      }));
    } else {
      pageMatrix = (QGDS_BRAND_TOKENS as any).pageMatrix || [];
    }

    // Filter target formats
    const targetFormats = (options.targetFormats && options.targetFormats.length > 0)
      ? pageMatrix.filter((f: any) =>
          options.targetFormats!.includes(f.name) ||
          options.targetFormats!.includes(f.formatStr) ||
          options.targetFormats!.includes(f.type)
        )
      : pageMatrix;

    if (targetFormats.length === 0) {
      report.details.push("No matching formats found in page matrix.");
      return report;
    }

    const layoutEngine = new QgdsLayoutEngineService();
    const brandEngine = new QgdsBrandEngineService();
    const specimenService = new QgdsSpecimenService();

    let totalItems = 0;
    targetFormats.forEach((f: any) => {
      const orientations = f.orientation || ["portrait", "landscape"];
      totalItems += orientations.length;
    });
    let currentStep = 0;

    for (let fIdx = 0; fIdx < targetFormats.length; fIdx++) {
      const format = targetFormats[fIdx];
      const orientations: Array<"portrait" | "landscape"> = (format.orientation && format.orientation.length > 0)
        ? (format.orientation as Array<"portrait" | "landscape">)
        : ["portrait", "landscape"];

      const filteredOrientations = options.includeOrientations && options.includeOrientations.length > 0
        ? orientations.filter((o) => options.includeOrientations!.includes(o))
        : orientations;

      for (let oIdx = 0; oIdx < filteredOrientations.length; oIdx++) {
        const orientation = filteredOrientations[oIdx];
        currentStep++;

        let widthMm = format.shortEdge;
        let heightMm = format.longEdge;
        if (orientation === "landscape") {
          widthMm = format.longEdge;
          heightMm = format.shortEdge;
        }

        const widthPt = widthMm * 2.83464567;
        const heightPt = heightMm * 2.83464567;

        const docType = format.type || "document";
        const formatStr = format.formatStr || format.name;
        const fileName = `${docType}-${formatStr.toLowerCase()}-${orientation}-${widthMm}x${heightMm}mm.indt`;
        const dirPath = PathUtils.join(outputFolder, docType);
        const targetPath = PathUtils.join(dirPath, fileName);

        this.reportProgress(options, `Building template: ${fileName}`, currentStep, totalItems);

        if (options.dryRun) {
          report.templatesGenerated++;
          if (options.exportIndd) report.documentsSaved++;
          report.outputFiles.push(targetPath);
          if (options.exportIndd) report.outputFiles.push(targetPath.replace(/\.indt$/i, ".indd"));
          if (!report.formatsProcessed.includes(format.name)) report.formatsProcessed.push(format.name);
          report.details.push(`[DryRun] Would generate: ${targetPath}`);
          continue;
        }

        let newDoc: any = null;
        try {
          if (typeof app !== "undefined" && app.documents && typeof app.documents.add === "function") {
            newDoc = app.documents.add(false);
          } else if (activeDoc && activeDoc.isValid) {
            newDoc = activeDoc;
          }

          if (!newDoc || !newDoc.isValid) {
            throw new Error(`Unable to instantiate document for ${format.name} (${orientation}).`);
          }

          // Normalize dimensions and facing pages
          if (newDoc.documentPreferences) {
            newDoc.documentPreferences.pageWidth = widthPt;
            newDoc.documentPreferences.pageHeight = heightPt;

            if (format.isFacingPages !== undefined) {
              newDoc.documentPreferences.facingPages = Boolean(format.isFacingPages);
            } else {
              const isLargeFormat = Math.max(format.shortEdge, format.longEdge) > 425;
              newDoc.documentPreferences.facingPages = !isLargeFormat && format.name !== "DL" && format.type !== "card";
            }
          }

          // Stage 1: Layout Engine (Masters, Margins, Folios)
          layoutEngine.execute(newDoc, {
            ...options,
            adapter,
            formatOverride: format.name,
            injectFooters: true,
            dryRun: false
          });

          // Stage 2: Brand Engine (Swatches, Gradients, Styles)
          brandEngine.execute(newDoc, {
            ...options,
            adapter,
            theme: options.theme || (adapter ? adapter.defaultTheme : "Blue"),
            styleMode: options.styleMode || "standard",
            dryRun: false
          });

          // Stage 3: Specimen & Component Archetypes
          if (options.injectSpecimen !== false) {
            specimenService.execute(newDoc, {
              ...options,
              adapter,
              injectTables: true,
              injectComponentArchetypes: options.injectComponentArchetypes || false,
              dryRun: false
            });
          }

          this.ensureDirectory(dirPath);

          // Save .indt template
          if (options.exportIndt !== false && typeof newDoc.save === "function") {
            newDoc.save(targetPath, true);
            report.templatesGenerated++;
            report.outputFiles.push(targetPath);
          }

          // Save .indd document if requested
          if (options.exportIndd && typeof newDoc.save === "function") {
            const inddPath = targetPath.replace(/\.indt$/i, ".indd");
            newDoc.save(inddPath, false);
            report.documentsSaved++;
            report.outputFiles.push(inddPath);
          }

          if (!report.formatsProcessed.includes(format.name)) {
            report.formatsProcessed.push(format.name);
          }

          report.details.push(`Successfully generated: ${fileName}`);
        } catch (err: any) {
          if (options.failurePolicy === "strict") throw err;
          report.skippedCount++;
          report.details.push(`Failed generating ${format.name} (${orientation}): ${err?.message}`);
        } finally {
          // Close headless document without saving further changes
          if (newDoc && newDoc !== activeDoc && typeof newDoc.close === "function") {
            try {
              newDoc.close(1852776480); // SaveOptions.NO
            } catch (_) {}
          }
        }
      }
    }

    return report;
  }

  /**
   * Safe cross-runtime directory creation without legacy Folder or browser APIs.
   */
  private ensureDirectory(dirPath: string): void {
    try {
      const fs = typeof require !== "undefined" ? require("fs") : null;
      if (fs && typeof fs.mkdirSync === "function") {
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
      }
    } catch (_) {}
  }
}
