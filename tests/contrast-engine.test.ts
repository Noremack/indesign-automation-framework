import { describe, it, expect } from "vitest";
import {
  resolveSwatchRgb,
  calculateColorLuminance,
  calculateColorContrastRatio,
  auditDocumentContrast,
  remediateDocumentContrast
} from "../src/core/contrast-engine";
import { MockDocument } from "./mocks/indesign-mock";

describe("Contrast Engine", () => {
  it("resolves basic swatch colors to RGB", () => {
    expect(resolveSwatchRgb("Paper")).toEqual([255, 255, 255]);
    expect(resolveSwatchRgb("[Paper]")).toEqual([255, 255, 255]);
    expect(resolveSwatchRgb("Black")).toEqual([0, 0, 0]);
    expect(resolveSwatchRgb({ hex: "#000000" })).toEqual([0, 0, 0]);
    expect(resolveSwatchRgb({ hex: "#FFFFFF" })).toEqual([255, 255, 255]);
    expect(resolveSwatchRgb({ colorValue: [0, 50, 100] })).toEqual([0, 50, 100]);
  });

  it("calculates relative luminance per WCAG 2.2 specifications", () => {
    const whiteLum = calculateColorLuminance([255, 255, 255]);
    const blackLum = calculateColorLuminance([0, 0, 0]);

    expect(whiteLum).toBeCloseTo(1.0, 2);
    expect(blackLum).toBeCloseTo(0.0, 2);
  });

  it("calculates contrast ratios conforming to WCAG 2.2 SC 1.4.3", () => {
    const blackOnWhite = calculateColorContrastRatio([0, 0, 0], [255, 255, 255]);
    expect(blackOnWhite).toBe(21.0);

    const whiteOnWhite = calculateColorContrastRatio([255, 255, 255], [255, 255, 255]);
    expect(whiteOnWhite).toBe(1.0);

    // Light grey on white (#CCCCCC -> [204, 204, 204])
    const greyOnWhite = calculateColorContrastRatio([204, 204, 204], [255, 255, 255]);
    expect(greyOnWhite).toBeLessThan(4.5);
  });

  it("audits document paragraph styles and detects contrast failures", () => {
    const doc = new MockDocument();
    doc.paragraphStyles.add({
      name: "Light Grey Heading",
      pointSize: 12,
      fillColor: { name: "Light Grey", colorValue: [220, 220, 220] }
    });
    doc.paragraphStyles.add({
      name: "Accessible Body",
      pointSize: 12,
      fillColor: { name: "Dark Navy", colorValue: [0, 20, 50] }
    });

    const audit = auditDocumentContrast(doc);
    expect(audit.totalAudited).toBeGreaterThanOrEqual(1);
    expect(audit.violationsCount).toBe(1);
    expect(audit.violations[0].styleName).toBe("Light Grey Heading");
  });

  it("auto-remediates failing paragraph styles to high contrast", () => {
    const doc = new MockDocument();
    doc.paragraphStyles.add({
      name: "Failing Style",
      pointSize: 12,
      fillColor: { name: "Light Grey", colorValue: [230, 230, 230] }
    });

    const remediated = remediateDocumentContrast(doc, "Black");
    expect(remediated).toBe(1);

    const reAudit = auditDocumentContrast(doc);
    expect(reAudit.violationsCount).toBe(0);
  });
});

