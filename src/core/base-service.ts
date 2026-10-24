import { app } from "indesign";
import { ServiceResult, BaseBatchOptions, FrameworkError } from "./types";
import { runInTransaction } from "./transaction";
import { withNormalizedUnits } from "./app-state";

export abstract class BaseService<TOptions extends BaseBatchOptions, TReport> {
  protected abstract readonly actionName: string;
  protected readonly minHostVersion: number = 18.0;

  public execute(doc: any, options: TOptions): ServiceResult<TReport> {
    const currentVersion = parseFloat(app.version);
    if (currentVersion < this.minHostVersion) {
      const result: ServiceResult<TReport> = {
        success: false,
        error: {
          code: "ERR_UNSUPPORTED_HOST_VERSION",
          domain: "PREFLIGHT",
          message: `Host InDesign v${currentVersion} is unsupported. Minimum required is v${this.minHostVersion}.`,
          recoverable: false
        }
      };
      this.copyDiagnosticToClipboard(result.error);
      if (options.notifyOnCompletion) {
        this.displayNotification(result, options);
      }
      return result;
    }

    if (!doc || !doc.isValid) {
      const result: ServiceResult<TReport> = {
        success: false,
        error: {
          code: "ERR_INVALID_DOCUMENT",
          domain: "DOM_INTEGRITY",
          message: "A valid, active document is required for execution.",
          recoverable: false
        }
      };
      this.copyDiagnosticToClipboard(result.error);
      if (options.notifyOnCompletion) {
        this.displayNotification(result, options);
      }
      return result;
    }

    const actionLabel = options.dryRun ? `${this.actionName} (Dry Run)` : this.actionName;
    const result = runInTransaction(actionLabel, () => {
      return withNormalizedUnits(doc, () => {
        return this.process(doc, options);
      });
    });

    if (!result.success) {
      this.copyDiagnosticToClipboard(result.error);
    }

    if (options.notifyOnCompletion) {
      this.displayNotification(result, options);
    }

    return result;
  }

  public copyDiagnosticToClipboard(error?: FrameworkError): string {
    if (!error) return "";
    const payload = {
      status: "FAILED",
      action: this.actionName,
      errorCode: error.code,
      domain: error.domain,
      message: error.message,
      targetElement: error.targetElement,
      recoverable: error.recoverable,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };
    const formatted = JSON.stringify(payload, null, 2);

    try {
      const uxp = require("uxp");
      if (uxp && uxp.clipboard && typeof uxp.clipboard.writeText === "function") {
        const res = uxp.clipboard.writeText(formatted);
        if (res && typeof res.then === "function") {
          res.catch(() => {});
        }
      }
    } catch (_) {}

    return formatted;
  }

  protected displayNotification(
    result: ServiceResult<TReport>,
    options?: TOptions
  ): void {
    const title = options?.dryRun ? `${this.actionName} (Dry Run)` : this.actionName;
    const message = result.success
      ? (options?.dryRun ? "Simulation completed successfully (no changes applied)." : "Operation completed successfully.")
      : `Operation failed: ${result.error?.message || "Unknown error"}\n\nDiagnostic report copied to clipboard. Paste into your AI assistant for instant debugging.`;

    try {
      const uxp = require("uxp");
      if (uxp && uxp.dialogs && typeof uxp.dialogs.showAlert === "function") {
        uxp.dialogs.showAlert({ title, message });
        return;
      }
    } catch (_) {}

    // Fallback for CLI or non-dialog test environments
    console.log(`[Notification] ${title}: ${message}`);
  }

  protected abstract process(doc: any, options: TOptions): TReport;

  protected reportProgress(
    options: TOptions,
    stage: string,
    current: number,
    total: number
  ): void {
    if (options.onProgress) {
      options.onProgress({
        stage,
        current,
        total,
        percentage: total > 0 ? Math.round((current / total) * 100) : 0
      });
    }
  }
}
