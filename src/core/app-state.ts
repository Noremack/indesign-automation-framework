import { MeasurementUnits, RulerOrigin } from "indesign";

export interface UnitStateSnapshot {
  horizontalUnits: any;
  verticalUnits: any;
  rulerOrigin: any;
  zeroPoint: number[];
}

export function withNormalizedUnits<T>(doc: any, action: () => T): T {
  const vp = doc.viewPreferences;
  const snapshot: UnitStateSnapshot = {
    horizontalUnits: vp.horizontalMeasurementUnits,
    verticalUnits: vp.verticalMeasurementUnits,
    rulerOrigin: vp.rulerOrigin,
    zeroPoint: doc.zeroPoint
  };

  try {
    vp.horizontalMeasurementUnits = MeasurementUnits.POINTS;
    vp.verticalMeasurementUnits = MeasurementUnits.POINTS;
    vp.rulerOrigin = RulerOrigin.PAGE_ORIGIN;
    doc.zeroPoint = [0, 0];
    return action();
  } finally {
    vp.horizontalMeasurementUnits = snapshot.horizontalUnits;
    vp.verticalMeasurementUnits = snapshot.verticalUnits;
    vp.rulerOrigin = snapshot.rulerOrigin;
    doc.zeroPoint = snapshot.zeroPoint;
  }
}

export function isElementEditable(item: any): boolean {
  if (!item) return false;

  try {
    if (item.isValid === false) return false;
  } catch (_) {
    return false;
  }

  const constructorName = item.constructor ? item.constructor.name : "";
  const textConstructors = new Set([
    "Text", "Word", "Character", "Paragraph", "TextStyleRange", "Line", "InsertionPoint"
  ]);

  // If item is a text model object
  if (textConstructors.has(constructorName)) {
    try {
      const story = item.parentStory;
      if (story && story.isValid) {
        if (story.locked) return false;
      }
      const frames = item.parentTextFrames;
      if (frames && frames.length > 0) {
        for (let i = 0; i < frames.length; i++) {
          if (!isElementEditable(frames[i])) return false;
        }
      }
      return true;
    } catch (_) {
      return false;
    }
  }

  // Regular PageItem / Frame checks
  try {
    if (item.locked === true) return false;
  } catch (_) {}

  try {
    const layer = item.itemLayer;
    if (layer && layer.isValid) {
      if (layer.locked || !layer.visible) return false;
    }
  } catch (_) {}

  // Check parent group hierarchy
  try {
    let parent = item.parent;
    while (parent && parent.isValid && parent.constructor && parent.constructor.name === "Group") {
      if (parent.locked === true) return false;
      parent = parent.parent;
    }
  } catch (_) {}

  return true;
}
