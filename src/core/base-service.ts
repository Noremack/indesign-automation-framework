import { app } from "indesign";
import { ServiceResult, BaseBatchOptions } from "./types";
import { runInTransaction } from "./transaction";
import { withNormalizedUnits } from "./app-state";

export abstract class BaseService<TOptions extends BaseBatchOptions, TReport> {
  protected abstract readonly actionName: string;
  protected readonly minHostVersion: number = 18.0;

  public execute(doc: any, options: TOptions): ServiceResult<TReport> {
    const currentVersion = parseFloat(app.version);
    if (currentVersion < this.minHostVersion) {
      return {
        success: false,
        error: {
          code: "ERR_UNSUPPORTED_HOST_VERSION",
          domain: "PREFLIGHT",
          message: `Host InDesign v${currentVersion} is unsupported. Minimum required is v${this.minHostVersion}.`,
          recoverable: false
        }
      };
    }

    if (!doc || !doc.isValid) {
      return {
        success: false,
        error: {
          code: "ERR_INVALID_DOCUMENT",
          domain: "DOM_INTEGRITY",
          message: "A valid, active document is required for execution.",
          recoverable: false
        }
      };
    }

    const result = runInTransaction(this.actionName, () => {
      return withNormalizedUnits(doc, () => {
        return this.process(doc, options);
      });
    });

    if (options.notifyOnCompletion) {
      this.displayNotification(result);
    }

    return result;
  }

  protected displayNotification(result: ServiceResult<TReport>): void {
    const title = this.actionName;
    const message = result.success
      ? `Operation completed successfully.`
      : `Operation failed: ${result.error?.message || "Unknown error"}`;

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
