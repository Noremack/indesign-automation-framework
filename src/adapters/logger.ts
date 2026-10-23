export class StandardLogger {
  constructor(private readonly prefix: string = "[Framework]") {}

  info(message: string, context?: Record<string, unknown>): void {
    console.log(`${this.prefix} [INFO] ${message}`, context ? JSON.stringify(context) : "");
  }

  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(`${this.prefix} [WARN] ${message}`, context ? JSON.stringify(context) : "");
  }

  error(message: string, error?: unknown): void {
    console.error(`${this.prefix} [ERROR] ${message}`, error);
  }
}
