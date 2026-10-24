import { BaseService } from "./base-service";
import { BaseBatchOptions } from "./types";

export interface StepReport {
  serviceName: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface PipelineReport {
  totalSteps: number;
  stepsSucceeded: number;
  stepsFailed: number;
  stepReports: StepReport[];
}

export interface PipelineOptions extends BaseBatchOptions {
  stepOptions?: Record<string, unknown>;
}

export class PipelineService extends BaseService<PipelineOptions, PipelineReport> {
  protected readonly actionName: string;
  private readonly services: BaseService<any, any>[];

  constructor(services: BaseService<any, any>[], pipelineName: string = "Composite Pipeline") {
    super();
    this.services = services;
    this.actionName = pipelineName;
  }

  protected process(doc: any, options: PipelineOptions): PipelineReport {
    const report: PipelineReport = {
      totalSteps: this.services.length,
      stepsSucceeded: 0,
      stepsFailed: 0,
      stepReports: []
    };

    const total = this.services.length;

    for (let i = 0; i < total; i++) {
      const childService = this.services[i];
      const serviceName = (childService as any).actionName || `Step ${i + 1}`;

      this.reportProgress(
        options,
        `Executing ${serviceName}`,
        i + 1,
        total
      );

      try {
        // Pass child-specific options if mapped by name or fallback to parent options
        const childOpts = {
          ...options,
          ...(options.stepOptions && (options.stepOptions as any)[serviceName]
            ? (options.stepOptions as any)[serviceName]
            : {})
        };

        // Execute child process logic directly within parent transaction and unit normalization boundary
        const childData = (childService as any).process(doc, childOpts);

        report.stepsSucceeded++;
        report.stepReports.push({
          serviceName,
          success: true,
          data: childData
        });
      } catch (stepErr: any) {
        report.stepsFailed++;
        report.stepReports.push({
          serviceName,
          success: false,
          error: stepErr instanceof Error ? stepErr.message : String(stepErr)
        });

        if (options.failurePolicy === "strict") {
          // Re-throw in strict mode to trigger atomic rollback across the entire multi-service pipeline
          throw stepErr;
        }
      }
    }

    return report;
  }
}
