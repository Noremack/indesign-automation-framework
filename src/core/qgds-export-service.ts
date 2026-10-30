import { BaseService } from "./base-service";
import { BaseBatchOptions } from "./types";
import { PathUtils } from "../adapters/path-utils";
import { IStorageAdapter, UserDirectoryStorageAdapter } from "../adapters/user-storage";
import { QgdsPreflightRemediationService, PreflightRemediationReport } from "./qgds-preflight-service";
import { QgdsAstExtractorService, DocumentNode } from "./qgds-ast-extractor";
import {
  foldDocumentAST,
  runQgdsLinter,
  emitQgdsDocument,
  wrapStandaloneHtml,
  generateSourceLedgerMarkdown,
  generateAccessibilityCertificate,
  generateAccessibilityAuditHtml,
  LinterIssue
} from "./qgds-html-emitter";

export interface QgdsExportPipelineOptions extends BaseBatchOptions {
  outputDirectory?: string;
  outputFileName?: string;
  storageAdapter?: IStorageAdapter;
  format?: "web-components" | "bem-html" | "semantic-html" | string;
  preferArticlesReadingOrder?: boolean;
  autoRemediatePreflight?: boolean;
  includeStandaloneHtmlWrapper?: boolean;
  includeDiagnosticsJson?: boolean;
  includeSourceLedger?: boolean;
  includeAccessibilityCertificate?: boolean;
  includeAccessibilityAuditHtml?: boolean;
  offlineMode?: boolean;
  blueprint?: any;
}

export interface QgdsExportPipelineReport {
  htmlPath: string;
  auditReportPath?: string;
  diagnosticsPath?: string;
  sourceLedgerPath?: string;
  certificatePath?: string;
  bytesWritten: number;
  componentsCount: Record<string, number>;
  linterIssues: LinterIssue[];
  wcagCompliant: boolean;
  exportedStoriesCount: number;
  writtenFiles: Record<string, string>;
}

export class QgdsExportPipelineService extends BaseService<
  QgdsExportPipelineOptions,
  QgdsExportPipelineReport
> {
  public override readonly actionName = "QGDS Master Export Pipeline";

  protected process(doc: any, options: QgdsExportPipelineOptions): QgdsExportPipelineReport {
    doc.recompose();
    const outDir = options.outputDirectory || UserDirectoryStorageAdapter.resolveSafeOutputDirectory(doc);
    const storage = options.storageAdapter || new UserDirectoryStorageAdapter(outDir);
    const format = options.format || "web-components";
    const baseName = options.outputFileName
      ? options.outputFileName.replace(/\.[^.]+$/, "")
      : doc.name
        ? String(doc.name).replace(/\.[^.]+$/, "")
        : "publication";

    // 1. Preflight Remediation & Audit
    let preflightReport: PreflightRemediationReport | undefined;
    if (options.autoRemediatePreflight !== false) {
      this.reportProgress(options, "Running Preflight Remediation", 1, 6);
      const preflightService = new QgdsPreflightRemediationService();
      const pResult = preflightService.execute(doc, {
        autoRemediate: true,
        autoCopyDiagnostics: false,
        dryRun: options.dryRun
      });
      if (pResult.success && pResult.data) {
        preflightReport = pResult.data;
      }
    }

    // 2. Extract Document AST
    this.reportProgress(options, "Extracting Document AST", 2, 6);
    const extractor = new QgdsAstExtractorService();
    const extractResult = extractor.execute(doc, {
      preferArticlesReadingOrder: options.preferArticlesReadingOrder !== false,
      dryRun: options.dryRun
    });
    const docNode: DocumentNode = extractResult.data || { type: "document", metadata: {} as any, children: [] };

    // 3. Fold Compound Components
    this.reportProgress(options, "Folding Compound Components", 3, 6);
    const folded = foldDocumentAST(docNode, options.blueprint);

    // 4. Run Accessibility Linter
    this.reportProgress(options, "Running WCAG 2.2 AA Linter", 4, 6);
    runQgdsLinter(folded.foldedDoc, folded.linterIssues);

    // 5. Emit HTML Markup
    this.reportProgress(options, "Emitting Accessible HTML Markup", 5, 6);
    const componentsCount: Record<string, number> = {};
    const bodyHtml = emitQgdsDocument(folded.foldedDoc, format, options.blueprint, componentsCount);
    let finalHtml = bodyHtml;
    if (options.includeStandaloneHtmlWrapper !== false) {
      finalHtml = wrapStandaloneHtml(
        bodyHtml,
        docNode.metadata?.title || baseName,
        format,
        docNode.metadata,
        options.offlineMode
      );
    }

    // 6. Persistence & Deliverable Generation
    this.reportProgress(options, "Writing Deliverables to Storage", 6, 6);
    const writtenFiles: Record<string, string> = {};
    let totalBytes = 0;
    const htmlPath = PathUtils.join(outDir, `${baseName}.html`);
    let auditReportPath: string | undefined;
    let diagnosticsPath: string | undefined;
    let sourceLedgerPath: string | undefined;
    let certificatePath: string | undefined;

    if (!options.dryRun) {
      storage.writeTextFile(htmlPath, finalHtml);
      writtenFiles[htmlPath] = finalHtml;
      totalBytes += finalHtml.length;

      // Standalone Accessibility Audit HTML
      if (options.includeAccessibilityAuditHtml !== false) {
        auditReportPath = PathUtils.join(outDir, `${baseName}-accessibility-audit.html`);
        const findings: any[] = [];
        if (preflightReport && preflightReport.violations) {
          for (const v of preflightReport.violations) {
            findings.push({
              ruleId: v.ruleId,
              severity: v.severity,
              target: v.target,
              message: v.message,
              remediated: true
            });
          }
        }
        for (const l of folded.linterIssues) {
          findings.push({
            ruleId: l.ruleId,
            severity: l.severity,
            target: l.target,
            message: l.message,
            remediated: false
          });
        }
        const auditMeta = {
          docName: doc.name || baseName,
          timestamp: new Date().toLocaleString(),
          violationsFound: (preflightReport?.violationsFound || 0) + folded.linterIssues.length,
          remediationsApplied: preflightReport?.remediationsApplied || 0,
          contrastRemediatedCount: preflightReport?.contrastRemediatedCount || 0,
          linksUpgradedCount: preflightReport?.linksUpgradedCount || 0,
          linearizedFramesCount: preflightReport?.linearizedFramesCount || 0
        };
        const auditHtml = generateAccessibilityAuditHtml(auditMeta, findings);
        storage.writeTextFile(auditReportPath, auditHtml);
        writtenFiles[auditReportPath] = auditHtml;
        totalBytes += auditHtml.length;
      }

      // Diagnostics JSON
      if (options.includeDiagnosticsJson !== false) {
        diagnosticsPath = PathUtils.join(outDir, `${baseName}-diagnostics.json`);
        const diagPayload = JSON.stringify(
          {
            title: docNode.metadata?.title || baseName,
            format,
            componentsCount,
            linterIssues: folded.linterIssues,
            preflight: preflightReport,
            exportedAt: new Date().toISOString()
          },
          null,
          2
        );
        storage.writeTextFile(diagnosticsPath, diagPayload);
        writtenFiles[diagnosticsPath] = diagPayload;
        totalBytes += diagPayload.length;
      }

      // Markdown Source Ledger
      if (options.includeSourceLedger !== false) {
        sourceLedgerPath = PathUtils.join(outDir, `${baseName}-source-ledger.md`);
        const ledgerMd = generateSourceLedgerMarkdown(
          folded.foldedDoc,
          folded.linterIssues,
          componentsCount,
          preflightReport
        );
        storage.writeTextFile(sourceLedgerPath, ledgerMd);
        writtenFiles[sourceLedgerPath] = ledgerMd;
        totalBytes += ledgerMd.length;
      }

      // Accessibility Certificate
      if (options.includeAccessibilityCertificate !== false) {
        certificatePath = PathUtils.join(outDir, `${baseName}-accessibility-certificate.json`);
        const certPayload = JSON.stringify(
          generateAccessibilityCertificate(folded.foldedDoc, folded.linterIssues, preflightReport),
          null,
          2
        );
        storage.writeTextFile(certificatePath, certPayload);
        writtenFiles[certificatePath] = certPayload;
        totalBytes += certPayload.length;
      }
    }

    doc.recompose();
    const wcagCompliant = folded.linterIssues.filter(i => i.severity === "error").length === 0;

    return {
      htmlPath,
      auditReportPath,
      diagnosticsPath,
      sourceLedgerPath,
      certificatePath,
      bytesWritten: totalBytes,
      componentsCount,
      linterIssues: folded.linterIssues,
      wcagCompliant,
      exportedStoriesCount: docNode.children.length,
      writtenFiles
    };
  }

  /**
   * Batch exports all documents contained in an InDesign Book (.indb).
   */
  public exportBook(book: any, options: QgdsExportPipelineOptions): QgdsExportPipelineReport[] {
    const reports: QgdsExportPipelineReport[] = [];
    if (!book) return reports;

    const bookContents = book.bookContents
      ? book.bookContents.everyItem
        ? book.bookContents.everyItem().getElements()
        : book.bookContents
      : [];

    for (let i = 0; i < bookContents.length; i++) {
      const entry = bookContents[i];
      const doc = entry.document || (entry.open ? entry.open() : entry);
      if (doc) {
        const result = this.execute(doc, options);
        if (result.success && result.data) {
          reports.push(result.data);
        }
      }
    }

    return reports;
  }
}
