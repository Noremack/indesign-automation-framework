export interface ResolvedSelection {
  targetFrame: any | null;
  targetStory: any | null;
  selectedTextRange: any | null;
  pageItem: any | null;
  rawItem: any;
}

export class SelectionResolver {
  /**
   * Resolves a selection input (single item, array of items, or collection)
   * into a standardized ResolvedSelection object.
   * If multiple items are selected/passed, resolves the primary (first) item.
   */
  public static resolve(rawInput: any): ResolvedSelection {
    if (!rawInput) {
      return this.empty();
    }

    // Handle Array or Collection (e.g. app.selection or [item1, item2])
    if (Array.isArray(rawInput)) {
      if (rawInput.length === 0) return this.empty();
      return this.resolveSingle(rawInput[0]);
    }

    // Handle InDesign collection proxy with .everyItem or numeric indexing
    if (typeof rawInput.length === "number" && typeof rawInput[0] !== "undefined" && typeof rawInput !== "string") {
      if (rawInput.length === 0) return this.empty();
      return this.resolveSingle(rawInput[0]);
    }

    return this.resolveSingle(rawInput);
  }

  /**
   * Resolves all items in a selection or array into an array of ResolvedSelection.
   */
  public static resolveAll(rawInput: any): ResolvedSelection[] {
    if (!rawInput) return [];

    let items: any[] = [];
    if (Array.isArray(rawInput)) {
      items = rawInput;
    } else if (typeof rawInput.length === "number" && typeof rawInput !== "string") {
      items = Array.from(rawInput);
    } else if (rawInput.everyItem && typeof rawInput.everyItem === "function") {
      try {
        items = rawInput.everyItem().getElements();
      } catch (_) {
        items = [rawInput];
      }
    } else {
      items = [rawInput];
    }

    return items.map(item => this.resolveSingle(item)).filter(res => res.rawItem !== null);
  }

  private static resolveSingle(rawItem: any): ResolvedSelection {
    if (!rawItem) return this.empty();

    // Check isValid safely (some COM objects throw when querying invalid)
    try {
      if (rawItem.isValid === false) return this.empty();
    } catch (_) {
      return this.empty();
    }

    const rawType = rawItem.constructor ? rawItem.constructor.name : "";
    const type = rawType.replace(/^Mock/, "");

    // 1. TextFrame
    if (type === "TextFrame") {
      let story = null;
      try { story = rawItem.parentStory || null; } catch (_) {}
      return {
        targetFrame: rawItem,
        targetStory: story,
        selectedTextRange: null,
        pageItem: rawItem,
        rawItem
      };
    }

    // 2. Text Ranges & Sub-elements
    const textConstructors = new Set([
      "Text", "Word", "Character", "Paragraph", "TextStyleRange", "Line", "InsertionPoint"
    ]);

    if (textConstructors.has(type)) {
      let targetFrame = null;
      let targetStory = null;
      try {
        const parentContainers = rawItem.parentTextFrames;
        targetFrame = parentContainers && parentContainers.length > 0 ? parentContainers[0] : null;
      } catch (_) {}
      try {
        targetStory = rawItem.parentStory || null;
      } catch (_) {}

      return {
        targetFrame,
        targetStory,
        selectedTextRange: type !== "InsertionPoint" ? rawItem : null,
        pageItem: targetFrame,
        rawItem
      };
    }

    // 3. Table Cell
    if (type === "Cell") {
      let targetFrame = null;
      let targetStory = null;
      let selectedTextRange = null;
      try {
        const parentTable = rawItem.parent;
        const parentFrame = parentTable && parentTable.parent ? parentTable.parent : null;
        const parentType = parentFrame && parentFrame.constructor ? parentFrame.constructor.name.replace(/^Mock/, "") : "";
        targetFrame = parentType === "TextFrame" ? parentFrame : null;
        targetStory = parentFrame ? parentFrame.parentStory : null;
        selectedTextRange = rawItem.texts && rawItem.texts.length > 0 ? rawItem.texts[0] : null;
      } catch (_) {}

      return {
        targetFrame,
        targetStory,
        selectedTextRange,
        pageItem: targetFrame,
        rawItem
      };
    }

    // 4. Other Page Items (Rectangle, Oval, Polygon, GraphicLine, Group, etc.)
    const graphicConstructors = new Set([
      "Rectangle", "Oval", "Polygon", "GraphicLine", "SplineItem", "Group", "Button", "MultiStateObject"
    ]);

    if (graphicConstructors.has(type) || (rawItem.geometricBounds && !textConstructors.has(type))) {
      return {
        targetFrame: null,
        targetStory: null,
        selectedTextRange: null,
        pageItem: rawItem,
        rawItem
      };
    }

    return {
      targetFrame: null,
      targetStory: null,
      selectedTextRange: null,
      pageItem: null,
      rawItem
    };
  }

  private static empty(): ResolvedSelection {
    return {
      targetFrame: null,
      targetStory: null,
      selectedTextRange: null,
      pageItem: null,
      rawItem: null
    };
  }
}
