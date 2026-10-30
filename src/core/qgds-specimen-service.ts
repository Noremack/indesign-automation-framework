import { BaseService } from "./base-service";
import { DomResolver } from "./dom-resolver";
import { QGDS_BRAND_TOKENS } from "./qgds-tokens";
import { BrandThemeAdapter } from "./theme-adapter";
import { BaseBatchOptions } from "./types";

export interface SpecimenOptions extends BaseBatchOptions {
  pageIndex?: number;
  injectTables?: boolean;
  injectComponentArchetypes?: boolean;
  targetLayerName?: string;
  margin?: number; // In Points
  adapter?: BrandThemeAdapter;
}

export interface SpecimenReport {
  specimenFramesCreated: number;
  paragraphsFormatted: number;
  tablesInjected: number;
  componentsInjected: number;
  skippedCount: number;
  details: string[];
}

/**
 * Service that injects brand typography specimens, accessible tables,
 * and design system component archetypes into target InDesign pages.
 */
export class QgdsSpecimenService extends BaseService<SpecimenOptions, SpecimenReport> {
  public override readonly actionName = "QGDS Typography Specimen & Component Archetype Injection";

  protected process(doc: any, options: SpecimenOptions): SpecimenReport {
    doc.recompose();
    const adapter = options.adapter;
    const namespacePrefix = adapter ? adapter.namespacePrefix : "QGDS";
    const tenantName = adapter ? adapter.tenantName : "Queensland Government Design System";
    const tenantId = adapter ? adapter.tenantId : "QGDS";

    const report: SpecimenReport = {
      specimenFramesCreated: 0,
      paragraphsFormatted: 0,
      tablesInjected: 0,
      componentsInjected: 0,
      skippedCount: 0,
      details: []
    };

    if (!doc.pages || doc.pages.length === 0) {
      if (typeof doc.pages?.add === "function" && !options.dryRun) {
        doc.pages.add();
      } else {
        report.details.push("Document contains no pages; specimen injection aborted.");
        return report;
      }
    }

    const pageIndex = options.pageIndex !== undefined ? options.pageIndex : 0;
    const targetPage = doc.pages[pageIndex] || doc.pages[0];
    if (!targetPage || !targetPage.isValid) {
      report.details.push(`Target page at index ${pageIndex} is invalid.`);
      return report;
    }

    // 1. Resolve Target Layer
    let targetLayer = doc.layers.itemByName(options.targetLayerName || "Foreground");
    if (!targetLayer || !targetLayer.isValid) {
      targetLayer = doc.layers.itemByName("Content");
    }
    if (!targetLayer || !targetLayer.isValid) {
      targetLayer = doc.layers[0] || doc.activeLayer;
    }

    // 2. Clear Existing Specimen Frames (Backwards sweep)
    const dynamicLabel = adapter ? `${adapter.tenantId}_BrandSpecimen` : "DynamicBrandSpecimen";
    const specimenName = adapter ? `${adapter.tenantName} Specimen` : "Typography Specimen";

    try {
      const pageItems = targetPage.pageItems
        ? (targetPage.pageItems.everyItem ? targetPage.pageItems.everyItem().getElements() : targetPage.pageItems)
        : [];

      for (let i = pageItems.length - 1; i >= 0; i--) {
        const item = pageItems[i];
        if (
          item &&
          item.isValid &&
          (item.label === "DynamicBrandSpecimen" ||
            item.label === dynamicLabel ||
            item.name === "Typography Specimen" ||
            item.name === specimenName)
        ) {
          if (item.locked && !options.dryRun) item.locked = false;
          if (!options.dryRun) item.remove();
        }
      }
    } catch (err: any) {
      if (options.failurePolicy === "strict") throw err;
      report.skippedCount++;
    }

    // 3. Compute Bounds based on Page Dimensions and Margins
    const pB = targetPage.bounds || [0, 0, 841.89, 595.28];
    const pageHeight = Math.abs(pB[2] - pB[0]);
    const pageWidth = Math.abs(pB[3] - pB[1]);

    // Parse margins (standardizing to Points)
    let mTop = 36;
    let mBottom = 36;
    let mLeft = 36;
    let mRight = 36;

    if (options.margin !== undefined) {
      mTop = options.margin;
      mBottom = options.margin;
      mLeft = options.margin;
      mRight = options.margin;
    } else if (targetPage.marginPreferences) {
      const mp = targetPage.marginPreferences;
      mTop = this.toPoints(mp.top, mTop);
      mBottom = this.toPoints(mp.bottom, mBottom);
      mLeft = this.toPoints(mp.left, mLeft);
      mRight = this.toPoints(mp.right, mRight);
    }

    // Account for potential header / footer banners from master spreads
    const headerOffset = Math.max(0, pageHeight * 0.05);
    const footerOffset = Math.max(0, pageHeight * 0.08);

    const top = pB[0] + mTop + headerOffset;
    const bottom = pB[2] - mBottom - footerOffset;
    const left = pB[1] + mLeft;
    const right = pB[3] - mRight;

    if (bottom <= top) {
      report.details.push("Calculated specimen bounds are collapsed or invalid.");
      return report;
    }

    if (options.dryRun) {
      report.specimenFramesCreated++;
      report.details.push(`[DryRun] Would inject specimen text frame at [${top.toFixed(1)}, ${left.toFixed(1)}, ${bottom.toFixed(1)}, ${right.toFixed(1)}] pt.`);
      return report;
    }

    // 4. Create Specimen Text Frame
    let tf: any = null;
    try {
      if (targetLayer && targetLayer.isValid) {
        try { targetLayer.locked = false; targetLayer.visible = true; } catch (_) {}
      }
      if (targetPage.textFrames && typeof targetPage.textFrames.add === "function") {
        try { tf = targetPage.textFrames.add(); } catch (_) {}
        if (!tf) { try { tf = targetPage.textFrames.add({}); } catch (_) {} }
      }
      if (!tf && targetPage.parent && targetPage.parent.textFrames && typeof targetPage.parent.textFrames.add === "function") {
        try { tf = targetPage.parent.textFrames.add(); } catch (_) {}
        if (!tf) { try { tf = targetPage.parent.textFrames.add({}); } catch (_) {} }
      }
      if (tf && tf.isValid) {
        if (targetLayer && targetLayer.isValid) try { tf.itemLayer = targetLayer; } catch (_) {}
        try { tf.geometricBounds = [top, left, bottom, right]; } catch (_) {}
        tf.label = dynamicLabel;
        tf.name = specimenName;

        // Configure multi-column layout for wider formats
        if (tf.textFramePreferences) {
          if (pageWidth > 500) {
            tf.textFramePreferences.textColumnCount = 2;
          } else {
            tf.textFramePreferences.textColumnCount = 1;
          }
        }

        // Clear stroke and fill
        const swNone = doc.swatches.itemByName("[None]") || doc.swatches.itemByName("None");
        if (swNone && swNone.isValid) {
          tf.fillColor = swNone;
          tf.strokeColor = swNone;
        }
        tf.strokeWeight = 0;
        report.specimenFramesCreated++;
      } else {
        throw new Error("Unable to create text frame proxy.");
      }
    } catch (err: any) {
      if (options.failurePolicy === "strict") throw err;
      report.skippedCount++;
      report.details.push(`Failed to create specimen text frame: ${err.message}`);
      return report;
    }

    // 5. Ingest Specimen Paragraph Content & Styles
    let specimenDefs: Array<{ text: string; style: string }> = [];
    if (adapter && adapter.getSpecimenStyles().length > 0) {
      specimenDefs = adapter.getSpecimenStyles();
    } else if (adapter && adapter.getParagraphStyles().length > 0) {
      const declared = adapter.getParagraphStyles();
      specimenDefs = declared.slice(0, 10).map(s => ({
        text: `${s.name.split("/").pop()?.trim()} — ${tenantName} Visual Standard`,
        style: s.name
      }));
    } else {
      specimenDefs = (QGDS_BRAND_TOKENS as any).specimenStyles || [];
    }

    if (specimenDefs.length > 0) {
      const contentText = specimenDefs.map((s: any) => s.text).join("\r") + "\r";
      tf.contents = contentText;

      const paragraphs = tf.paragraphs ? (tf.paragraphs.everyItem ? tf.paragraphs.everyItem().getElements() : tf.paragraphs) : [];

      for (let s = 0; s < specimenDefs.length && s < paragraphs.length; s++) {
        const def = specimenDefs[s];
        const para = paragraphs[s];
        if (!para || !def.style) continue;

        try {
          const pStyle = DomResolver.getParagraphStyleSafely(doc, def.style, namespacePrefix);
          if (pStyle && pStyle.isValid) {
            if (typeof para.applyParagraphStyle === "function") {
              para.applyParagraphStyle(pStyle, true);
            } else {
              para.appliedParagraphStyle = pStyle;
            }
            if (typeof para.clearOverrides === "function") {
              try { para.clearOverrides(); } catch (_) {}
            }
            report.paragraphsFormatted++;
          }
        } catch (_) {
          report.skippedCount++;
        }
      }
      report.details.push(`Formatted ${report.paragraphsFormatted} specimen paragraph(s).`);
    }

    // 6. Ingest Accessible Component Archetypes & Tables
    if (options.injectTables !== false) {
      this.injectSpecimenTables(doc, tf, report, namespacePrefix);
    }

    if (options.injectComponentArchetypes) {
      this.injectArchetypeContainers(doc, targetPage, targetLayer, pB, report, adapter, namespacePrefix);
    }

    doc.recompose();
    return report;
  }

  /**
   * Injects sample accessible tables into the specimen text frame.
   */
  private injectSpecimenTables(doc: any, tf: any, report: SpecimenReport, namespacePrefix: string): void {
    try {
      const insertionPoint = tf.insertionPoints && typeof tf.insertionPoints.lastItem === "function"
        ? tf.insertionPoints.lastItem()
        : null;

      if (!insertionPoint || !insertionPoint.tables || typeof insertionPoint.tables.add !== "function") {
        return;
      }

      // Add Table 1: Solid Header Table (spacing controlled via style properties, no blank paragraph hacks)
      insertionPoint.contents = "\r";
      const table1 = insertionPoint.tables.add({
        headerRowCount: 1,
        bodyRowCount: 3,
        columnCount: 3
      });

      if (table1 && table1.isValid) {
        this.populateTableCells(table1, "Solid Header Specimen");
        const tStyle1 = DomResolver.getTableStyleSafely(doc, "Table - Solid Header", namespacePrefix) ||
                        DomResolver.getTableStyleSafely(doc, "Solid Header", namespacePrefix);
        if (tStyle1 && tStyle1.isValid) {
          try {
            table1.appliedTableStyle = tStyle1;
            if (typeof table1.clearTableStyleOverrides === "function") table1.clearTableStyleOverrides(true);
            if (table1.cells?.everyItem && typeof table1.cells.everyItem().clearCellStyleOverrides === "function") {
              table1.cells.everyItem().clearCellStyleOverrides(true);
            }
          } catch (_) {}
        }
        report.tablesInjected++;
      }

      // Add Table 2: Clean Header Table (spacing controlled via style properties, no blank paragraph hacks)
      const lastIp = tf.insertionPoints.lastItem();
      lastIp.contents = "\r";
      const table2 = lastIp.tables.add({
        headerRowCount: 1,
        bodyRowCount: 3,
        columnCount: 3
      });

      if (table2 && table2.isValid) {
        this.populateTableCells(table2, "Clean Header Specimen");
        const tStyle2 = DomResolver.getTableStyleSafely(doc, "Table - Clean Header", namespacePrefix) ||
                        DomResolver.getTableStyleSafely(doc, "Clean Header", namespacePrefix);
        if (tStyle2 && tStyle2.isValid) {
          try {
            table2.appliedTableStyle = tStyle2;
            if (typeof table2.clearTableStyleOverrides === "function") table2.clearTableStyleOverrides(true);
            if (table2.cells?.everyItem && typeof table2.cells.everyItem().clearCellStyleOverrides === "function") {
              table2.cells.everyItem().clearCellStyleOverrides(true);
            }
          } catch (_) {}
        }
        report.tablesInjected++;
      }

      report.details.push(`Injected ${report.tablesInjected} accessible specimen table(s).`);
    } catch (_) {
      report.skippedCount++;
    }
  }

  /**
   * Helper to populate table headers and rows with descriptive content.
   */
  private populateTableCells(table: any, titlePrefix: string): void {
    try {
      if (table.rows && table.rows.length >= 4 && table.columns && table.columns.length >= 3) {
        // Headers
        table.rows[0].cells[0].contents = "Metric / Indicator";
        table.rows[0].cells[1].contents = "Target Allocation";
        table.rows[0].cells[2].contents = "Status";

        // Body rows
        table.rows[1].cells[0].contents = `${titlePrefix} Alpha`;
        table.rows[1].cells[1].contents = "$4,250,000";
        table.rows[1].cells[2].contents = "Active";

        table.rows[2].cells[0].contents = `${titlePrefix} Beta`;
        table.rows[2].cells[1].contents = "$1,820,000";
        table.rows[2].cells[2].contents = "Under Review";

        table.rows[3].cells[0].contents = `${titlePrefix} Gamma`;
        table.rows[3].cells[1].contents = "$940,000";
        table.rows[3].cells[2].contents = "Scheduled";
      }
    } catch (_) {}
  }

  /**
   * Injects structured component archetypes (callout box and feature cards).
   */
  private injectArchetypeContainers(
    doc: any,
    page: any,
    layer: any,
    pB: number[],
    report: SpecimenReport,
    adapter?: BrandThemeAdapter,
    namespacePrefix: string = "QGDS"
  ): void {
    try {
      if (!page.textFrames || typeof page.textFrames.add !== "function") return;

      const tenantId = adapter ? adapter.tenantId : "QGDS";
      const calloutTop = pB[0] + 50;
      const calloutBottom = calloutTop + 90;
      const calloutLeft = pB[1] + 50;
      const calloutRight = pB[3] - 50;

      let calloutFrame: any = null;
      try { calloutFrame = page.textFrames.add(); } catch (_) {
        try { calloutFrame = page.textFrames.add({}); } catch (_) {}
      }
      if (!calloutFrame || !calloutFrame.isValid) return;

      if (layer && layer.isValid) {
        try { calloutFrame.itemLayer = layer; } catch (_) {}
      }
      calloutFrame.geometricBounds = [calloutTop, calloutLeft, calloutBottom, calloutRight];
      calloutFrame.label = adapter ? `${adapter.tenantId}_BrandComponent` : "DynamicBrandComponent";
      calloutFrame.name = "Component Archetype - Callout";
      calloutFrame.contents = "Important Advisory Notice\rAll projects must undergo environmental and accessibility certification before publication.\r";

      const headingStyle =
        DomResolver.getParagraphStyleSafely(doc, "Callout / Heading", namespacePrefix) ||
        DomResolver.getParagraphStyleSafely(doc, "Heading 3", namespacePrefix);
      const bodyStyle =
        DomResolver.getParagraphStyleSafely(doc, "Callout / Body", namespacePrefix) ||
        DomResolver.getParagraphStyleSafely(doc, "Body", namespacePrefix);

      if (calloutFrame.paragraphs && calloutFrame.paragraphs.length >= 2) {
        if (headingStyle && headingStyle.isValid) calloutFrame.paragraphs[0].appliedParagraphStyle = headingStyle;
        if (bodyStyle && bodyStyle.isValid) calloutFrame.paragraphs[1].appliedParagraphStyle = bodyStyle;
      }

      let lightFill: any = null;
      let accentStroke: any = null;

      if (adapter) {
        const roles = adapter.resolveRoleColors(adapter.defaultTheme);
        if (doc.swatches) {
          lightFill = doc.swatches.itemByName(roles.frameFillColor);
          accentStroke = doc.swatches.itemByName(roles.accentColor || roles.subtleStrokeColor);
        }
      }

      if (!lightFill || !lightFill.isValid) {
        lightFill = doc.swatches?.itemByName("Blue - Extra Light") || doc.swatches?.itemByName("Neutral - Extra Light");
      }
      if (lightFill && lightFill.isValid) calloutFrame.fillColor = lightFill;

      if (!accentStroke || !accentStroke.isValid) {
        accentStroke = doc.swatches?.itemByName("Blue - Medium") || doc.swatches?.itemByName("Neutral - Dark");
      }
      if (accentStroke && accentStroke.isValid) {
        calloutFrame.strokeColor = accentStroke;
        calloutFrame.strokeWeight = 1.5;
      }

      report.componentsInjected++;
      report.details.push("Injected Component Archetype: Callout Box.");
    } catch (_) {
      report.skippedCount++;
    }
  }

  /**
   * Helper to convert numeric or unit-string measurements to Points.
   */
  private toPoints(val: any, fallback: number): number {
    if (typeof val === "number") return val;
    if (typeof val === "string") {
      const num = parseFloat(val);
      if (isNaN(num)) return fallback;
      if (val.toLowerCase().endsWith("mm")) return num * 2.83464567; // 1 mm = 2.83465 pt
      if (val.toLowerCase().endsWith("in")) return num * 72;
      if (val.toLowerCase().endsWith("pt")) return num;
      return num;
    }
    return fallback;
  }
}
