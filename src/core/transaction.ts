import { app, ScriptLanguage, UndoModes } from "indesign";
import { ServiceResult } from "./types";

let isTransactionActive = false;

export function runInTransaction<T>(
  actionName: string,
  operation: () => T
): ServiceResult<T> {
  if (isTransactionActive) {
    try {
      const res = operation();
      if (res !== null && typeof res === "object" && typeof (res as any).then === "function") {
        throw new Error("Async callback detected inside nested transaction.");
      }
      return { success: true, data: res };
    } catch (err: any) {
      return {
        success: false,
        error: {
          code: "ERR_NESTED_TRANSACTION_FAILED",
          domain: "TRANSACTION",
          message: err instanceof Error ? err.message : String(err),
          recoverable: true,
          stack: err instanceof Error ? err.stack : undefined
        }
      };
    }
  }

  let executionResult: T;
  let executionError: Error | null = null;

  const wrappedAction = () => {
    isTransactionActive = true;
    try {
      const res = operation();
      if (res !== null && typeof res === "object" && typeof (res as any).then === "function") {
        throw new Error("Async callback detected inside runInTransaction. Transactions must be strictly synchronous.");
      }
      executionResult = res;
    } catch (err: any) {
      executionError = err instanceof Error ? err : new Error(String(err));
      // Re-throw so InDesign's UndoModes.ENTIRE_SCRIPT rolls back all mutations atomically
      throw executionError;
    } finally {
      isTransactionActive = false;
    }
  };

  try {
    app.doScript(
      wrappedAction,
      ScriptLanguage.UXP_SCRIPT,
      [],
      UndoModes.ENTIRE_SCRIPT,
      actionName
    );
  } catch (fatalErr: any) {
    isTransactionActive = false;
    const errorObj = executionError || (fatalErr instanceof Error ? fatalErr : new Error(String(fatalErr)));
    return {
      success: false,
      error: {
        code: executionError ? "ERR_TRANSACTION_FAILED" : "ERR_DOSCRIPT_FATAL",
        domain: "TRANSACTION",
        message: errorObj.message,
        recoverable: executionError !== null,
        stack: errorObj.stack
      }
    };
  }

  return { success: true, data: executionResult! };
}
