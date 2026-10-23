import { describe, it, expect } from "vitest";
import { MockDocument, MockTextFrame, MockLayer, MockStory, MeasurementUnits, RulerOrigin } from "./mocks/indesign-mock";
import { withNormalizedUnits, isElementEditable } from "../src/core/app-state";

describe("AppState & Unit Normalization", () => {
  it("normalizes units to POINTS and PAGE_ORIGIN, then restores prior state", () => {
    const doc = new MockDocument();
    doc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.INCHES;
    doc.viewPreferences.verticalMeasurementUnits = MeasurementUnits.INCHES;
    doc.viewPreferences.rulerOrigin = RulerOrigin.SPREAD_ORIGIN;
    doc.zeroPoint = [50, 50];

    let ranInside = false;

    withNormalizedUnits(doc, () => {
      ranInside = true;
      expect(doc.viewPreferences.horizontalMeasurementUnits).toBe(MeasurementUnits.POINTS);
      expect(doc.viewPreferences.verticalMeasurementUnits).toBe(MeasurementUnits.POINTS);
      expect(doc.viewPreferences.rulerOrigin).toBe(RulerOrigin.PAGE_ORIGIN);
      expect(doc.zeroPoint).toEqual([0, 0]);
    });

    expect(ranInside).toBe(true);
    // Verified restoration of original state
    expect(doc.viewPreferences.horizontalMeasurementUnits).toBe(MeasurementUnits.INCHES);
    expect(doc.viewPreferences.verticalMeasurementUnits).toBe(MeasurementUnits.INCHES);
    expect(doc.viewPreferences.rulerOrigin).toBe(RulerOrigin.SPREAD_ORIGIN);
    expect(doc.zeroPoint).toEqual([50, 50]);
  });

  describe("isElementEditable", () => {
    it("returns false for null or invalid items", () => {
      expect(isElementEditable(null)).toBe(false);
      expect(isElementEditable(undefined)).toBe(false);
      expect(isElementEditable({ isValid: false })).toBe(false);
    });

    it("returns false for locked page items", () => {
      const frame = new MockTextFrame({ locked: true });
      expect(isElementEditable(frame)).toBe(false);
    });

    it("returns false for items on locked or hidden layers", () => {
      const lockedLayer = new MockLayer({ locked: true });
      const hiddenLayer = new MockLayer({ visible: false });

      const frameOnLocked = new MockTextFrame({ itemLayer: lockedLayer });
      const frameOnHidden = new MockTextFrame({ itemLayer: hiddenLayer });

      expect(isElementEditable(frameOnLocked)).toBe(false);
      expect(isElementEditable(frameOnHidden)).toBe(false);
    });

    it("returns false for items within a locked parent group", () => {
      const lockedGroup = {
        constructor: { name: "Group" },
        isValid: true,
        locked: true,
        parent: null
      };
      const frameInGroup = new MockTextFrame({ parent: lockedGroup });
      expect(isElementEditable(frameInGroup)).toBe(false);
    });

    it("evaluates text model objects checking parent story lock status", () => {
      const lockedStory = new MockStory();
      lockedStory.locked = true;

      const textItem = {
        constructor: { name: "Paragraph" },
        isValid: true,
        parentStory: lockedStory,
        parentTextFrames: []
      };

      expect(isElementEditable(textItem)).toBe(false);

      const unlockedStory = new MockStory();
      unlockedStory.locked = false;
      const editableText = {
        constructor: { name: "Paragraph" },
        isValid: true,
        parentStory: unlockedStory,
        parentTextFrames: []
      };

      expect(isElementEditable(editableText)).toBe(true);
    });

    it("returns true for valid unlocked item on active visible layer", () => {
      const frame = new MockTextFrame();
      expect(isElementEditable(frame)).toBe(true);
    });
  });
});
