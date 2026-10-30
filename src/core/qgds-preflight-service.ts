import { BaseService } from "./base-service";
import { BaseBatchOptions } from "./types";
import { auditDocumentContrast, remediateDocumentContrast } from "./contrast-engine";

export interface PreflightViolation {
  ruleId: string;
  severity: "error" | "warning" | "info";
  message: string;
  target: string;
}

export interface PreflightRemediationOptions extends BaseBatchOptions {
  autoRemediate?: boolean;
  targetLanguage?: string;
}

export interface PreflightRemediationReport {
  violationsFound: number;
  remediationsApplied: number;
  linearizedFramesCount: number;
  tocCleanedCount: number;
  tablesRemediatedCount: number;
  languagesAlignedCount: number;
  contrastRemediatedCount: number;
  linksUpgradedCount: number;
  taggedPdfAligned: boolean;
  altTextMissingCount: number;
  ambiguousLinksCount: number;
  sectionsAlignedCount: number;
  skippedCount: number;
  violations: PreflightViolation[];
  details: string[];
}

export class QgdsPreflightRemediationService extends BaseService<
  PreflightRemediationOptions,
  PreflightRemediationReport
> {
  public override readonly actionName = "QGDS Preflight & Remediation";

  protected process(doc: any, options: PreflightRemediationOptions): PreflightRemediationReport {
    const report: PreflightRemediationReport = {
      violationsFound: 0,
      remediationsApplied: 0,
      linearizedFramesCount: 0,
      tocCleanedCount: 0,
      tablesRemediatedCount: 0,
      languagesAlignedCount: 0,
      contrastRemediatedCount: 0,
      linksUpgradedCount: 0,
      taggedPdfAligned: false,
      altTextMissingCount: 0,
      ambiguousLinksCount: 0,
      sectionsAlignedCount: 0,
      skippedCount: 0,
      violations: [],
      details: []
    };

    doc.recompose();
    const autoFix = options.autoRemediate !== false && !options.dryRun;
    const targetLang = options.targetLanguage || "English: UK";
    const totalStages = 11;

    // Stage 1: Document Language Alignment (Rule LANG 3.1)
    this.reportProgress(options, "Auditing language settings (Rule LANG 3.1)", 1, totalStages);
    try {
      if (doc.paragraphStyles) {
        const styles = doc.paragraphStyles.everyItem().getElements();
        for (let i = 0; i < styles.length; i++) {
          const style = styles[i];
          if (style.appliedLanguage !== targetLang) {
            report.violationsFound++;
            report.violations.push({
              ruleId: "LANG 3.1",
              severity: "warning",
              message: `Paragraph style "${style.name}" language is "${style.appliedLanguage || "unspecified"}" (expected "${targetLang}").`,
              target: style.name
            });
            if (autoFix) {
              try {
                style.appliedLanguage = targetLang;
                report.remediationsApplied++;
                report.languagesAlignedCount++;
                report.details.push(`Updated language of style "${style.name}" to "${targetLang}".`);
              } catch (_) {}
            }
          }
        }
      }
    } catch (err: any) {
      if (options.failurePolicy === "strict") throw err;
      report.skippedCount++;
    }

    // Stage 2: Table Header Compliance (Rule TBL 1.2, WCAG 1.3.1, PDF/UA)
    this.reportProgress(options, "Auditing table headers (Rule TBL 1.2)", 2, totalStages);
    try {
      const stories = doc.stories ? doc.stories.everyItem().getElements() : [];
      for (let s = 0; s < stories.length; s++) {
        const story = stories[s];
        if (!story || !story.tables) continue;
        const tables = story.tables.everyItem().getElements();
        for (let t = 0; t < tables.length; t++) {
          const table = tables[t];
          if (table.headerRowCount < 1) {
            report.violationsFound++;
            report.violations.push({
              ruleId: "TBL 1.2",
              severity: "warning",
              message: `Table ${t + 1} lacks a dedicated header row (required for accessible tables).`,
              target: `Table ${t + 1}`
            });
            if (autoFix && table.bodyRowCount > 1) {
              try {
                table.headerRowCount = 1;
                report.remediationsApplied++;
                report.tablesRemediatedCount++;
                report.details.push(`Configured headerRowCount = 1 on Table ${t + 1}.`);
              } catch (_) {}
            }
          }
        }
      }
    } catch (err: any) {
      if (options.failurePolicy === "strict") throw err;
      report.skippedCount++;
    }

    // Stage 3: Dynamic Table of Contents Hygiene (Rule TOC 8.1)
    this.reportProgress(options, "Auditing Table of Contents hygiene (Rule TOC 8.1)", 3, totalStages);
    try {
      const tocStyles = doc.tocStyles ? doc.tocStyles.everyItem().getElements() : [];
      if (tocStyles.length === 0) {
        report.violationsFound++;
        report.violations.push({
          ruleId: "TOC 8.1",
          severity: "info",
          message: "Document does not define a native Table of Contents style (TOC).",
          target: "TOC Styles"
        });
      } else {
        report.tocCleanedCount++;
      }
    } catch (err: any) {
      if (options.failurePolicy === "strict") throw err;
      report.skippedCount++;
    }

    // Stage 4: Geometric Linearization of Floating Elements (Rule ORD 1.1)
    this.reportProgress(options, "Auditing reading order linearization (Rule ORD 1.1)", 4, totalStages);
    try {
      const pages = doc.pages ? doc.pages.everyItem().getElements() : [];
      for (let p = 0; p < pages.length; p++) {
        const page = pages[p];
        if (!page || !page.textFrames) continue;
        const frames = page.textFrames.everyItem().getElements();
        if (frames.length > 1) {
          const sorted = frames.slice().sort((a: any, b: any) => {
            const bA = a.geometricBounds || [0, 0, 0, 0];
            const bB = b.geometricBounds || [0, 0, 0, 0];
            return bA[0] !== bB[0] ? bA[0] - bB[0] : bA[1] - bB[1];
          });
          for (let f = 0; f < sorted.length; f++) {
            const targetFrame = sorted[f];
            if (targetFrame && targetFrame.isValid) {
              try {
                if (autoFix && typeof targetFrame.bringToFront === "function") {
                  targetFrame.bringToFront();
                  report.linearizedFramesCount++;
                }
              } catch (_) {}
            }
          }
          report.details.push(`Linearized ${sorted.length} frames on page ${page.name}.`);
        }
      }
    } catch (err: any) {
      if (options.failurePolicy === "strict") throw err;
      report.skippedCount++;
    }

    // Stage 5: Tagged PDF Preferences (Rule PDF/UA 7.1)
    this.reportProgress(options, "Auditing Tagged PDF export settings (Rule PDF/UA 7.1)", 5, totalStages);
    try {
      if (doc.exportPreferences) {
        const ep = doc.exportPreferences;
        if (ep.exportReaderSpreads === true) {
          report.violationsFound++;
          report.violations.push({
            ruleId: "PDF/UA 7.1",
            severity: "warning",
            message: "Reader spreads are enabled; single-page reading is required for accessible tagged PDF.",
            target: "ExportPreferences"
          });
          if (autoFix) {
            try {
              ep.exportReaderSpreads = false;
              report.remediationsApplied++;
              report.details.push("Disabled exportReaderSpreads for single-page accessible export.");
            } catch (_) {}
          }
        }
        report.taggedPdfAligned = true;
      }
    } catch (err: any) {
      if (options.failurePolicy === "strict") throw err;
      report.skippedCount++;
    }

    // Stage 6: Articles Panel Synchronization (Rule ART 1.3)
    this.reportProgress(options, "Auditing Articles panel reading order (Rule ART 1.3)", 6, totalStages);
    try {
      if (doc.articles) {
        const arts = doc.articles.everyItem ? doc.articles.everyItem().getElements() : doc.articles;
        if (!arts || arts.length === 0) {
          report.violationsFound++;
          report.violations.push({
            ruleId: "ART 1.3",
            severity: "info",
            message: "No articles defined. Screen reader order will rely entirely on spread DOM hierarchy.",
            target: "Articles"
          });
          if (autoFix && typeof doc.articles.add === "function") {
            try {
              const newArt = doc.articles.add({ name: "QGDS Reading Order" });
              const pages = doc.pages ? doc.pages.everyItem().getElements() : [];
              for (let p = 0; p < pages.length; p++) {
                const tf = pages[p].textFrames ? pages[p].textFrames.everyItem().getElements() : [];
                for (let f = 0; f < tf.length; f++) {
                  if (tf[f] && tf[f].isValid && typeof newArt.members?.add === "function") {
                    try { newArt.members.add(tf[f]); } catch (_) {}
                  }
                }
              }
              report.remediationsApplied++;
              report.details.push('Created fallback "QGDS Reading Order" article populated with page text frames.');
            } catch (_) {}
          }
        }
      }
    } catch (err: any) {
      if (options.failurePolicy === "strict") throw err;
      report.skippedCount++;
    }

    // Stage 7: WCAG 2.2 AA Color Contrast Engine (Rule COL 1.1)
    this.reportProgress(options, "Auditing paragraph styles color contrast (Rule COL 1.1)", 7, totalStages);
    try {
      const contrastAudit = auditDocumentContrast(doc);
      if (contrastAudit.violationsCount > 0) {
        report.violationsFound += contrastAudit.violationsCount;
        for (let ci = 0; ci < contrastAudit.violations.length; ci++) {
          const cv = contrastAudit.violations[ci];
          report.violations.push({
            ruleId: "COL 1.1",
            severity: "error",
            message: cv.message,
            target: cv.styleName
          });
        }
        if (autoFix) {
          const fixed = remediateDocumentContrast(doc, "Neutral - Black");
          report.remediationsApplied += fixed;
          report.contrastRemediatedCount += fixed;
          report.details.push(`Remediated ${fixed} paragraph style(s) with low contrast to compliant text.`);
        }
      }
    } catch (err: any) {
      if (options.failurePolicy === "strict") throw err;
      report.skippedCount++;
    }

    // Stage 8: Insecure Hyperlink Upgrade (Rule LNK 2.5)
    this.reportProgress(options, "Auditing hyperlink security (Rule LNK 2.5)", 8, totalStages);
    try {
      if (doc.hyperlinkURLDestinations) {
        const dests = doc.hyperlinkURLDestinations.everyItem
          ? doc.hyperlinkURLDestinations.everyItem().getElements()
          : doc.hyperlinkURLDestinations;
        for (let d = 0; d < dests.length; d++) {
          const dest = dests[d];
          if (!dest || !dest.isValid) continue;
          const url = dest.destinationURL || "";
          if (/^http:\/\//i.test(url)) {
            report.violationsFound++;
            report.violations.push({
              ruleId: "LNK 2.5",
              severity: "warning",
              message: `Insecure HTTP destination detected: "${url}".`,
              target: url
            });
            if (autoFix) {
              try {
                dest.destinationURL = url.replace(/^http:\/\//i, "https://");
                report.remediationsApplied++;
                report.linksUpgradedCount++;
                report.details.push(`Upgraded hyperlink to HTTPS: "${dest.destinationURL}".`);
              } catch (_) {}
            }
          }
        }
      }
    } catch (err: any) {
      if (options.failurePolicy === "strict") throw err;
      report.skippedCount++;
    }

    // Stage 9: Missing Alternative Text Audit (Rule WCAG 1.1.1)
    this.reportProgress(options, "Auditing graphic frames for alt text (Rule WCAG 1.1.1)", 9, totalStages);
    try {
      const allGraphics = doc.allGraphics || [];
      for (let gi = 0; gi < allGraphics.length; gi++) {
        const g = allGraphics[gi];
        if (!g || !g.isValid) continue;
        let hasAlt = false;
        try {
          const tagOpts = g.parent?.objectExportOptions || g.objectExportOptions;
          if (tagOpts && (tagOpts.customAltText || tagOpts.altTextSourceType !== 0)) {
            hasAlt = true;
          }
        } catch (_) {}
        if (!hasAlt) {
          const linkName = g.itemLink && g.itemLink.name ? g.itemLink.name : "Graphic";
          const pgNum = g.parentPage && g.parentPage.name ? g.parentPage.name : "?";
          report.violationsFound++;
          report.altTextMissingCount++;
          report.violations.push({
            ruleId: "WCAG 1.1.1",
            severity: "warning",
            message: `Graphic "${linkName}" on page ${pgNum} lacks alternative text.`,
            target: linkName
          });
        }
      }
    } catch (err: any) {
      if (options.failurePolicy === "strict") throw err;
      report.skippedCount++;
    }

    // Stage 10: Link Purpose / Generic Anchor Text (Rule WCAG 2.4.4)
    this.reportProgress(options, "Auditing link descriptive purpose (Rule WCAG 2.4.4)", 10, totalStages);
    try {
      if (doc.hyperlinks) {
        const hlinks = doc.hyperlinks.everyItem
          ? doc.hyperlinks.everyItem().getElements()
          : doc.hyperlinks;
        for (let hi = 0; hi < hlinks.length; hi++) {
          const hl = hlinks[hi];
          if (!hl || !hl.isValid) continue;
          let srcText = "";
          try {
            if (hl.source && hl.source.sourceText) {
              srcText = hl.source.sourceText.contents || "";
            }
          } catch (_) {}
          const cleanLink = srcText.toLowerCase().trim();
          if (/^(click here|here|read more|more|learn more|download|link)$/.test(cleanLink)) {
            report.violationsFound++;
            report.ambiguousLinksCount++;
            report.violations.push({
              ruleId: "WCAG 2.4.4",
              severity: "warning",
              message: `Ambiguous generic link text "${cleanLink}" is not descriptive.`,
              target: hl.name || cleanLink
            });
          }
        }
      }
    } catch (err: any) {
      if (options.failurePolicy === "strict") throw err;
      report.skippedCount++;
    }

    // Stage 11: Section Marker & Breadcrumbs Alignment (Rule SEC 4.1)
    this.reportProgress(options, "Auditing section markers (Rule SEC 4.1)", 11, totalStages);
    try {
      if (doc.sections) {
        const docSecs = doc.sections.everyItem
          ? doc.sections.everyItem().getElements()
          : doc.sections;
        if (docSecs.length > 1) {
          for (let dsIdx = 0; dsIdx < docSecs.length; dsIdx++) {
            const ds = docSecs[dsIdx];
            if (!ds || !ds.isValid) continue;
            const dsName = ds.name ? ds.name.trim() : "";
            const dsMarker = ds.marker ? ds.marker.trim() : "";
            if (!dsName && !dsMarker) {
              report.violationsFound++;
              report.violations.push({
                ruleId: "SEC 4.1",
                severity: "info",
                message: `Section #${dsIdx + 1} lacks a title or marker for accessible breadcrumbs.`,
                target: `Section #${dsIdx + 1}`
              });
              if (autoFix) {
                try {
                  const pStart = ds.pageStart && ds.pageStart.name ? ds.pageStart.name : String(dsIdx + 1);
                  ds.name = `Section ${dsIdx + 1} (p. ${pStart})`;
                  report.remediationsApplied++;
                  report.sectionsAlignedCount++;
                  report.details.push(`Assigned descriptive section title "${ds.name}".`);
                } catch (_) {}
              }
            }
          }
        }
      }
    } catch (err: any) {
      if (options.failurePolicy === "strict") throw err;
      report.skippedCount++;
    }

    return report;
  }
}

