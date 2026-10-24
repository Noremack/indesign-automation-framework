import { describe, it, expect } from "vitest";
import { MockDocument } from "./mocks/indesign-mock";
import { BaseService } from "../src/core/base-service";
import { BaseBatchOptions } from "../src/core/types";
import { PipelineService } from "../src/core/pipeline-service";

class StepOneService extends BaseService<BaseBatchOptions, { count: number }> {
  public actionName = "Step One";
  protected process(doc: any, options: BaseBatchOptions) {
    return { count: 10 };
  }
}

class StepTwoService extends BaseService<BaseBatchOptions, { count: number }> {
  public actionName = "Step Two";
  protected process(doc: any, options: BaseBatchOptions) {
    return { count: 20 };
  }
}

class StepFailingService extends BaseService<BaseBatchOptions, void> {
  public actionName = "Failing Step";
  protected process(doc: any, options: BaseBatchOptions): void {
    throw new Error("Pipeline step failure simulation");
  }
}

describe("PipelineService", () => {
  it("executes multiple child services sequentially and aggregates reports", () => {
    const pipeline = new PipelineService([
      new StepOneService(),
      new StepTwoService()
    ], "Test Sequence Pipeline");

    const doc = new MockDocument();
    const progressList: any[] = [];

    const result = pipeline.execute(doc, {
      onProgress: (p) => progressList.push(p)
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.totalSteps).toBe(2);
    expect(result.data?.stepsSucceeded).toBe(2);
    expect(result.data?.stepsFailed).toBe(0);
    expect(result.data?.stepReports.length).toBe(2);
    expect(result.data?.stepReports[0].serviceName).toBe("Step One");
    expect((result.data?.stepReports[0].data as any).count).toBe(10);
    expect(result.data?.stepReports[1].serviceName).toBe("Step Two");
    expect((result.data?.stepReports[1].data as any).count).toBe(20);
    expect(progressList.length).toBe(2);
  });

  it("handles step failures under permissive policy by continuing subsequent steps", () => {
    const pipeline = new PipelineService([
      new StepOneService(),
      new StepFailingService(),
      new StepTwoService()
    ]);

    const doc = new MockDocument();
    const result = pipeline.execute(doc, { failurePolicy: "permissive" });

    expect(result.success).toBe(true);
    expect(result.data?.totalSteps).toBe(3);
    expect(result.data?.stepsSucceeded).toBe(2);
    expect(result.data?.stepsFailed).toBe(1);
    expect(result.data?.stepReports[1].success).toBe(false);
    expect(result.data?.stepReports[1].error).toContain("Pipeline step failure simulation");
    expect(result.data?.stepReports[2].success).toBe(true);
  });

  it("triggers atomic rollback under strict policy when any step fails", () => {
    const pipeline = new PipelineService([
      new StepOneService(),
      new StepFailingService(),
      new StepTwoService()
    ]);

    const doc = new MockDocument();
    const result = pipeline.execute(doc, { failurePolicy: "strict" });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("ERR_TRANSACTION_FAILED");
    expect(result.error?.message).toContain("Pipeline step failure simulation");
  });
});
