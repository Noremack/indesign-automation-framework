import { ColorModel, ColorSpace } from "indesign";

export class DomResolver {
  public static cleanGroupPath(groupPath?: string, namespacePrefix?: string): string {
    if (!groupPath) return "";
    let cleaned = groupPath;
    const prefixes = namespacePrefix && namespacePrefix !== "QGDS"
      ? [namespacePrefix, "QGDS"]
      : ["QGDS"];

    for (const p of prefixes) {
      const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      cleaned = cleaned
        .replace(new RegExp(`^\\s*(?:${escaped}\\s*[\\/\\\\]\\s*)+`, "i"), "")
        .replace(new RegExp(`[\\/\\\\]\\s*${escaped}\\s*[\\/\\\\]`, "gi"), "/")
        .replace(new RegExp(`[\\/\\\\]\\s*${escaped}\\s*$`, "i"), "");
    }
    return cleaned.trim();
  }

  public static getOrCreateColor(
    doc: any,
    name: string,
    colorValue: number[],
    space: any = ColorSpace.CMYK
  ): any {
    if (!doc || !doc.colors) return null;
    const existing = doc.colors.itemByName(name);

    const spaceVal = (space === "CMYK" || space === 1129142603)
      ? 1129142603
      : (typeof ColorSpace !== "undefined" && ColorSpace?.RGB ? ColorSpace.RGB : 1666336572);

    const safeValue = Array.isArray(colorValue)
      ? colorValue.map(v => Math.max(0, Math.round(Number(v) || 0)))
      : [0, 0, 0];

    if (existing && existing.isValid) {
      try {
        existing.space = spaceVal;
        existing.colorValue = safeValue;
      } catch (_) {}
      return existing;
    }

    const modelVal = (typeof ColorModel !== "undefined" && ColorModel?.PROCESS)
      ? ColorModel.PROCESS
      : 1886545267;

    return doc.colors.add({
      name,
      model: modelVal,
      space: spaceVal,
      colorValue: safeValue
    });
  }

  public static getOrCreateLayer(doc: any, layerName: string): any {
    const existing = doc.layers.itemByName(layerName);
    if (existing.isValid) return existing;
    return doc.layers.add({ name: layerName });
  }

  public static getOrCreateGradient(
    doc: any,
    name: string,
    type: "Linear" | "Radial" | string = "Linear",
    stops: Array<{ color: string; location: number; midpoint?: number }> = []
  ): any {
    if (!doc || !doc.isValid || !doc.gradients) return null;
    let gradient = doc.gradients.itemByName(name);
    if (!gradient.isValid) {
      gradient = doc.gradients.add({
        name,
        type: String(type).toLowerCase() === "radial" ? 1380012908 : 1818850926
      });
    }

    if (stops && stops.length > 0 && gradient.gradientStops) {
      try {
        while (gradient.gradientStops.length > stops.length && typeof gradient.gradientStops.lastItem === "function") {
          gradient.gradientStops.lastItem().remove();
        }
        while (gradient.gradientStops.length < stops.length && typeof gradient.gradientStops.add === "function") {
          gradient.gradientStops.add();
        }
        for (let i = 0; i < stops.length; i++) {
          const stop = stops[i];
          const stopEl = gradient.gradientStops[i];
          if (!stopEl) continue;
          if (stop.color && doc.colors) {
            const sw = doc.colors.itemByName(stop.color);
            if (sw && sw.isValid) {
              stopEl.stopColor = sw;
            }
          }
          if (typeof stop.location === "number") {
            stopEl.location = stop.location;
          }
          if (typeof stop.midpoint === "number") {
            try { stopEl.midpoint = stop.midpoint; } catch (_) {}
          }
        }
      } catch (_) {}
    }

    return gradient;
  }

  public static resolveTargetGroup(
    rootGroupCollection: any,
    groupPath: string,
    childGroupName: string
  ): any {
    if (!groupPath || !rootGroupCollection) return null;
    const cleaned = this.cleanGroupPath(groupPath);
    if (!cleaned) return null;
    const parts = cleaned.split(/\s*[\/\\]\s*/).filter(Boolean);
    if (parts.length === 0) return null;

    let currentColl = rootGroupCollection;
    let currentGrp: any = null;

    for (let p = 0; p < parts.length; p++) {
      const partName = parts[p];
      if (!partName) continue;
      currentGrp = currentColl.itemByName(partName);
      if (!currentGrp || !currentGrp.isValid) {
        currentGrp = currentColl.add({ name: partName });
      }
      if (p < parts.length - 1) {
        if (currentGrp[childGroupName]) {
          currentColl = currentGrp[childGroupName];
        } else {
          break;
        }
      }
    }
    return currentGrp;
  }

  public static getOrCreateParagraphStyle(
    doc: any,
    name: string,
    props: any = {},
    groupPath?: string,
    exportTagMap?: { exportTag: string; exportClass?: string }
  ): any {
    if (!doc || !doc.isValid || !doc.paragraphStyles) return null;

    let targetCollection = doc.paragraphStyles;
    if (groupPath && doc.paragraphStyleGroups) {
      const grp = this.resolveTargetGroup(doc.paragraphStyleGroups, groupPath, "paragraphStyleGroups");
      if (grp && grp.isValid && grp.paragraphStyles) {
        targetCollection = grp.paragraphStyles;
      }
    }

    let style = targetCollection.itemByName(name);
    if (!style || !style.isValid) {
      try {
        style = targetCollection.add({ name });
      } catch (_) {
        try {
          style = targetCollection.add();
          style.name = name;
        } catch (_) {
          style = this.getParagraphStyleSafely(doc, name);
        }
      }
    }
    if (style && style.isValid && props && Object.keys(props).length > 0) {
      try {
        for (const [k, v] of Object.entries(props)) {
          try { (style as any)[k] = v; } catch (_) {}
        }
      } catch (_) {}
    }

    if (exportTagMap && style.styleExportTagMaps && typeof style.styleExportTagMaps.add === "function") {
      try {
        style.styleExportTagMaps.add({
          exportType: "EPUB",
          exportTag: exportTagMap.exportTag,
          exportClass: exportTagMap.exportClass || ""
        });
      } catch (_) {}
    }

    return style;
  }

  public static getOrCreateCharacterStyle(
    doc: any,
    name: string,
    props: any = {},
    groupPath?: string,
    exportTagMap?: { exportTag: string; exportClass?: string }
  ): any {
    if (!doc || !doc.isValid || !doc.characterStyles) return null;

    let targetCollection = doc.characterStyles;
    if (groupPath && doc.characterStyleGroups) {
      const grp = this.resolveTargetGroup(doc.characterStyleGroups, groupPath, "characterStyleGroups");
      if (grp && grp.isValid && grp.characterStyles) {
        targetCollection = grp.characterStyles;
      }
    }

    let style = targetCollection.itemByName(name);
    if (!style || !style.isValid) {
      try {
        style = targetCollection.add({ name });
      } catch (_) {
        try {
          style = targetCollection.add();
          style.name = name;
        } catch (_) {
          style = this.getCharacterStyleSafely(doc, name);
        }
      }
    }
    if (style && style.isValid && props && Object.keys(props).length > 0) {
      try {
        for (const [k, v] of Object.entries(props)) {
          try { (style as any)[k] = v; } catch (_) {}
        }
      } catch (_) {}
    }

    if (exportTagMap && style.styleExportTagMaps && typeof style.styleExportTagMaps.add === "function") {
      try {
        style.styleExportTagMaps.add({
          exportType: "EPUB",
          exportTag: exportTagMap.exportTag,
          exportClass: exportTagMap.exportClass || ""
        });
      } catch (_) {}
    }

    return style;
  }

  public static getOrCreateCellStyle(
    doc: any,
    name: string,
    props: any = {},
    groupPath?: string
  ): any {
    if (!doc || !doc.isValid || !doc.cellStyles) return null;

    let targetCollection = doc.cellStyles;
    if (groupPath && doc.cellStyleGroups) {
      const grp = this.resolveTargetGroup(doc.cellStyleGroups, groupPath, "cellStyleGroups");
      if (grp && grp.isValid && grp.cellStyles) {
        targetCollection = grp.cellStyles;
      }
    }

    let style = targetCollection.itemByName(name);
    if (!style || !style.isValid) {
      try {
        style = targetCollection.add({ name });
      } catch (_) {
        try {
          style = targetCollection.add();
          style.name = name;
        } catch (_) {
          style = this.getCellStyleSafely(doc, name);
        }
      }
    }
    if (style && style.isValid && props && Object.keys(props).length > 0) {
      try {
        for (const [k, v] of Object.entries(props)) {
          try { (style as any)[k] = v; } catch (_) {}
        }
      } catch (_) {}
    }

    return style;
  }

  public static getOrCreateTableStyle(
    doc: any,
    name: string,
    props: any = {},
    groupPath?: string
  ): any {
    if (!doc || !doc.isValid || !doc.tableStyles) return null;

    let targetCollection = doc.tableStyles;
    if (groupPath && doc.tableStyleGroups) {
      const grp = this.resolveTargetGroup(doc.tableStyleGroups, groupPath, "tableStyleGroups");
      if (grp && grp.isValid && grp.tableStyles) {
        targetCollection = grp.tableStyles;
      }
    }

    let style = targetCollection.itemByName(name);
    if (!style || !style.isValid) {
      try {
        style = targetCollection.add({ name });
      } catch (_) {
        try {
          style = targetCollection.add();
          style.name = name;
        } catch (_) {
          style = this.getTableStyleSafely(doc, name);
        }
      }
    }
    if (style && style.isValid && props && Object.keys(props).length > 0) {
      try {
        for (const [k, v] of Object.entries(props)) {
          try { (style as any)[k] = v; } catch (_) {}
        }
      } catch (_) {}
    }

    return style;
  }

  public static getOrCreateObjectStyle(
    doc: any,
    name: string,
    props: any = {},
    groupPath?: string
  ): any {
    if (!doc || !doc.isValid || !doc.objectStyles) return null;

    let targetCollection = doc.objectStyles;
    if (groupPath && doc.objectStyleGroups) {
      const grp = this.resolveTargetGroup(doc.objectStyleGroups, groupPath, "objectStyleGroups");
      if (grp && grp.isValid && grp.objectStyles) {
        targetCollection = grp.objectStyles;
      }
    }

    let style = targetCollection.itemByName(name);
    if (!style || !style.isValid) {
      try {
        style = targetCollection.add({ name });
      } catch (_) {
        try {
          style = targetCollection.add();
          style.name = name;
        } catch (_) {
          style = this.getObjectStyleSafely(doc, name);
        }
      }
    }
    if (style && style.isValid && props && Object.keys(props).length > 0) {
      try {
        for (const [k, v] of Object.entries(props)) {
          try { (style as any)[k] = v; } catch (_) {}
        }
      } catch (_) {}
    }

    return style;
  }

  public static getStyleCandidates(styleName: string, namespacePrefix?: string): string[] {
    if (!styleName) return [];
    const candidates = [styleName];
    const stripped = this.cleanGroupPath(styleName, namespacePrefix);
    if (stripped && !candidates.includes(stripped)) {
      candidates.push(stripped);
    }
    const leaf = styleName.split(/[\/\\]/).pop()?.trim();
    if (leaf && !candidates.includes(leaf)) {
      candidates.push(leaf);
    }
    return candidates;
  }

  public static getParagraphStyleSafely(doc: any, styleName: string, namespacePrefix?: string): any | null {
    if (!doc || !doc.isValid || !doc.paragraphStyles) return null;
    const candidates = this.getStyleCandidates(styleName, namespacePrefix);

    for (const name of candidates) {
      const topLevel = doc.paragraphStyles.itemByName(name);
      if (topLevel && topLevel.isValid) return topLevel;
    }

    return this.findStyleInGroups(doc.paragraphStyleGroups, "paragraphStyles", candidates);
  }

  public static getCharacterStyleSafely(doc: any, styleName: string, namespacePrefix?: string): any | null {
    if (!doc || !doc.isValid || !doc.characterStyles) return null;
    const candidates = this.getStyleCandidates(styleName, namespacePrefix);

    for (const name of candidates) {
      const topLevel = doc.characterStyles.itemByName(name);
      if (topLevel && topLevel.isValid) return topLevel;
    }

    return this.findStyleInGroups(doc.characterStyleGroups, "characterStyles", candidates);
  }

  public static getObjectStyleSafely(doc: any, styleName: string, namespacePrefix?: string): any | null {
    if (!doc || !doc.isValid || !doc.objectStyles) return null;
    const candidates = this.getStyleCandidates(styleName, namespacePrefix);

    for (const name of candidates) {
      const topLevel = doc.objectStyles.itemByName(name);
      if (topLevel && topLevel.isValid) return topLevel;
    }

    return this.findStyleInGroups(doc.objectStyleGroups, "objectStyles", candidates);
  }

  public static getTableStyleSafely(doc: any, styleName: string, namespacePrefix?: string): any | null {
    if (!doc || !doc.isValid || !doc.tableStyles) return null;
    const candidates = this.getStyleCandidates(styleName, namespacePrefix);

    for (const name of candidates) {
      const topLevel = doc.tableStyles.itemByName(name);
      if (topLevel && topLevel.isValid) return topLevel;
    }

    return this.findStyleInGroups(doc.tableStyleGroups, "tableStyles", candidates);
  }

  public static getCellStyleSafely(doc: any, styleName: string, namespacePrefix?: string): any | null {
    if (!doc || !doc.isValid || !doc.cellStyles) return null;
    const candidates = this.getStyleCandidates(styleName, namespacePrefix);

    for (const name of candidates) {
      const topLevel = doc.cellStyles.itemByName(name);
      if (topLevel && topLevel.isValid) return topLevel;
    }

    return this.findStyleInGroups(doc.cellStyleGroups, "cellStyles", candidates);
  }

  private static findStyleInGroups(groupsCollection: any, styleProp: string, styleNames: string | string[]): any | null {
    if (!groupsCollection) return null;
    const names = Array.isArray(styleNames) ? styleNames : [styleNames];
    const groups = groupsCollection.everyItem ? groupsCollection.everyItem().getElements() : [];
    
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      if (!group || !group.isValid) continue;

      const styleCollection = group[styleProp];
      if (styleCollection) {
        for (const name of names) {
          const match = styleCollection.itemByName(name);
          if (match && match.isValid) return match;
        }
      }

      // Recursively search child groups if present
      const childGroupsProp = styleProp === "paragraphStyles"
        ? "paragraphStyleGroups"
        : styleProp === "characterStyles"
        ? "characterStyleGroups"
        : styleProp === "tableStyles"
        ? "tableStyleGroups"
        : styleProp === "cellStyles"
        ? "cellStyleGroups"
        : "objectStyleGroups";

      if (group[childGroupsProp]) {
        const nestedMatch = this.findStyleInGroups(group[childGroupsProp], styleProp, names);
        if (nestedMatch) return nestedMatch;
      }
    }
    return null;
  }
}
