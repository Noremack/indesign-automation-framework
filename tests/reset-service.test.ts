import { describe, it, expect, beforeEach } from "vitest";
import { MockDocument, MockApplication, MockLayer, MockTextFrame, MockColor } from "./mocks/indesign-mock";
import { QgdsResetService } from "../src/core/qgds-reset-service";
import { DomResolver } from "../src/core/dom-resolver";

describe("QgdsResetService", () => {
  let doc: MockDocument;
  let service: QgdsResetService;

  beforeEach(() => {
    (global as any).app = new MockApplication();
    doc = new MockDocument();
    service = new QgdsResetService();
  });

  it("unlocks locked layers safely", () => {
    const lockedLayer = doc.layers.add({ name: "Locked Layer", locked: true });
    expect(lockedLayer.locked).toBe(true);

    const result = service.execute(doc, { resetMasters: false, resetTextFrames: false, resetStyles: false, resetSwatches: false });
    expect(result.success).toBe(true);
    expect(result.data?.layersUnlocked).toBeGreaterThanOrEqual(1);
    expect(lockedLayer.locked).toBe(false);
  });

  it("resets text frames to [Basic Paragraph] and clears overrides", () => {
    const customStyle = DomResolver.getOrCreateParagraphStyle(doc, "QGDS / Headings / H1 - Title", { pointSize: 24 });
    const tf = doc.pages[0].textFrames.add(new MockTextFrame({
      name: "Header Frame",
      contents: "Strategic Plan Title"
    }));
    tf.applyParagraphStyle(customStyle);

    const result = service.execute(doc, { resetMasters: false, resetStyles: false, resetSwatches: false });
    expect(result.success).toBe(true);
    expect(result.data?.textFramesReset).toBe(1);
    expect(tf.parentStory.appliedParagraphStyle?.name).toBe("[Basic Paragraph]");
  });

  it("safely purges custom styles and preserves built-ins", () => {
    DomResolver.getOrCreateParagraphStyle(doc, "Custom Heading", { pointSize: 20 }, "Custom Group");
    DomResolver.getOrCreateCharacterStyle(doc, "Custom Bold", {}, "Custom Group");

    const result = service.execute(doc, { resetMasters: false, resetTextFrames: false, resetSwatches: false });
    expect(result.success).toBe(true);
    expect(result.data?.stylesRemoved).toBeGreaterThan(0);
    // [Basic Paragraph] must never be removed
    expect(doc.paragraphStyles.itemByName("[Basic Paragraph]").isValid).toBe(true);
  });

  it("purges custom swatches while preserving built-in swatches", () => {
    doc.colors.add(new MockColor({ name: "Blue - Medium", colorValue: [100, 50, 0, 0] }));
    doc.colors.add(new MockColor({ name: "Gum - Medium", colorValue: [40, 0, 80, 20] }));

    const result = service.execute(doc, { resetMasters: false, resetTextFrames: false, resetStyles: false });
    expect(result.success).toBe(true);
    expect(result.data?.swatchesRemoved).toBeGreaterThanOrEqual(2);
    // Built-in Black & Registration must be preserved
    expect(doc.colors.itemByName("Black").isValid).toBe(true);
    expect(doc.colors.itemByName("Registration").isValid).toBe(true);
  });

  it("purges items on master pages when resetMasters is enabled", () => {
    const master = doc.masterSpreads[0];
    const mPage = master.pages[0];
    const mFrame = mPage.textFrames.add(new MockTextFrame({ name: "Master Header", contents: "Header" }));
    expect(mPage.pageItems.length).toBeGreaterThan(0);

    const result = service.execute(doc, { resetMasters: true, resetTextFrames: false, resetStyles: false, resetSwatches: false });
    expect(result.success).toBe(true);
    expect(result.data?.masterItemsCleared).toBeGreaterThan(0);
    expect(mPage.pageItems.length).toBe(0);
    expect(mFrame.isValid).toBe(false);
  });

  it("supports dryRun simulation without modifying document", () => {
    const lockedLayer = doc.layers.add({ name: "Protected Layer", locked: true });

    const result = service.execute(doc, { dryRun: true });
    expect(result.success).toBe(true);
    expect(lockedLayer.locked).toBe(true); // Should not have unlocked in dry run
    expect(result.data?.details.some(d => d.includes("[DryRun]"))).toBe(true);
  });
});
