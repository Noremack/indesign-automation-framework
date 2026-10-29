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

  it("creates and retrieves gradients with gradient stops", () => {
    const doc = new MockDocument();

    const grad = DomResolver.getOrCreateGradient(doc, "Blue - Gradient", "Linear", [
      { color: "Black", location: 0 },
      { color: "Registration", location: 100 }
    ]);

    expect(grad).toBeDefined();
    expect(grad.name).toBe("Blue - Gradient");
    expect(doc.gradients.length).toBe(1);

    // Retrieving existing returns same instance
    const existing = DomResolver.getOrCreateGradient(doc, "Blue - Gradient");
    expect(existing.name).toBe("Blue - Gradient");
    expect(doc.gradients.length).toBe(1);
  });

  it("resolves and creates nested style groups", () => {
    const doc = new MockDocument();

    const group = DomResolver.resolveTargetGroup(
      doc.paragraphStyleGroups,
      "QGDS / Headings / SubLevel",
      "paragraphStyleGroups"
    );

    expect(group).toBeDefined();
    expect(group.name).toBe("SubLevel");
  });

  it("creates hierarchical paragraph styles, character styles, table styles, and cell styles", () => {
    const doc = new MockDocument();

    const pStyle = DomResolver.getOrCreateParagraphStyle(
      doc,
      "QGDS Title",
      { pointSize: 28 },
      "QGDS / Headings",
      { exportTag: "h1", exportClass: "qld__title" }
    );
    expect(pStyle).toBeDefined();
    expect(pStyle.name).toBe("QGDS Title");
    expect(pStyle.pointSize).toBe(28);

    const cStyle = DomResolver.getOrCreateCharacterStyle(
      doc,
      "Accent Bold",
      { fontStyle: "Bold" },
      "QGDS / Inline",
      { exportTag: "strong" }
    );
    expect(cStyle).toBeDefined();
    expect(cStyle.name).toBe("Accent Bold");

    const cellStyle = DomResolver.getOrCreateCellStyle(
      doc,
      "Cell - Header",
      {},
      "QGDS / Tables"
    );
    expect(cellStyle).toBeDefined();
    expect(cellStyle.name).toBe("Cell - Header");

    const tableStyle = DomResolver.getOrCreateTableStyle(
      doc,
      "Table - Clean",
      {},
      "QGDS / Tables"
    );
    expect(tableStyle).toBeDefined();
    expect(tableStyle.name).toBe("Table - Clean");
  });
});
