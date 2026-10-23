import { describe, it, expect } from "vitest";
import { mockApp, NothingEnum } from "./mocks/indesign-mock";
import { withFindChangeScope } from "../src/core/find-change-scope";

describe("withFindChangeScope", () => {
  it("isolates GREP preferences and restores NOTHING on completion", () => {
    mockApp.findGrepPreferences = { findWhat: "DirtyState" };
    mockApp.changeGrepPreferences = { changeTo: "DirtyState" };

    let ran = false;
    withFindChangeScope("GREP", () => {
      ran = true;
      expect(mockApp.findGrepPreferences).toBe(NothingEnum.NOTHING);
      expect(mockApp.changeGrepPreferences).toBe(NothingEnum.NOTHING);
      // Simulate grep query setup
      mockApp.findGrepPreferences = { findWhat: "\\d+" };
    });

    expect(ran).toBe(true);
    // Verified reset in finally
    expect(mockApp.findGrepPreferences).toBe(NothingEnum.NOTHING);
    expect(mockApp.changeGrepPreferences).toBe(NothingEnum.NOTHING);
  });

  it("resets preferences even if the scoped action throws an error", () => {
    expect(() => {
      withFindChangeScope("TEXT", () => {
        mockApp.findTextPreferences = { findWhat: "foo" };
        throw new Error("Query failure");
      });
    }).toThrow("Query failure");

    expect(mockApp.findTextPreferences).toBe(NothingEnum.NOTHING);
    expect(mockApp.changeTextPreferences).toBe(NothingEnum.NOTHING);
  });
});
