import { describe, it, expect, vi } from "vitest";
import { packPrompt } from "../tools/pack-prompt.mjs";
import { extractSignaturesAST } from "../tools/extract-context.mjs";
import { StandardLogger } from "../src/adapters/logger";

describe("Support Tools & Adapters", () => {
  describe("StandardLogger", () => {
    it("formats INFO, WARN, and ERROR messages with prefix", () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const logger = new StandardLogger("[TestPrefix]");
      logger.info("Informational message", { key: "val" });
      logger.warn("Warning alert");
      logger.error("Error failure", new Error("Boom"));

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("[TestPrefix] [INFO] Informational message"),
        expect.stringContaining("key")
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[TestPrefix] [WARN] Warning alert"),
        ""
      );
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("[TestPrefix] [ERROR] Error failure"),
        expect.any(Error)
      );

      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe("packPrompt", () => {
    it("packs rules, contracts, and task within token budget", () => {
      const payload = packPrompt({
        rulesPath: "antigravity.rules.json",
        typesPath: "src/core/types.ts",
        taskDescription: "Test packing task"
      });

      expect(payload).toContain("[RULES]");
      expect(payload).toContain("[CONTRACTS]");
      expect(payload).toContain("[TASK]\nTest packing task");
    });

    it("throws error when max token limit is breached", () => {
      expect(() => {
        packPrompt({
          rulesPath: "antigravity.rules.json",
          typesPath: "src/core/types.ts",
          taskDescription: "A".repeat(10000),
          maxTokens: 50 // tiny token budget
        });
      }).toThrow(/Token budget breached/);
    });
  });

  describe("extractSignaturesAST", () => {
    it("extracts type definitions and interfaces from TypeScript source", () => {
      const signatures = extractSignaturesAST("src/core/types.ts");
      expect(signatures).toContain("export type ErrorDomain");
      expect(signatures).toContain("export interface FrameworkError");
      expect(signatures).toContain("export interface ServiceResult");
    });

    it("extracts class method signatures from TypeScript source", () => {
      const signatures = extractSignaturesAST("src/core/base-service.ts");
      expect(signatures).toContain("export class BaseService");
      expect(signatures).toContain("execute");
      expect(signatures).toContain("process");
    });
  });
});
