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

  describe("generateFixPrompt", () => {
    it("generates an AI repair prompt including rules, contracts, and error report", async () => {
      const { generateFixPrompt } = await import("../tools/prompt-fix.mjs");
      const errorJson = JSON.stringify({
        status: "FAILED",
        action: "AlignToSpread",
        errorCode: "ERR_ELEMENT_NOT_EDITABLE",
        message: "Item 42 is locked or hidden"
      });

      const prompt = generateFixPrompt({
        errorInput: errorJson,
        rulesPath: "antigravity.rules.json",
        typesPath: "src/core/types.ts"
      });

      expect(prompt).toContain("[ROLE]");
      expect(prompt).toContain("[FRAMEWORK RULES]");
      expect(prompt).toContain("[CONTRACTS & TYPES]");
      expect(prompt).toContain("[DIAGNOSTIC ERROR REPORT]");
      expect(prompt).toContain("ERR_ELEMENT_NOT_EDITABLE");
      expect(prompt).toContain("[REPAIR INSTRUCTIONS]");
    });

    it("throws an error when empty error input is provided", async () => {
      const { generateFixPrompt } = await import("../tools/prompt-fix.mjs");
      expect(() => {
        generateFixPrompt({ errorInput: "" });
      }).toThrow(/No error diagnostic input provided/);
    });
  });

  describe("lint-invariants", () => {
    it("detects banned APIs such as Folder, File, and doc.allPageItems", async () => {
      const { lintFile } = await import("../tools/lint-invariants.mjs");
      const badCode = `
        const f = new Folder("/c/test");
        const docItems = doc.allPageItems;
        $.writeln("debug message");
      `;

      const violations = lintFile("bad-script.ts", badCode);
      expect(violations.length).toBe(3);
      expect(violations.map(v => v.rule)).toEqual([
        "BANNED_API_FOLDER",
        "BANNED_UNSCOPED_PAGEITEMS",
        "BANNED_API_WRITELN"
      ]);
    });

    it("passes cleanly on valid code using framework invariants", async () => {
      const { lintFile } = await import("../tools/lint-invariants.mjs");
      const goodCode = `
        const pages = doc.pages.everyItem().getElements();
        for (let i = pages.length - 1; i >= 0; i--) {
          const items = pages[i].pageItems.everyItem().getElements();
        }
      `;

      const violations = lintFile("good-service.ts", goodCode);
      expect(violations.length).toBe(0);
    });
  });

  describe("prompt-wizard", () => {
    it("assembles prompt using selected preset non-interactively", async () => {
      const { runPromptWizard } = await import("../tools/prompt-wizard.mjs");
      const result = await runPromptWizard({
        presetChoice: "1",
        task: "Align headline frames to top margin"
      });

      expect(result.prompt).toContain("Default Safe Preset");
      expect(result.prompt).toContain("Align headline frames to top margin");
      expect(result.intakeSummary).toContain("1C, 2A, 3D, 4B");
    });
  });

  describe("roadblocks telemetry", () => {
    it("records roadblock events and analyzes failure distributions", async () => {
      const { recordRoadblock } = await import("../tools/prompt-fix.mjs");
      const { analyzeRoadblocks } = await import("../tools/roadblocks.mjs");
      const tempLog = ".framework/test-telemetry.jsonl";

      // Ensure clean state
      const fs = await import("fs");
      if (fs.existsSync(tempLog)) fs.unlinkSync(tempLog);

      recordRoadblock({
        code: "ERR_ELEMENT_NOT_EDITABLE",
        domain: "DOM_INTEGRITY",
        action: "TestFrameAligner",
        message: "Locked text frame id 12",
        logPath: tempLog
      });

      recordRoadblock({
        code: "ERR_ELEMENT_NOT_EDITABLE",
        domain: "DOM_INTEGRITY",
        action: "TestFrameAligner",
        message: "Locked text frame id 15",
        logPath: tempLog
      });

      recordRoadblock({
        code: "ERR_TRANSACTION_FAILED",
        domain: "TRANSACTION",
        action: "TestFrameAligner",
        message: "Unexpected geometry error",
        logPath: tempLog
      });

      const report = analyzeRoadblocks(tempLog);

      expect(report.total).toBe(3);
      expect(report.byCode[0].code).toBe("ERR_ELEMENT_NOT_EDITABLE");
      expect(report.byCode[0].count).toBe(2);
      expect(report.byCode[0].percentage).toBe(67);
      expect(report.byCode[0].suggestion).toContain("isElementEditable");
      expect(report.byCode[1].code).toBe("ERR_TRANSACTION_FAILED");

      // Cleanup
      if (fs.existsSync(tempLog)) fs.unlinkSync(tempLog);
    });
  });
});

