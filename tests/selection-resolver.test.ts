import { describe, it, expect } from "vitest";
import { MockTextFrame, MockStory } from "./mocks/indesign-mock";
import { SelectionResolver } from "../src/core/selection-resolver";

describe("SelectionResolver", () => {
  it("resolves null, undefined, or empty arrays safely", () => {
    const empty1 = SelectionResolver.resolve(null);
    expect(empty1.targetFrame).toBeNull();
    expect(empty1.rawItem).toBeNull();

    const empty2 = SelectionResolver.resolve([]);
    expect(empty2.targetFrame).toBeNull();

    const emptyAll = SelectionResolver.resolveAll([]);
    expect(emptyAll).toEqual([]);
  });

  it("resolves single TextFrame selection", () => {
    const frame = new MockTextFrame({ name: "Headline" });
    const resolved = SelectionResolver.resolve(frame);

    expect(resolved.targetFrame).toBe(frame);
    expect(resolved.targetStory).toBe(frame.parentStory);
    expect(resolved.selectedTextRange).toBeNull();
    expect(resolved.pageItem).toBe(frame);
  });

  it("resolves array selections (e.g. app.selection with TextFrame)", () => {
    const frame = new MockTextFrame({ name: "Callout" });
    const resolved = SelectionResolver.resolve([frame]);

    expect(resolved.targetFrame).toBe(frame);
    expect(resolved.rawItem).toBe(frame);
  });

  it("resolves text model objects (Paragraph, Word, Character, InsertionPoint)", () => {
    const frame = new MockTextFrame();
    const story = frame.parentStory;

    const mockParagraph = {
      constructor: { name: "Paragraph" },
      isValid: true,
      parentTextFrames: [frame],
      parentStory: story,
      contents: "Sample paragraph text"
    };

    const resolved = SelectionResolver.resolve(mockParagraph);
    expect(resolved.targetFrame).toBe(frame);
    expect(resolved.targetStory).toBe(story);
    expect(resolved.selectedTextRange).toBe(mockParagraph);

    // InsertionPoint does not select a range
    const mockInsertionPoint = {
      constructor: { name: "InsertionPoint" },
      isValid: true,
      parentTextFrames: [frame],
      parentStory: story
    };
    const resolvedIp = SelectionResolver.resolve(mockInsertionPoint);
    expect(resolvedIp.targetFrame).toBe(frame);
    expect(resolvedIp.selectedTextRange).toBeNull();
  });

  it("resolves table cell selections", () => {
    const frame = new MockTextFrame();
    const mockTable = {
      constructor: { name: "Table" },
      parent: frame
    };
    const mockCell = {
      constructor: { name: "Cell" },
      isValid: true,
      parent: mockTable,
      texts: [{ contents: "Cell text" }]
    };

    const resolved = SelectionResolver.resolve(mockCell);
    expect(resolved.targetFrame).toBe(frame);
    expect(resolved.targetStory).toBe(frame.parentStory);
    expect(resolved.selectedTextRange).toBe(mockCell.texts[0]);
  });

  it("resolves graphic items (Rectangle, Oval, Group)", () => {
    const rect = {
      constructor: { name: "Rectangle" },
      isValid: true,
      geometricBounds: [0, 0, 200, 200]
    };

    const resolved = SelectionResolver.resolve(rect);
    expect(resolved.targetFrame).toBeNull();
    expect(resolved.pageItem).toBe(rect);
  });

  it("resolves multiple items via resolveAll", () => {
    const frame1 = new MockTextFrame({ name: "F1" });
    const frame2 = new MockTextFrame({ name: "F2" });

    const all = SelectionResolver.resolveAll([frame1, frame2]);
    expect(all.length).toBe(2);
    expect(all[0].targetFrame).toBe(frame1);
    expect(all[1].targetFrame).toBe(frame2);
  });
});
