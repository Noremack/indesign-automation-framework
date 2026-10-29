#!/usr/bin/env node
import fs from "fs";
import path from "path";

const targetPath = "dist/scripts/InDesignQGDSPublishingSuite.idjs";
if (!fs.existsSync(targetPath)) {
  console.error("Target script does not exist:", targetPath);
  process.exit(1);
}

const pTokens = "C:/Users/Noremac/AppData/Roaming/Adobe/InDesign/Version 21.0/en_US/Scripts/Scripts Panel/InDesign Brand Engine/brand-tokens.json";
const pAbbr = "C:/Users/Noremac/AppData/Roaming/Adobe/InDesign/Version 21.0/en_US/Scripts/Scripts Panel/InDesign Semantic Styler/abbreviation-mappings.json";
const pLeg = "C:/Users/Noremac/AppData/Roaming/Adobe/InDesign/Version 21.0/en_US/Scripts/Scripts Panel/InDesign Semantic Styler/legislation-mappings.json";

const rawTokens = JSON.parse(fs.readFileSync(pTokens, "utf8"));
const rawAbbr = JSON.parse(fs.readFileSync(pAbbr, "utf8"));
const rawLeg = JSON.parse(fs.readFileSync(pLeg, "utf8"));

// 1. Prepare 37 full swatches
function cleanGroup(g) {
  if (!g) return "";
  return g.replace(/^\s*(?:QGDS\s*[\/\\]\s*)+/i, "")
          .replace(/[\/\\]\s*QGDS\s*[\/\\]/gi, "/")
          .replace(/[\/\\]\s*QGDS\s*$/i, "")
          .trim();
}

function cleanStyleName(n) {
  if (!n) return "";
  return n.replace(/^\s*(?:QGDS\s*[\/\\]\s*)+/i, "").split(/\s*[\/\\]\s*/).pop().trim();
}

// 1. Prepare 37 full swatches with both RGB and CMYK component values
const fullColors = Object.values(rawTokens.colors).map(c => ({
  name: c.name,
  space: c.space || "RGB",
  value: c.value,
  cmykValue: c.cmykValue || c.value
}));

// 2. Prepare 14 gradients
const fullGradients = rawTokens.gradients || [];

// 3. Prepare 17 page formats
const fullPageMatrix = rawTokens.pageMatrix || [];

// 4. Prepare full styles matrices with clean category subfolders (no unwanted QGDS root)
const fullParagraphStyles = (rawTokens.styles?.paragraph || []).map(p => ({
  ...p,
  name: cleanStyleName(p.name),
  group: cleanGroup(p.group),
  basedOn: p.basedOn ? cleanStyleName(p.basedOn) : undefined
}));
const fullCharacterStyles = (rawTokens.styles?.character || []).map(c => ({
  ...c,
  name: cleanStyleName(c.name),
  group: "Character"
}));
const fullCellStyles = (rawTokens.styles?.cell || []).map(c => ({
  ...c,
  name: cleanStyleName(c.name),
  group: "Tables"
}));
const fullTableStyles = (rawTokens.styles?.table || []).map(t => ({
  ...t,
  name: cleanStyleName(t.name),
  group: "Tables",
  headerRegionCell: t.headerRegionCell ? cleanStyleName(t.headerRegionCell) : undefined,
  bodyRegionCell: t.bodyRegionCell ? cleanStyleName(t.bodyRegionCell) : undefined
}));
const fullSpecimenStyles = (rawTokens.specimenStyles || []).map(s => ({
  ...s,
  style: cleanStyleName(s.style)
}));

// 5. Prepare abbreviations (including QGDS)
const fullAbbr = {
  "QGDS": { expansions: ["Queensland Government Design System"], enabled: true }
};
for (const [k, v] of Object.entries(rawAbbr.abbreviations)) {
  if (v && v.enabled !== false && v.expansions && v.expansions.length > 0) {
    fullAbbr[k] = { expansions: v.expansions, enabled: true };
  }
}

// 6. Prepare Acts
const fullActs = Object.keys(rawLeg.legislation).filter(k => rawLeg.legislation[k]?.enabled !== false);

console.log(`Embedding ${fullColors.length} colors, ${fullGradients.length} gradients, ${fullPageMatrix.length} page formats, ${fullParagraphStyles.length} paragraph styles, ${fullCharacterStyles.length} character styles, ${Object.keys(fullAbbr).length} abbreviations, and ${fullActs.length} acts...`);

let content = fs.readFileSync(targetPath, "utf8");

// --- DomResolver Full Implementation ---
const fullDomResolver = `class DomResolver {
    static cleanGroupPath(groupPath, namespacePrefix) {
        if (!groupPath) return "";
        const prefix = namespacePrefix ? String(namespacePrefix).trim() : "QGDS";
        const reStart = new RegExp("^\\\\s*(?:" + prefix + "\\\\s*[\\\\/\\\\\\\\]\\\\s*)+", "i");
        const reMid = new RegExp("[\\\\/\\\\\\\\]\\\\s*" + prefix + "\\\\s*[\\\\/\\\\\\\\]", "gi");
        const reEnd = new RegExp("[\\\\/\\\\\\\\]\\\\s*" + prefix + "\\\\s*$", "i");
        return groupPath
            .replace(reStart, "")
            .replace(reMid, "/")
            .replace(reEnd, "")
            .trim();
    }
    static getStyleCandidates(styleName, namespacePrefix) {
        if (!styleName) return [];
        const candidates = [styleName];
        const stripped = this.cleanGroupPath(styleName, namespacePrefix);
        if (stripped && !candidates.includes(stripped)) {
            candidates.push(stripped);
        }
        const leaf = styleName.split(/[\\/\\\\]/).pop();
        const leafTrimmed = leaf ? leaf.trim() : "";
        if (leafTrimmed && !candidates.includes(leafTrimmed)) {
            candidates.push(leafTrimmed);
        }
        return candidates;
    }
    static getOrCreateColor(doc, name, colorValue, space) {
        if (!doc || !doc.colors) return null;
        const existing = doc.colors.itemByName(name);

        const modelVal = (indesign.ColorModel && indesign.ColorModel.PROCESS)
            ? indesign.ColorModel.PROCESS
            : 1886545267;
        const spaceVal = (space === "CMYK" || space === 1129142603)
            ? 1129142603
            : ((indesign.ColorSpace && indesign.ColorSpace.RGB) ? indesign.ColorSpace.RGB : 1666336572);

        const safeVal = Array.isArray(colorValue)
            ? colorValue.map(v => Math.max(0, Math.round(Number(v) || 0)))
            : [0, 0, 0];

        if (existing && existing.isValid) {
            try {
                existing.space = spaceVal;
                existing.colorValue = safeVal;
            } catch (_) {}
            return existing;
        }

        return doc.colors.add({
            name,
            model: modelVal,
            space: spaceVal,
            colorValue: safeVal
        });
    }
    static getOrCreateLayer(doc, layerName) {
        const existing = doc.layers ? doc.layers.itemByName(layerName) : null;
        if (existing && existing.isValid)
            return existing;
        return doc.layers ? doc.layers.add({ name: layerName }) : null;
    }
    static getOrCreateGradient(doc, name, type = "Linear", stops = []) {
        if (!doc || !doc.isValid || !doc.gradients) return null;
        let gradient = doc.gradients.itemByName(name);
        if (!gradient || !gradient.isValid) {
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
    static resolveTargetGroup(rootGroupCollection, groupPath, childGroupName) {
        if (!groupPath || !rootGroupCollection) return null;
        const cleaned = this.cleanGroupPath(groupPath);
        if (!cleaned) return null;
        const parts = cleaned.split(/\\s*[\\/\\\\]\\s*/).filter(Boolean);
        if (parts.length === 0) return null;

        let currentColl = rootGroupCollection;
        let currentGrp = null;
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
    static getParagraphStyleSafely(doc, styleName) {
        if (!doc || !doc.isValid || !doc.paragraphStyles)
            return null;
        const candidates = this.getStyleCandidates(styleName);
        for (let i = 0; i < candidates.length; i++) {
            const topLevel = doc.paragraphStyles.itemByName(candidates[i]);
            if (topLevel && topLevel.isValid)
                return topLevel;
        }
        return this.findStyleInGroups(doc.paragraphStyleGroups, "paragraphStyles", candidates);
    }
    static getCharacterStyleSafely(doc, styleName) {
        if (!doc || !doc.isValid || !doc.characterStyles)
            return null;
        const candidates = this.getStyleCandidates(styleName);
        for (let i = 0; i < candidates.length; i++) {
            const topLevel = doc.characterStyles.itemByName(candidates[i]);
            if (topLevel && topLevel.isValid)
                return topLevel;
        }
        return this.findStyleInGroups(doc.characterStyleGroups, "characterStyles", candidates);
    }
    static getTableStyleSafely(doc, styleName) {
        if (!doc || !doc.isValid || !doc.tableStyles)
            return null;
        const candidates = this.getStyleCandidates(styleName);
        for (let i = 0; i < candidates.length; i++) {
            const topLevel = doc.tableStyles.itemByName(candidates[i]);
            if (topLevel && topLevel.isValid)
                return topLevel;
        }
        return this.findStyleInGroups(doc.tableStyleGroups, "tableStyles", candidates);
    }
    static getCellStyleSafely(doc, styleName) {
        if (!doc || !doc.isValid || !doc.cellStyles)
            return null;
        const candidates = this.getStyleCandidates(styleName);
        for (let i = 0; i < candidates.length; i++) {
            const topLevel = doc.cellStyles.itemByName(candidates[i]);
            if (topLevel && topLevel.isValid)
                return topLevel;
        }
        return this.findStyleInGroups(doc.cellStyleGroups, "cellStyles", candidates);
    }
    static getObjectStyleSafely(doc, styleName) {
        if (!doc || !doc.isValid || !doc.objectStyles)
            return null;
        const candidates = this.getStyleCandidates(styleName);
        for (let i = 0; i < candidates.length; i++) {
            const topLevel = doc.objectStyles.itemByName(candidates[i]);
            if (topLevel && topLevel.isValid)
                return topLevel;
        }
        return this.findStyleInGroups(doc.objectStyleGroups, "objectStyles", candidates);
    }
    static getOrCreateParagraphStyle(doc, name, props = {}, groupPath, exportTagMap) {
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
            style = this.getParagraphStyleSafely(doc, name);
        }
        if (!style || !style.isValid) {
            style = targetCollection.add({ name, ...props });
        } else if (props && Object.keys(props).length > 0) {
            try {
                for (const [k, v] of Object.entries(props)) {
                    try { style[k] = v; } catch (_) {}
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
    static getOrCreateCharacterStyle(doc, name, props = {}, groupPath, exportTagMap) {
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
            style = this.getCharacterStyleSafely(doc, name);
        }
        if (!style || !style.isValid) {
            style = targetCollection.add({ name, ...props });
        } else if (props && Object.keys(props).length > 0) {
            try {
                for (const [k, v] of Object.entries(props)) {
                    try { style[k] = v; } catch (_) {}
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
    static getOrCreateCellStyle(doc, name, props = {}, groupPath) {
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
            style = this.getCellStyleSafely(doc, name);
        }
        if (!style || !style.isValid) {
            style = targetCollection.add({ name, ...props });
        } else if (props && Object.keys(props).length > 0) {
            try {
                for (const [k, v] of Object.entries(props)) {
                    try { style[k] = v; } catch (_) {}
                }
            } catch (_) {}
        }
        return style;
    }
    static getOrCreateTableStyle(doc, name, props = {}, groupPath) {
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
            style = this.getTableStyleSafely(doc, name);
        }
        if (!style || !style.isValid) {
            style = targetCollection.add({ name, ...props });
        } else if (props && Object.keys(props).length > 0) {
            try {
                for (const [k, v] of Object.entries(props)) {
                    try { style[k] = v; } catch (_) {}
                }
            } catch (_) {}
        }
        return style;
    }
    static getOrCreateObjectStyle(doc, name, properties = {}, groupName) {
        const existing = this.getObjectStyleSafely(doc, name);
        if (existing && existing.isValid)
            return existing;
        let targetCollection = doc.objectStyles;
        if (groupName && doc.objectStyleGroups) {
            const grp = this.resolveTargetGroup(doc.objectStyleGroups, groupName, "objectStyleGroups");
            if (grp && grp.isValid && grp.objectStyles) {
                targetCollection = grp.objectStyles;
            }
        }
        return targetCollection.add({
            name,
            ...properties
        });
    }
    static findStyleInGroups(groupsCollection, styleProp, styleNames) {
        if (!groupsCollection)
            return null;
        const names = Array.isArray(styleNames) ? styleNames : [styleNames];
        const groups = groupsCollection.everyItem ? groupsCollection.everyItem().getElements() : [];
        for (let i = 0; i < groups.length; i++) {
            const group = groups[i];
            if (!group || !group.isValid)
                continue;
            const styleCollection = group[styleProp];
            if (styleCollection) {
                for (let n = 0; n < names.length; n++) {
                    const match = styleCollection.itemByName(names[n]);
                    if (match && match.isValid)
                        return match;
                }
            }
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
                if (nestedMatch)
                    return nestedMatch;
            }
        }
        return null;
    }
}`;

// Replace DomResolver and inject BrandThemeAdapter + LayoutPlanner
const adapterAndPlannerBlock = `
class ThemeValidationError extends Error {
    constructor(missingFields) {
        super("[ThemeValidationError] Tenant brand package is missing required tokens: " + missingFields.join(", "));
        this.name = "ThemeValidationError";
        this.missingFields = missingFields;
    }
}

class BrandThemeAdapter {
    constructor(brandPackage) {
        if (!brandPackage) throw new Error("[ThemeAdapter] Brand package is null or undefined.");
        this.pkg = brandPackage;
        this.validate();
    }
    validate() {
        const missing = [];
        if (!this.pkg.manifest) missing.push("manifest");
        else {
            if (!this.pkg.manifest.tenantId) missing.push("manifest.tenantId");
            if (!this.pkg.manifest.tenantName) missing.push("manifest.tenantName");
            if (!this.pkg.manifest.namespacePrefix) missing.push("manifest.namespacePrefix");
            if (!this.pkg.manifest.defaultTheme) missing.push("manifest.defaultTheme");
        }
        if (!Array.isArray(this.pkg.swatches) || this.pkg.swatches.length === 0) missing.push("swatches (non-empty array)");
        if (!this.pkg.themeMatrices || Object.keys(this.pkg.themeMatrices).length === 0) missing.push("themeMatrices (non-empty dictionary)");
        if (missing.length > 0) throw new ThemeValidationError(missing);
    }
    get package() { return this.pkg; }
    get manifest() { return this.pkg.manifest; }
    get tenantId() { return this.pkg.manifest.tenantId; }
    get tenantName() { return this.pkg.manifest.tenantName; }
    get namespacePrefix() { return this.pkg.manifest.namespacePrefix; }
    get defaultTheme() { return this.pkg.manifest.defaultTheme; }
    getAvailableThemes() { return this.pkg.manifest.availableThemes || Object.keys(this.pkg.themeMatrices); }
    resolveRoleColors(themeName, isReverse = false) {
        const targetTheme = this.pkg.themeMatrices[themeName] ? themeName : this.pkg.manifest.defaultTheme;
        const matrix = this.pkg.themeMatrices[targetTheme];
        if (!matrix) throw new Error('[ThemeAdapter] Theme "' + themeName + '" is not registered in tenant package.');
        return isReverse ? matrix.reverse : matrix.standard;
    }
    getSwatchesForTheme(themeName) {
        const prefix = themeName + " -";
        return (this.pkg.swatches || []).filter(s => s.name.startsWith("Neutral") || s.name.startsWith(prefix));
    }
    getGradientsForTheme(themeName) {
        const prefix = themeName + " -";
        return (this.pkg.gradients || []).filter(g => g.name.startsWith("Neutral") || g.name.startsWith(prefix));
    }
    getParagraphStyles() { return this.pkg.styles?.paragraph || []; }
    getCharacterStyles() { return this.pkg.styles?.character || []; }
    getCellStyles() { return this.pkg.styles?.cell || []; }
    getTableStyles() { return this.pkg.styles?.table || []; }
    getLayers() {
        return this.pkg.layers || [
            { name: "Layer 1", zIndex: 0 },
            { name: "Brand Assets", zIndex: 1 },
            { name: "Content", zIndex: 2 },
            { name: "Header & Footer", zIndex: 3 }
        ];
    }
    getSpecimenStyles() { return this.pkg.specimenStyles || []; }
    matchLayoutPreset(shortEdgeMm, longEdgeMm, toleranceMm = 3.0) {
        const presets = this.pkg.layoutPresets || [];
        for (let i = 0; i < presets.length; i++) {
            const preset = presets[i];
            if (Math.abs(shortEdgeMm - preset.shortEdgeMm) <= toleranceMm && Math.abs(longEdgeMm - preset.longEdgeMm) <= toleranceMm) {
                return preset;
            }
        }
        const fallbackMargin = Math.max(10, Math.round(shortEdgeMm * 0.05));
        return {
            name: "Custom",
            shortEdgeMm,
            longEdgeMm,
            marginMm: fallbackMargin,
            gutterMm: fallbackMargin,
            bleedMm: 3,
            baseFontPt: 12,
            isFacingPages: shortEdgeMm <= 425,
            masterSpreads: [
                { prefix: "A", name: "Cover", injectFolio: false },
                { prefix: "B", name: "Content", injectFolio: true }
            ]
        };
    }
    getExportPresets() {
        return this.pkg.exportPresets || {
            printPdfPreset: "[High Quality Print]",
            digitalPdfPreset: "[Smallest File Size]",
            outputDirectoryPattern: "Deliverables"
        };
    }
}

class LayoutPlanner {
    static analyzeDimensions(wPt, hPt) {
        const PT_TO_MM = 25.4 / 72.0;
        const widthMm = Math.round(wPt * PT_TO_MM * 10) / 10;
        const heightMm = Math.round(hPt * PT_TO_MM * 10) / 10;
        const shortEdgeMm = Math.min(widthMm, heightMm);
        const longEdgeMm = Math.max(widthMm, heightMm);
        const orientation = widthMm > heightMm ? "landscape" : "portrait";
        return { widthMm, heightMm, shortEdgeMm, longEdgeMm, orientation };
    }
    static calculatePlan(params) {
        const PT_TO_MM = 25.4 / 72.0;
        const { widthMm, heightMm, shortEdgeMm, longEdgeMm, orientation } = this.analyzeDimensions(params.widthPt, params.heightPt);
        const widthPt = params.widthPt;
        const heightPt = params.heightPt;
        const pageCount = params.pageCount || 1;
        const publicationTitle = params.publicationTitle || "Publication";

        let matchedFormat = "Custom";
        let marginMm = 12;
        let gutterMm = 12;
        let scalingFactor = 1.0;
        let isFacingPages = shortEdgeMm <= 425;
        let masterDefinitions = [
            { prefix: "A", name: "Cover", injectFolio: false },
            { prefix: "B", name: "Content", injectFolio: true },
            { prefix: "C", name: "Back", injectFolio: false }
        ];

        if (params.adapter) {
            const preset = params.adapter.matchLayoutPreset(shortEdgeMm, longEdgeMm);
            matchedFormat = preset.name;
            marginMm = preset.marginMm;
            gutterMm = preset.gutterMm;
            scalingFactor = preset.baseFontPt ? preset.baseFontPt / 12 : 1.0;
            if (preset.isFacingPages !== undefined) isFacingPages = preset.isFacingPages;
            if (preset.masterSpreads && preset.masterSpreads.length > 0) masterDefinitions = preset.masterSpreads;
        } else if (params.presets && params.presets.length > 0) {
            for (let i = 0; i < params.presets.length; i++) {
                const p = params.presets[i];
                const pShort = p.shortEdge || p.shortEdgeMm || 0;
                const pLong = p.longEdge || p.longEdgeMm || 0;
                if (Math.abs(shortEdgeMm - pShort) <= 3 && Math.abs(longEdgeMm - pLong) <= 3) {
                    matchedFormat = p.name;
                    marginMm = p.margin || p.marginMm || 12;
                    gutterMm = p.gutter || p.gutterMm || marginMm;
                    scalingFactor = p.scaleRatio || (p.baseFont ? p.baseFont / 12 : 1.0);
                    if (p.isFacingPages !== undefined) isFacingPages = Boolean(p.isFacingPages);
                    else if (p.name === "DL" || p.type === "card") isFacingPages = false;
                    break;
                }
            }
        } else {
            marginMm = Math.max(12, Math.round(shortEdgeMm * 0.05));
            gutterMm = marginMm;
        }

        if (params.marginOverrideMm !== undefined && params.marginOverrideMm > 0) {
            marginMm = params.marginOverrideMm;
        }
        const marginPt = marginMm / PT_TO_MM;
        const headerFooterLayer = (params.layerNames && params.layerNames.headersFooters) || "Headers & Footers";

        const masterPlans = masterDefinitions.map(def => {
            const isCover = def.name.toLowerCase().includes("cover");
            const topM = isCover ? Math.round(marginMm * 1.5) : marginMm;
            const botM = isCover ? Math.round(marginMm * 1.5) : marginMm;
            const folios = [];
            if (def.injectFolio) {
                const footerY1 = heightPt - marginPt;
                const footerY2 = heightPt - Math.max(10, marginPt / 2);
                folios.push({
                    geometricBounds: [footerY1, marginPt, footerY2, widthPt - marginPt],
                    text: publicationTitle + "  |  Page \\u0018",
                    pointSize: Math.max(8, Math.round(9 * scalingFactor)),
                    label: "DynamicContentFooter",
                    name: "Running Folio",
                    layerName: headerFooterLayer
                });
            }
            return {
                prefix: def.prefix,
                baseName: def.name,
                fullName: def.prefix + "-" + def.name,
                isCover,
                marginsMm: { top: topM, bottom: botM, left: marginMm, right: marginMm },
                marginsPt: { top: topM / PT_TO_MM, bottom: botM / PT_TO_MM, left: marginPt, right: marginPt },
                gutterMm,
                folios
            };
        });

        const coverMaster = masterPlans.find(m => m.isCover) || masterPlans[0];
        const contentMaster = masterPlans.find(m => !m.isCover) || masterPlans[1] || masterPlans[0];
        const pageRemappings = [];
        for (let p = 0; p < pageCount; p++) {
            pageRemappings.push({
                pageIndex: p,
                targetMasterPrefix: p === 0 ? coverMaster.prefix : contentMaster.prefix,
                targetMasterBaseName: p === 0 ? coverMaster.baseName : contentMaster.baseName
            });
        }
        const layers = [
            { name: (params.layerNames && params.layerNames.content) || "Artwork / Content", color: 1768846950 },
            { name: headerFooterLayer, color: 1684366699 },
            { name: (params.layerNames && params.layerNames.brandAssets) || "Brand Assets / Badges", color: 1836016741 }
        ];

        return {
            matchedFormat,
            dimensionsMm: { width: widthMm, height: heightMm },
            dimensionsPt: { width: widthPt, height: heightPt },
            orientation,
            scalingFactor,
            marginMm,
            marginPt,
            gutterMm,
            isFacingPages,
            layers,
            masterPlans,
            pageRemappings
        };
    }
}

class PhysicalTypographyEngine {
    static snapToBaselineGrid(targetPt, baselineGridPt = 4) {
        const grid = Math.max(1, baselineGridPt);
        return Math.ceil(targetPt / grid) * grid;
    }
    static calculateBasePointSize(baseBodyCapHeightMm = 2.4, capToEmRatio = 0.705) {
        const capHeightPt = baseBodyCapHeightMm * (72.0 / 25.4);
        const pt = capHeightPt / Math.max(0.1, capToEmRatio);
        return Math.round(pt * 100) / 100;
    }
    static getRoleScaleStep(role) {
        switch (role) {
            case "display": return 5;
            case "title":
            case "h1": return 4;
            case "h2": return 3;
            case "h3": return 2;
            case "h4":
            case "lead": return 1;
            case "listItem":
            case "body": return 0;
            case "small":
            case "caption": return -1;
            case "footer": return -2;
            default: return 0;
        }
    }
    static calculateRolePointSize(baseBodyPt, role, scaleRatio = 1.25) {
        const step = this.getRoleScaleStep(role);
        const pt = baseBodyPt * Math.pow(scaleRatio, step);
        return Math.round(pt * 100) / 100;
    }
    static calculateRoleLeading(pointSize, role, baselineGridPt = 4) {
        const multipliers = {
            display: 1.15,
            title: 1.15,
            h1: 1.15,
            h2: 1.15,
            h3: 1.20,
            h4: 1.20,
            lead: 1.30,
            body: 1.35,
            listItem: 1.35,
            small: 1.30,
            caption: 1.30,
            footer: 1.30
        };
        const multiplier = multipliers[role] || 1.35;
        const rawLeading = pointSize * multiplier;
        let snapped = this.snapToBaselineGrid(rawLeading, baselineGridPt);
        if (snapped <= pointSize) {
            snapped += baselineGridPt;
        }
        return snapped;
    }
    static calculateRoleSpacing(role, baselineGridPt = 4) {
        const grid = Math.max(1, Math.round(baselineGridPt));
        switch (role) {
            case "display":
            case "title":
            case "h1":
                return { spaceBefore: 4 * grid, spaceAfter: 2 * grid, spaceBetweenParagraphsOfSameStyle: 1 * grid, keepWithNext: 1 };
            case "h2":
                return { spaceBefore: 3 * grid, spaceAfter: 1 * grid, spaceBetweenParagraphsOfSameStyle: 1 * grid, keepWithNext: 1 };
            case "h3":
                return { spaceBefore: 2 * grid, spaceAfter: 1 * grid, spaceBetweenParagraphsOfSameStyle: 1 * grid, keepWithNext: 1 };
            case "h4":
                return { spaceBefore: 2 * grid, spaceAfter: 1 * grid, spaceBetweenParagraphsOfSameStyle: 1 * grid, keepWithNext: 1 };
            case "lead":
                return { spaceBefore: 1 * grid, spaceAfter: 2 * grid, spaceBetweenParagraphsOfSameStyle: 1 * grid };
            case "listItem":
                return { spaceBefore: 1 * grid, spaceAfter: 2 * grid, spaceBetweenParagraphsOfSameStyle: 0 };
            case "small":
            case "caption":
                return { spaceBefore: 1 * grid, spaceAfter: 1 * grid, spaceBetweenParagraphsOfSameStyle: 1 * grid };
            case "footer":
                return { spaceBefore: 0, spaceAfter: 0, spaceBetweenParagraphsOfSameStyle: 0 };
            case "body":
            default:
                return { spaceBefore: 0, spaceAfter: 2 * grid, spaceBetweenParagraphsOfSameStyle: 1 * grid };
        }
    }
    static calculateOpticalTracking(longEdgeMm, formatName) {
        if (formatName) {
            const fn = formatName.toUpperCase();
            if (fn.includes("A0") || fn.includes("BANNER") || fn.includes("BILLBOARD")) return 25;
            if (fn.includes("A1") || fn.includes("POSTER - LARGE")) return 20;
            if (fn.includes("A2") || fn.includes("POSTER")) return 15;
            if (fn.includes("A3")) return 10;
        }
        if (longEdgeMm !== undefined) {
            if (longEdgeMm >= 1000) return 25;
            if (longEdgeMm >= 800) return 20;
            if (longEdgeMm >= 550) return 15;
            if (longEdgeMm >= 400) return 10;
        }
        return 0;
    }
    static detectTypographyRole(styleName, groupPath) {
        const combined = ((groupPath || "") + " / " + styleName).toLowerCase();
        if (combined.includes("display") || combined.includes("hero")) return "display";
        if (combined.includes("title")) return "title";
        if (combined.includes("h1") || combined.includes("heading 1")) return "h1";
        if (combined.includes("h2") || combined.includes("heading 2")) return "h2";
        if (combined.includes("h3") || combined.includes("heading 3")) return "h3";
        if (combined.includes("h4") || combined.includes("heading 4") || combined.includes("minor")) return "h4";
        if (combined.includes("lead") || combined.includes("abstract") || combined.includes("intro")) return "lead";
        if (combined.includes("list") || combined.includes("bullet") || combined.includes("numbered")) return "listItem";
        if (combined.includes("footer") || combined.includes("running folio")) return "footer";
        if (combined.includes("caption") || combined.includes("note") || combined.includes("small")) return "small";
        return "body";
    }
    static applyPhysicalTypographyRules(styleProps, role, config = {}) {
        const baseCapHeight = config.baseBodyCapHeightMm || 2.4;
        const capToEm = config.capToEmRatio || 0.705;
        const scaleRatio = config.scaleRatio || 1.25;
        const baselineGrid = Math.max(1, Math.round(config.baselineGridPt || 4));

        const baseBodyPt = this.calculateBasePointSize(baseCapHeight, capToEm);
        const calculatedPointSize = this.calculateRolePointSize(baseBodyPt, role, scaleRatio);
        styleProps.pointSize = calculatedPointSize;

        const calculatedLeading = this.calculateRoleLeading(calculatedPointSize, role, baselineGrid);
        styleProps.leading = calculatedLeading;
        styleProps.alignToBaseline = true;

        styleProps.hyphenation = false;
        const leftAlign = (typeof indesign !== "undefined" && indesign.Justification && indesign.Justification.LEFT_ALIGN) || 1818584692;
        styleProps.justification = leftAlign;
        styleProps.composer = "Adobe World-Ready Paragraph Composer";

        const spacing = this.calculateRoleSpacing(role, baselineGrid);
        styleProps.spaceBefore = spacing.spaceBefore;
        styleProps.spaceAfter = spacing.spaceAfter;
        styleProps.spaceBetweenParagraphsOfSameStyle = spacing.spaceBetweenParagraphsOfSameStyle;
        styleProps.spaceBetweenParagraphsForSameStyle = spacing.spaceBetweenParagraphsOfSameStyle;
        if (spacing.keepWithNext !== undefined) {
            styleProps.keepWithNext = spacing.keepWithNext;
        }

        const opticalOffset = config.opticalTrackingOffset !== undefined
            ? config.opticalTrackingOffset
            : this.calculateOpticalTracking(config.longEdgeMm, config.formatName);

        const existingTracking = typeof styleProps.tracking === "number" ? styleProps.tracking : 0;
        styleProps.tracking = existingTracking + opticalOffset;

        return styleProps;
    }
}
`;

// Replace DomResolver and all injected adapters/planners idempotently
content = content.replace(/class DomResolver\s*\{[\s\S]*?(?=const DEFAULT_QGDS_PAGE_MATRIX\s*=)/s, `${fullDomResolver}\n${adapterAndPlannerBlock}\n\n`);

// --- Theme Colors Resolution ---
const themeColorsBlock = `
function getThemeColors(primaryTheme = "Blue", isReverse = false) {
    const hasExtraDark = ["Blue", "BVRT", "Gum", "Sand"].includes(primaryTheme);
    const extraDarkToken = hasExtraDark ? (primaryTheme + " - Extra Dark") : (primaryTheme + " - Black");

    const baseData = {
        themeName: primaryTheme,
        themeWhiteColor: primaryTheme + " - White",
        themeExtraDarkColor: extraDarkToken,
        primaryTextColor: "Neutral - Extra Dark",
        primaryHeadingColor: primaryTheme + " - Medium",
        secondaryHeadingColor: extraDarkToken,
        accentColor: primaryTheme + " - Medium",
        subtleStrokeColor: "Neutral - Light",
        frameFillColor: primaryTheme + " - Extra Light",
        tableHeaderBG: primaryTheme + " - Medium",
        tableHeaderText: "Neutral - White",
        tableBodyHorizontalBorderColor: "Neutral - Medium",
        tableBodyVerticalBorderColor: "Neutral - Light",
        tableZebraColor: "Neutral - Extra Light"
    };

    if (isReverse) {
        baseData.primaryTextColor = "Paper";
        baseData.primaryHeadingColor = "Paper";
        baseData.secondaryHeadingColor = primaryTheme + " - Extra Light";
        baseData.accentColor = primaryTheme + " - Light";
        baseData.subtleStrokeColor = "Neutral - Dark";
        baseData.frameFillColor = extraDarkToken;
        baseData.tableBodyHorizontalBorderColor = "Paper";
        baseData.tableBodyVerticalBorderColor = baseData.themeWhiteColor;
        baseData.tableHeaderBG = baseData.themeWhiteColor;
        baseData.tableHeaderText = extraDarkToken;
        baseData.tableZebraColor = primaryTheme + " - Black";
    }

    return baseData;
}
`;

if (!content.includes("function getThemeColors(")) {
    content = content.replace("class QgdsBrandEngineService", `${themeColorsBlock}\nclass QgdsBrandEngineService`);
}

// Embed Tokens Constants
content = content.replace(/const DEFAULT_QGDS_COLORS = \[[\s\S]*?\r?\n\];/s, `const DEFAULT_QGDS_COLORS = ${JSON.stringify(fullColors, null, 4)};`);
content = content.replace(/const DEFAULT_QGDS_ABBREVIATIONS = \{[\s\S]*?\r?\n\};/s, `const DEFAULT_QGDS_ABBREVIATIONS = ${JSON.stringify(fullAbbr, null, 4)};`);
content = content.replace(/const DEFAULT_QGDS_ACTS = \[[\s\S]*?\r?\n\];/s, `const DEFAULT_QGDS_ACTS = ${JSON.stringify(fullActs, null, 4)};`);

const embeddedMatricesBlock = `
const DEFAULT_QGDS_PAGE_MATRIX = ${JSON.stringify(fullPageMatrix, null, 4)};
const DEFAULT_QGDS_GRADIENTS = ${JSON.stringify(fullGradients, null, 4)};
const DEFAULT_QGDS_PARAGRAPH_STYLES = ${JSON.stringify(fullParagraphStyles, null, 4)};
const DEFAULT_QGDS_CHARACTER_STYLES = ${JSON.stringify(fullCharacterStyles, null, 4)};
const DEFAULT_QGDS_CELL_STYLES = ${JSON.stringify(fullCellStyles, null, 4)};
const DEFAULT_QGDS_TABLE_STYLES = ${JSON.stringify(fullTableStyles, null, 4)};
const DEFAULT_QGDS_SPECIMEN_STYLES = ${JSON.stringify(fullSpecimenStyles, null, 4)};
`;

if (content.includes("const DEFAULT_QGDS_PAGE_MATRIX =")) {
    content = content.replace(/const DEFAULT_QGDS_PAGE_MATRIX =[\s\S]*?(?=const DEFAULT_QGDS_COLORS =)/s, `${embeddedMatricesBlock}\n`);
} else if (content.includes("const DEFAULT_QGDS_GRADIENTS =")) {
    content = content.replace(/const DEFAULT_QGDS_GRADIENTS =[\s\S]*?(?=const DEFAULT_QGDS_COLORS =)/s, `${embeddedMatricesBlock}\n`);
} else {
    content = content.replace("const DEFAULT_QGDS_COLORS =", `${embeddedMatricesBlock}\nconst DEFAULT_QGDS_COLORS =`);
}

// --- Layout Engine Implementation ---
const layoutEngineBlock = `
const PT_TO_MM = 0.352778;

function analyzeDocumentMetrics(doc, customMatrix) {
    let wPt = 595.28;
    let hPt = 841.89;
    try {
        if (doc.pages && doc.pages.length > 0) {
            const p = doc.pages[0];
            const bounds = p.bounds || [0, 0, 841.89, 595.28];
            hPt = Math.abs(bounds[2] - bounds[0]);
            wPt = Math.abs(bounds[3] - bounds[1]);
        } else if (doc.documentPreferences) {
            wPt = doc.documentPreferences.pageWidth || 595.28;
            hPt = doc.documentPreferences.pageHeight || 841.89;
        }
    } catch (_) {}

    const wMm = Math.round(wPt * PT_TO_MM * 100) / 100;
    const hMm = Math.round(hPt * PT_TO_MM * 100) / 100;
    const shortMm = Math.min(wMm, hMm);
    const longMm = Math.max(wMm, hMm);
    const orientation = wMm >= hMm ? "landscape" : "portrait";
    const matrix = customMatrix || DEFAULT_QGDS_PAGE_MATRIX || [];

    for (let i = 0; i < matrix.length; i++) {
        const preset = matrix[i];
        if (Math.abs(shortMm - preset.shortEdge) <= 3 && Math.abs(longMm - preset.longEdge) <= 3) {
            return { metrics: preset, widthMm: wMm, heightMm: hMm, orientation };
        }
    }

    const fallbackMargin = Math.max(12, Math.round(shortMm * 0.05));
    const fallback = {
        name: "Custom",
        shortEdge: shortMm,
        longEdge: longMm,
        margin: fallbackMargin,
        gutter: fallbackMargin,
        bleed: 3,
        baseFont: 12,
        masters: ["Cover", "Content", "Back"]
    };
    return { metrics: fallback, widthMm: wMm, heightMm: hMm, orientation };
}

class QgdsLayoutEngineService extends BaseService {
    constructor() {
        super(...arguments);
        this.actionName = "QGDS Layout & Master Spread Engine";
    }
    process(doc, options) {
        doc.recompose();
        const analysis = analyzeDocumentMetrics(doc);
        const metrics = analysis.metrics;
        const widthMm = analysis.widthMm;
        const heightMm = analysis.heightMm;
        const orientation = analysis.orientation;

        const marginMm = (options.marginOverrideMm !== undefined) ? options.marginOverrideMm : metrics.margin;
        const baseMarginPt = marginMm / PT_TO_MM;
        const scalingFactor = metrics.scaleRatio || (metrics.baseFont ? metrics.baseFont / 12 : 1.0);

        const report = {
            matchedFormat: metrics.name,
            dimensionsMm: { width: widthMm, height: heightMm },
            orientation,
            scalingFactor,
            marginMm,
            mastersCreated: [],
            pagesRemapped: 0,
            footersInjected: 0,
            skippedCount: 0,
            details: []
        };

        // 1. Layer Stratification
        if (options.enforceStratification !== false && doc.layers) {
            try {
                const requiredLayers = [
                    { name: "Artwork / Content", color: 1768846950 },
                    { name: "Headers & Footers", color: 1684366699 },
                    { name: "Brand Assets / Badges", color: 1836016741 }
                ];
                for (let i = 0; i < requiredLayers.length; i++) {
                    const l = DomResolver.getOrCreateLayer(doc, requiredLayers[i].name);
                    if (l && l.isValid) {
                        try {
                            l.locked = false;
                            l.visible = true;
                        } catch (_) {}
                    }
                }
            } catch (err) {
                if (options.failurePolicy === "strict") throw err;
                report.skippedCount++;
            }
        }

        // 2. Master Spreads (A-Cover, B-Content, C-Back)
        let aCoverMaster = null;
        let bContentMaster = null;
        let cBackMaster = null;

        if (options.createMasters !== false && doc.masterSpreads) {
            try {
                const requiredMasters = [
                    { prefix: "A", baseName: "Cover" },
                    { prefix: "B", baseName: "Content" },
                    { prefix: "C", baseName: "Back" }
                ];
                for (let r = 0; r < requiredMasters.length; r++) {
                    const req = requiredMasters[r];
                    let foundMaster = null;
                    const currentMasters = doc.masterSpreads.everyItem ? doc.masterSpreads.everyItem().getElements() : [];
                    for (let m = 0; m < currentMasters.length; m++) {
                        const cm = currentMasters[m];
                        if (cm.isValid && (cm.name === (req.prefix + "-" + req.baseName) || (cm.namePrefix === req.prefix && cm.baseName === req.baseName))) {
                            foundMaster = cm;
                            break;
                        }
                    }
                    if (!foundMaster) {
                        for (let m = 0; m < currentMasters.length; m++) {
                            const cm = currentMasters[m];
                            if (cm.isValid && cm.namePrefix === req.prefix) {
                                try {
                                    if (!options.dryRun) {
                                        cm.baseName = req.baseName;
                                    }
                                    foundMaster = cm;
                                    report.mastersCreated.push(req.prefix + "-" + req.baseName);
                                    break;
                                } catch (_) {}
                            }
                        }
                    }
                    if (!foundMaster && !options.dryRun) {
                        try {
                            const newM = doc.masterSpreads.add();
                            newM.namePrefix = req.prefix;
                            newM.baseName = req.baseName;
                            foundMaster = newM;
                            report.mastersCreated.push(req.prefix + "-" + req.baseName);
                        } catch (_) {}
                    }

                    // Purge existing items from master pages if cleaning is enabled
                    if (foundMaster && foundMaster.isValid && options.cleanMasters !== false && !options.dryRun) {
                        const mPages = foundMaster.pages?.everyItem ? foundMaster.pages.everyItem().getElements() : (foundMaster.pages || []);
                        for (let p = 0; p < mPages.length; p++) {
                            const mp = mPages[p];
                            if (!mp || !mp.isValid) continue;
                            const pItems = mp.pageItems?.everyItem ? mp.pageItems.everyItem().getElements() : (mp.pageItems || []);
                            for (let pi = pItems.length - 1; pi >= 0; pi--) {
                                const item = pItems[pi];
                                if (item && item.isValid) {
                                    try {
                                        if (item.itemLayer && item.itemLayer.isValid && item.itemLayer.locked) item.itemLayer.locked = false;
                                        if (item.locked) item.locked = false;
                                        item.remove();
                                    } catch (_) {}
                                }
                            }
                        }
                    }

                    if (req.prefix === "A") aCoverMaster = foundMaster;
                    if (req.prefix === "B") bContentMaster = foundMaster;
                    if (req.prefix === "C") cBackMaster = foundMaster;
                }
            } catch (err) {
                if (options.failurePolicy === "strict") throw err;
                report.skippedCount++;
            }
        }

        // 3. Margin & Gutter Enforcement
        if (options.enforceMargins !== false && !options.dryRun) {
            try {
                const mSpreads = doc.masterSpreads?.everyItem ? doc.masterSpreads.everyItem().getElements() : [];
                for (let m = 0; m < mSpreads.length; m++) {
                    const ms = mSpreads[m];
                    if (!ms || !ms.isValid || !ms.pages) continue;
                    const isCover = ms.name && ms.name.toLowerCase().indexOf("cover") !== -1;
                    const topM = isCover ? (Math.round(marginMm * 1.5) + "mm") : (marginMm + "mm");
                    const botM = isCover ? (Math.round(marginMm * 1.5) + "mm") : (marginMm + "mm");
                    const mPages = ms.pages.everyItem ? ms.pages.everyItem().getElements() : [];
                    for (let p = 0; p < mPages.length; p++) {
                        const pg = mPages[p];
                        if (pg && pg.isValid && pg.marginPreferences) {
                            pg.marginPreferences.properties = {
                                top: topM,
                                bottom: botM,
                                left: marginMm + "mm",
                                right: marginMm + "mm",
                                columnGutter: metrics.gutter + "mm"
                            };
                        }
                    }
                }
                const docPages = doc.pages?.everyItem ? doc.pages.everyItem().getElements() : [];
                for (let p = 0; p < docPages.length; p++) {
                    const pg = docPages[p];
                    if (!pg || !pg.isValid || !pg.marginPreferences) continue;
                    pg.marginPreferences.properties = {
                        top: marginMm + "mm",
                        bottom: marginMm + "mm",
                        left: marginMm + "mm",
                        right: marginMm + "mm",
                        columnGutter: metrics.gutter + "mm"
                    };
                }
            } catch (err) {
                if (options.failurePolicy === "strict") throw err;
                report.skippedCount++;
            }
        }

        // 4. Remap Document Pages to Brand Masters
        if (options.remapBodyPages !== false && !options.dryRun && doc.pages) {
            try {
                const docPages = doc.pages.everyItem ? doc.pages.everyItem().getElements() : [];
                for (let p = 0; p < docPages.length; p++) {
                    const pg = docPages[p];
                    if (!pg || !pg.isValid) continue;
                    if (p === 0 && aCoverMaster && aCoverMaster.isValid) {
                        pg.appliedMaster = aCoverMaster;
                        report.pagesRemapped++;
                    } else if (p > 0 && bContentMaster && bContentMaster.isValid) {
                        pg.appliedMaster = bContentMaster;
                        report.pagesRemapped++;
                    }
                }
                if (aCoverMaster && aCoverMaster.isValid && doc.masterSpreads) {
                    const masters = doc.masterSpreads.everyItem ? doc.masterSpreads.everyItem().getElements() : [];
                    for (let m = masters.length - 1; m >= 0; m--) {
                        const ms = masters[m];
                        if (ms && ms.isValid && (ms.name === "A-Master" || ms.name === "A-Parent")) {
                            const items = ms.pageItems?.everyItem ? ms.pageItems.everyItem().getElements() : ms.pageItems || [];
                            if (items.length === 0) {
                                try { ms.remove(); } catch (_) {}
                            }
                        }
                    }
                }
            } catch (err) {
                if (options.failurePolicy === "strict") throw err;
                report.skippedCount++;
            }
        }

        // 5. Inject Footers on B-Content Master
        if (options.injectFooters !== false && !options.dryRun && bContentMaster && bContentMaster.isValid) {
            try {
                const cPages = bContentMaster.pages?.everyItem ? bContentMaster.pages.everyItem().getElements() : [];
                const pubTitle = options.publicationTitle || (doc.name ? String(doc.name).replace(/\\.[^.]+$/, "") : "Queensland Government Publication");
                let footerLayer = doc.layers?.itemByName("Headers & Footers");
                if (!footerLayer || !footerLayer.isValid) {
                    footerLayer = doc.layers ? doc.layers[0] : null;
                }

                for (let cpIdx = 0; cpIdx < cPages.length; cpIdx++) {
                    const cp = cPages[cpIdx];
                    if (!cp || !cp.isValid || !cp.textFrames) continue;
                    if (cp.textFrames.everyItem) {
                        const tfs = cp.textFrames.everyItem().getElements();
                        for (let ti = tfs.length - 1; ti >= 0; ti--) {
                            if (tfs[ti].label === "DynamicContentFooter" || tfs[ti].label === "DynamicBrandFooter" || tfs[ti].name === "Running Folio" || tfs[ti].name === "DynamicBrandFooter") {
                                try { tfs[ti].remove(); } catch (_) {}
                            }
                        }
                    }
                    const pageBounds = cp.bounds || [0, 0, 841.89, 595.28];
                    const pageW = Math.abs(pageBounds[3] - pageBounds[1]);
                    const pageH = Math.abs(pageBounds[2] - pageBounds[0]);
                    const footerY1 = pageH - baseMarginPt;
                    const footerY2 = pageH - Math.max(10, baseMarginPt / 2);

                    const tfFolio = cp.textFrames.add({
                        label: "DynamicContentFooter",
                        geometricBounds: [footerY1, baseMarginPt, footerY2, pageW - baseMarginPt],
                        itemLayer: footerLayer
                    });
                    try {
                        tfFolio.contents = pubTitle + "  |  Page " + String.fromCharCode(0x0018);
                    } catch (_) {
                        tfFolio.contents = pubTitle + "  |  Page ";
                    }
                    report.footersInjected++;
                }
            } catch (err) {
                if (options.failurePolicy === "strict") throw err;
                report.skippedCount++;
            }
        }

        return report;
    }
}
`;

const resetServiceBlock = `
class QgdsResetService extends BaseService {
    constructor() {
        super(...arguments);
        this.actionName = "QGDS Document Sanitization Protocol";
    }
    process(doc, options) {
        doc.recompose();
        const report = {
            layersUnlocked: 0,
            masterItemsCleared: 0,
            textFramesReset: 0,
            stylesRemoved: 0,
            groupsRemoved: 0,
            swatchesRemoved: 0,
            skippedCount: 0,
            details: []
        };
        if (doc.layers) {
            try {
                const layers = doc.layers.everyItem ? doc.layers.everyItem().getElements() : doc.layers;
                for (let l = 0; l < layers.length; l++) {
                    const layer = layers[l];
                    if (layer && layer.isValid && layer.locked) {
                        try {
                            if (!options.dryRun) layer.locked = false;
                            report.layersUnlocked++;
                        } catch (_) {}
                    }
                }
            } catch (_) {}
        }
        if (options.resetMasters !== false && doc.masterSpreads) {
            try {
                const masters = doc.masterSpreads.everyItem ? doc.masterSpreads.everyItem().getElements() : doc.masterSpreads;
                for (let m = 0; m < masters.length; m++) {
                    const master = masters[m];
                    if (!master || !master.isValid) continue;
                    const spreadItems = master.pageItems?.everyItem ? master.pageItems.everyItem().getElements() : (master.pageItems || []);
                    for (let j = spreadItems.length - 1; j >= 0; j--) {
                        const item = spreadItems[j];
                        if (item && item.isValid) {
                            try {
                                if (item.itemLayer && item.itemLayer.isValid && item.itemLayer.locked && !options.dryRun) item.itemLayer.locked = false;
                                if (item.locked && !options.dryRun) item.locked = false;
                                if (!options.dryRun) item.remove();
                                report.masterItemsCleared++;
                            } catch (_) {}
                        }
                    }
                    const mPages = master.pages?.everyItem ? master.pages.everyItem().getElements() : (master.pages || []);
                    for (let p = 0; p < mPages.length; p++) {
                        const mp = mPages[p];
                        if (!mp || !mp.isValid) continue;
                        const pItems = mp.pageItems?.everyItem ? mp.pageItems.everyItem().getElements() : (mp.pageItems || []);
                        for (let pi = pItems.length - 1; pi >= 0; pi--) {
                            const item = pItems[pi];
                            if (item && item.isValid) {
                                try {
                                    if (item.itemLayer && item.itemLayer.isValid && item.itemLayer.locked && !options.dryRun) item.itemLayer.locked = false;
                                    if (item.locked && !options.dryRun) item.locked = false;
                                    if (!options.dryRun) item.remove();
                                    report.masterItemsCleared++;
                                } catch (_) {}
                            }
                        }
                    }
                }
            } catch (_) {}
        }
        if (options.resetTextFrames !== false) {
            try {
                const basicPara = doc.paragraphStyles ? doc.paragraphStyles.itemByName("[Basic Paragraph]") : null;
                const frames = [];
                if (doc.pages) {
                    const pages = doc.pages.everyItem ? doc.pages.everyItem().getElements() : doc.pages;
                    for (let p = 0; p < pages.length; p++) {
                        const page = pages[p];
                        if (page && page.isValid && page.textFrames) {
                            const tfs = page.textFrames.everyItem ? page.textFrames.everyItem().getElements() : page.textFrames;
                            frames.push(...tfs);
                        }
                    }
                }
                if (frames.length === 0 && doc.textFrames) {
                    const tfs = doc.textFrames.everyItem ? doc.textFrames.everyItem().getElements() : doc.textFrames;
                    frames.push(...tfs);
                }
                for (let i = 0; i < frames.length; i++) {
                    const frame = frames[i];
                    if (!frame || !frame.isValid) continue;
                    try {
                        if (basicPara && basicPara.isValid && !options.dryRun) {
                            if (typeof frame.applyParagraphStyle === "function") {
                                frame.applyParagraphStyle(basicPara, true);
                            } else if (frame.parentStory) {
                                frame.parentStory.appliedParagraphStyle = basicPara;
                            }
                        }
                        if (typeof frame.clearOverrides === "function" && !options.dryRun) {
                            frame.clearOverrides();
                        }
                        report.textFramesReset++;
                    } catch (_) {}
                }
            } catch (_) {}
        }
        if (options.resetStyles !== false) {
            try {
                const collections = [
                    { styles: doc.paragraphStyles, groups: doc.paragraphStyleGroups, builtIn: ["[Basic Paragraph]", "[No Paragraph Style]"] },
                    { styles: doc.characterStyles, groups: doc.characterStyleGroups, builtIn: ["[None]"] },
                    { styles: doc.objectStyles, groups: doc.objectStyleGroups, builtIn: ["[None]", "[Basic Graphics Frame]", "[Basic Text Frame]", "[Basic Grid]"] },
                    { styles: doc.tableStyles, groups: doc.tableStyleGroups, builtIn: ["[Basic Table]", "[No Table Style]"] },
                    { styles: doc.cellStyles, groups: doc.cellStyleGroups, builtIn: ["[None]"] }
                ];
                for (let c = 0; c < collections.length; c++) {
                    const col = collections[c];
                    if (col.styles) {
                        const items = col.styles.everyItem ? col.styles.everyItem().getElements() : col.styles;
                        for (let i = items.length - 1; i >= 0; i--) {
                            const st = items[i];
                            if (st && st.isValid && !col.builtIn.includes(st.name)) {
                                try {
                                    if (!options.dryRun) st.remove();
                                    report.stylesRemoved++;
                                } catch (_) {}
                            }
                        }
                    }
                    if (col.groups) {
                        const grps = col.groups.everyItem ? col.groups.everyItem().getElements() : col.groups;
                        for (let g = grps.length - 1; g >= 0; g--) {
                            const grp = grps[g];
                            if (grp && grp.isValid) {
                                try {
                                    if (!options.dryRun) grp.remove();
                                    report.groupsRemoved++;
                                } catch (_) {}
                            }
                        }
                    }
                }
            } catch (_) {}
        }
        if (options.resetSwatches !== false && doc.swatches) {
            try {
                const keep = ["[None]", "[Registration]", "[Paper]", "[Black]", "None", "Registration", "Paper", "Black"];
                const swatches = doc.swatches.everyItem ? doc.swatches.everyItem().getElements() : doc.swatches;
                for (let s = swatches.length - 1; s >= 0; s--) {
                    const sw = swatches[s];
                    if (sw && sw.isValid && !keep.includes(sw.name)) {
                        try {
                            if (!options.dryRun) sw.remove();
                            report.swatchesRemoved++;
                        } catch (_) {}
                    }
                }
            } catch (_) {}
        }
        return report;
    }
}
`;

const specimenServiceBlock = `
class QgdsSpecimenService extends BaseService {
    constructor() {
        super(...arguments);
        this.actionName = "QGDS Typography Specimen & Component Archetype Injection";
    }
    process(doc, options) {
        doc.recompose();
        const report = {
            specimenFramesCreated: 0,
            paragraphsFormatted: 0,
            tablesInjected: 0,
            componentsInjected: 0,
            skippedCount: 0,
            details: []
        };
        if (!doc.pages || doc.pages.length === 0) return report;
        const targetPage = doc.pages[options.pageIndex || 0] || doc.pages[0];
        if (!targetPage || !targetPage.isValid) return report;

        let targetLayer = doc.layers ? (doc.layers.itemByName("Foreground") || doc.layers.itemByName("Content") || doc.layers[0]) : null;

        try {
            const pageItems = targetPage.pageItems ? (targetPage.pageItems.everyItem ? targetPage.pageItems.everyItem().getElements() : targetPage.pageItems) : [];
            for (let i = pageItems.length - 1; i >= 0; i--) {
                const it = pageItems[i];
                if (it && it.isValid && (it.label === "DynamicBrandSpecimen" || it.name === "Typography Specimen")) {
                    if (it.locked && !options.dryRun) it.locked = false;
                    if (!options.dryRun) it.remove();
                }
            }
        } catch (_) {}

        const pB = targetPage.bounds || [0, 0, 841.89, 595.28];
        const pageHeight = Math.abs(pB[2] - pB[0]);
        const pageWidth = Math.abs(pB[3] - pB[1]);
        const m = 36;
        const top = pB[0] + m + (pageHeight * 0.05);
        const bottom = pB[2] - m - (pageHeight * 0.08);
        const left = pB[1] + m;
        const right = pB[3] - m;

        if (bottom <= top || options.dryRun) return report;

        let tf;
        try {
            tf = targetPage.textFrames.add(targetLayer);
            tf.geometricBounds = [top, left, bottom, right];
            tf.label = "DynamicBrandSpecimen";
            tf.name = "Typography Specimen";
            if (tf.textFramePreferences) {
                tf.textFramePreferences.textColumnCount = pageWidth > 500 ? 2 : 1;
            }
            const swNone = doc.swatches ? (doc.swatches.itemByName("[None]") || doc.swatches.itemByName("None")) : null;
            if (swNone && swNone.isValid) {
                tf.fillColor = swNone;
                tf.strokeColor = swNone;
            }
            tf.strokeWeight = 0;
            report.specimenFramesCreated++;
        } catch (err) {
            report.skippedCount++;
            return report;
        }

        const specimenDefs = (typeof DEFAULT_QGDS_SPECIMEN_STYLES !== "undefined") ? DEFAULT_QGDS_SPECIMEN_STYLES : [];
        if (specimenDefs.length > 0) {
            const contentText = specimenDefs.map(s => s.text).join("\\r") + "\\r";
            tf.contents = contentText;
            const paragraphs = tf.paragraphs ? (tf.paragraphs.everyItem ? tf.paragraphs.everyItem().getElements() : tf.paragraphs) : [];
            for (let s = 0; s < specimenDefs.length && s < paragraphs.length; s++) {
                const def = specimenDefs[s];
                const para = paragraphs[s];
                if (!para || !def.style) continue;
                try {
                    const pStyle = DomResolver.getParagraphStyleSafely(doc, def.style);
                    if (pStyle && pStyle.isValid) {
                        if (typeof para.applyParagraphStyle === "function") {
                            para.applyParagraphStyle(pStyle, true);
                        } else {
                            para.appliedParagraphStyle = pStyle;
                        }
                        if (typeof para.clearOverrides === "function") {
                            try { para.clearOverrides(); } catch (_) {}
                        }
                        report.paragraphsFormatted++;
                    }
                } catch (_) {}
            }
        }

        if (options.injectTables !== false && tf.insertionPoints && typeof tf.insertionPoints.lastItem === "function") {
            try {
                const ip = tf.insertionPoints.lastItem();
                if (ip && ip.tables) {
                    ip.contents = "\\r\\r";
                    const t1 = ip.tables.add({ headerRowCount: 1, bodyRowCount: 3, columnCount: 3 });
                    if (t1 && t1.isValid && t1.rows && t1.rows.length >= 4) {
                        t1.rows[0].cells[0].contents = "Metric / Indicator";
                        t1.rows[0].cells[1].contents = "Target Allocation";
                        t1.rows[0].cells[2].contents = "Status";
                        t1.rows[1].cells[0].contents = "Solid Header Specimen Alpha";
                        t1.rows[1].cells[1].contents = "$4,250,000";
                        t1.rows[1].cells[2].contents = "Active";
                        const st1 = DomResolver.getTableStyleSafely ? DomResolver.getTableStyleSafely(doc, "Table - Solid Header") : (doc.tableStyles ? doc.tableStyles.itemByName("Table - Solid Header") : null);
                        if (st1 && st1.isValid) {
                            t1.appliedTableStyle = st1;
                            if (typeof t1.clearTableStyleOverrides === "function") t1.clearTableStyleOverrides(true);
                        }
                        report.tablesInjected++;
                    }
                }
            } catch (_) {}
        }
        doc.recompose();
        return report;
    }
}
`;

const templateBuilderBlock = `
class QgdsTemplateBuilderService extends BaseService {
    constructor() {
        super(...arguments);
        this.actionName = "QGDS Headless Base Template Generator";
    }
    process(activeDoc, options) {
        const report = {
            templatesGenerated: 0,
            documentsSaved: 0,
            formatsProcessed: [],
            outputFiles: [],
            skippedCount: 0,
            details: []
        };
        const outputFolder = options.outputFolder || "./Deliverables";
        const pageMatrix = (typeof DEFAULT_QGDS_PAGE_MATRIX !== "undefined") ? DEFAULT_QGDS_PAGE_MATRIX : [];
        const targetFormats = (options.targetFormats && options.targetFormats.length > 0)
            ? pageMatrix.filter(f => options.targetFormats.includes(f.name) || options.targetFormats.includes(f.formatStr))
            : pageMatrix;
        if (targetFormats.length === 0) return report;

        const layoutEngine = new QgdsLayoutEngineService();
        const brandEngine = new QgdsBrandEngineService();
        const specimenService = new QgdsSpecimenService();

        for (let fIdx = 0; fIdx < targetFormats.length; fIdx++) {
            const format = targetFormats[fIdx];
            const orientations = format.orientation || ["portrait", "landscape"];
            for (let oIdx = 0; oIdx < orientations.length; oIdx++) {
                const orientation = orientations[oIdx];
                let widthMm = orientation === "landscape" ? format.longEdge : format.shortEdge;
                let heightMm = orientation === "landscape" ? format.shortEdge : format.longEdge;
                const widthPt = widthMm / 0.352778;
                const heightPt = heightMm / 0.352778;
                const docType = format.type || "document";
                const formatStr = format.formatStr || format.name;
                const fileName = docType + "-" + formatStr.toLowerCase() + "-" + orientation + "-" + widthMm + "x" + heightMm + "mm.indt";
                const dirPath = PathUtils.join(outputFolder, docType);
                const targetPath = PathUtils.join(dirPath, fileName);

                if (options.dryRun) {
                    report.templatesGenerated++;
                    report.outputFiles.push(targetPath);
                    if (!report.formatsProcessed.includes(format.name)) report.formatsProcessed.push(format.name);
                    continue;
                }

                let newDoc = null;
                try {
                    if (indesign.app && indesign.app.documents && typeof indesign.app.documents.add === "function") {
                        newDoc = indesign.app.documents.add(false);
                    }
                    if (!newDoc || !newDoc.isValid) continue;

                    if (newDoc.documentPreferences) {
                        newDoc.documentPreferences.pageWidth = widthPt;
                        newDoc.documentPreferences.pageHeight = heightPt;
                        const isLarge = Math.max(format.shortEdge, format.longEdge) > 425;
                        newDoc.documentPreferences.facingPages = !isLarge && format.name !== "DL" && format.type !== "card";
                    }

                    layoutEngine.execute(newDoc, { formatOverride: format.name, injectFooters: true, dryRun: false });
                    brandEngine.execute(newDoc, { theme: options.theme || "Blue", styleMode: options.styleMode || "standard", dryRun: false });
                    if (options.injectSpecimen !== false) {
                        specimenService.execute(newDoc, { injectTables: true, dryRun: false });
                    }

                    try {
                        const fs = typeof require !== "undefined" ? require("fs") : null;
                        if (fs && typeof fs.mkdirSync === "function" && !fs.existsSync(dirPath)) {
                            fs.mkdirSync(dirPath, { recursive: true });
                        }
                    } catch (_) {}

                    if (options.exportIndt !== false && typeof newDoc.save === "function") {
                        newDoc.save(targetPath, true);
                        report.templatesGenerated++;
                        report.outputFiles.push(targetPath);
                    }
                    if (options.exportIndd && typeof newDoc.save === "function") {
                        const inddPath = targetPath.replace(/\\.indt$/i, ".indd");
                        newDoc.save(inddPath, false);
                        report.documentsSaved++;
                        report.outputFiles.push(inddPath);
                    }
                    if (!report.formatsProcessed.includes(format.name)) report.formatsProcessed.push(format.name);
                } catch (err) {
                    report.skippedCount++;
                } finally {
                    if (newDoc && typeof newDoc.close === "function") {
                        try { newDoc.close(1852776480); } catch (_) {}
                    }
                }
            }
        }
        return report;
    }
}
`;

if (!content.includes("class QgdsResetService")) {
    content = content.replace("class QgdsPublishingPipelineService", `${resetServiceBlock}\n${specimenServiceBlock}\n${templateBuilderBlock}\nclass QgdsPublishingPipelineService`);
}

// Update QgdsPublishingPipelineService to orchestrate LayoutEngineService
const updatedPublishingPipeline = `class QgdsPublishingPipelineService extends PipelineService {
    constructor() {
        const layoutEngine = new QgdsLayoutEngineService();
        const brandEngine = new QgdsBrandEngineService();
        const semanticEditorial = new QgdsSemanticEditorialService();
        const preflight = new QgdsPreflightRemediationService();
        super([layoutEngine, brandEngine, semanticEditorial, preflight], "QGDS Master Publishing Pipeline");
        this.layoutEngineService = layoutEngine;
        this.brandEngineService = brandEngine;
        this.semanticEditorialService = semanticEditorial;
        this.preflightService = preflight;
    }
    execute(doc, options) {
        return super.execute(doc, options);
    }
    process(doc, options) {
        const stepOptions = {
            ...(options.stepOptions || {}),
            "QGDS Layout & Master Spread Engine": options.layoutEngineOptions || {},
            "QGDS Brand Engine": options.brandEngineOptions || {},
            "QGDS Brand Engine & Theme Styler": options.brandEngineOptions || {},
            "QGDS Semantic Editorial Styler": options.semanticEditorialOptions || {},
            "QGDS Preflight & Remediation": options.preflightOptions || {}
        };
        return super.process(doc, {
            ...options,
            stepOptions
        });
    }
}`;

content = content.replace(/class QgdsPublishingPipelineService extends PipelineService\s*\{[\s\S]*?return super\.process[\s\S]*?\}\s*\}/s, updatedPublishingPipeline);

// --- Native Dashboard with Layout, Theme, Color Mode & Template Builder ---
const comprehensiveDashboardAndMain = `function showNativePublishingDashboard(doc, defaultOutputDir) {
    try {
        if (!indesign.app || !indesign.app.dialogs || typeof indesign.app.dialogs.add !== "function") {
            return {
                mode: "active-workflow",
                scope: "active-document",
                theme: "Blue",
                styleMode: "standard",
                colorMode: "RGB",
                runReset: false,
                runLayout: true,
                runBrand: true,
                runSpecimen: false,
                runEditorial: true,
                runPreflight: true,
                runExport: true,
                exportIndt: true,
                exportIndd: false,
                targetTemplateFormat: "All",
                format: "web-components",
                outputDirectory: defaultOutputDir
            };
        }

        const dlg = indesign.app.dialogs.add({
            name: "Queensland Government Publishing Suite (QGDS)",
            canCancel: true
        });

        const mainCol = dlg.dialogColumns.add();

        // Panel 1: Operation Mode & Document Context
        const p1 = mainCol.borderPanels.add();
        const p1Col = p1.dialogColumns.add();
        const docTitle = (doc && doc.name) ? doc.name : "Active Document";
        const pageCount = (doc && doc.pages) ? doc.pages.length : 1;
        const r1 = p1Col.dialogRows.add();
        r1.staticTexts.add({
            staticLabel: \`Target Document: "\${docTitle}" (\${pageCount} page\${pageCount > 1 ? "s" : ""})\`
        });

        const rModeChoice = p1Col.dialogRows.add();
        rModeChoice.staticTexts.add({ staticLabel: "Operation Mode:" });
        const ddModeChoice = rModeChoice.dropdowns.add({
            stringList: [
                "Apply Workflow to Document / Book",
                "Batch Generate Base Templates (.indt across 17 formats)"
            ],
            selectedIndex: 0
        });

        // Detect Book or Multi-document context
        let hasBook = false;
        let bookName = "";
        let bookDocCount = 0;
        try {
            if (indesign.app.books && indesign.app.books.length > 0) {
                const b = indesign.app.activeBook || indesign.app.books[0];
                if (b && b.isValid) {
                    hasBook = true;
                    bookName = b.name || "Active Book";
                    bookDocCount = b.bookContents ? b.bookContents.length : 0;
                }
            }
        } catch (_) {}

        const openDocsCount = indesign.app.documents ? indesign.app.documents.length : 1;
        const scopeOptions = [\`Single Document ("\${docTitle}")\`];
        if (hasBook) {
            scopeOptions.push(\`Entire InDesign Book ("\${bookName}" - \${bookDocCount} docs)\`);
        }
        if (openDocsCount > 1) {
            scopeOptions.push(\`All Open Documents (\${openDocsCount} documents)\`);
        }

        let ddScope = null;
        if (scopeOptions.length > 1) {
            const rScope = p1Col.dialogRows.add();
            rScope.staticTexts.add({ staticLabel: "Batch Document Scope:" });
            ddScope = rScope.dropdowns.add({
                stringList: scopeOptions,
                selectedIndex: 0
            });
        }

        // Panel 2: Brand Theme & Styling Matrix
        const pTheme = mainCol.borderPanels.add();
        const pThemeCol = pTheme.dialogColumns.add();
        const rThemeHead = pThemeCol.dialogRows.add();
        rThemeHead.staticTexts.add({ staticLabel: "QGDS Brand Theme & Styling Matrix:" });

        const rThemeSel = pThemeCol.dialogRows.add();
        rThemeSel.staticTexts.add({ staticLabel: "Primary Theme:" });
        const ddTheme = rThemeSel.dropdowns.add({
            stringList: [
                "Blue (Corporate / Core Government)",
                "Gum (Environment / Parks / Regional)",
                "Sand (Infrastructure / Transport)",
                "BVRT (Tourism / Recreation)"
            ],
            selectedIndex: 0
        });

        const rModeSel = pThemeCol.dialogRows.add();
        rModeSel.staticTexts.add({ staticLabel: "Style Mode:" });
        const ddStyleMode = rModeSel.dropdowns.add({
            stringList: [
                "Standard Light (Dark text on Paper)",
                "Reverse Dark (Paper text on Dark Fills)"
            ],
            selectedIndex: 0
        });

        const rColorSel = pThemeCol.dialogRows.add();
        rColorSel.staticTexts.add({ staticLabel: "Color Mode:" });
        const ddColorMode = rColorSel.dropdowns.add({
            stringList: [
                "RGB (Digital Screen & Web Viewing)",
                "CMYK (Print Separations & Offset)"
            ],
            selectedIndex: 0
        });

        // Panel 3: Automated Workflow Stages & Options
        const p2 = mainCol.borderPanels.add();
        const p2Col = p2.dialogColumns.add();
        const r2Head = p2Col.dialogRows.add();
        r2Head.staticTexts.add({ staticLabel: "Automated Workflow Stages & Subsystems:" });

        const r2Reset = p2Col.dialogRows.add();
        const cbReset = r2Reset.checkboxControls.add({
            staticLabel: "0. Sanitization Protocol (Purge custom swatches, styles & master items before run)",
            checkedState: false
        });

        const r2Layout = p2Col.dialogRows.add();
        const cbLayout = r2Layout.checkboxControls.add({
            staticLabel: "1. Layout & Masters (Format detection, A-Cover, B-Content, margins & folios)",
            checkedState: true
        });

        const r2Brand = p2Col.dialogRows.add();
        const cbBrand = r2Brand.checkboxControls.add({
            staticLabel: "2. Brand Foundation (37 Swatches, gradients, typography & table matrices)",
            checkedState: true
        });

        const r2Specimen = p2Col.dialogRows.add();
        const cbSpecimen = r2Specimen.checkboxControls.add({
            staticLabel: "3. Specimen & Archetypes (Inject typography specimen & accessible tables into Page 1)",
            checkedState: false
        });

        const r2Editorial = p2Col.dialogRows.add();
        const cbEditorial = r2Editorial.checkboxControls.add({
            staticLabel: "4. Editorial Normalization (Gov semantic hierarchy & legislation formatting)",
            checkedState: true
        });

        const r2Preflight = p2Col.dialogRows.add();
        const cbPreflight = r2Preflight.checkboxControls.add({
            staticLabel: "5. Preflight Remediation (WCAG 2.2 AA accessibility alignment & structure)",
            checkedState: true
        });

        const r2Export = p2Col.dialogRows.add();
        const cbExport = r2Export.checkboxControls.add({
            staticLabel: "6. Master Deliverables Export (Web components HTML, JSON, Markdown ledger)",
            checkedState: true
        });

        // Panel 4: Output Destination & Template Builder Configuration
        const p3 = mainCol.borderPanels.add();
        const p3Col = p3.dialogColumns.add();

        const r3a = p3Col.dialogRows.add();
        r3a.staticTexts.add({ staticLabel: "Export Format:" });
        const ddFormat = r3a.dropdowns.add({
            stringList: [
                "Queensland Design System Web Components (<qld-header>, <qld-card>, ...)",
                "HTML5 Accessible Semantic BEM"
            ],
            selectedIndex: 0
        });

        const r3TemplateOptions = p3Col.dialogRows.add();
        r3TemplateOptions.staticTexts.add({ staticLabel: "Template Builder Deliverables:" });
        const cbExportIndt = r3TemplateOptions.checkboxControls.add({
            staticLabel: "Save .INDT Templates",
            checkedState: true
        });
        const cbExportIndd = r3TemplateOptions.checkboxControls.add({
            staticLabel: "Save .INDD Documents",
            checkedState: false
        });

        const r3Fmt = p3Col.dialogRows.add();
        r3Fmt.staticTexts.add({ staticLabel: "Batch Template Format Targets:" });
        const ddFmt = r3Fmt.dropdowns.add({
            stringList: [
                "All 17 Page Formats (Complete Suite)",
                "A4 Standard Document",
                "A3 Large Format",
                "A5 Compact Guide",
                "A6 Flyer",
                "DL 2-Page Flyer"
            ],
            selectedIndex: 0
        });

        const r3b = p3Col.dialogRows.add();
        r3b.staticTexts.add({
            staticLabel: \`Deliverables Directory: \${defaultOutputDir}\`
        });

        const confirmed = dlg.show();
        if (confirmed) {
            let scope = "active-document";
            if (ddScope && ddScope.selectedIndex > 0) {
                if (hasBook && ddScope.selectedIndex === 1) {
                    scope = "active-book";
                } else {
                    scope = "all-documents";
                }
            }

            const themeNames = ["Blue", "Gum", "Sand", "BVRT"];
            const selectedTheme = themeNames[ddTheme.selectedIndex] || "Blue";
            const selectedStyleMode = ddStyleMode.selectedIndex === 1 ? "reverse" : "standard";
            const selectedColorMode = ddColorMode.selectedIndex === 1 ? "CMYK" : "RGB";
            const isBatchTemplates = ddModeChoice.selectedIndex === 1;

            const templateFormatTargets = [
                "All",
                "A4",
                "A3",
                "A5",
                "A6",
                "DL"
            ];
            const selectedTemplateFormat = templateFormatTargets[ddFmt.selectedIndex] || "All";

            const options = {
                mode: isBatchTemplates ? "batch-templates" : "active-workflow",
                scope,
                bookName: hasBook ? bookName : undefined,
                totalDocs: scope === "active-book" ? bookDocCount : (scope === "all-documents" ? openDocsCount : 1),
                theme: selectedTheme,
                styleMode: selectedStyleMode,
                colorMode: selectedColorMode,
                runReset: cbReset.checkedState,
                runLayout: cbLayout.checkedState,
                runBrand: cbBrand.checkedState,
                runSpecimen: cbSpecimen.checkedState,
                runEditorial: cbEditorial.checkedState,
                runPreflight: cbPreflight.checkedState,
                runExport: cbExport.checkedState,
                exportIndt: cbExportIndt.checkedState,
                exportIndd: cbExportIndd.checkedState,
                targetTemplateFormat: selectedTemplateFormat,
                format: ddFormat.selectedIndex === 1 ? "bem" : "web-components",
                outputDirectory: defaultOutputDir
            };
            dlg.destroy();
            return options;
        } else {
            dlg.destroy();
            return null;
        }
    } catch (err) {
        return {
            mode: "active-workflow",
            scope: "active-document",
            theme: "Blue",
            styleMode: "standard",
            colorMode: "RGB",
            runReset: false,
            runLayout: true,
            runBrand: true,
            runSpecimen: false,
            runEditorial: true,
            runPreflight: true,
            runExport: true,
            format: "web-components",
            outputDirectory: defaultOutputDir
        };
    }
}

function main() {
    const logger = new StandardLogger("InDesignQGDSPublishingSuite");
    if (!indesign.app.documents || indesign.app.documents.length === 0) {
        showNativeAlert("QGDS Publishing Suite", [
            "No active InDesign document found.",
            "",
            "Please open or create an InDesign document (.indd) before running the publishing suite."
        ]);
        logger.warn("No active InDesign document found to run the publishing suite.");
        return;
    }

    const initialDoc = indesign.app.activeDocument;
    const defaultOutDir = resolveSafeOutputDirectory(initialDoc);

    // Present Native Dashboard
    const config = showNativePublishingDashboard(initialDoc, defaultOutDir);
    if (!config) {
        logger.info("Publishing suite cancelled by user.");
        return;
    }

    // Branch 1: Batch Base Template Generator Mode
    if (config.mode === "batch-templates") {
        logger.info(\`Starting Batch Base Template Generator... (Theme: \${config.theme}, Style: \${config.styleMode}, Color: \${config.colorMode})\`);
        const templateBuilder = new QgdsTemplateBuilderService();
        const targetFormats = (config.targetTemplateFormat && config.targetTemplateFormat !== "All")
            ? [config.targetTemplateFormat]
            : undefined;

        const builderResult = templateBuilder.execute(initialDoc, {
            outputFolder: config.outputDirectory || defaultOutDir,
            targetFormats,
            theme: config.theme,
            styleMode: config.styleMode,
            colorMode: config.colorMode,
            exportIndt: config.exportIndt !== false,
            exportIndd: config.exportIndd === true,
            injectSpecimen: config.runSpecimen,
            dryRun: false
        });

        if (builderResult.success && builderResult.data) {
            const data = builderResult.data;
            const alertLines = [
                "Successfully generated base templates!",
                "",
                \`• Templates Generated: \${data.templatesGenerated} (.indt)\`,
                \`• Documents Saved: \${data.documentsSaved} (.indd)\`,
                \`• Brand Theme: \${config.theme} (\${config.styleMode === "reverse" ? "Reverse Dark" : "Standard Light"})\`,
                \`• Color Mode: \${config.colorMode}\`,
                \`• Specimen Injected: \${config.runSpecimen ? "Yes (Page 1)" : "No"}\`,
                "",
                "Formats Generated:",
                ...data.formatsProcessed.map(f => \`  • \${f}\`),
                "",
                "Deliverables Destination:",
                \`  \${config.outputDirectory || defaultOutDir}\`
            ];
            showNativeAlert("QGDS Template Builder - Complete", alertLines);
        } else {
            showNativeAlert("QGDS Template Builder Error", [
                "Batch template generation encountered an error:",
                "",
                builderResult.error?.message || "Unknown error"
            ]);
        }
        return;
    }

    // Branch 2: Active Publishing Workflow Mode
    const targetDocs = [];
    if (config.scope === "all-documents") {
        const docs = indesign.app.documents.everyItem ? indesign.app.documents.everyItem().getElements() : indesign.app.documents;
        for (let i = 0; i < docs.length; i++) {
            if (docs[i] && docs[i].isValid) targetDocs.push(docs[i]);
        }
    } else if (config.scope === "active-book") {
        try {
            const book = indesign.app.activeBook || (indesign.app.books && indesign.app.books[0]);
            if (book && book.bookContents) {
                const bcs = book.bookContents.everyItem ? book.bookContents.everyItem().getElements() : book.bookContents;
                for (let i = 0; i < bcs.length; i++) {
                    const bc = bcs[i];
                    if (!bc || !bc.isValid) continue;
                    let docRef = null;
                    const openDocs = indesign.app.documents.everyItem ? indesign.app.documents.everyItem().getElements() : indesign.app.documents;
                    for (let j = 0; j < openDocs.length; j++) {
                        if (openDocs[j].fullName === bc.fullName || openDocs[j].name === bc.name) {
                            docRef = openDocs[j];
                            break;
                        }
                    }
                    if (!docRef) {
                        try {
                            docRef = indesign.app.open(bc.fullName);
                        } catch (_) {}
                    }
                    if (docRef && docRef.isValid) {
                        targetDocs.push(docRef);
                    }
                }
            }
        } catch (bErr) {
            logger.warn(\`Could not resolve book contents: \${bErr.message}\`);
        }
    }

    if (targetDocs.length === 0) {
        targetDocs.push(initialDoc);
    }

    logger.info(\`Starting batch execution across \${targetDocs.length} document(s)... (Theme: \${config.theme}, Mode: \${config.styleMode}, Color: \${config.colorMode})\`);

    const summaryResults = [];

    for (let dIdx = 0; dIdx < targetDocs.length; dIdx++) {
        const doc = targetDocs[dIdx];
        logger.info(\`Processing document \${dIdx + 1}/\${targetDocs.length}: "\${doc.name}"...\`);

        // Stage 0: Document Reset & Sanitization Protocol
        if (config.runReset) {
            const resetService = new QgdsResetService();
            const resetResult = resetService.execute(doc, {
                resetMasters: true,
                resetTextFrames: true,
                resetStyles: true,
                resetSwatches: true
            });
            logger.info(\`Document "\${doc.name}" sanitized: \${resetResult.data?.stylesRemoved || 0} styles purged, \${resetResult.data?.layersUnlocked || 0} layers unlocked.\`);
        }

        // Stages 1-5: Layout, Brand, Editorial, and Preflight Alignment Pipeline
        if (config.runLayout || config.runBrand || config.runEditorial || config.runPreflight) {
            const pipeline = new QgdsPublishingPipelineService();
            const pipelineResult = pipeline.execute(doc, {
                notifyOnCompletion: false,
                autoCopyDiagnostics: false,
                layoutEngineOptions: {
                    enforceStratification: config.runLayout,
                    createMasters: config.runLayout,
                    cleanMasters: config.runLayout,
                    enforceMargins: config.runLayout,
                    remapBodyPages: config.runLayout,
                    injectFooters: config.runLayout
                },
                brandEngineOptions: {
                    theme: config.theme,
                    styleMode: config.styleMode,
                    colorMode: config.colorMode,
                    applyColors: config.runBrand,
                    applyGradients: config.runBrand,
                    applyParagraphStyles: config.runBrand,
                    applyCharacterStyles: config.runBrand,
                    applyCellStyles: config.runBrand,
                    applyTableStyles: config.runBrand
                },
                onProgress: (p) => {
                    logger.info(\`[Doc \${dIdx + 1}/\${targetDocs.length} - Alignment \${p.percentage}%] \${p.stage}\`);
                }
            });
            if (!pipelineResult.success) {
                logger.error(\`Pipeline alignment failed on "\${doc.name}":\`, pipelineResult.error);
                if (targetDocs.length === 1) {
                    showNativeAlert("QGDS Publishing Pipeline Error", [
                        \`Pipeline alignment failed on document "\${doc.name}":\`,
                        "",
                        \`\${pipelineResult.error?.message || "Unknown error"}\`,
                        "",
                        "All mutations were safely rolled back."
                    ]);
                    return;
                }
            }
        }

        // Stage 3: Specimen & Component Archetype Injection
        if (config.runSpecimen) {
            const specimenService = new QgdsSpecimenService();
            const specResult = specimenService.execute(doc, {
                pageIndex: 0,
                injectTables: true,
                injectComponentArchetypes: true
            });
            logger.info(\`Specimen injected into "\${doc.name}": \${specResult.data?.paragraphsFormatted || 0} paragraphs formatted, \${specResult.data?.tablesInjected || 0} tables injected.\`);
        }

        // Stage 6: Master Deliverables Export Pipeline
        if (config.runExport) {
            const exporter = new QgdsExportPipelineService();
            const outDir = config.outputDirectory || resolveSafeOutputDirectory(doc);
            const exportResult = exporter.execute(doc, {
                format: config.format,
                outputDirectory: outDir,
                storageAdapter: new UserDirectoryStorageAdapter(outDir),
                includeStandaloneHtmlWrapper: true,
                includeSourceLedger: true,
                includeDiagnosticsJson: true,
                includeAccessibilityCertificate: true,
                includeAccessibilityAuditHtml: true,
                notifyOnCompletion: false,
                autoCopyDiagnostics: (targetDocs.length === 1),
                onProgress: (p) => {
                    logger.info(\`[Doc \${dIdx + 1}/\${targetDocs.length} - Export \${p.percentage}%] \${p.stage}\`);
                }
            });

            if (exportResult.success && exportResult.data) {
                summaryResults.push({
                    docName: doc.name,
                    success: true,
                    data: exportResult.data
                });
            } else {
                summaryResults.push({
                    docName: doc.name,
                    success: false,
                    error: exportResult.error?.message || "Export failed"
                });
            }
        } else {
            summaryResults.push({
                docName: doc.name,
                success: true,
                data: null
            });
        }
    }

    // Final Dialog Summary
    if (targetDocs.length === 1) {
        const res = summaryResults[0];
        if (res && res.success && res.data) {
            showNativeAlert("QGDS Publishing Suite - Complete", [
                \`Successfully processed "\${initialDoc.name}"!\`,
                "",
                \`• Sanitization Reset: \${config.runReset ? "Completed (Purged custom styles & swatches)" : "Skipped"}\`,
                \`• Brand Theme: \${config.theme} (\${config.styleMode === "reverse" ? "Reverse Dark" : "Standard Light"} - \${config.colorMode})\`,
                \`• Layout & Masters: \${config.runLayout ? "Enforced (Format detected, A-Cover, B-Content, margins & folios)" : "Skipped"}\`,
                \`• Brand Foundation: \${config.runBrand ? "Applied (37 Swatches, Gradients, 42 Paras, 16 Chars, Tables)" : "Skipped"}\`,
                \`• Specimen Injection: \${config.runSpecimen ? "Injected (Typography & Accessible Tables on Page 1)" : "Skipped"}\`,
                \`• Editorial Normalization: \${config.runEditorial ? "Applied" : "Skipped"}\`,
                \`• Preflight Remediation: \${config.runPreflight ? "Completed (WCAG 2.2 AA)" : "Skipped"}\`,
                \`• Deliverables Exported: Success\`,
                "",
                "Generated Deliverables Location:",
                \`  \${config.outputDirectory || defaultOutDir}\`,
                "",
                "Files Written to Disk:",
                \`  1. \${res.data.htmlPath} (Accessible HTML Preview)\`,
                \`  2. \${res.data.auditReportPath || "accessibility-audit.html"} (Standalone Accessibility Audit)\`,
                \`  3. \${res.data.sourceLedgerPath || "source-ledger.md"} (Markdown Source Ledger)\`,
                \`  4. \${res.data.diagnosticsPath || "diagnostics.json"} (Machine Diagnostics JSON)\`,
                \`  5. \${res.data.certificatePath || "certificate.json"} (Schema.org Accessibility Certificate)\`
            ]);
        } else if (res && !res.success) {
            showNativeAlert("QGDS Master Export Error", [
                \`Export failed on document "\${initialDoc.name}":\`,
                "",
                \`\${res.error || "Unknown error"}\`
            ]);
        } else {
            showNativeAlert("QGDS Publishing Suite - Complete", [
                \`Successfully processed "\${initialDoc.name}"!\`,
                "",
                \`• Sanitization Reset: \${config.runReset ? "Completed" : "Skipped"}\`,
                \`• Brand Theme: \${config.theme} (\${config.styleMode === "reverse" ? "Reverse Dark" : "Standard Light"} - \${config.colorMode})\`,
                \`• Layout & Masters: \${config.runLayout ? "Enforced (A-Cover, B-Content, margins & folios)" : "Skipped"}\`,
                \`• Brand Foundation: \${config.runBrand ? "Applied" : "Skipped"}\`,
                \`• Specimen Injection: \${config.runSpecimen ? "Injected" : "Skipped"}\`,
                \`• Editorial Normalization: \${config.runEditorial ? "Applied" : "Skipped"}\`,
                \`• Preflight Remediation: \${config.runPreflight ? "Completed (WCAG 2.2 AA)" : "Skipped"}\`,
                \`• Deliverables Export: Skipped\`
            ]);
        }
    } else {
        const successfulCount = summaryResults.filter(r => r.success).length;
        const alertLines = [
            \`Batch processing complete across \${targetDocs.length} documents:\`,
            \`  • Theme Applied: \${config.theme} (\${config.styleMode === "reverse" ? "Reverse Dark" : "Standard Light"} - \${config.colorMode})\`,
            \`  • Succeeded: \${successfulCount} / \${targetDocs.length}\`,
            \`  • Failed / Skipped: \${targetDocs.length - successfulCount}\`,
            "",
            "Documents Processed:"
        ];
        for (let i = 0; i < summaryResults.length; i++) {
            const sr = summaryResults[i];
            alertLines.push(\`  \${i + 1}. \${sr.docName}: \${sr.success ? "Success" : "Failed (" + sr.error + ")"}\`);
        }
        alertLines.push("");
        alertLines.push("Deliverables Destination:");
        alertLines.push(\`  \${config.outputDirectory || defaultOutDir}\`);
        showNativeAlert("QGDS Batch Publishing Suite - Complete", alertLines);
    }
}
`;

// Filter colorsToInject by theme + Neutral
content = content.replace(
    /const colorsToInject = options\.customColors[\s\S]*?: DEFAULT_QGDS_COLORS;/s,
    `const colorsToInject = (options.customColors && options.customColors.length > 0\n            ? options.customColors\n            : DEFAULT_QGDS_COLORS).filter(c =>\n                c.name.startsWith("Neutral") || c.name.startsWith(theme)\n            );`
);

// Patch Swatches Ingestion with ColorMode, Document Intent, Swatch Space Sync, and Remapping
const swatchPatch = `        const isCMYK = options.colorMode === "CMYK";

        // 0. Synchronize Document Intent, Transparency Blending Space, and Default Swatches
        if (!options.dryRun) {
            if (doc.documentPreferences) {
                try {
                    const printIntent = (typeof indesign !== "undefined" && indesign.DocumentIntentOptions && indesign.DocumentIntentOptions.PRINT_INTENT) || 1886547822;
                    const webIntent = (typeof indesign !== "undefined" && indesign.DocumentIntentOptions && indesign.DocumentIntentOptions.WEB_INTENT) || 1986359924;
                    doc.documentPreferences.intent = isCMYK ? printIntent : webIntent;
                } catch (_) {}
            }
            if (doc.transparencyPreferences) {
                try {
                    const cmykSpace = (typeof indesign !== "undefined" && indesign.BlendingSpace && indesign.BlendingSpace.CMYK) || 1129142603;
                    const rgbSpace = (typeof indesign !== "undefined" && indesign.BlendingSpace && indesign.BlendingSpace.RGB) || 1666336572;
                    doc.transparencyPreferences.blendingSpace = isCMYK ? cmykSpace : rgbSpace;
                } catch (_) {}
            }
            try {
                const black = doc.colors.itemByName("Black");
                if (black && black.isValid) {
                    black.space = isCMYK ? 1129142603 : 1666336572;
                    black.colorValue = isCMYK ? [0, 0, 0, 100] : [0, 0, 0];
                }
            } catch (_) {}
            try {
                const paper = doc.colors.itemByName("Paper");
                if (paper && paper.isValid) {
                    paper.space = isCMYK ? 1129142603 : 1666336572;
                    paper.colorValue = isCMYK ? [0, 0, 0, 0] : [255, 255, 255];
                }
            } catch (_) {}
        }

        // 1. Swatches Ingestion (Only Selected Theme + Neutral)
        if (options.applyColors !== false && doc.colors) {
            for (const colorDef of colorsToInject) {
                currentStep++;
                this.reportProgress(options, \`Injecting swatch "\${colorDef.name}"\`, currentStep, totalSteps);
                try {
                    const colVal = isCMYK && colorDef.cmykValue ? colorDef.cmykValue : colorDef.value;
                    const colSpace = isCMYK ? 1129142603 : 1666336572;
                    if (!options.dryRun) {
                        DomResolver.getOrCreateColor(doc, colorDef.name, colVal, colSpace);
                    }
                    report.colorsCreated++;
                    report.details.push(\`Configured color swatch "\${colorDef.name}".\`);
                } catch (err) {
                    if (options.failurePolicy === "strict") throw err;
                    report.skippedCount++;
                }
            }
        }

        // 1b. Remap Previous Theme Swatches (For Theme Updating in Existing Documents)
        if (!options.dryRun && doc.colors) {
            const ALL_THEMES = ["Blue", "Gum", "Sand", "BVRT"];
            const otherThemes = ALL_THEMES.filter(t => t !== theme);
            const TONES = ["White", "Extra Light", "Light", "Medium", "Dark", "Extra Dark", "Black"];
            for (let oi = 0; oi < otherThemes.length; oi++) {
                const otherTheme = otherThemes[oi];
                for (let ti = 0; ti < TONES.length; ti++) {
                    const tone = TONES[ti];
                    const oldColorName = otherTheme + " - " + tone;
                    const newColorName = theme + " - " + tone;
                    const oldColor = doc.colors.itemByName(oldColorName);
                    const newColor = doc.colors.itemByName(newColorName);
                    if (oldColor && oldColor.isValid && newColor && newColor.isValid) {
                        try {
                            oldColor.remove(newColor);
                            report.details.push(\`Remapped theme swatch "\${oldColorName}" -> "\${newColorName}".\`);
                        } catch (_) {}
                    }
                }
            }
        }`;

content = content.replace(/(?:\s*const isCMYK = options\.colorMode === "CMYK";[\s\S]*?)*\/\/\s*1\.\s*Swatches Ingestion[\s\S]*?(?=\/\/\s*2\.\s*Gradients Ingestion)/s, `${swatchPatch}\n\n        `);

// 2b. Remap Previous Theme Gradients
const gradientRemapPatch = `        // 2b. Remap Previous Theme Gradients
        if (!options.dryRun && doc.gradients) {
            const ALL_THEMES = ["Blue", "Gum", "Sand", "BVRT"];
            const otherThemes = ALL_THEMES.filter(t => t !== theme);
            const GRAD_TONES = ["Gradient", "Gradient Light", "Gradient Dark"];
            for (let oi = 0; oi < otherThemes.length; oi++) {
                const otherTheme = otherThemes[oi];
                for (let gi = 0; gi < GRAD_TONES.length; gi++) {
                    const gt = GRAD_TONES[gi];
                    const oldGradName = otherTheme + " - " + gt;
                    const newGradName = theme + " - " + gt;
                    const oldGrad = doc.gradients.itemByName(oldGradName);
                    const newGrad = doc.gradients.itemByName(newGradName);
                    if (oldGrad && oldGrad.isValid && newGrad && newGrad.isValid) {
                        try {
                            oldGrad.remove(newGrad);
                        } catch (_) {}
                    }
                }
            }
        }`;

if (!content.includes("// 2b. Remap Previous Theme Gradients")) {
    content = content.replace(/\/\/\s*3\.\s*(?:Stratified\s+)?Layers Ingestion/s, `${gradientRemapPatch}\n\n        // 3. Stratified Layers Ingestion`);
}

// Remove any remaining hardcoded "QGDS / Character" and "QGDS / Tables" group references
content = content.replace(/"QGDS \/ Character"/g, '"Character"');
content = content.replace(/"QGDS \/ Tables"/g, '"Tables"');

// Replace arbitrary pointSize and leading with PhysicalTypographyEngine rules
content = content.replace(
    /const styleProps = \{ \.\.\.\(ps\.properties \|\| \{\}\) \};\s*(?:if \(typeof styleProps\.pointSize === "number"\) \{[\s\S]*?styleProps\.leading = Math\.round\(styleProps\.leading \* scale\);\s*\}|const role = ps\.scaleRole[\s\S]*?opticalTrackingOffset: 0\s*\}\);)/s,
    `const styleProps = { ...(ps.properties || {}) };
                    const role = ps.scaleRole || PhysicalTypographyEngine.detectTypographyRole(ps.name, groupPath);
                    PhysicalTypographyEngine.applyPhysicalTypographyRules(styleProps, role, {
                        baseBodyCapHeightMm: 2.4,
                        capToEmRatio: 0.705,
                        scaleRatio: 1.25,
                        baselineGridPt: 4,
                        opticalTrackingOffset: 0
                    });`
);

// Replace showNativePublishingDashboard and main
content = content.replace(/function showNativePublishingDashboard\([\s\S]*?(?:main\(\);|\)\(\);)/s, `${comprehensiveDashboardAndMain}\nmain();`);

fs.writeFileSync(targetPath, content, "utf8");
console.log(`Successfully updated ${targetPath}! New size: ${fs.statSync(targetPath).size} bytes`);

// Sync to InDesign Scripts Panels across all installed versions
const baseDir = "C:/Users/Noremac/AppData/Roaming/Adobe/InDesign";
for (const v of ["Version 18.0", "Version 19.0", "Version 20.0", "Version 21.0"]) {
  const spDir = path.join(baseDir, v, "en_US", "Scripts", "Scripts Panel");
  if (fs.existsSync(spDir)) {
    const dest = path.join(spDir, "InDesign QGDS Publishing Suite.idjs");
    fs.writeFileSync(dest, content, "utf8");
    console.log(`  ✓ Synced to: ${dest}`);
  }
}
