import { describe, it, expect } from "vitest";
import { PathUtils } from "../src/adapters/path-utils";

describe("PathUtils", () => {
  it("converts Windows backslashes to POSIX slashes", () => {
    expect(PathUtils.toPosix("C:\\Adobe\\InDesign\\scripts\\main.idjs")).toBe(
      "C:/Adobe/InDesign/scripts/main.idjs"
    );
  });

  it("normalizes redundant slashes and relative parent traversal", () => {
    expect(PathUtils.normalize("folder//subfolder/../file.txt")).toBe(
      "folder/file.txt"
    );
    expect(PathUtils.normalize("/root/a/b/../../c")).toBe("/root/c");
  });

  it("joins path segments safely without relying on Node path module", () => {
    const joined = PathUtils.join("root", "folder", "sub", "file.idjs");
    expect(joined).toBe("root/folder/sub/file.idjs");

    const joinedWin = PathUtils.join("C:\\folder", "sub", "file.idjs");
    expect(joinedWin).toBe("C:/folder/sub/file.idjs");
  });

  it("extracts basename with and without extension", () => {
    expect(PathUtils.basename("/path/to/script.idjs")).toBe("script.idjs");
    expect(PathUtils.basename("/path/to/script.idjs", ".idjs")).toBe("script");
    expect(PathUtils.basename("C:\\folder\\asset.png", ".png")).toBe("asset");
  });

  it("extracts directory name", () => {
    expect(PathUtils.dirname("/path/to/script.idjs")).toBe("/path/to");
    expect(PathUtils.dirname("C:/path/to/script.idjs")).toBe("C:/path/to");
    expect(PathUtils.dirname("filename.txt")).toBe(".");
  });

  it("extracts extension name", () => {
    expect(PathUtils.extname("/path/to/script.idjs")).toBe(".idjs");
    expect(PathUtils.extname("file.min.js")).toBe(".js");
    expect(PathUtils.extname("noext")).toBe("");
  });

  it("detects absolute paths on POSIX and Windows", () => {
    expect(PathUtils.isAbsolute("/unix/path")).toBe(true);
    expect(PathUtils.isAbsolute("C:\\windows\\path")).toBe(true);
    expect(PathUtils.isAbsolute("D:/windows/path")).toBe(true);
    expect(PathUtils.isAbsolute("relative/path")).toBe(false);
  });
});
