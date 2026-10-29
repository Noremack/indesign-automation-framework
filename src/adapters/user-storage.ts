import { PathUtils } from "./path-utils";

/**
 * Storage adapter interface decoupling file persistence from environment specifics.
 */
export interface IStorageAdapter {
  writeTextFile(filePath: string, content: string): boolean;
  readTextFile(filePath: string): string | null;
  exists(filePath: string): boolean;
  listFiles(): string[];
  getWrittenFiles(): Record<string, string>;
}

/**
 * Production storage adapter for InDesign UXP scripts and Node runtimes.
 * Safely writes to user-permitted disk locations without triggering EACCES errors.
 */
export class UserDirectoryStorageAdapter implements IStorageAdapter {
  private baseDir: string;
  private writtenFiles: Record<string, string> = {};

  constructor(baseDir: string = ".") {
    this.baseDir = PathUtils.normalize(baseDir);
  }

  public getBaseDir(): string {
    return this.baseDir;
  }

  private ensureDirectoryExists(dirPath: string): void {
    try {
      // In InDesign UXP and Node.js environments, 'fs' is available via CommonJS require
      const fs = typeof require !== "undefined" ? require("fs") : null;
      if (fs && typeof fs.mkdirSync === "function") {
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
      }
    } catch (err: any) {
      console.warn(`[UserDirectoryStorageAdapter] Could not create directory "${dirPath}": ${err?.message}`);
    }
  }

  public writeTextFile(filePath: string, content: string): boolean {
    const normalized = PathUtils.normalize(filePath);
    const dir = PathUtils.dirname(normalized);
    this.ensureDirectoryExists(dir);

    try {
      const fs = typeof require !== "undefined" ? require("fs") : null;
      if (fs && typeof fs.writeFileSync === "function") {
        fs.writeFileSync(normalized, content, "utf8");
        this.writtenFiles[normalized] = content;
        return true;
      }
    } catch (err: any) {
      console.error(`[UserDirectoryStorageAdapter] Failed writing file "${normalized}": ${err?.message}`);
      throw err;
    }

    // In-memory fallback if fs is absent (e.g. mock test environments)
    this.writtenFiles[normalized] = content;
    return true;
  }

  public readTextFile(filePath: string): string | null {
    const normalized = PathUtils.normalize(filePath);
    try {
      const fs = typeof require !== "undefined" ? require("fs") : null;
      if (fs && typeof fs.readFileSync === "function" && fs.existsSync(normalized)) {
        return fs.readFileSync(normalized, "utf8");
      }
    } catch (_) {}

    return this.writtenFiles[normalized] || null;
  }

  public exists(filePath: string): boolean {
    const normalized = PathUtils.normalize(filePath);
    try {
      const fs = typeof require !== "undefined" ? require("fs") : null;
      if (fs && typeof fs.existsSync === "function") {
        return fs.existsSync(normalized);
      }
    } catch (_) {}

    return normalized in this.writtenFiles;
  }

  public listFiles(): string[] {
    return Object.keys(this.writtenFiles);
  }

  public getWrittenFiles(): Record<string, string> {
    return { ...this.writtenFiles };
  }

  /**
   * Resolves a guaranteed safe, user-writable output folder on standard user accounts:
   * 1. If document is saved, returns `<documentFolder>/Deliverables`
   * 2. If document is unsaved, resolves `<UserHome>/Desktop/${tenantPrefix}_Deliverables`
   * 3. Fallback to `<Temp>/${tenantPrefix}_Deliverables`
   */
  public static resolveSafeOutputDirectory(doc?: any, subFolder: string = "Deliverables", tenantPrefix: string = "QGDS"): string {
    // 1. If document is saved on disk, use its parent directory
    try {
      if (doc && doc.saved) {
        let rawPath: string | null = null;
        if (typeof doc.filePath === "string") {
          rawPath = doc.filePath;
        } else if (doc.filePath && doc.filePath.fsName) {
          rawPath = doc.filePath.fsName;
        } else if (doc.filePath) {
          rawPath = String(doc.filePath);
        }
        if (rawPath && rawPath !== "[object Object]") {
          return PathUtils.join(rawPath, subFolder);
        }
      }
    } catch (_) {}

    // 2. Try environment variables for standard user desktop (Windows & macOS)
    try {
      const env = typeof process !== "undefined" && process.env ? process.env : {};
      const home = env.USERPROFILE || env.HOME;
      if (home) {
        return PathUtils.join(home, "Desktop", `${tenantPrefix}_${subFolder}`);
      }
    } catch (_) {}

    // 3. Fallback to temp directory
    try {
      const env = typeof process !== "undefined" && process.env ? process.env : {};
      const tempDir = env.TEMP || env.TMP || "C:/Temp";
      return PathUtils.join(tempDir, `${tenantPrefix}_${subFolder}`);
    } catch (_) {}

    return `./${subFolder}`;
  }
}

