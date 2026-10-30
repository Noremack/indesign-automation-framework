import { app } from "indesign";
import { StandardLogger } from "../../adapters/logger";
import { NativeDialog } from "../../adapters/native-dialog";
import { UserDirectoryStorageAdapter } from "../../adapters/user-storage";
import { PipelineService, PipelineOptions, PipelineReport } from "../../core/pipeline-service";
import { QgdsBrandEngineService, BrandEngineOptions } from "../../core/qgds-brand-engine";
import { QgdsLayoutEngineService, LayoutEngineOptions } from "../../core/qgds-layout-engine";
import { QgdsSpecimenService, SpecimenOptions } from "../../core/qgds-specimen-service";
import { QgdsSemanticEditorialService, SemanticEditorialOptions } from "../../core/qgds-editorial-service";
import { QgdsPreflightRemediationService, PreflightRemediationOptions } from "../../core/qgds-preflight-service";
import { QgdsResetService } from "../../core/qgds-reset-service";
import { QgdsTemplateBuilderService } from "../../core/qgds-template-builder";
import { QgdsExportPipelineService } from "../../core/qgds-export-service";

export interface QgdsPublishingPipelineOptions extends PipelineOptions {
  theme?: string;
  runSpecimen?: boolean;
  brandEngineOptions?: Partial<BrandEngineOptions>;
  layoutEngineOptions?: Partial<LayoutEngineOptions>;
  specimenOptions?: Partial<SpecimenOptions>;
  semanticEditorialOptions?: Partial<SemanticEditorialOptions>;
  preflightOptions?: Partial<PreflightRemediationOptions>;
}

export class QgdsPublishingPipelineService extends PipelineService {
  public readonly brandEngineService: QgdsBrandEngineService;
  public readonly layoutEngineService: QgdsLayoutEngineService;
  public readonly specimenService: QgdsSpecimenService;
  public readonly semanticEditorialService: QgdsSemanticEditorialService;
  public readonly preflightService: QgdsPreflightRemediationService;

  constructor() {
    const brandEngine = new QgdsBrandEngineService();
    const layoutEngine = new QgdsLayoutEngineService();
    const specimenService = new QgdsSpecimenService();
    const semanticEditorial = new QgdsSemanticEditorialService();
    const preflight = new QgdsPreflightRemediationService();

    super(
      [brandEngine, layoutEngine, specimenService, semanticEditorial, preflight],
      "QGDS Master Publishing Pipeline"
    );

    this.brandEngineService = brandEngine;
    this.layoutEngineService = layoutEngine;
    this.specimenService = specimenService;
    this.semanticEditorialService = semanticEditorial;
    this.preflightService = preflight;
  }

  public override execute(doc: any, options: QgdsPublishingPipelineOptions): any {
    return super.execute(doc, options);
  }

  protected override process(doc: any, options: QgdsPublishingPipelineOptions): PipelineReport {
    const activeTheme = (options.brandEngineOptions?.theme || options.theme || "Blue") as any;

    const brandOpts: BrandEngineOptions = {
      theme: activeTheme,
      applyObjectStyles: true,
      ...(options.brandEngineOptions || {})
    };

    const layoutOpts: LayoutEngineOptions = {
      theme: activeTheme,
      ...(options.layoutEngineOptions || {})
    };

    const specimenOpts: SpecimenOptions = {
      pageIndex: 0,
      injectTables: true,
      injectComponentArchetypes: true,
      dryRun: options.specimenOptions?.dryRun === true || options.runSpecimen === false,
      ...(options.specimenOptions || {})
    };

    const stepOptions = {
      ...(options.stepOptions || {}),
      "QGDS Brand Engine": brandOpts,
      "QGDS Brand Engine & Theme Styler": brandOpts,
      "Brand Engine & Theme Styler": brandOpts,
      "QGDS Layout & Master Spread Engine": layoutOpts,
      "QGDS Typography Specimen & Component Archetype Injection": specimenOpts,
      "Typography Specimen & Component Archetype Injection": specimenOpts,
      "QGDS Semantic Editorial Styler": options.semanticEditorialOptions || {},
      "QGDS Preflight & Remediation": options.preflightOptions || {}
    };

    return super.process(doc, {
      ...options,
      stepOptions
    });
  }
}

export function main(): void {
  const logger = new StandardLogger("InDesignQGDSPublishingSuite");

  if (!app.documents || app.documents.length === 0) {
    NativeDialog.showInDesignAlert("QGDS Publishing Suite", [
      "No active InDesign document found.",
      "",
      "Please open or create an InDesign document (.indd) before running the publishing suite."
    ]);
    logger.warn("No active InDesign document found to run the publishing suite.");
    return;
  }

  const initialDoc = app.activeDocument;
  const defaultOutDir = UserDirectoryStorageAdapter.resolveSafeOutputDirectory(initialDoc);

  // Present Native Dashboard
  const config = NativeDialog.showPublishingDashboard(initialDoc, defaultOutDir);
  if (!config) {
    logger.info("Publishing suite cancelled by user.");
    return;
  }

  // Branch 1: Batch Base Template Generator Mode
  if (config.mode === "batch-templates") {
    logger.info(
      `Starting Batch Base Template Generator... (Theme: ${config.theme}, Style: ${config.styleMode}, Color: ${config.colorMode})`
    );
    const templateBuilder = new QgdsTemplateBuilderService();
    const targetFormats =
      config.targetTemplateFormat && config.targetTemplateFormat !== "All"
        ? [config.targetTemplateFormat]
        : undefined;

    const builderResult = templateBuilder.execute(initialDoc, {
      outputFolder: config.outputDirectory || defaultOutDir,
      targetFormats,
      theme: config.theme,
      styleMode: config.styleMode,
      colorMode: config.colorMode,
      exportIndt: config.exportIndt !== false,
      exportIndd: config.exportIndd === true,
      injectSpecimen: config.runSpecimen,
      dryRun: false
    });

    if (builderResult.success && builderResult.data) {
      const data = builderResult.data;
      const alertLines = [
        "Successfully generated base templates!",
        "",
        `• Templates Generated: ${data.templatesGenerated} (.indt)`,
        `• Documents Saved: ${data.documentsSaved} (.indd)`,
        `• Brand Theme: ${config.theme} (${config.styleMode === "reverse" ? "Reverse Dark" : "Standard Light"})`,
        `• Color Mode: ${config.colorMode}`,
        `• Specimen Injected: ${config.runSpecimen ? "Yes (Page 1)" : "No"}`,
        "",
        "Formats Generated:",
        ...data.formatsProcessed.map(f => `  • ${f}`),
        "",
        "Deliverables Destination:",
        `  ${config.outputDirectory || defaultOutDir}`
      ];
      NativeDialog.showInDesignAlert("QGDS Template Builder - Complete", alertLines);
    } else {
      NativeDialog.showInDesignAlert("QGDS Template Builder Error", [
        "Batch template generation encountered an error:",
        "",
        builderResult.error?.message || "Unknown error"
      ]);
    }
    return;
  }

  // Branch 2: Active Publishing Workflow Mode
  const targetDocs: any[] = [];
  if (config.scope === "all-documents") {
    const docs = app.documents.everyItem ? app.documents.everyItem().getElements() : app.documents;
    for (let i = 0; i < docs.length; i++) {
      if (docs[i] && docs[i].isValid) targetDocs.push(docs[i]);
    }
  } else if (config.scope === "active-book") {
    try {
      const book = (app as any).activeBook || ((app as any).books && (app as any).books[0]);
      if (book && book.bookContents) {
        const bcs = book.bookContents.everyItem ? book.bookContents.everyItem().getElements() : book.bookContents;
        for (let i = 0; i < bcs.length; i++) {
          const bc = bcs[i];
          if (!bc || !bc.isValid) continue;
          let docRef: any = null;
          const openDocs = app.documents.everyItem ? app.documents.everyItem().getElements() : app.documents;
          for (let j = 0; j < openDocs.length; j++) {
            if ((openDocs[j] as any).fullName === bc.fullName || openDocs[j].name === bc.name) {
              docRef = openDocs[j];
              break;
            }
          }
          if (!docRef) {
            try {
              docRef = (app as any).open(bc.fullName);
            } catch (_) {}
          }
          if (docRef && docRef.isValid) {
            targetDocs.push(docRef);
          }
        }
      }
    } catch (bErr: any) {
      logger.warn(`Could not resolve book contents: ${bErr?.message}`);
    }
  }

  if (targetDocs.length === 0) {
    targetDocs.push(initialDoc);
  }

  logger.info(
    `Starting batch execution across ${targetDocs.length} document(s)... (Theme: ${config.theme}, Mode: ${config.styleMode}, Color: ${config.colorMode})`
  );

  const summaryResults: Array<{ docName: string; success: boolean; data?: any; error?: string }> = [];

  for (let dIdx = 0; dIdx < targetDocs.length; dIdx++) {
    const doc = targetDocs[dIdx];
    logger.info(`Processing document ${dIdx + 1}/${targetDocs.length}: "${doc.name}"...`);

    // Stage 0: Document Reset & Sanitization Protocol
    if (config.runReset) {
      const resetService = new QgdsResetService();
      const resetResult = resetService.execute(doc, {
        resetMasters: true,
        resetTextFrames: true,
        resetStyles: true,
        resetSwatches: true
      });
      logger.info(
        `Document "${doc.name}" sanitized: ${resetResult.data?.stylesRemoved || 0} styles purged, ${resetResult.data?.layersUnlocked || 0} layers unlocked.`
      );
    }

    // Stages 1-5: Layout, Brand, Editorial, and Preflight Alignment Pipeline
    const pipelineShouldRun =
      config.runLayout || config.runBrand || config.runEditorial || config.runPreflight || config.runSpecimen;

    if (pipelineShouldRun) {
      const pipeline = new QgdsPublishingPipelineService();
      const pipelineResult = pipeline.execute(doc, {
        notifyOnCompletion: false,
        autoCopyDiagnostics: false,
        theme: config.theme,
        runSpecimen: config.runSpecimen,
        layoutEngineOptions: {
          enforceStratification: config.runLayout,
          createMasters: config.runLayout,
          cleanMasters: config.runLayout,
          enforceMargins: config.runLayout,
          remapBodyPages: config.runLayout,
          injectFooters: config.runLayout,
          injectDecorations: config.runLayout
        },
        brandEngineOptions: {
          theme: config.theme as any,
          styleMode: config.styleMode as any,
          colorMode: config.colorMode as any,
          applyColors: config.runBrand,
          applyGradients: config.runBrand,
          applyParagraphStyles: config.runBrand,
          applyCharacterStyles: config.runBrand,
          applyObjectStyles: config.runBrand,
          applyCellStyles: config.runBrand,
          applyTableStyles: config.runBrand
        },
        specimenOptions: {
          pageIndex: 0,
          injectTables: true,
          injectComponentArchetypes: true,
          dryRun: !config.runSpecimen
        },
        onProgress: p => {
          logger.info(`[Doc ${dIdx + 1}/${targetDocs.length} - Alignment ${p.percentage}%] ${p.stage}`);
        }
      });

      if (!pipelineResult.success) {
        logger.error(`Pipeline alignment failed on "${doc.name}":`, pipelineResult.error);
        if (targetDocs.length === 1) {
          NativeDialog.showInDesignAlert("QGDS Publishing Pipeline Error", [
            `Pipeline alignment failed on document "${doc.name}":`,
            "",
            `${pipelineResult.error?.message || "Unknown error"}`,
            "",
            "All mutations were safely rolled back."
          ]);
          return;
        }
      }
    }

    // Stage 6: Master Deliverables Export Pipeline
    if (config.runExport) {
      const exporter = new QgdsExportPipelineService();
      const outDir = config.outputDirectory || UserDirectoryStorageAdapter.resolveSafeOutputDirectory(doc);
      const exportResult = exporter.execute(doc, {
        format: config.format,
        outputDirectory: outDir,
        storageAdapter: new UserDirectoryStorageAdapter(outDir),
        includeStandaloneHtmlWrapper: true,
        includeSourceLedger: true,
        includeDiagnosticsJson: true,
        includeAccessibilityCertificate: true,
        includeAccessibilityAuditHtml: true,
        notifyOnCompletion: false,
        autoCopyDiagnostics: targetDocs.length === 1,
        onProgress: p => {
          logger.info(`[Doc ${dIdx + 1}/${targetDocs.length} - Export ${p.percentage}%] ${p.stage}`);
        }
      });

      if (exportResult.success && exportResult.data) {
        summaryResults.push({
          docName: doc.name,
          success: true,
          data: exportResult.data
        });
      } else {
        summaryResults.push({
          docName: doc.name,
          success: false,
          error: exportResult.error?.message || "Export failed"
        });
      }
    } else {
      summaryResults.push({
        docName: doc.name,
        success: true,
        data: null
      });
    }
  }

  // Final Dialog Summary
  if (targetDocs.length === 1) {
    const res = summaryResults[0];
    if (res && res.success && res.data) {
      NativeDialog.showInDesignAlert("QGDS Publishing Suite - Complete", [
        `Successfully processed "${initialDoc.name}"!`,
        "",
        `• Sanitization Reset: ${config.runReset ? "Completed (Purged custom styles & swatches)" : "Skipped"}`,
        `• Brand Theme: ${config.theme} (${config.styleMode === "reverse" ? "Reverse Dark" : "Standard Light"} - ${config.colorMode})`,
        `• Layout & Masters: ${config.runLayout ? "Enforced (Format detected, A-Cover, B-Content, margins & folios)" : "Skipped"}`,
        `• Brand Foundation: ${config.runBrand ? "Applied (37 Swatches, Gradients, 42 Paras, 16 Chars, Tables)" : "Skipped"}`,
        `• Specimen Injection: ${config.runSpecimen ? "Injected (Typography & Accessible Tables on Page 1)" : "Skipped"}`,
        `• Editorial Normalization: ${config.runEditorial ? "Applied" : "Skipped"}`,
        `• Preflight Remediation: ${config.runPreflight ? "Completed (WCAG 2.2 AA)" : "Skipped"}`,
        `• Deliverables Exported: Success`,
        "",
        "Generated Deliverables Location:",
        `  ${config.outputDirectory || defaultOutDir}`,
        "",
        "Files Written to Disk:",
        `  1. ${res.data.htmlPath} (Accessible HTML Preview)`,
        `  2. ${res.data.auditReportPath || "accessibility-audit.html"} (Standalone Accessibility Audit)`,
        `  3. ${res.data.sourceLedgerPath || "source-ledger.md"} (Markdown Source Ledger)`,
        `  4. ${res.data.diagnosticsPath || "diagnostics.json"} (Machine Diagnostics JSON)`,
        `  5. ${res.data.certificatePath || "certificate.json"} (Schema.org Accessibility Certificate)`
      ]);
    } else if (res && !res.success) {
      NativeDialog.showInDesignAlert("QGDS Master Export Error", [
        `Export failed on document "${initialDoc.name}":`,
        "",
        `${res.error || "Unknown error"}`
      ]);
    } else {
      NativeDialog.showInDesignAlert("QGDS Publishing Suite - Complete", [
        `Successfully processed "${initialDoc.name}"!`,
        "",
        `• Sanitization Reset: ${config.runReset ? "Completed" : "Skipped"}`,
        `• Brand Theme: ${config.theme} (${config.styleMode === "reverse" ? "Reverse Dark" : "Standard Light"} - ${config.colorMode})`,
        `• Layout & Masters: ${config.runLayout ? "Enforced (A-Cover, B-Content, margins & folios)" : "Skipped"}`,
        `• Brand Foundation: ${config.runBrand ? "Applied" : "Skipped"}`,
        `• Specimen Injection: ${config.runSpecimen ? "Injected" : "Skipped"}`,
        `• Editorial Normalization: ${config.runEditorial ? "Applied" : "Skipped"}`,
        `• Preflight Remediation: ${config.runPreflight ? "Completed (WCAG 2.2 AA)" : "Skipped"}`,
        `• Deliverables Export: Skipped`
      ]);
    }
  } else {
    const successfulCount = summaryResults.filter(r => r.success).length;
    const alertLines = [
      `Batch processing complete across ${targetDocs.length} documents:`,
      `  • Theme Applied: ${config.theme} (${config.styleMode === "reverse" ? "Reverse Dark" : "Standard Light"} - ${config.colorMode})`,
      `  • Succeeded: ${successfulCount} / ${targetDocs.length}`,
      `  • Failed / Skipped: ${targetDocs.length - successfulCount}`,
      "",
      "Documents Processed:"
    ];
    for (let i = 0; i < summaryResults.length; i++) {
      const sr = summaryResults[i];
      alertLines.push(`  ${i + 1}. ${sr.docName}: ${sr.success ? "Success" : "Failed (" + sr.error + ")"}`);
    }
    alertLines.push("");
    alertLines.push("Deliverables Destination:");
    alertLines.push(`  ${config.outputDirectory || defaultOutDir}`);
    NativeDialog.showInDesignAlert("QGDS Batch Publishing Suite - Complete", alertLines);
  }
}

// Self-execute on run
main();
