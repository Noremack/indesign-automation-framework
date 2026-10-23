import { describe, it, expect } from "vitest";
import {
  MockDocument,
  MockParagraphStyle,
  MockParagraphStyleGroup,
  MockCharacterStyle,
  MockCharacterStyleGroup,
  ColorSpace
} from "./mocks/indesign-mock";
import { DomResolver } from "../src/core/dom-resolver";

describe("DomResolver", () => {
  it("retrieves existing color or adds new one if missing", () => {
    const doc = new MockDocument();

    // 1. Existing color "Black"
    const black = DomResolver.getOrCreateColor(doc, "Black", [0, 0, 0, 100]);
    expect(black).toBeDefined();
    expect(black.isValid).toBe(true);
    expect(black.name).toBe("Black");

    // 2. New color "Brand Navy"
    const navy = DomResolver.getOrCreateColor(doc, "Brand Navy", [100, 80, 10, 50], ColorSpace.CMYK);
    expect(navy).toBeDefined();
    expect(navy.name).toBe("Brand Navy");

    // Querying again should return the existing one
    const navyAgain = DomResolver.getOrCreateColor(doc, "Brand Navy", [100, 80, 10, 50]);
    expect(navyAgain.id).toBe(navy.id);
  });

  it("retrieves existing layer or adds new one if missing", () => {
    const doc = new MockDocument();

    const layer1 = DomResolver.getOrCreateLayer(doc, "Layer 1");
    expect(layer1).toBeDefined();
    expect(layer1.name).toBe("Layer 1");

    const artLayer = DomResolver.getOrCreateLayer(doc, "Artwork");
    expect(artLayer).toBeDefined();
    expect(artLayer.name).toBe("Artwork");
    expect(doc.layers.length).toBe(2);
  });

  it("resolves top-level and nested paragraph styles across hierarchical groups", () => {
    const doc = new MockDocument();

    // Top-level style
    const topStyle = DomResolver.getParagraphStyleSafely(doc, "[Basic Paragraph]");
    expect(topStyle).toBeDefined();
    expect(topStyle.name).toBe("[Basic Paragraph]");

    // Setup nested groups: Group 1 -> SubGroup -> SubHeader Style
    const subHeader = new MockParagraphStyle({ name: "SubHeader" });
    const subGroup = new MockParagraphStyleGroup("SubGroup", [subHeader]);
    const group1 = new MockParagraphStyleGroup("Group 1", [], [subGroup]);

    doc.paragraphStyleGroups.add(group1);

    const resolvedNested = DomResolver.getParagraphStyleSafely(doc, "SubHeader");
    expect(resolvedNested).toBeDefined();
    expect(resolvedNested.name).toBe("SubHeader");

    const missing = DomResolver.getParagraphStyleSafely(doc, "NonExistentStyle");
    expect(missing).toBeNull();
  });

  it("resolves top-level and nested character styles across groups", () => {
    const doc = new MockDocument();

    const none = DomResolver.getCharacterStyleSafely(doc, "[None]");
    expect(none).toBeDefined();

    const bold = new MockCharacterStyle({ name: "BoldAccent" });
    const charGroup = new MockCharacterStyleGroup("Editorial", [bold]);
    doc.characterStyleGroups.add(charGroup);

    const resolved = DomResolver.getCharacterStyleSafely(doc, "BoldAccent");
    expect(resolved).toBeDefined();
    expect(resolved.name).toBe("BoldAccent");
  });
});
