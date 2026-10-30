export class StandardLogger {
  private logFilePath = "C:/Work/InDesign Scripts/publishing-suite-execution.log";

  constructor(private readonly prefix: string = "[Framework]") {}

  private writeToDisk(level: string, message: string, extra?: unknown): void {
    try {
      const fs = typeof require !== "undefined" ? require("fs") : null;
      if (fs && typeof fs.appendFileSync === "function") {
        const timestamp = new Date().toISOString();
        const extraStr = extra ? (extra instanceof Error ? extra.stack : JSON.stringify(extra)) : "";
        fs.appendFileSync(this.logFilePath, `[${timestamp}] ${this.prefix} [${level}] ${message} ${extraStr}\n`, "utf8");
      }
    } catch (_) {}
  }

  info(message: string, context?: Record<string, unknown>): void {
    console.log(`${this.prefix} [INFO] ${message}`, context ? JSON.stringify(context) : "");
    this.writeToDisk("INFO", message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(`${this.prefix} [WARN] ${message}`, context ? JSON.stringify(context) : "");
    this.writeToDisk("WARN", message, context);
  }

  error(message: string, error?: unknown): void {
    console.error(`${this.prefix} [ERROR] ${message}`, error);
    this.writeToDisk("ERROR", message, error);
  }
}
