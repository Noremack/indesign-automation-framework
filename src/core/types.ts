export type ErrorDomain = 
  | "DOM_INTEGRITY" 
  | "IO" 
  | "PREFLIGHT" 
  | "VALIDATION" 
  | "TRANSACTION";

export interface FrameworkError {
  code: string;
  domain: ErrorDomain;
  message: string;
  targetElement?: {
    id: number;
    constructorName: string;
    pageIndex?: number;
  };
  recoverable: boolean;
  stack?: string;
}

export interface ServiceResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: FrameworkError;
}

export interface ProgressReport {
  stage: string;
  current: number;
  total: number;
  percentage: number;
}

export type ProgressCallback = (report: ProgressReport) => void;

export type FailurePolicy = "strict" | "permissive";

export type ExecutionScope = "selection" | "page" | "spread" | "document";

export interface BaseBatchOptions {
  onProgress?: ProgressCallback;
  failurePolicy?: FailurePolicy;
  scope?: ExecutionScope;
}

