declare const indesign: any;

export type TypographyRole =
  | "display"
  | "title"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "lead"
  | "body"
  | "listItem"
  | "small"
  | "caption"
  | "footer";

export interface PhysicalTypographyConfig {
  baseBodyCapHeightMm?: number;
  capToEmRatio?: number;
  scaleRatio?: number;
  baselineGridPt?: number;
  longEdgeMm?: number;
  formatName?: string;
  opticalTrackingOffset?: number;
}

export interface RoleSpacing {
  spaceBefore: number;
  spaceAfter: number;
  spaceBetweenParagraphsOfSameStyle: number;
  keepWithNext?: number;
}

/**
 * Physical Typography & Vertical Rhythm Engine.
 * Adheres strictly to physical scaling mathematics, baseline grid alignment,
 * and government readability / accessibility requirements.
 */
export class PhysicalTypographyEngine {
  public static readonly PT_TO_MM = 25.4 / 72.0;
  public static readonly MM_TO_PT = 72.0 / 25.4;
  public static readonly DEFAULT_CAP_TO_EM_RATIO = 0.705; // Standard for Noto Sans / Helvetica
  public static readonly DEFAULT_BASE_CAP_HEIGHT_MM = 2.4; // Accessible body text physical cap height
  public static readonly DEFAULT_SCALE_RATIO = 1.25; // Major Third modular scale
  public static readonly DEFAULT_BASELINE_GRID_PT = 4; // Standard 4pt vertical rhythm grid
  public static readonly LEFT_ALIGN = 1818584692; // Justification.LEFT_ALIGN FourCC
  public static readonly WORLD_READY_COMPOSER = "Adobe World-Ready Paragraph Composer";

  /**
   * Snaps any point dimension upward to a whole-integer multiple of the baseline grid.
   */
  public static snapToBaselineGrid(targetPt: number, baselineGridPt: number = 4): number {
    const grid = Math.max(1, baselineGridPt);
    return Math.ceil(targetPt / grid) * grid;
  }

  /**
   * Derives body text point size from physical cap height (in mm) and font cap-to-em ratio:
   * PointSize = (CapHeightMm * (72 / 25.4)) / CapToEmRatio
   */
  public static calculateBasePointSize(
    baseBodyCapHeightMm: number = PhysicalTypographyEngine.DEFAULT_BASE_CAP_HEIGHT_MM,
    capToEmRatio: number = PhysicalTypographyEngine.DEFAULT_CAP_TO_EM_RATIO
  ): number {
    const capHeightPt = baseBodyCapHeightMm * PhysicalTypographyEngine.MM_TO_PT;
    const pt = capHeightPt / Math.max(0.1, capToEmRatio);
    return Math.round(pt * 100) / 100;
  }

  /**
   * Maps semantic roles to modular scale steps.
   */
  public static getRoleScaleStep(role: TypographyRole): number {
    switch (role) {
      case "display":
        return 5;
      case "title":
      case "h1":
        return 4;
      case "h2":
        return 3;
      case "h3":
        return 2;
      case "h4":
      case "lead":
        return 1;
      case "listItem":
      case "body":
        return 0;
      case "small":
      case "caption":
        return -1;
      case "footer":
        return -2;
      default:
        return 0;
    }
  }

  /**
   * Calculates role point size using the modular progression:
   * Size = BasePointSize * (ScaleRatio ^ ScaleStep)
   */
  public static calculateRolePointSize(
    baseBodyPt: number,
    role: TypographyRole,
    scaleRatio: number = PhysicalTypographyEngine.DEFAULT_SCALE_RATIO
  ): number {
    const step = this.getRoleScaleStep(role);
    const pt = baseBodyPt * Math.pow(scaleRatio, step);
    return Math.round(pt * 100) / 100;
  }

  /**
   * Calculates vertical leading based on role multiplier and snaps upward to the baseline grid.
   */
  public static calculateRoleLeading(
    pointSize: number,
    role: TypographyRole,
    baselineGridPt: number = PhysicalTypographyEngine.DEFAULT_BASELINE_GRID_PT
  ): number {
    const multipliers: Record<TypographyRole, number> = {
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

  /**
   * Generates strict grid-snapped paragraph spacing and native same-style spacing.
   * All values are guaranteed to be whole-integer multiples of the baseline grid.
   */
  public static calculateRoleSpacing(
    role: TypographyRole,
    baselineGridPt: number = PhysicalTypographyEngine.DEFAULT_BASELINE_GRID_PT
  ): RoleSpacing {
    const grid = Math.max(1, Math.round(baselineGridPt));

    switch (role) {
      case "display":
      case "title":
      case "h1":
        return {
          spaceBefore: 4 * grid,
          spaceAfter: 2 * grid,
          spaceBetweenParagraphsOfSameStyle: 1 * grid,
          keepWithNext: 1
        };
      case "h2":
        return {
          spaceBefore: 3 * grid,
          spaceAfter: 1 * grid,
          spaceBetweenParagraphsOfSameStyle: 1 * grid,
          keepWithNext: 1
        };
      case "h3":
        return {
          spaceBefore: 2 * grid,
          spaceAfter: 1 * grid,
          spaceBetweenParagraphsOfSameStyle: 1 * grid,
          keepWithNext: 1
        };
      case "h4":
        return {
          spaceBefore: 2 * grid,
          spaceAfter: 1 * grid,
          spaceBetweenParagraphsOfSameStyle: 1 * grid,
          keepWithNext: 1
        };
      case "lead":
        return {
          spaceBefore: 1 * grid,
          spaceAfter: 2 * grid,
          spaceBetweenParagraphsOfSameStyle: 1 * grid
        };
      case "listItem":
        return {
          spaceBefore: 1 * grid, // Boundary spacing before list block
          spaceAfter: 2 * grid,  // Boundary spacing after list block
          spaceBetweenParagraphsOfSameStyle: 0 // Compact spacing between list items
        };
      case "small":
      case "caption":
        return {
          spaceBefore: 1 * grid,
          spaceAfter: 1 * grid,
          spaceBetweenParagraphsOfSameStyle: 1 * grid
        };
      case "footer":
        return {
          spaceBefore: 0,
          spaceAfter: 0,
          spaceBetweenParagraphsOfSameStyle: 0
        };
      case "body":
      default:
        return {
          spaceBefore: 0,
          spaceAfter: 2 * grid,
          spaceBetweenParagraphsOfSameStyle: 1 * grid
        };
    }
  }

  /**
   * Calculates format-level optical tracking offset (+10 to +25 on large formats).
   */
  public static calculateOpticalTracking(
    longEdgeMm?: number,
    formatName?: string
  ): number {
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

  /**
   * Detects semantic typography role from style name or style group path.
   */
  public static detectTypographyRole(styleName: string, groupPath?: string): TypographyRole {
    const combined = `${groupPath || ""} / ${styleName}`.toLowerCase();
    if (combined.includes("display") || combined.includes("hero")) return "display";
    if (combined.includes("banner / title") || combined.includes("title")) return "title";
    if (combined.includes("h1") || combined.includes("heading 1") || combined.includes("header 1")) return "h1";
    if (combined.includes("h2") || combined.includes("heading 2") || combined.includes("header 2")) return "h2";
    if (combined.includes("h3") || combined.includes("heading 3") || combined.includes("header 3")) return "h3";
    if (combined.includes("h4") || combined.includes("heading 4") || combined.includes("minor")) return "h4";
    if (combined.includes("lead") || combined.includes("abstract") || combined.includes("intro")) return "lead";
    if (combined.includes("list") || combined.includes("bullet") || combined.includes("numbered")) return "listItem";
    if (combined.includes("footer") || combined.includes("running folio")) return "footer";
    if (combined.includes("caption") || combined.includes("note") || combined.includes("small")) return "small";
    return "body";
  }

  /**
   * Applies all physical typography rules, baseline grid snapping, and accessibility mandates
   * directly to paragraph style properties in place.
   */
  public static applyPhysicalTypographyRules(
    styleProps: any,
    role: TypographyRole,
    config: PhysicalTypographyConfig = {}
  ): any {
    const baseCapHeight = config.baseBodyCapHeightMm || this.DEFAULT_BASE_CAP_HEIGHT_MM;
    const capToEm = config.capToEmRatio || this.DEFAULT_CAP_TO_EM_RATIO;
    const scaleRatio = config.scaleRatio || this.DEFAULT_SCALE_RATIO;
    const baselineGrid = Math.max(1, Math.round(config.baselineGridPt || this.DEFAULT_BASELINE_GRID_PT));

    // 1. Calculate Physical Point Size (Eliminate arbitrary sizes)
    const baseBodyPt = this.calculateBasePointSize(baseCapHeight, capToEm);
    const calculatedPointSize = this.calculateRolePointSize(baseBodyPt, role, scaleRatio);
    styleProps.pointSize = calculatedPointSize;

    // 2. Lock Vertical Rhythm (Leading snapped upward to baseline grid)
    const calculatedLeading = this.calculateRoleLeading(calculatedPointSize, role, baselineGrid);
    styleProps.leading = calculatedLeading;
    styleProps.alignToBaseline = true;

    // 3. Enforce Readability Mandates
    styleProps.hyphenation = false;
    const leftAlign = (typeof indesign !== "undefined" && indesign.Justification?.LEFT_ALIGN) || this.LEFT_ALIGN;
    styleProps.justification = leftAlign;
    styleProps.composer = this.WORLD_READY_COMPOSER;

    // 4. Native Same-Style Spacing & Strict Grid Snapping
    const spacing = this.calculateRoleSpacing(role, baselineGrid);
    styleProps.spaceBefore = spacing.spaceBefore;
    styleProps.spaceAfter = spacing.spaceAfter;
    styleProps.spaceBetweenParagraphsOfSameStyle = spacing.spaceBetweenParagraphsOfSameStyle;
    styleProps.spaceBetweenParagraphsForSameStyle = spacing.spaceBetweenParagraphsOfSameStyle;
    if (spacing.keepWithNext !== undefined) {
      styleProps.keepWithNext = spacing.keepWithNext;
    }

    // 5. Optical Tracking Adjustments
    const opticalOffset = config.opticalTrackingOffset !== undefined
      ? config.opticalTrackingOffset
      : this.calculateOpticalTracking(config.longEdgeMm, config.formatName);

    const existingTracking = typeof styleProps.tracking === "number" ? styleProps.tracking : 0;
    styleProps.tracking = existingTracking + opticalOffset;

    return styleProps;
  }
}

