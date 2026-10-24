import { describe, it, expect, vi } from "vitest";
import { MockDocument, mockApp } from "./mocks/indesign-mock";
import { BaseService } from "../src/core/base-service";
import { BaseBatchOptions, ProgressReport } from "../src/core/types";

class TestLayoutService extends BaseService<BaseBatchOptions, { count: number }> {
  public actionName = "Test Layout Service";
  public minHostVersion = 18.0;

  protected process(doc: any, options: BaseBatchOptions) {
    this.reportProgress(options, "Processing step 1", 1, 2);
    this.reportProgress(options, "Processing step 2", 2, 2);
    return { count: 42 };
  }
}

class FailingService extends BaseService<BaseBatchOptions, void> {
  protected readonly actionName = "Failing Service";

  protected process(doc: any, options: BaseBatchOptions): void {
    throw new Error("Simulated failure in processing");
  }
}

describe("BaseService Invariant Execution", () => {
  it("executes successfully within normalized environment and reports progress", () => {
    const service = new TestLayoutService();
    const doc = new MockDocument();
    const progressLog: ProgressReport[] = [];

    const result = service.execute(doc, {
      onProgress: (p) => progressLog.push(p)
    });

    expect(result.success).toBe(true);
    expect(result.data?.count).toBe(42);
    expect(progressLog.length).toBe(2);
    expect(progressLog[0].percentage).toBe(50);
    expect(progressLog[1].percentage).toBe(100);
  });

  it("fails preflight when host InDesign version is below required minimum", () => {
    const service = new TestLayoutService();
    const doc = new MockDocument();
    
    // Temporarily mock host version to unsupported version
    const originalVersion = mockApp.version;
    mockApp.version = "17.0";

    const result = service.execute(doc, {});
    expect(result.success).toBe(false);
    expect(result.error?.domain).toBe("PREFLIGHT");
    expect(result.error?.code).toBe("ERR_UNSUPPORTED_HOST_VERSION");

    // Restore version
    mockApp.version = originalVersion;
  });

  it("fails when an invalid document is provided", () => {
    const service = new TestLayoutService();
    const result = service.execute(null as any, {});

    expect(result.success).toBe(false);
    expect(result.error?.domain).toBe("DOM_INTEGRITY");
    expect(result.error?.code).toBe("ERR_INVALID_DOCUMENT");
  });

  it("captures runtime errors thrown in process and returns structured error result", () => {
    const service = new FailingService();
    const doc = new MockDocument();
    const result = service.execute(doc, {});

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.domain).toBe("TRANSACTION");
    expect(result.error?.message).toContain("Simulated failure");
  });

  it("supports permissive failure policy by continuing execution and recording skipped elements", () => {
    class BatchProcessor extends BaseService<BaseBatchOptions, { processed: number; skipped: number }> {
      protected readonly actionName = "Batch Processor";

      protected process(doc: any, options: BaseBatchOptions) {
        const report = { processed: 0, skipped: 0 };
        const items = [1, 2, 3];

        for (const item of items) {
          try {
            if (item === 2) {
              throw new Error("Element 2 processing error");
            }
            report.processed++;
          } catch (err) {
            if (options.failurePolicy === "strict") {
              throw err;
            }
            report.skipped++;
          }
        }
        return report;
      }
    }

    const service = new BatchProcessor();
    const doc = new MockDocument();

    // Permissive execution
    const permissiveResult = service.execute(doc, { failurePolicy: "permissive", scope: "spread" });
    expect(permissiveResult.success).toBe(true);
    expect(permissiveResult.data?.processed).toBe(2);
    expect(permissiveResult.data?.skipped).toBe(1);

    // Strict execution
    const strictResult = service.execute(doc, { failurePolicy: "strict" });
    expect(strictResult.success).toBe(false);
    expect(strictResult.error?.code).toBe("ERR_TRANSACTION_FAILED");
    expect(strictResult.error?.message).toContain("Element 2 processing error");
  });

  it("handles notifyOnCompletion gracefully without throwing", () => {
    const service = new TestLayoutService();
    const doc = new MockDocument();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const result = service.execute(doc, { notifyOnCompletion: true });
    expect(result.success).toBe(true);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[Notification] Test Layout Service"));

    logSpy.mockRestore();
  });

  it("supports dryRun mode and provides simulated notification", () => {
    const service = new TestLayoutService();
    const doc = new MockDocument();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const result = service.execute(doc, { dryRun: true, notifyOnCompletion: true });
    expect(result.success).toBe(true);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("[Notification] Test Layout Service (Dry Run): Simulation completed successfully (no changes applied).")
    );

    logSpy.mockRestore();
  });

  it("formats structured diagnostic payload and copies to clipboard on failure", () => {
    const service = new FailingService();
    const doc = new MockDocument();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const result = service.execute(doc, { notifyOnCompletion: true });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();

    const diagnosticJson = service.copyDiagnosticToClipboard(result.error);
    const parsed = JSON.parse(diagnosticJson);

    expect(parsed.status).toBe("FAILED");
    expect(parsed.action).toBe("Failing Service");
    expect(parsed.errorCode).toBe("ERR_TRANSACTION_FAILED");
    expect(parsed.message).toContain("Simulated failure in processing");

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("[Notice] A diagnostic report was copied to your clipboard. Paste into your AI assistant for instant debugging.")
    );

    logSpy.mockRestore();
  });

  it("respects autoCopyDiagnostics: false and does not copy to clipboard", () => {
    const service = new FailingService();
    const doc = new MockDocument();
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const result = service.execute(doc, { autoCopyDiagnostics: false, notifyOnCompletion: true });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();

    // Verify notification does NOT include clipboard copy notice
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("[Notification] Failing Service: Operation failed: Simulated failure in processing")
    );
    expect(logSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("[Notice] Failure diagnostic payload copied")
    );

    logSpy.mockRestore();
  });
});