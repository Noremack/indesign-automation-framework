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

    return runInTransaction(this.actionName, () => {
      return withNormalizedUnits(doc, () => {
        return this.process(doc, options);
      });
    });
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
