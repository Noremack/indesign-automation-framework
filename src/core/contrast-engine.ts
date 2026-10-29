/**
 * WCAG 2.2 AA Color Contrast Engine for Adobe InDesign.
 * Calculates relative luminance and contrast ratios conforming to WCAG 2.2 Success Criterion 1.4.3.
 */

export interface ContrastViolation {
  styleName: string;
  fillColorName: string;
  rgb: [number, number, number];
  ratio: number;
  requiredRatio: number;
  pointSize: number;
  message: string;
}

export interface ContrastAuditResult {
  totalAudited: number;
  violationsCount: number;
  violations: ContrastViolation[];
}

/**
 * Resolves an InDesign swatch, color, or mock object into standard [r, g, b] (0-255).
 */
export function resolveSwatchRgb(swatch: any): [number, number, number] | null {
  if (!swatch) return null;
  const sName = swatch.name || (typeof swatch === "string" ? swatch : "");

  if (/^\[?Paper\]?$/i.test(sName)) return [255, 255, 255];
  if (/^\[?Black\]?$/i.test(sName) || /^\[?Registration\]?$/i.test(sName)) return [0, 0, 0];
  if (/^\[?None\]?$/i.test(sName)) return null;

  // Hex color support
  if (swatch.hex) {
    let h = String(swatch.hex).replace(/^#/, "");
    if (h.length === 3) {
      h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    }
    const num = parseInt(h, 16);
    if (!isNaN(num)) {
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    }
  }

  // InDesign colorValue array [r, g, b] or [c, m, y, k]
  if (swatch.colorValue && Array.isArray(swatch.colorValue) && swatch.colorValue.length >= 3) {
    const cv = swatch.colorValue;
    if (cv.length === 3) {
      return [
        Math.max(0, Math.min(255, Math.round(cv[0]))),
        Math.max(0, Math.min(255, Math.round(cv[1]))),
        Math.max(0, Math.min(255, Math.round(cv[2])))
      ];
    }
    if (cv.length === 4) {
      // CMYK to sRGB approximation for contrast evaluation
      const c = (cv[0] || 0) / 100.0;
      const m = (cv[1] || 0) / 100.0;
      const y = (cv[2] || 0) / 100.0;
      const k = (cv[3] || 0) / 100.0;
      const r = Math.round(255 * (1 - c) * (1 - k));
      const g = Math.round(255 * (1 - m) * (1 - k));
      const b = Math.round(255 * (1 - y) * (1 - k));
      return [
        Math.max(0, Math.min(255, r)),
        Math.max(0, Math.min(255, g)),
        Math.max(0, Math.min(255, b))
      ];
    }
  }

  return null;
}

/**
 * Calculates relative luminance L = 0.2126*R + 0.7152*G + 0.0722*B per WCAG 2.2 specifications.
 */
export function calculateColorLuminance(rgb: [number, number, number]): number {
  if (!rgb || rgb.length < 3) return 1.0;

  function channelLuminance(val: number): number {
    const s = val / 255.0;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }

  return (
    0.2126 * channelLuminance(rgb[0]) +
    0.7152 * channelLuminance(rgb[1]) +
    0.0722 * channelLuminance(rgb[2])
  );
}

/**
 * Calculates the WCAG 2.2 contrast ratio between two RGB colors (1.0 to 21.0).
 */
export function calculateColorContrastRatio(
  rgb1: [number, number, number],
  rgb2: [number, number, number]
): number {
  const l1 = calculateColorLuminance(rgb1);
  const l2 = calculateColorLuminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

/**
 * Audits all paragraph styles in a document for WCAG 2.2 AA contrast against Paper.
 */
export function auditDocumentContrast(doc: any): ContrastAuditResult {
  const result: ContrastAuditResult = {
    totalAudited: 0,
    violationsCount: 0,
    violations: []
  };

  if (!doc || !doc.isValid) return result;

  try {
    const styles = doc.allParagraphStyles || (doc.paragraphStyles?.everyItem ? doc.paragraphStyles.everyItem().getElements() : doc.paragraphStyles) || [];
    for (let i = 0; i < styles.length; i++) {
      const st = styles[i];
      if (!st || !st.isValid) continue;
      const stName = st.name || "";
      if (stName === "[No Paragraph Style]" || stName === "[Basic Paragraph]") continue;

      const fCol = st.fillColor;
      if (!fCol) continue;
      const rgb = resolveSwatchRgb(fCol);
      if (!rgb) continue;

      result.totalAudited++;
      const ratio = calculateColorContrastRatio(rgb, [255, 255, 255]);
      const ptSize = typeof st.pointSize === "number" ? st.pointSize : 12;
      const reqRatio = ptSize >= 18 ? 3.0 : 4.5;

      if (ratio < reqRatio) {
        result.violationsCount++;
        result.violations.push({
          styleName: stName,
          fillColorName: fCol.name || String(fCol),
          rgb,
          ratio,
          requiredRatio: reqRatio,
          pointSize: ptSize,
          message: `Paragraph style "${stName}" contrast ratio is ${ratio}:1 on Paper (expected >= ${reqRatio}:1 for ${ptSize}pt).`
        });
      }
    }
  } catch (err: any) {
    console.warn(`[ContrastEngine] Audit failed: ${err?.message}`);
  }

  return result;
}

/**
 * Auto-remediates paragraph styles failing contrast by setting them to high-contrast Dark swatch or Black.
 */
export function remediateDocumentContrast(doc: any, targetSwatchName: string = "Neutral - Extra Dark"): number {
  if (!doc || !doc.isValid) return 0;
  let remediated = 0;

  try {
    const styles = doc.allParagraphStyles || (doc.paragraphStyles?.everyItem ? doc.paragraphStyles.everyItem().getElements() : doc.paragraphStyles) || [];
    let targetSwatch: any = null;

    // Backward compatibility for legacy swatch name
    const effectiveSwatchName = targetSwatchName === "QGDS / Dark / Text" ? "Neutral - Extra Dark" : targetSwatchName;

    if (doc.swatches && typeof doc.swatches.itemByName === "function") {
      const s = doc.swatches.itemByName(effectiveSwatchName);
      if (s && s.isValid) {
        targetSwatch = s;
      } else {
        const blk = doc.swatches.itemByName("Black");
        if (blk && blk.isValid) targetSwatch = blk;
      }
    }

    if (!targetSwatch && doc.colors && typeof doc.colors.itemByName === "function") {
      const blkCol = doc.colors.itemByName("Black");
      if (blkCol && blkCol.isValid) targetSwatch = blkCol;
    }

    for (let i = 0; i < styles.length; i++) {
      const st = styles[i];
      if (!st || !st.isValid) continue;
      const stName = st.name || "";
      if (stName === "[No Paragraph Style]" || stName === "[Basic Paragraph]") continue;

      const fCol = st.fillColor;
      if (!fCol) continue;
      const rgb = resolveSwatchRgb(fCol);
      if (!rgb) continue;

      const ratio = calculateColorContrastRatio(rgb, [255, 255, 255]);
      const ptSize = typeof st.pointSize === "number" ? st.pointSize : 12;
      const reqRatio = ptSize >= 18 ? 3.0 : 4.5;

      if (ratio < reqRatio) {
        try {
          if (targetSwatch) {
            st.fillColor = targetSwatch;
          } else {
            st.fillColor = "Black";
          }
          remediated++;
        } catch (_) {}
      }
    }
  } catch (err: any) {
    console.warn(`[ContrastEngine] Auto-remediation failed: ${err?.message}`);
  }

  return remediated;
}

