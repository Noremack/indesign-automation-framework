import { app, NothingEnum } from "indesign";

export type FindChangeType = "GREP" | "TEXT" | "GLYPH";

export function withFindChangeScope<T>(
  type: FindChangeType,
  action: () => T
): T {
  const reset = () => {
    try {
      if (type === "GREP") {
        app.findGrepPreferences = NothingEnum.NOTHING;
        app.changeGrepPreferences = NothingEnum.NOTHING;
      } else if (type === "TEXT") {
        app.findTextPreferences = NothingEnum.NOTHING;
        app.changeTextPreferences = NothingEnum.NOTHING;
      }
    } catch (_) {
      if (type === "GREP") {
        app.findGrepPreferences = null;
        app.changeGrepPreferences = null;
      } else if (type === "TEXT") {
        app.findTextPreferences = null;
        app.changeTextPreferences = null;
      }
    }
  };

  reset();
  try {
    return action();
  } finally {
    reset();
  }
}
