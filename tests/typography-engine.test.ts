import { describe, it, expect, beforeEach } from "vitest";
import { MockDocument, MockApplication } from "./mocks/indesign-mock";
import {
  PhysicalTypographyEngine,
  TypographyRole
} from "../src/core/typography-engine";
import { QgdsBrandEngineService } from "../src/core/qgds-brand-engine";
import { BrandThemeAdapter } from "../src/core/theme-adapter";
import { TenantBrandPackage } from "../src/core/theme-schema";
import { DomResolver } from "../src/core/dom-resolver";

const testTenant: TenantBrandPackage = {
  manifest: {
    schemaVersion: "2.0.0",
    tenantId: "gov-dept",
    tenantName: "Department of Government Services",
    namespacePrefix: "DGS",
    defaultTheme: "Navy",
    availableThemes: ["Navy"]
  },
  swatches: [
    { name: "Navy - Medium", space: "RGB", value: [0, 45, 98] },
    { name: "Neutral - Extra Dark", space: "RGB", value: [30, 30, 30] },
    { name: "Neutral - White", space: "RGB", value: [255, 255, 255] }
  ],
  themeMatrices: {
    Navy: {
      standard: {
        primaryTextColor: "Neutral - Extra Dark",
        primaryHeadingColor: "Navy - Medium",
        secondaryHeadingColor: "Navy - Medium",
        accentColor: "Navy - Medium",
        subtleStrokeColor: "Neutral - White",
        frameFillColor: "Neutral - White",
        tableHeaderBG: "Navy - Medium",
        tableHeaderText: "Neutral - White",
        tableBodyHorizontalBorderColor: "Neutral - Extra Dark",
        tableBodyVerticalBorderColor: "Neutral - White",
        tableZebraColor: "Neutral - White"
      },
      reverse: {
        primaryTextColor: "Neutral - White",
        primaryHeadingColor: "Neutral - White",
        secondaryHeadingColor: "Neutral - White",
        accentColor: "Navy - Medium",
        subtleStrokeColor: "Neutral - Extra Dark",
        frameFillColor: "Neutral - Extra Dark",
        tableHeaderBG: "Neutral - White",
        tableHeaderText: "Navy - Medium",
        tableBodyHorizontalBorderColor: "Neutral - White",
        tableBodyVerticalBorderColor: "Neutral - White",
        tableZebraColor: "Neutral - Extra Dark"
      }
    }
  },
  typography: {
    primaryFont: {
      family: "Noto Sans",
      capToEmRatio: 0.705
    },
    scales: {
      body: { pointSize: 10, leading: 16 }
    }
  },
  layoutPresets: [
    {
      name: "A4 Document",
      shortEdgeMm: 210,
      longEdgeMm: 297,
      marginMm: 15,
      gutterMm: 15,
      bleedMm: 3,
      baseFontPt: 12,
      baselineGridPt: 4,
      baseBodyCapHeightMm: 2.4,
      scaleRatio: 1.25,
      isFacingPages: true,
      masterSpreads: [
        { prefix: "A", name: "Cover", injectFolio: false },
        { prefix: "B", name: "Content", injectFolio: true }
      ]
    },
    {
      name: "A0 Exhibition Poster",
      shortEdgeMm: 841,
      longEdgeMm: 1189,
      marginMm: 40,
      gutterMm: 40,
      bleedMm: 5,
      baseFontPt: 24,
      baselineGridPt: 8,
      baseBodyCapHeightMm: 6.0,
      scaleRatio: 1.25,
      opticalTrackingOffset: 25,
      isFacingPages: false,
      masterSpreads: [
        { prefix: "A", name: "Poster", injectFolio: false }
      ]
    }
  ],
  styles: {
    paragraph: [
      {
        name: "DGS / Body",
        group: "Narrative",
        roleColor: "primaryTextColor",
        properties: {}
      },
      {
        name: "DGS / List Item",
        group: "Narrative",
        roleColor: "primaryTextColor",
        properties: {}
      },
      {
        name: "DGS / Heading 1",
        group: "Headings",
        roleColor: "primaryHeadingColor",
        properties: {}
      },
      {
        name: "DGS / Heading 2",
        group: "Headings",
        roleColor: "primaryHeadingColor",
        properties: {}
      }
    ]
  }
};

describe("PhysicalTypographyEngine & Accessibility Rules", () => {
  it("eliminates arbitrary point sizes by deriving body size from physical cap height", () => {
    // 2.4mm cap height with 0.705 cap-to-em ratio:
    // capHeightPt = 2.4 * (72 / 25.4) = 6.80315 pt
    // pointSize = 6.80315 / 0.705 = 9.65 pt
    const pt = PhysicalTypographyEngine.calculateBasePointSize(2.4, 0.705);
    expect(pt).toBeCloseTo(9.65, 1);

    // 12pt baseFont with 0.705 ratio has capHeight:
    // 12 * 0.705 * (25.4 / 72) = 2.9845 mm
    const capHeightMm = (12 * 0.705) * PhysicalTypographyEngine.PT_TO_MM;
    const derived12 = PhysicalTypographyEngine.calculateBasePointSize(capHeightMm, 0.705);
    expect(derived12).toBeCloseTo(12.0, 1);
  });

  it("derives headings using modular scale progression", () => {
    const basePt = 10.0;
    const scaleRatio = 1.25;

    const bodyPt = PhysicalTypographyEngine.calculateRolePointSize(basePt, "body", scaleRatio);
    const h4Pt = PhysicalTypographyEngine.calculateRolePointSize(basePt, "h4", scaleRatio);
    const h3Pt = PhysicalTypographyEngine.calculateRolePointSize(basePt, "h3", scaleRatio);
    const h2Pt = PhysicalTypographyEngine.calculateRolePointSize(basePt, "h2", scaleRatio);
    const h1Pt = PhysicalTypographyEngine.calculateRolePointSize(basePt, "h1", scaleRatio);
    const displayPt = PhysicalTypographyEngine.calculateRolePointSize(basePt, "display", scaleRatio);
    const smallPt = PhysicalTypographyEngine.calculateRolePointSize(basePt, "small", scaleRatio);

    expect(bodyPt).toBe(10.0);
    expect(h4Pt).toBeCloseTo(12.5, 1);
    expect(h3Pt).toBeCloseTo(15.63, 1);
    expect(h2Pt).toBeCloseTo(19.53, 1);
    expect(h1Pt).toBeCloseTo(24.41, 1);
    expect(displayPt).toBeCloseTo(30.52, 1);
    expect(smallPt).toBeCloseTo(8.0, 1);
  });

  it("locks vertical rhythm by snapping leading upward to baseline grid", () => {
    const gridPt = 4;
    // 10pt text with 1.35 body multiplier = 13.5pt -> snaps upward to 16pt (4 * 4)
    const bodyLeading = PhysicalTypographyEngine.calculateRoleLeading(10.0, "body", gridPt);
    expect(bodyLeading).toBe(16);
    expect(bodyLeading % gridPt).toBe(0);

    // 24.41pt H1 with 1.15 multiplier = 28.07pt -> snaps upward to 32pt (8 * 4)
    const h1Leading = PhysicalTypographyEngine.calculateRoleLeading(24.41, "h1", gridPt);
    expect(h1Leading).toBe(32);
    expect(h1Leading % gridPt).toBe(0);

    // On 3pt grid: 10pt with 1.35 multiplier = 13.5pt -> snaps upward to 15pt (5 * 3)
    const grid3Leading = PhysicalTypographyEngine.calculateRoleLeading(10.0, "body", 3);
    expect(grid3Leading).toBe(15);
    expect(grid3Leading % 3).toBe(0);
  });

  it("calculates native same-style spacing and strict grid-snapped boundaries", () => {
    const gridPt = 4;

    // Body text: 1 grid unit same-style, 2 grid units spaceAfter, 0 spaceBefore
    const bodySpacing = PhysicalTypographyEngine.calculateRoleSpacing("body", gridPt);
    expect(bodySpacing.spaceBetweenParagraphsOfSameStyle).toBe(4);
    expect(bodySpacing.spaceAfter).toBe(8);
    expect(bodySpacing.spaceBefore).toBe(0);

    // List items: 0 same-style (compact items), 1 grid unit spaceBefore, 2 grid units spaceAfter (boundary)
    const listSpacing = PhysicalTypographyEngine.calculateRoleSpacing("listItem", gridPt);
    expect(listSpacing.spaceBetweenParagraphsOfSameStyle).toBe(0);
    expect(listSpacing.spaceBefore).toBe(4);
    expect(listSpacing.spaceAfter).toBe(8);

    // Headings: strictly integer multiples of baseline grid with keepWithNext = 1
    const h1Spacing = PhysicalTypographyEngine.calculateRoleSpacing("h1", gridPt);
    expect(h1Spacing.spaceBefore).toBe(16); // 4 * 4pt
    expect(h1Spacing.spaceAfter).toBe(8);   // 2 * 4pt
    expect(h1Spacing.spaceBetweenParagraphsOfSameStyle).toBe(4);
    expect(h1Spacing.keepWithNext).toBe(1);
  });

  it("applies optical tracking offsets on large formats", () => {
    expect(PhysicalTypographyEngine.calculateOpticalTracking(297, "A4")).toBe(0);
    expect(PhysicalTypographyEngine.calculateOpticalTracking(420, "A3")).toBe(10);
    expect(PhysicalTypographyEngine.calculateOpticalTracking(594, "A2")).toBe(15);
    expect(PhysicalTypographyEngine.calculateOpticalTracking(841, "A1")).toBe(20);
    expect(PhysicalTypographyEngine.calculateOpticalTracking(1189, "A0")).toBe(25);
    expect(PhysicalTypographyEngine.calculateOpticalTracking(1500, "Billboard")).toBe(25);
  });

  it("hardcodes government readability mandates (hyphenation, left align, World-Ready composer)", () => {
    const props: any = {};
    PhysicalTypographyEngine.applyPhysicalTypographyRules(props, "body", {
      baseBodyCapHeightMm: 2.4,
      capToEmRatio: 0.705,
      baselineGridPt: 4
    });

    expect(props.hyphenation).toBe(false);
    expect(props.justification).toBe(1818584692); // Justification.LEFT_ALIGN
    expect(props.composer).toBe("Adobe World-Ready Paragraph Composer");
    expect(props.alignToBaseline).toBe(true);
    expect(props.spaceBetweenParagraphsOfSameStyle).toBe(4);
    expect(props.spaceBetweenParagraphsForSameStyle).toBe(4);
  });
});

describe("QgdsBrandEngineService Typography Integration", () => {
  let doc: MockDocument;
  let adapter: BrandThemeAdapter;

  beforeEach(() => {
    (global as any).app = new MockApplication();
    doc = new MockDocument();
    adapter = new BrandThemeAdapter(testTenant);
  });

  it("configures physical typography, vertical rhythm, and same-style spacing on generated styles", () => {
    const brandEngine = new QgdsBrandEngineService();
    const result = brandEngine.execute(doc, {
      adapter,
      theme: "Navy"
    });

    expect(result.success).toBe(true);

    const bodyStyle = DomResolver.getParagraphStyleSafely(doc, "Body", "DGS");
    expect(bodyStyle).toBeDefined();
    expect(bodyStyle.isValid).toBe(true);

    // Readability mandates
    expect(bodyStyle.hyphenation).toBe(false);
    expect(bodyStyle.justification).toBe(1818584692);
    expect(bodyStyle.composer).toBe("Adobe World-Ready Paragraph Composer");
    expect(bodyStyle.alignToBaseline).toBe(true);

    // Baseline grid vertical rhythm (leading multiple of 4)
    expect(bodyStyle.leading % 4).toBe(0);
    expect(bodyStyle.leading).toBeGreaterThan(bodyStyle.pointSize);

    // Same-style spacing (1 grid unit = 4pt, spaceAfter = 8pt)
    expect(bodyStyle.spaceBetweenParagraphsOfSameStyle).toBe(4);
    expect(bodyStyle.spaceBetweenParagraphsForSameStyle).toBe(4);
    expect(bodyStyle.spaceAfter).toBe(8);

    // List item spacing (0 same-style for compact bullets, spaceAfter = 8pt boundary)
    const listStyle = DomResolver.getParagraphStyleSafely(doc, "List Item", "DGS");
    expect(listStyle).toBeDefined();
    expect(listStyle.spaceBetweenParagraphsOfSameStyle).toBe(0);
    expect(listStyle.spaceBefore).toBe(4);
    expect(listStyle.spaceAfter).toBe(8);

    // Heading 1: modular progression, grid snapped leading, keepWithNext = 1
    const h1Style = DomResolver.getParagraphStyleSafely(doc, "Heading 1", "DGS");
    expect(h1Style).toBeDefined();
    expect(h1Style.pointSize).toBeGreaterThan(bodyStyle.pointSize * 2);
    expect(h1Style.leading % 4).toBe(0);
    expect(h1Style.keepWithNext).toBe(1);
    expect(h1Style.spaceBefore).toBe(16);
    expect(h1Style.spaceAfter).toBe(8);
  });

  it("applies optical tracking offset when generating styles for large formats (A0 Poster)", () => {
    // Configure document as A0 size (841 x 1189 mm -> ~2384 x 3370 pt)
    doc.pages[0].bounds = [0, 0, 3370.39, 2383.94];

    const brandEngine = new QgdsBrandEngineService();
    brandEngine.execute(doc, {
      adapter,
      theme: "Navy"
    });

    const bodyStyle = DomResolver.getParagraphStyleSafely(doc, "Body", "DGS");
    expect(bodyStyle).toBeDefined();
    // A0 format optical tracking should be +25
    expect(bodyStyle.tracking).toBe(25);
  });
});

