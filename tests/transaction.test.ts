import { describe, it, expect } from "vitest";
import { runInTransaction } from "../src/core/transaction";

describe("runInTransaction", () => {
  it("executes synchronous operations successfully", () => {
    const result = runInTransaction("Test Transaction", () => {
      return 100 + 200;
    });

    expect(result.success).toBe(true);
    expect(result.data).toBe(300);
  });

  it("rejects asynchronous callbacks and returns an error", () => {
    const result = runInTransaction("Async Test", () => {
      // Intentionally return a Promise to test synchronous invariant enforcement
      return Promise.resolve("async result");
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error?.domain).toBe("TRANSACTION");
    expect(result.error?.message).toContain("Transactions must be strictly synchronous");
  });

  it("handles errors thrown inside transaction block", () => {
    const result = runInTransaction("Error Test", () => {
      throw new Error("Failure in transaction body");
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("ERR_TRANSACTION_FAILED");
    expect(result.error?.message).toBe("Failure in transaction body");
  });

  it("supports nested transactions safely", () => {
    const outerResult = runInTransaction("Outer Transaction", () => {
      const innerResult = runInTransaction("Inner Transaction", () => {
        return "nested success";
      });
      return innerResult.data;
    });

    expect(outerResult.success).toBe(true);
    expect(outerResult.data).toBe("nested success");
  });
});
