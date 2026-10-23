/**
 * Pure, zero-dependency cross-platform path utilities.
 * Designed to run safely in InDesign UXP (where Node 'path' is absent),
 * web contexts, and Node.js test runners alike.
 */
export class PathUtils {
  public static toPosix(targetPath: string): string {
    return targetPath.replace(/\\/g, "/");
  }

  public static normalize(targetPath: string): string {
    const isWin = /^[a-zA-Z]:[\\/]/.test(targetPath);
    let normalized = targetPath.replace(/\\/g, "/");
    
    // Replace duplicate slashes
    normalized = normalized.replace(/\/{2,}/g, "/");
    
    // Resolve . and ..
    const segments = normalized.split("/");
    const resolved: string[] = [];
    
    for (const seg of segments) {
      if (seg === "." || seg === "") {
        if (resolved.length === 0 && normalized.startsWith("/")) {
          resolved.push("");
        }
        continue;
      }
      if (seg === "..") {
        if (resolved.length > 0 && resolved[resolved.length - 1] !== "..") {
          resolved.pop();
        } else {
          resolved.push(seg);
        }
      } else {
        resolved.push(seg);
      }
    }
    
    let result = resolved.join("/");
    if (normalized.startsWith("/") && !result.startsWith("/")) {
      result = "/" + result;
    }
    return result || ".";
  }

  public static join(...segments: string[]): string {
    if (segments.length === 0) return ".";
    const joined = segments.filter(Boolean).join("/");
    return PathUtils.normalize(joined);
  }

  public static resolve(...segments: string[]): string {
    return PathUtils.join(...segments);
  }

  public static basename(targetPath: string, ext?: string): string {
    const posix = PathUtils.toPosix(targetPath);
    const lastSlash = posix.lastIndexOf("/");
    let base = lastSlash === -1 ? posix : posix.substring(lastSlash + 1);
    if (ext && base.endsWith(ext)) {
      base = base.substring(0, base.length - ext.length);
    }
    return base;
  }

  public static dirname(targetPath: string): string {
    const posix = PathUtils.toPosix(targetPath);
    const lastSlash = posix.lastIndexOf("/");
    if (lastSlash === -1) return ".";
    if (lastSlash === 0) return "/";
    return posix.substring(0, lastSlash);
  }

  public static extname(targetPath: string): string {
    const base = PathUtils.basename(targetPath);
    const lastDot = base.lastIndexOf(".");
    if (lastDot <= 0) return "";
    return base.substring(lastDot);
  }

  public static isAbsolute(targetPath: string): boolean {
    return /^([a-zA-Z]:[\\/]|[\/])/.test(targetPath);
  }
}
