import { ColorModel, ColorSpace } from "indesign";

export class DomResolver {
  public static getOrCreateColor(
    doc: any,
    name: string,
    colorValue: number[],
    space: any = ColorSpace.CMYK
  ): any {
    const existing = doc.colors.itemByName(name);
    if (existing.isValid) return existing;

    return doc.colors.add({
      name,
      model: ColorModel.PROCESS,
      space,
      colorValue
    });
  }

  public static getOrCreateLayer(doc: any, layerName: string): any {
    const existing = doc.layers.itemByName(layerName);
    if (existing.isValid) return existing;
    return doc.layers.add({ name: layerName });
  }

  public static getParagraphStyleSafely(doc: any, styleName: string): any | null {
    if (!doc || !doc.isValid) return null;
    const topLevel = doc.paragraphStyles.itemByName(styleName);
    if (topLevel.isValid) return topLevel;

    return this.findStyleInGroups(doc.paragraphStyleGroups, "paragraphStyles", styleName);
  }

  public static getCharacterStyleSafely(doc: any, styleName: string): any | null {
    if (!doc || !doc.isValid) return null;
    const topLevel = doc.characterStyles.itemByName(styleName);
    if (topLevel.isValid) return topLevel;

    return this.findStyleInGroups(doc.characterStyleGroups, "characterStyles", styleName);
  }

  public static getObjectStyleSafely(doc: any, styleName: string): any | null {
    if (!doc || !doc.isValid) return null;
    if (!doc.objectStyles) return null;
    const topLevel = doc.objectStyles.itemByName(styleName);
    if (topLevel.isValid) return topLevel;

    return this.findStyleInGroups(doc.objectStyleGroups, "objectStyles", styleName);
  }

  private static findStyleInGroups(groupsCollection: any, styleProp: string, styleName: string): any | null {
    if (!groupsCollection) return null;
    const groups = groupsCollection.everyItem ? groupsCollection.everyItem().getElements() : [];
    
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i];
      if (!group || !group.isValid) continue;

      const styleCollection = group[styleProp];
      if (styleCollection) {
        const match = styleCollection.itemByName(styleName);
        if (match && match.isValid) return match;
      }

      // Recursively search child groups if present
      const childGroupsProp = styleProp === "paragraphStyles"
        ? "paragraphStyleGroups"
        : styleProp === "characterStyles"
        ? "characterStyleGroups"
        : "objectStyleGroups";

      if (group[childGroupsProp]) {
        const nestedMatch = this.findStyleInGroups(group[childGroupsProp], styleProp, styleName);
        if (nestedMatch) return nestedMatch;
      }
    }
    return null;
  }
}
