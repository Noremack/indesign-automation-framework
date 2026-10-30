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

// 4b. Prepare full object styles from qgds-tokens.ts
const tokensTs = fs.readFileSync("src/core/qgds-tokens.ts", "utf8");
const objMatch = tokensTs.match(/export const DEFAULT_QGDS_OBJECT_STYLES = (\[[\s\S]*?\n\]);/);
let fullObjectStyles = [];
if (objMatch) {
  const cleaned = objMatch[1].replace(/\s+as\s+const/g, "");
  fullObjectStyles = eval(cleaned);
}

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
if (content.startsWith("(function () {")) {
    content = content.replace(/^\(function \(\) \{\s*(?:'use strict';\s*)?/, "'use strict';\n").replace(/\n\}\)\(\);\s*$/, "");
}

// Enhance StandardLogger with synchronous execution logging to disk
const persistentLoggerBlock = `class StandardLogger {
    constructor(prefix = "[Framework]") {
        this.prefix = prefix;
    }
    _write(level, message, contextOrError) {
        const line = "[" + new Date().toISOString() + "] [" + this.prefix + "] [" + level + "] " + message +
            (contextOrError ? " " + (contextOrError.stack || (typeof contextOrError === "object" ? JSON.stringify(contextOrError) : String(contextOrError))) : "");
        try {
            if (level === "ERROR") console.error(line);
            else if (level === "WARN") console.warn(line);
            else console.log(line);
        } catch (_) {}
        try {
            if (fs && typeof fs.appendFileSync === "function") {
                fs.appendFileSync("C:/Work/InDesign Scripts/publishing-suite-execution.log", line + "\\n");
            }
        } catch (_) {}
    }
    info(message, context) { this._write("INFO", message, context); }
    warn(message, context) { this._write("WARN", message, context); }
    error(message, error) { this._write("ERROR", message, error); }
}`;

content = content.replace(/class StandardLogger\s*\{[\s\S]*?\n\}/s, persistentLoggerBlock);


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
        if (style && style.isValid && properties && Object.keys(properties).length > 0) {
            try {
                for (const [k, v] of Object.entries(properties)) {
                    try { style[k] = v; } catch (_) {}
                }
            } catch (_) {}
        }
        return style;
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
class QgdsThemeValidationError extends Error {
    constructor(missingFields) {
        super("[ThemeValidationError] Tenant brand package is missing required tokens: " + (Array.isArray(missingFields) ? missingFields.join(", ") : String(missingFields)));
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
        if (missing.length > 0) throw new QgdsThemeValidationError(missing);
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
        const brandLayer = (params.layerNames && params.layerNames.brandAssets) || "Brand Assets / Badges";
        const headerFooterLayer = (params.layerNames && params.layerNames.headersFooters) || "Headers & Footers";
        const bleedPt = 3 / PT_TO_MM;
        const isAboveA3 = Math.max(widthMm, heightMm) > 420;

        const masterPlans = masterDefinitions.map(def => {
            const lowerName = def.name.toLowerCase();
            const isCover = lowerName.includes("cover");
            const isBack = lowerName.includes("back");
            const isSinglePage = isCover || isBack;
            const topM = (isCover && !isAboveA3) ? Math.round(marginMm * 1.5) : marginMm;
            const botM = (isCover && !isAboveA3) ? Math.round(marginMm * 1.5) : marginMm;

            const decorations = [];
            const folios = [];
            const editorialFrames = [];

            if (isCover) {
                const scaledHeaderH = Math.max(25, (12 / PT_TO_MM) * scalingFactor);
                decorations.push({
                    name: "Brand bar - Small",
                    label: "DynamicBrandHeader",
                    layerName: brandLayer,
                    geometricBounds: [-bleedPt, -bleedPt, scaledHeaderH, widthPt - marginPt],
                    fillColorRole: "themeGradient",
                    objectStyleName: "Medium - Rounded Bottom Right",
                    objectStyleGroup: "Frames - Radius Large",
                    bottomRightCornerOption: 1852797549,
                    bottomRightCornerRadius: 22.68 * scalingFactor,
                    visible: true
                });

                const scaledFooterH = Math.max(35, heightPt * 0.10);
                decorations.push({
                    name: "Cover Footer Banner",
                    label: "DynamicBrandFooter",
                    layerName: brandLayer,
                    geometricBounds: [heightPt - scaledFooterH, -bleedPt, heightPt + bleedPt, widthPt + bleedPt],
                    fillColorRole: "themeGradient",
                    visible: true
                });
            } else if (isBack) {
                const scaledBackCoverH = Math.max(30, (19 / PT_TO_MM) * scalingFactor);
                decorations.push({
                    name: "Back Cover Background",
                    label: "DynamicBrandBackCover",
                    layerName: brandLayer,
                    geometricBounds: [heightPt - scaledBackCoverH, marginPt, heightPt + bleedPt, widthPt + bleedPt],
                    fillColorRole: "themeGradient",
                    objectStyleName: "Medium - Rounded Top Left",
                    objectStyleGroup: "Frames - Radius Large",
                    topLeftCornerOption: 1852797549,
                    topLeftCornerRadius: 22.68 * scalingFactor,
                    visible: true
                });
                editorialFrames.push({
                    name: "Back Cover Text",
                    label: "DynamicBrandBackCover",
                    layerName: brandLayer,
                    geometricBounds: [heightPt - scaledBackCoverH, marginPt, heightPt + bleedPt, widthPt + bleedPt],
                    contents: "13 QGOV (137468)\\r\\nwww.tmr.qld.gov.au | www.qld.gov.au",
                    paragraphStyleName: "Footer Reverse",
                    characterStyleName: "Bold Reverse",
                    characterRange: [0, 15],
                    justification: 1919379572,
                    verticalJustification: 1667591796
                });
            }

            if (def.injectFolio) {
                const liveW = widthPt - 2 * marginPt;
                const footerY1 = heightPt - marginPt;
                const footerY2 = heightPt - Math.max(10, marginPt / 2);
                const fontSize = Math.max(8, Math.round(9 * scalingFactor));

                // Left Page
                folios.push({
                    geometricBounds: [footerY1, marginPt, footerY2, marginPt + liveW * 0.2],
                    text: "\\u0018",
                    pointSize: fontSize,
                    label: "DynamicContentFooter",
                    name: "Content Footer - Page Number (Left)",
                    layerName: headerFooterLayer,
                    side: "left",
                    justification: 1818584692,
                    isAutoPageNumber: true
                });
                folios.push({
                    geometricBounds: [footerY1, marginPt + liveW * 0.25, footerY2, widthPt - marginPt],
                    text: publicationTitle,
                    pointSize: fontSize,
                    label: "DynamicContentFooter",
                    name: "Content Footer - Document Title (Left)",
                    layerName: headerFooterLayer,
                    side: "left",
                    justification: 1919379572
                });

                // Right Page
                folios.push({
                    geometricBounds: [footerY1, marginPt, footerY2, widthPt - marginPt - liveW * 0.25],
                    text: publicationTitle,
                    pointSize: fontSize,
                    label: "DynamicContentFooter",
                    name: "Content Footer - Document Title (Right)",
                    layerName: headerFooterLayer,
                    side: "right",
                    justification: 1818584692
                });
                folios.push({
                    geometricBounds: [footerY1, widthPt - marginPt - liveW * 0.2, footerY2, widthPt - marginPt],
                    text: "\\u0018",
                    pointSize: fontSize,
                    label: "DynamicContentFooter",
                    name: "Content Footer - Page Number (Right)",
                    layerName: headerFooterLayer,
                    side: "right",
                    justification: 1919379572,
                    isAutoPageNumber: true
                });
            }

            return {
                prefix: def.prefix,
                baseName: def.name,
                fullName: def.prefix + "-" + def.name,
                isCover,
                isSinglePage,
                marginsMm: { top: topM, bottom: botM, left: marginMm, right: marginMm },
                marginsPt: { top: topM / PT_TO_MM, bottom: botM / PT_TO_MM, left: marginPt, right: marginPt },
                gutterMm,
                folios,
                decorations,
                editorialFrames
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
const DEFAULT_QGDS_OBJECT_STYLES = ${JSON.stringify(fullObjectStyles, null, 4)};
const DEFAULT_QGDS_SPECIMEN_STYLES = ${JSON.stringify(fullSpecimenStyles, null, 4)};
`;

// Update DEFAULT_QGDS_LAYERS to correct Background -> Master -> Foreground order so Foreground is on top
const fixedDefaultLayersBlock = `const DEFAULT_QGDS_LAYERS = [
    { name: "Background", color: "GREEN", aliases: ["Background", "Layer 2"] },
    { name: "Master: expand for cover options", color: "RED", aliases: [] },
    { name: "Foreground", color: "BLUE", aliases: ["Foreground", "Layer 1"] }
];`;
content = content.replace(/const DEFAULT_QGDS_LAYERS = \[[\s\S]*?\r?\n\];/s, fixedDefaultLayersBlock);

// Remove duplicate downstream definition if present after DEFAULT_QGDS_LAYERS
content = content.replace(/(const DEFAULT_QGDS_LAYERS = \[[\s\S]*?\r?\n\];)\s*const DEFAULT_QGDS_OBJECT_STYLES = \[[\s\S]*?\r?\n\];/s, "$1");

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

        // 1. Layer Stratification (Enforce official 3-layer architecture: Foreground on top, Cover Options in middle, Background at bottom)
        if (options.enforceStratification !== false && doc.layers) {
            try {
                // Unlock all document layers first
                const allDocLayers = doc.layers.everyItem ? doc.layers.everyItem().getElements() : doc.layers;
                for (let l = 0; l < allDocLayers.length; l++) {
                    try {
                        allDocLayers[l].locked = false;
                        allDocLayers[l].visible = true;
                    } catch (_) {}
                }

                // Create layers in Background -> Master -> Foreground order so Foreground sits on top
                const layerDefs = [
                    { name: "Background", aliases: ["Background", "Layer 2"] },
                    { name: "Master: expand for cover options", aliases: ["Master: expand for cover options", "Brand Assets / Badges", "Headers & Footers", "Cover Options"] },
                    { name: "Foreground", aliases: ["Foreground", "Layer 1", "Artwork / Content", "Content"] }
                ];
                const docLayers = doc.layers.everyItem ? doc.layers.everyItem().getElements() : [];
                for (let i = 0; i < layerDefs.length; i++) {
                    const lDef = layerDefs[i];
                    let targetLayer = null;
                    for (let j = 0; j < docLayers.length; j++) {
                        if (docLayers[j].isValid && docLayers[j].name.toLowerCase() === lDef.name.toLowerCase()) {
                            targetLayer = docLayers[j];
                            break;
                        }
                    }
                    if (!targetLayer && lDef.aliases) {
                        for (let a = 0; a < lDef.aliases.length; a++) {
                            for (let k = 0; k < docLayers.length; k++) {
                                if (docLayers[k].isValid && docLayers[k].name.toLowerCase() === lDef.aliases[a].toLowerCase()) {
                                    targetLayer = docLayers[k];
                                    break;
                                }
                            }
                            if (targetLayer) break;
                        }
                    }
                    if (!targetLayer) {
                        targetLayer = doc.layers.add({ name: lDef.name });
                    } else if (targetLayer.name !== lDef.name) {
                        try { targetLayer.name = lDef.name; } catch (_) {}
                    }
                    try {
                        targetLayer.locked = false;
                        targetLayer.visible = true;
                    } catch (_) {}
                }

                // Explicitly enforce Z-index stacking order: Foreground (index 0, top), Cover Options (index 1), Background (index 2, bottom)
                const fg = doc.layers.itemByName ? doc.layers.itemByName("Foreground") : null;
                const cov = doc.layers.itemByName ? doc.layers.itemByName("Master: expand for cover options") : null;
                const bg = doc.layers.itemByName ? doc.layers.itemByName("Background") : null;

                if (fg && fg.isValid) {
                    try { fg.move(1634101602); } catch (_) { // AT_BEGINNING
                        try { if (doc.layers.length > 0 && doc.layers[0] !== fg) fg.move(1650812527, doc.layers[0]); } catch (_) {}
                    }
                }
                if (bg && bg.isValid) {
                    try { bg.move(1634101614); } catch (_) { // AT_END
                        try { if (doc.layers.length > 0 && doc.layers[doc.layers.length - 1] !== bg) bg.move(1634104421, doc.layers[doc.layers.length - 1]); } catch (_) {}
                    }
                }
                if (cov && cov.isValid && fg && fg.isValid) {
                    try { cov.move(1634104421, fg); } catch (_) {} // AFTER fg
                }

                // Clean up any remaining empty unused layers that aren't the 3 official layers
                const remainingLayers = doc.layers.everyItem ? doc.layers.everyItem().getElements() : [];
                const officialNames = ["Foreground", "Master: expand for cover options", "Background"];
                for (let r = remainingLayers.length - 1; r >= 0; r--) {
                    const rl = remainingLayers[r];
                    if (rl && rl.isValid && !officialNames.includes(rl.name)) {
                        const items = rl.pageItems ? (rl.pageItems.everyItem ? rl.pageItems.everyItem().getElements() : rl.pageItems) : [];
                        if (items.length === 0) {
                            try { rl.remove(); } catch (_) {}
                        }
                    }
                }
            } catch (err) {
                if (options.failurePolicy === "strict") throw err;
                report.skippedCount++;
            }
        }

        // 2. Master Spreads Execution (Adoption, Renaming, Single-Page Enforcement & Cleaning)
        const masterSpreadsMap = {};
        let aCoverMaster = null;
        let bContentMaster = null;
        let cBackMaster = null;

        if (options.createMasters !== false && doc.masterSpreads) {
            try {
                // Detach all document pages from masters first to unlock master spread structure
                const docPagesInitial = doc.pages ? (doc.pages.everyItem ? doc.pages.everyItem().getElements() : doc.pages) : [];
                for (let p = 0; p < docPagesInitial.length; p++) {
                    try { docPagesInitial[p].appliedMaster = null; } catch (_) {}
                }

                const requiredMasters = [
                    { prefix: "A", baseName: "Cover", searchStr: "cover", aliases: ["a-master", "a-parent", "master a", "parent a"], isSinglePage: true },
                    { prefix: "B", baseName: "Content", searchStr: "content", aliases: ["b-master", "b-parent", "master b", "parent b"], isSinglePage: false },
                    { prefix: "C", baseName: "Back", searchStr: "back", aliases: ["c-master", "c-parent", "master c", "parent c"], isSinglePage: true }
                ];
                const adoptedMasterIds = new Set();
                const currentMasters = doc.masterSpreads.everyItem ? doc.masterSpreads.everyItem().getElements() : [];

                for (let r = 0; r < requiredMasters.length; r++) {
                    const req = requiredMasters[r];
                    let foundMaster = null;

                    // 1. Exact match
                    for (let m = 0; m < currentMasters.length; m++) {
                        const cm = currentMasters[m];
                        if (cm.isValid && !adoptedMasterIds.has(cm.id || cm) && (cm.name === (req.prefix + "-" + req.baseName) || (cm.namePrefix === req.prefix && cm.baseName === req.baseName))) {
                            foundMaster = cm;
                            break;
                        }
                    }

                    // 2. Substring match
                    if (!foundMaster) {
                        for (let m = 0; m < currentMasters.length; m++) {
                            const cm = currentMasters[m];
                            if (cm.isValid && !adoptedMasterIds.has(cm.id || cm) && cm.name && cm.name.toLowerCase().indexOf(req.searchStr) !== -1) {
                                try {
                                    if (!options.dryRun) {
                                        if (cm.baseName !== req.baseName) cm.baseName = req.baseName;
                                        if (cm.namePrefix !== req.prefix) cm.namePrefix = req.prefix;
                                    }
                                    foundMaster = cm;
                                    report.mastersCreated.push(req.prefix + "-" + req.baseName);
                                    break;
                                } catch (_) {}
                            }
                        }
                    }

                    // 3. Known Aliases
                    if (!foundMaster) {
                        for (let m = 0; m < currentMasters.length; m++) {
                            const cm = currentMasters[m];
                            if (cm.isValid && !adoptedMasterIds.has(cm.id || cm) && cm.name && req.aliases.indexOf(cm.name.toLowerCase().trim()) !== -1) {
                                try {
                                    if (!options.dryRun) {
                                        if (cm.baseName !== req.baseName) cm.baseName = req.baseName;
                                        if (cm.namePrefix !== req.prefix) cm.namePrefix = req.prefix;
                                    }
                                    foundMaster = cm;
                                    report.mastersCreated.push(req.prefix + "-" + req.baseName);
                                    break;
                                } catch (_) {}
                            }
                        }
                    }

                    // 4. Prefix match
                    if (!foundMaster) {
                        for (let m = 0; m < currentMasters.length; m++) {
                            const cm = currentMasters[m];
                            if (cm.isValid && !adoptedMasterIds.has(cm.id || cm) && cm.namePrefix === req.prefix) {
                                try {
                                    if (!options.dryRun) {
                                        if (cm.baseName !== req.baseName) cm.baseName = req.baseName;
                                    }
                                    foundMaster = cm;
                                    report.mastersCreated.push(req.prefix + "-" + req.baseName);
                                    break;
                                } catch (_) {}
                            }
                        }
                    }

                    // 5. Create new master spread
                    if (!foundMaster && !options.dryRun) {
                        try {
                            const newM = req.isSinglePage
                                ? (doc.masterSpreads.add(1) || doc.masterSpreads.add())
                                : doc.masterSpreads.add();
                            if (newM && newM.isValid) {
                                try { if (newM.baseName !== req.baseName) newM.baseName = req.baseName; } catch (_) {}
                                try { if (newM.namePrefix !== req.prefix) newM.namePrefix = req.prefix; } catch (_) {}
                                foundMaster = newM;
                                report.mastersCreated.push(req.prefix + "-" + req.baseName);
                            }
                        } catch (_) {}
                    }

                    if (foundMaster && foundMaster.isValid) {
                        adoptedMasterIds.add(foundMaster.id || foundMaster);

                        // ENFORCE SINGLE-PAGE SPREADS ON COVER AND BACK (remove left/verso page in facing pages)
                        if (req.isSinglePage && !options.dryRun && foundMaster.pages) {
                            let mPages = foundMaster.pages.everyItem ? foundMaster.pages.everyItem().getElements() : (foundMaster.pages || []);
                            while (mPages.length > 1) {
                                try {
                                    mPages[0].remove();
                                    mPages = foundMaster.pages.everyItem ? foundMaster.pages.everyItem().getElements() : (foundMaster.pages || []);
                                } catch (_) {
                                    try {
                                        const freshSingle = doc.masterSpreads.add(1);
                                        if (freshSingle && freshSingle.isValid) {
                                            try { foundMaster.remove(); } catch (_) {}
                                            freshSingle.namePrefix = req.prefix;
                                            freshSingle.baseName = req.baseName;
                                            foundMaster = freshSingle;
                                        }
                                    } catch (_) {}
                                    break;
                                }
                            }
                        }

                        // Purge existing items if cleanMasters is enabled
                        if (options.cleanMasters !== false && !options.dryRun) {
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
                    }

                    masterSpreadsMap[req.prefix] = foundMaster;
                    if (req.prefix === "A") aCoverMaster = foundMaster;
                    if (req.prefix === "B") bContentMaster = foundMaster;
                    if (req.prefix === "C") cBackMaster = foundMaster;
                }

                // Cleanup unused blank master spreads (e.g. D-Parent, E-Parent, ... or any empty unmapped master spread)
                if (!options.dryRun) {
                    const freshMasters = doc.masterSpreads ? (doc.masterSpreads.everyItem ? doc.masterSpreads.everyItem().getElements() : doc.masterSpreads) : [];
                    const validPrefixes = new Set(["A", "B", "C"]);
                    for (let m = freshMasters.length - 1; m >= 0; m--) {
                        const cm = freshMasters[m];
                        if (!cm || !cm.isValid) continue;
                        if (validPrefixes.has(cm.namePrefix) || cm.name === "A-Cover" || cm.name === "B-Content" || cm.name === "C-Back") continue;

                        // Reassign any document pages using cm before removing
                        for (let p = 0; p < docPagesInitial.length; p++) {
                            const dp = docPagesInitial[p];
                            if (dp && dp.isValid) {
                                const curId = dp.appliedMaster ? (dp.appliedMaster.id || dp.appliedMaster.name) : null;
                                if (curId && (curId === cm.id || curId === cm.name)) {
                                    try { dp.appliedMaster = (p === 0 ? aCoverMaster : bContentMaster); } catch (_) {}
                                }
                            }
                        }

                        try { cm.appliedMaster = null; } catch (_) {}
                        try {
                            cm.remove();
                            report.details.push("Removed unused master spread " + cm.name);
                        } catch (_) {}
                    }
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
            } catch (err) {
                if (options.failurePolicy === "strict") throw err;
                report.skippedCount++;
            }
        }

        // 5. Inject Brand Decorations & Running Folios
        if (!options.dryRun) {
            try {
                const themeName = options.theme || "Blue";
                const gradientName = themeName + " - Gradient";
                const themeGrad = doc.gradients?.itemByName ? (doc.gradients.itemByName(gradientName)?.isValid ? doc.gradients.itemByName(gradientName) : null) : null;
                const themeColor = doc.colors?.itemByName ? (doc.colors.itemByName(themeName + " - Medium")?.isValid ? doc.colors.itemByName(themeName + " - Medium") : (doc.colors.itemByName(themeName + " - Dark")?.isValid ? doc.colors.itemByName(themeName + " - Dark") : null)) : null;
                const fillTarget = (themeGrad && themeGrad.isValid) ? themeGrad : ((themeColor && themeColor.isValid) ? themeColor : (doc.colors?.itemByName("Black")?.isValid ? doc.colors.itemByName("Black") : null));

                const coverLayer = doc.layers?.itemByName ? (doc.layers.itemByName("Master: expand for cover options")?.isValid ? doc.layers.itemByName("Master: expand for cover options") : doc.layers[0]) : doc.layers[0];
                const fgLayer = doc.layers?.itemByName ? (doc.layers.itemByName("Foreground")?.isValid ? doc.layers.itemByName("Foreground") : doc.layers[0]) : doc.layers[0];
                const bleedPt = 3 / PT_TO_MM;
                const pWidthPt = metrics.shortEdge / PT_TO_MM;
                const pHeightPt = metrics.longEdge / PT_TO_MM;

                function safeAddRect(pageOrSpread, layer, bounds, name, label) {
                    if (!pageOrSpread || !pageOrSpread.isValid) return null;
                    let r = null;
                    if (pageOrSpread.rectangles && typeof pageOrSpread.rectangles.add === "function") {
                        try { r = pageOrSpread.rectangles.add(); } catch (_) {}
                        if (!r) { try { r = pageOrSpread.rectangles.add({}); } catch (_) {} }
                        if (!r && layer && layer.isValid) { try { r = pageOrSpread.rectangles.add(layer); } catch (_) {} }
                    }
                    if (!r && pageOrSpread.parent && pageOrSpread.parent.rectangles && typeof pageOrSpread.parent.rectangles.add === "function") {
                        try { r = pageOrSpread.parent.rectangles.add(); } catch (_) {}
                        if (!r) { try { r = pageOrSpread.parent.rectangles.add({}); } catch (_) {} }
                        if (!r && layer && layer.isValid) { try { r = pageOrSpread.parent.rectangles.add(layer); } catch (_) {} }
                    }
                    if (r && r.isValid) {
                        if (layer && layer.isValid) { try { r.itemLayer = layer; } catch (_) {} }
                        if (bounds) { try { r.geometricBounds = bounds; } catch (_) {} }
                        if (name) { try { r.name = name; } catch (_) {} }
                        if (label) { try { r.label = label; } catch (_) {} }
                    }
                    return r;
                }

                function safeAddTF(pageOrSpread, layer, bounds, name, label) {
                    if (!pageOrSpread || !pageOrSpread.isValid) return null;
                    let f = null;
                    if (pageOrSpread.textFrames && typeof pageOrSpread.textFrames.add === "function") {
                        try { f = pageOrSpread.textFrames.add(); } catch (_) {}
                        if (!f) { try { f = pageOrSpread.textFrames.add({}); } catch (_) {} }
                        if (!f && layer && layer.isValid) { try { f = pageOrSpread.textFrames.add(layer); } catch (_) {} }
                    }
                    if (!f && pageOrSpread.parent && pageOrSpread.parent.textFrames && typeof pageOrSpread.parent.textFrames.add === "function") {
                        try { f = pageOrSpread.parent.textFrames.add(); } catch (_) {}
                        if (!f) { try { f = pageOrSpread.parent.textFrames.add({}); } catch (_) {} }
                        if (!f && layer && layer.isValid) { try { f = pageOrSpread.parent.textFrames.add(layer); } catch (_) {} }
                    }
                    if (f && f.isValid) {
                        if (layer && layer.isValid) { try { f.itemLayer = layer; } catch (_) {} }
                        if (bounds) { try { f.geometricBounds = bounds; } catch (_) {} }
                        if (name) { try { f.name = name; } catch (_) {} }
                        if (label) { try { f.label = label; } catch (_) {} }
                    }
                    return f;
                }

                // Resolve A-Cover and C-Back masters safely
                if (!aCoverMaster || !aCoverMaster.isValid) {
                    aCoverMaster = doc.masterSpreads?.itemByName ? (doc.masterSpreads.itemByName("A-Cover")?.isValid ? doc.masterSpreads.itemByName("A-Cover") : null) : null;
                }
                if (!cBackMaster || !cBackMaster.isValid) {
                    cBackMaster = doc.masterSpreads?.itemByName ? (doc.masterSpreads.itemByName("C-Back")?.isValid ? doc.masterSpreads.itemByName("C-Back") : null) : null;
                }

                // A-Cover: Brand bar - Small & Cover Footer Banner
                try {
                    if (aCoverMaster && aCoverMaster.isValid) {
                        const mPages = aCoverMaster.pages ? (aCoverMaster.pages.everyItem ? aCoverMaster.pages.everyItem().getElements() : aCoverMaster.pages) : [];
                        const cp = mPages.length > 1 ? mPages[mPages.length - 1] : (mPages.length > 0 ? mPages[0] : aCoverMaster);
                        const targetParent = (cp && cp.rectangles && typeof cp.rectangles.add === "function") ? cp : aCoverMaster;

                        const rawBounds = (cp && (cp.bounds || cp.geometricBounds)) ? (cp.bounds || cp.geometricBounds) : null;
                        const pw = rawBounds ? Math.abs(rawBounds[3] - rawBounds[1]) : pWidthPt;
                        const ph = rawBounds ? Math.abs(rawBounds[2] - rawBounds[0]) : pHeightPt;
                        const pageX = rawBounds ? rawBounds[1] : 0;
                        const pageY = rawBounds ? rawBounds[0] : 0;
                        const scaledH = Math.max(25, (12 / PT_TO_MM) * scalingFactor);

                        if (coverLayer && coverLayer.isValid) coverLayer.locked = false;

                        // 1. Brand bar - Small
                        const barBounds = [pageY - bleedPt, pageX - bleedPt, pageY + scaledH, pageX + pw - baseMarginPt];
                        const barRect = safeAddRect(targetParent, coverLayer, barBounds, "Brand bar - Small", "DynamicBrandHeader");
                        if (barRect && barRect.isValid) {
                            try {
                                const objStyle = DomResolver.getObjectStyleSafely(doc, "Medium - Rounded Bottom Right", "Frames - Radius Large");
                                if (objStyle && objStyle.isValid) {
                                    barRect.appliedObjectStyle = objStyle;
                                } else if (barRect.bottomRightCornerOption !== undefined) {
                                    barRect.bottomRightCornerOption = 1852797549; // ROUNDED_CORNER
                                    barRect.bottomRightCornerRadius = 22.68 * scalingFactor;
                                }
                            } catch (_) {}
                            try { barRect.strokeWeight = 0; } catch (_) {}
                            try { if (fillTarget) barRect.fillColor = fillTarget; } catch (_) {}
                            try {
                                const swNone = doc.swatches?.item("None")?.isValid ? doc.swatches.item("None") : doc.swatches?.item("[None]");
                                if (swNone && swNone.isValid) barRect.strokeColor = swNone;
                            } catch (_) {}
                            report.details.push("Injected 'Brand bar - Small' on A-Cover.");
                        } else {
                            report.details.push("Failed to create 'Brand bar - Small' on A-Cover.");
                        }

                        // 2. Cover Footer Banner
                        const scaledFootH = Math.max(35, ph * 0.10);
                        const footBounds = [pageY + ph - scaledFootH, pageX - bleedPt, pageY + ph + bleedPt, pageX + pw + bleedPt];
                        const footRect = safeAddRect(targetParent, coverLayer, footBounds, "Cover Footer Banner", "DynamicBrandFooter");
                        if (footRect && footRect.isValid) {
                            try { footRect.strokeWeight = 0; } catch (_) {}
                            try { if (fillTarget) footRect.fillColor = fillTarget; } catch (_) {}
                            try {
                                const swNone = doc.swatches?.item("None")?.isValid ? doc.swatches.item("None") : doc.swatches?.item("[None]");
                                if (swNone && swNone.isValid) footRect.strokeColor = swNone;
                            } catch (_) {}

                            // Attempt to place and embed authentic vector footer asset from standard asset paths
                            try {
                                const assetPaths = [
                                    "C:/Work/SVG/footer-A4-portrait-with-margin-Q.svg",
                                    "C:/Work/AI/footer-A4-portrait-with-margin-Q.ai",
                                    "C:/Work/SVG/footer-A4-landscape-with-margin-Q.svg",
                                    "C:/Work/AI/footer-A4-landscape-with-margin-Q.ai",
                                    "C:/Work/_footers-with-margins.ai",
                                    "C:/Work/_footers.ai"
                                ];
                                for (let a = 0; a < assetPaths.length; a++) {
                                    try {
                                        footRect.place(assetPaths[a]);
                                        if (typeof footRect.fit === "function") {
                                            footRect.fit(1667591780); // FitOptions.PROPORTIONALLY
                                        }
                                        if (footRect.frameFittingOptions) {
                                            footRect.frameFittingOptions.fittingAlignment = 1651471465; // AnchorPoint.BOTTOM_CENTER_ANCHOR
                                        }
                                        if (footRect.graphics && footRect.graphics.length > 0 && footRect.graphics[0].itemLink) {
                                            try { footRect.graphics[0].itemLink.unlink(); } catch (_) {}
                                        }
                                        break;
                                    } catch (_) {}
                                }
                            } catch (_) {}

                            report.details.push("Injected 'Cover Footer Banner' on A-Cover.");
                        } else {
                            report.details.push("Failed to create 'Cover Footer Banner' on A-Cover.");
                        }
                    }
                } catch (coverErr) {
                    report.details.push("Cover decorations failed: " + (coverErr && coverErr.message ? coverErr.message : String(coverErr)));
                }

                // C-Back: Back Cover Background & Editorial Contact Text
                try {
                    if (cBackMaster && cBackMaster.isValid) {
                        const mPages = cBackMaster.pages ? (cBackMaster.pages.everyItem ? cBackMaster.pages.everyItem().getElements() : cBackMaster.pages) : [];
                        const bp = mPages.length > 0 ? mPages[0] : cBackMaster;
                        const backTargetParent = (bp && bp.rectangles && typeof bp.rectangles.add === "function") ? bp : cBackMaster;

                        const rawBounds = (bp && (bp.bounds || bp.geometricBounds)) ? (bp.bounds || bp.geometricBounds) : null;
                        const pw = rawBounds ? Math.abs(rawBounds[3] - rawBounds[1]) : pWidthPt;
                        const ph = rawBounds ? Math.abs(rawBounds[2] - rawBounds[0]) : pHeightPt;
                        const pageX = rawBounds ? rawBounds[1] : 0;
                        const pageY = rawBounds ? rawBounds[0] : 0;
                        const scaledBackH = Math.max(30, (19 / PT_TO_MM) * scalingFactor);

                        if (coverLayer && coverLayer.isValid) coverLayer.locked = false;

                        const backBounds = [pageY + ph - scaledBackH, pageX + baseMarginPt, pageY + ph + bleedPt, pageX + pw + bleedPt];
                        const backRect = safeAddRect(backTargetParent, coverLayer, backBounds, "Back Cover Background", "DynamicBrandBackCover");
                        if (backRect && backRect.isValid) {
                            try {
                                const objStyle = DomResolver.getObjectStyleSafely(doc, "Medium - Rounded Top Left", "Frames - Radius Large");
                                if (objStyle && objStyle.isValid) {
                                    backRect.appliedObjectStyle = objStyle;
                                } else if (backRect.topLeftCornerOption !== undefined) {
                                    backRect.topLeftCornerOption = 1852797549; // ROUNDED_CORNER
                                    backRect.topLeftCornerRadius = 22.68 * scalingFactor;
                                }
                            } catch (_) {}
                            try { backRect.strokeWeight = 0; } catch (_) {}
                            try { if (fillTarget) backRect.fillColor = fillTarget; } catch (_) {}
                            try {
                                const swNone = doc.swatches?.item("None")?.isValid ? doc.swatches.item("None") : doc.swatches?.item("[None]");
                                if (swNone && swNone.isValid) backRect.strokeColor = swNone;
                            } catch (_) {}
                            report.details.push("Injected 'Back Cover Background' on C-Back.");
                        } else {
                            report.details.push("Failed to create 'Back Cover Background' on C-Back.");
                        }

                        // Back Cover Editorial Contact Details
                        const backTf = safeAddTF(backTargetParent, fgLayer, backBounds, "Back Cover Text", "DynamicBrandBackCover");
                        if (backTf && backTf.isValid) {
                            try { backTf.strokeWeight = 0; } catch (_) {}
                            try {
                                const swNone = doc.swatches?.item("None")?.isValid ? doc.swatches.item("None") : doc.swatches?.item("[None]");
                                if (swNone && swNone.isValid) {
                                    backTf.strokeColor = swNone;
                                    backTf.fillColor = swNone;
                                }
                            } catch (_) {}
                            try {
                                if (backTf.textFramePreferences) {
                                    backTf.textFramePreferences.verticalJustification = 1667591796; // CENTER_ALIGN
                                }
                            } catch (_) {}
                            try {
                                backTf.contents = "13 QGOV (137468)\\r\\nwww.tmr.qld.gov.au | www.qld.gov.au";
                            } catch (_) {}
                            if (backTf.texts && backTf.texts.length > 0) {
                                const pStyle = DomResolver.getParagraphStyleSafely(doc, "Footer Reverse", "Reverse") ||
                                               DomResolver.getParagraphStyleSafely(doc, "Footer Reverse") ||
                                               DomResolver.getParagraphStyleSafely(doc, "Footer");
                                if (pStyle && pStyle.isValid) {
                                    try { backTf.texts[0].appliedParagraphStyle = pStyle; } catch (_) {}
                                }
                                try { backTf.texts[0].justification = 1919379572; } catch (_) {} // RIGHT_ALIGN
                                const cStyle = DomResolver.getCharacterStyleSafely(doc, "Bold Reverse", "Reverse") ||
                                               DomResolver.getCharacterStyleSafely(doc, "Bold Reverse") ||
                                               DomResolver.getCharacterStyleSafely(doc, "Bold");
                                if (cStyle && cStyle.isValid && backTf.texts[0].characters) {
                                    try {
                                        backTf.texts[0].characters.itemByRange(0, 15).appliedCharacterStyle = cStyle;
                                    } catch (_) {}
                                }
                            }
                            report.details.push("Injected 'Back Cover Text' on C-Back.");
                        }
                    }
                } catch (backErr) {
                    report.details.push("Back cover decoration failed: " + (backErr && backErr.message ? backErr.message : String(backErr)));
                }

                // B-Content: Running Folios
                try {
                    if (options.injectFooters !== false && bContentMaster && bContentMaster.isValid) {
                        const cPages = bContentMaster.pages?.everyItem ? bContentMaster.pages.everyItem().getElements() : [];
                        const pubTitle = options.publicationTitle || (doc.name ? String(doc.name).replace(/\.[^.]+$/, "") : "Queensland Government Publication");
                        const footerStyle = DomResolver.getParagraphStyleSafely(doc, "Footer", "Footers") || DomResolver.getParagraphStyleSafely(doc, "Footer");
                        const boldStyle = DomResolver.getCharacterStyleSafely(doc, "Bold", "Character") || DomResolver.getCharacterStyleSafely(doc, "Bold");

                        for (let cpIdx = 0; cpIdx < cPages.length; cpIdx++) {
                            const cp = cPages[cpIdx];
                            if (!cp || !cp.isValid || !cp.textFrames) continue;
                            if (cp.textFrames.everyItem) {
                                const tfs = cp.textFrames.everyItem().getElements();
                                for (let ti = tfs.length - 1; ti >= 0; ti--) {
                                    if (tfs[ti].label === "DynamicContentFooter" || tfs[ti].label === "DynamicBrandFooter" || tfs[ti].name === "Running Folio" || tfs[ti].name === "DynamicBrandFooter" || (tfs[ti].name && tfs[ti].name.indexOf("Content Footer") === 0)) {
                                        try { tfs[ti].remove(); } catch (_) {}
                                    }
                                }
                            }
                            const pageBounds = cp.bounds || [0, 0, pHeightPt, pWidthPt];
                            const pw = Math.abs(pageBounds[3] - pageBounds[1]);
                            const ph = Math.abs(pageBounds[2] - pageBounds[0]);
                            const footerY1 = ph - baseMarginPt;
                            const footerY2 = ph - Math.max(10, baseMarginPt / 2);
                            const isLeft = cpIdx === 0 && cPages.length > 1;
                            const liveW = pw - 2 * baseMarginPt;

                            if (isLeft) {
                                const tfNum = safeAddTF(cp, fgLayer, [footerY1, baseMarginPt, footerY2, baseMarginPt + liveW * 0.2], "Content Footer - Page Number", "DynamicContentFooter");
                                const tfTitle = safeAddTF(cp, fgLayer, [footerY1, baseMarginPt + liveW * 0.25, footerY2, pw - baseMarginPt], "Content Footer - Document Title", "DynamicContentFooter");
                                if (tfNum && tfNum.isValid) {
                                    try { tfNum.contents = String.fromCharCode(0x0018); } catch (_) {}
                                    if (tfNum.texts && tfNum.texts[0]) {
                                        if (footerStyle && footerStyle.isValid) tfNum.texts[0].appliedParagraphStyle = footerStyle;
                                        tfNum.texts[0].justification = 1818584692;
                                        if (boldStyle && boldStyle.isValid) tfNum.texts[0].appliedCharacterStyle = boldStyle;
                                    }
                                }
                                if (tfTitle && tfTitle.isValid) {
                                    try { tfTitle.contents = pubTitle; } catch (_) {}
                                    if (tfTitle.texts && tfTitle.texts[0]) {
                                        if (footerStyle && footerStyle.isValid) tfTitle.texts[0].appliedParagraphStyle = footerStyle;
                                        tfTitle.texts[0].justification = 1919379572;
                                    }
                                }
                            } else {
                                const tfTitle = safeAddTF(cp, fgLayer, [footerY1, baseMarginPt, footerY2, pw - baseMarginPt - liveW * 0.25], "Content Footer - Document Title", "DynamicContentFooter");
                                const tfNum = safeAddTF(cp, fgLayer, [footerY1, pw - baseMarginPt - liveW * 0.2, footerY2, pw - baseMarginPt], "Content Footer - Page Number", "DynamicContentFooter");
                                if (tfTitle && tfTitle.isValid) {
                                    try { tfTitle.contents = pubTitle; } catch (_) {}
                                    if (tfTitle.texts && tfTitle.texts[0]) {
                                        if (footerStyle && footerStyle.isValid) tfTitle.texts[0].appliedParagraphStyle = footerStyle;
                                        tfTitle.texts[0].justification = 1818584692;
                                    }
                                }
                                if (tfNum && tfNum.isValid) {
                                    try { tfNum.contents = String.fromCharCode(0x0018); } catch (_) {}
                                    if (tfNum.texts && tfNum.texts[0]) {
                                        if (footerStyle && footerStyle.isValid) tfNum.texts[0].appliedParagraphStyle = footerStyle;
                                        tfNum.texts[0].justification = 1919379572;
                                        if (boldStyle && boldStyle.isValid) tfNum.texts[0].appliedCharacterStyle = boldStyle;
                                    }
                                }
                            }
                            report.footersInjected++;
                        }
                    }
                } catch (folioErr) {
                    report.details.push("Content footers failed: " + (folioErr && folioErr.message ? folioErr.message : String(folioErr)));
                }

                // Remap all document pages to appropriate masters
                if (doc.pages && doc.pages.length > 0) {
                    const dPages = doc.pages.everyItem ? doc.pages.everyItem().getElements() : doc.pages;
                    for (let p = 0; p < dPages.length; p++) {
                        const dp = dPages[p];
                        if (!dp || !dp.isValid) continue;
                        try {
                            if (p === 0 && aCoverMaster && aCoverMaster.isValid) {
                                dp.appliedMaster = aCoverMaster;
                                report.pagesRemapped++;
                            } else if (p === dPages.length - 1 && dPages.length > 1 && cBackMaster && cBackMaster.isValid) {
                                dp.appliedMaster = cBackMaster;
                                report.pagesRemapped++;
                            } else if (bContentMaster && bContentMaster.isValid) {
                                dp.appliedMaster = bContentMaster;
                                report.pagesRemapped++;
                            }
                        } catch (_) {}
                    }
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

        let targetLayer = doc.layers ? (doc.layers.itemByName("Foreground")?.isValid ? doc.layers.itemByName("Foreground") : doc.layers[0]) : null;

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

        let tf = null;
        if (targetPage.textFrames && typeof targetPage.textFrames.add === "function") {
            try { tf = targetPage.textFrames.add(); } catch (_) {}
            if (!tf) { try { tf = targetPage.textFrames.add({}); } catch (_) {} }
            if (!tf && targetLayer && targetLayer.isValid) { try { tf = targetPage.textFrames.add(targetLayer); } catch (_) {} }
        }
        if (!tf && targetPage.parent && targetPage.parent.textFrames && typeof targetPage.parent.textFrames.add === "function") {
            try { tf = targetPage.parent.textFrames.add(); } catch (_) {}
            if (!tf) { try { tf = targetPage.parent.textFrames.add({}); } catch (_) {} }
            if (!tf && targetLayer && targetLayer.isValid) { try { tf = targetPage.parent.textFrames.add(targetLayer); } catch (_) {} }
        }
        if (tf && tf.isValid) {
            if (targetLayer && targetLayer.isValid) {
                try { tf.itemLayer = targetLayer; } catch (_) {}
            }
            try { tf.geometricBounds = [top, left, bottom, right]; } catch (_) {}
            tf.label = "DynamicBrandSpecimen";
            tf.name = "Typography Specimen";
            if (tf.textFramePreferences) {
                tf.textFramePreferences.textColumnCount = pageWidth > 500 ? 2 : 1;
            }
            const swNone = doc.swatches ? (doc.swatches.itemByName("[None]") || doc.swatches.itemByName("None")) : null;
            if (swNone && swNone.isValid) {
                try { tf.fillColor = swNone; } catch (_) {}
                try { tf.strokeColor = swNone; } catch (_) {}
            }
            tf.strokeWeight = 0;
            report.specimenFramesCreated++;
        } else {
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
                        const st1 = DomResolver.getTableStyleSafely ? (DomResolver.getTableStyleSafely(doc, "Table - Solid Header") || DomResolver.getTableStyleSafely(doc, "Table - Bold Header")) : (doc.tableStyles ? (doc.tableStyles.itemByName("Table - Solid Header") || doc.tableStyles.itemByName("Table - Bold Header")) : null);
                        if (st1 && st1.isValid) {
                            t1.appliedTableStyle = st1;
                            if (typeof t1.clearTableStyleOverrides === "function") t1.clearTableStyleOverrides(true);
                        }
                        const cellHeaderSolid = DomResolver.getParagraphStyleSafely(doc, "Cell - Header Text Solid", "Tables") || DomResolver.getParagraphStyleSafely(doc, "Cell - Header Solid", "Tables") || doc.paragraphStyles?.itemByName("Cell - Header Text Solid");
                        const cellBody = DomResolver.getParagraphStyleSafely(doc, "Body Text", "Narrative") || DomResolver.getParagraphStyleSafely(doc, "Body", "Narrative") || doc.paragraphStyles?.itemByName("Body Text");
                        if (cellHeaderSolid && cellHeaderSolid.isValid) {
                            for (let c = 0; c < 3; c++) {
                                try { t1.rows[0].cells[c].paragraphs[0].appliedParagraphStyle = cellHeaderSolid; } catch (_) {}
                            }
                        }
                        if (cellBody && cellBody.isValid) {
                            for (let r = 1; r < 4; r++) {
                                for (let c = 0; c < 3; c++) {
                                    try { t1.rows[r].cells[c].paragraphs[0].appliedParagraphStyle = cellBody; } catch (_) {}
                                }
                            }
                        }
                        report.tablesInjected++;
                    }
                }
            } catch (_) {}
        }

        try {
            doc.recompose();
            if (tf.overflows && doc.pages && doc.pages.length === 1) {
                const bContentM = doc.masterSpreads?.itemByName ? (doc.masterSpreads.itemByName("B-Content")?.isValid ? doc.masterSpreads.itemByName("B-Content") : null) : null;
                const p2 = doc.pages.add(1699021422); // LocationOptions.AT_END
                if (p2 && p2.isValid) {
                    if (bContentM) {
                        try { p2.appliedMaster = bContentM; } catch (_) {}
                    }
                    const p2B = p2.bounds || [0, 0, 841.89, 595.28];
                    const npTop = p2B[0] + m + 12;
                    const npBottom = p2B[2] - m - (pageHeight * 0.08);
                    const npLeft = p2B[1] + m;
                    const npRight = p2B[3] - m;
                    if (npBottom > npTop + 30) {
                        let nextTf = null;
                        try {
                            nextTf = p2.textFrames.add();
                        } catch (_) {
                            try { nextTf = p2.textFrames.add({}); } catch (_) {}
                        }
                        if (nextTf && nextTf.isValid) {
                            if (targetLayer && targetLayer.isValid) {
                                try { nextTf.itemLayer = targetLayer; } catch (_) {}
                            }
                            try { nextTf.geometricBounds = [npTop, npLeft, npBottom, npRight]; } catch (_) {}
                            nextTf.label = "DynamicBrandSpecimen";
                            nextTf.name = "Typography Specimen";
                            if (nextTf.textFramePreferences) {
                                nextTf.textFramePreferences.textColumnCount = pageWidth > 500 ? 2 : 1;
                            }
                            const swNone = doc.swatches ? (doc.swatches.itemByName("[None]") || doc.swatches.itemByName("None")) : null;
                            if (swNone && swNone.isValid) {
                                try { nextTf.fillColor = swNone; } catch (_) {}
                                try { nextTf.strokeColor = swNone; } catch (_) {}
                            }
                            nextTf.strokeWeight = 0;
                            try { tf.nextTextFrame = nextTf; } catch (_) {}
                            report.specimenFramesCreated++;
                        }
                    }
                }
            }
        } catch (_) {}

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

if (content.includes("class QgdsResetService")) {
    content = content.replace(/class QgdsResetService extends BaseService[\s\S]*?(?=class QgdsPublishingPipelineService)/s, `${resetServiceBlock}\n${specimenServiceBlock}\n${templateBuilderBlock}\n`);
} else {
    content = content.replace("class QgdsPublishingPipelineService", `${resetServiceBlock}\n${specimenServiceBlock}\n${templateBuilderBlock}\nclass QgdsPublishingPipelineService`);
}

// Update QgdsPublishingPipelineService to orchestrate BrandEngine first, then LayoutEngine, Specimen, Editorial, and Preflight
const updatedPublishingPipeline = `class QgdsPublishingPipelineService extends PipelineService {
    constructor() {
        const brandEngine = new QgdsBrandEngineService();
        const layoutEngine = new QgdsLayoutEngineService();
        const specimenService = new QgdsSpecimenService();
        const semanticEditorial = new QgdsSemanticEditorialService();
        const preflight = new QgdsPreflightRemediationService();
        super([brandEngine, layoutEngine, specimenService, semanticEditorial, preflight], "QGDS Master Publishing Pipeline");
        this.brandEngineService = brandEngine;
        this.layoutEngineService = layoutEngine;
        this.specimenService = specimenService;
        this.semanticEditorialService = semanticEditorial;
        this.preflightService = preflight;
    }
    execute(doc, options) {
        return super.execute(doc, options);
    }
    process(doc, options) {
        const activeTheme = options.brandEngineOptions?.theme || options.theme || "Blue";
        const brandOpts = {
            theme: activeTheme,
            applyObjectStyles: true,
            ...(options.brandEngineOptions || {})
        };
        const layoutOpts = {
            theme: activeTheme,
            ...(options.layoutEngineOptions || {})
        };
        const specimenOpts = {
            pageIndex: 0,
            injectTables: true,
            injectComponentArchetypes: true,
            dryRun: options.specimenOptions?.dryRun === true || options.runSpecimen === false,
            ...(options.specimenOptions || {})
        };
        const stepOptions = {
            ...(options.stepOptions || {}),
            "QGDS Brand Engine": brandOpts,
            "QGDS Brand Engine & Theme Styler": brandOpts,
            "QGDS Layout & Master Spread Engine": layoutOpts,
            "QGDS Typography Specimen & Component Archetype Injection": specimenOpts,
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
                runSpecimen: true,
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
            checkedState: true
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
            runSpecimen: true,
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
                theme: config.theme,
                runSpecimen: config.runSpecimen,
                layoutEngineOptions: {
                    theme: config.theme,
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
                    applyObjectStyles: config.runBrand,
                    applyCellStyles: config.runBrand,
                    applyTableStyles: config.runBrand
                },
                specimenOptions: {
                    pageIndex: 0,
                    injectTables: true,
                    injectComponentArchetypes: true,
                    dryRun: !config.runSpecimen
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
                injectComponentArchetypes: true,
                dryRun: false
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

// 4-8. Comprehensive Styles Ingestion Patch (Standard + Reverse Styles, Object Styles, Cell/Table Styles)
const brandStylesFullPatch = `        // 4. Hierarchical Paragraph Styles (Standard + Reverse)
        if (options.applyParagraphStyles !== false && doc.paragraphStyles) {
            const themesToProcess = [{ theme: themeColors, isRev: false, prefix: "" }];
            if (options.createReverseStyles !== false) {
                const revThemeColors = (typeof getThemeColors === "function") ? getThemeColors(theme, true) : themeColors;
                themesToProcess.push({ theme: revThemeColors, isRev: true, prefix: "Reverse / " });
            }

            for (const tInfo of themesToProcess) {
                for (const ps of pStylesToInject) {
                    currentStep++;
                    this.reportProgress(options, \`Configuring paragraph style "\${ps.name}"\${tInfo.isRev ? " (Reverse)" : ""}\`, currentStep, totalSteps);
                    try {
                        const groupPath = tInfo.isRev ? (tInfo.prefix + ps.group) : ps.group;
                        const styleProps = { ...(ps.properties || {}) };
                        const role = ps.scaleRole || PhysicalTypographyEngine.detectTypographyRole(ps.name, groupPath);
                        PhysicalTypographyEngine.applyPhysicalTypographyRules(styleProps, role, {
                            baseBodyCapHeightMm: 2.4,
                            capToEmRatio: 0.705,
                            scaleRatio: 1.25,
                            baselineGridPt: 4,
                            opticalTrackingOffset: 0
                        });

                        if (ps.roleColor) {
                            const swatchName = tInfo.theme[ps.roleColor];
                            if (swatchName === "Paper") {
                                styleProps.fillColor = "Paper";
                            } else if (swatchName && doc.colors) {
                                const sw = doc.colors.itemByName(swatchName);
                                if (sw && sw.isValid) {
                                    styleProps.fillColor = sw;
                                }
                            }
                        }

                        if (!options.dryRun) {
                            DomResolver.getOrCreateParagraphStyle(
                                doc,
                                ps.name,
                                styleProps,
                                groupPath,
                                ps.exportTagMap
                            );
                        }
                        report.stylesCreated++;
                        report.paragraphStylesCreated++;
                        report.details.push(\`Configured paragraph style "\${ps.name}" in "\${groupPath}".\`);
                    } catch (err) {
                        if (options.failurePolicy === "strict") throw err;
                        report.skippedCount++;
                    }
                }
            }
        }

        // 5. Character Styles (Standard + Reverse)
        if (options.applyCharacterStyles !== false && doc.characterStyles) {
            const charGroups = [{ isRev: false, group: "Character" }];
            if (options.createReverseStyles !== false) {
                charGroups.push({ isRev: true, group: "Reverse / Character" });
            }
            for (const cGrp of charGroups) {
                for (const cs of cStylesToInject) {
                    currentStep++;
                    this.reportProgress(options, \`Configuring character style "\${cs.name}"\${cGrp.isRev ? " (Reverse)" : ""}\`, currentStep, totalSteps);
                    try {
                        const styleProps = { ...(cs.properties || {}) };
                        if (cGrp.isRev && cs.roleColor) {
                            const revThemeColors = (typeof getThemeColors === "function") ? getThemeColors(theme, true) : themeColors;
                            const swatchName = revThemeColors[cs.roleColor];
                            if (swatchName === "Paper") {
                                styleProps.fillColor = "Paper";
                            } else if (swatchName && doc.colors) {
                                const sw = doc.colors.itemByName(swatchName);
                                if (sw && sw.isValid) styleProps.fillColor = sw;
                            }
                        }
                        if (!options.dryRun) {
                            DomResolver.getOrCreateCharacterStyle(
                                doc,
                                cs.name,
                                styleProps,
                                cGrp.group,
                                cs.exportTagMap
                            );
                        }
                        report.characterStylesCreated++;
                        report.details.push(\`Configured character style "\${cs.name}" in "\${cGrp.group}".\`);
                    } catch (err) {
                        if (options.failurePolicy === "strict") throw err;
                        report.skippedCount++;
                    }
                }
            }
        }

        // 6. Cell Styles (5 styles)
        if (options.applyCellStyles !== false && doc.cellStyles) {
            for (const cell of cellStylesToInject) {
                currentStep++;
                this.reportProgress(options, \`Configuring cell style "\${cell.name}"\`, currentStep, totalSteps);
                try {
                    const cellProps = {};
                    if (cell.role === "header" && doc.colors) {
                        const hBg = doc.colors.itemByName(themeColors.tableHeaderBG);
                        if (hBg && hBg.isValid) cellProps.fillColor = hBg;
                    }
                    if (!options.dryRun) {
                        DomResolver.getOrCreateCellStyle(doc, cell.name, cellProps, "Tables");
                    }
                    report.cellStylesCreated++;
                    report.details.push(\`Configured cell style "\${cell.name}".\`);
                } catch (err) {
                    if (options.failurePolicy === "strict") throw err;
                    report.skippedCount++;
                }
            }
        }

        // 7. Table Styles (2 styles)
        if (options.applyTableStyles !== false && doc.tableStyles) {
            for (const tbl of tableStylesToInject) {
                currentStep++;
                this.reportProgress(options, \`Configuring table style "\${tbl.name}"\`, currentStep, totalSteps);
                try {
                    const tblProps = {};
                    if (tbl.headerRegionCell && doc.cellStyles) {
                        const hc = doc.cellStyles.itemByName(tbl.headerRegionCell);
                        if (hc && hc.isValid) tblProps.headerRegionCellStyle = hc;
                    }
                    if (tbl.bodyRegionCell && doc.cellStyles) {
                        const bc = doc.cellStyles.itemByName(tbl.bodyRegionCell);
                        if (bc && bc.isValid) tblProps.bodyRegionCellStyle = bc;
                    }
                    if (!options.dryRun) {
                        DomResolver.getOrCreateTableStyle(doc, tbl.name, tblProps, "Tables");
                    }
                    report.tableStylesCreated++;
                    report.details.push(\`Configured table style "\${tbl.name}".\`);
                } catch (err) {
                    if (options.failurePolicy === "strict") throw err;
                    report.skippedCount++;
                }
            }
        }

        // 8. Object Styles (24 styles: Frames - Radius Large, Frames - Radius Medium, Callouts, Cards)
        if (options.applyObjectStyles !== false && doc.objectStyles) {
            for (const objDef of objectStylesToInject) {
                currentStep++;
                this.reportProgress(options, \`Configuring object style "\${objDef.name}"\`, currentStep, totalSteps);
                try {
                    if (!options.dryRun) {
                        let fillTarget = null;
                        if (objDef.roleColor && themeColors[objDef.roleColor]) {
                            const roleSwatch = themeColors[objDef.roleColor];
                            fillTarget = (roleSwatch === "Paper") ? "Paper" : (doc.colors?.itemByName ? doc.colors.itemByName(roleSwatch) : null);
                        } else if (objDef.fillColor && doc.colors) {
                            fillTarget = doc.colors.itemByName(objDef.fillColor);
                        }
                        const styleProps = {
                            ...(objDef.properties || {}),
                            name: objDef.name
                        };
                        if (fillTarget) {
                            styleProps.fillColor = fillTarget;
                            styleProps.enableFill = true;
                        }
                        if (objDef.strokeColor && doc.colors) {
                            const strokeColor = doc.colors.itemByName(objDef.strokeColor);
                            if (strokeColor && strokeColor.isValid) styleProps.strokeColor = strokeColor;
                        }
                        if (objDef.strokeWeight !== undefined) styleProps.strokeWeight = objDef.strokeWeight;
                        if (objDef.fillTint !== undefined) styleProps.fillTint = objDef.fillTint;
                        if (objDef.insetSpacing) {
                            styleProps.textFramePreferences = {
                                insetSpacing: objDef.insetSpacing
                            };
                        }
                        DomResolver.getOrCreateObjectStyle(doc, objDef.name, styleProps, objDef.group);
                    }
                    report.objectStylesCreated++;
                    report.details.push(\`Configured object style "\${objDef.name}".\`);
                } catch (err) {
                    if (options.failurePolicy === "strict") throw err;
                    report.skippedCount++;
                }
            }
        }`;

content = content.replace(/\/\/\s*4\.\s*Hierarchical Paragraph Styles[\s\S]*?(?=\s*return report;)/s, `${brandStylesFullPatch}\n\n        `);

// Replace Layout Engine with updated layoutEngineBlock
content = content.replace(/const PT_TO_MM = 0\.352778;[\s\S]*?(?=class QgdsResetService)/s, `${layoutEngineBlock}\n\n`);

// Replace showNativePublishingDashboard and main
content = content.replace(/function showNativePublishingDashboard\([\s\S]*?(?:main\(\);|\)\(\);)/s, `${comprehensiveDashboardAndMain}\nmain();`);

// Encapsulate script in IIFE to protect persistent UXP script engine global scope
if (!content.startsWith("(function () {")) {
    content = `(function () {\n'use strict';\n${content.replace(/^'use strict';\s*/, "")}\n})();\n`;
}

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
