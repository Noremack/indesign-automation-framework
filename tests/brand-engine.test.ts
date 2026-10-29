import { describe, it, expect } from "vitest";
import { MockDocument } from "./mocks/indesign-mock";
import {
  QgdsBrandEngineService,
  getThemeColors,
  BrandEngineOptions
} from "../src/core/qgds-brand-engine";

describe("QGDS Brand Engine & Theme Styler", () => {
  it("resolves context-aware theme colors for all 4 brand themes in standard light mode", () => {
    const blueStandard = getThemeColors("Blue", false);
    expect(blueStandard.themeName).toBe("Blue");
    expect(blueStandard.primaryTextColor).toBe("Neutral - Extra Dark");
    expect(blueStandard.primaryHeadingColor).toBe("Blue - Medium");
    expect(blueStandard.tableHeaderBG).toBe("Blue - Medium");

    const gumStandard = getThemeColors("Gum", false);
    expect(gumStandard.primaryHeadingColor).toBe("Gum - Medium");

    const sandStandard = getThemeColors("Sand", false);
    expect(sandStandard.primaryHeadingColor).toBe("Sand - Medium");

    const bvrtStandard = getThemeColors("BVRT", false);
    expect(bvrtStandard.primaryHeadingColor).toBe("BVRT - Medium");
  });

  it("inverts text to Paper and fills to dark tones in reverse dark mode", () => {
    const blueReverse = getThemeColors("Blue", true);
    expect(blueReverse.primaryTextColor).toBe("Paper");
    expect(blueReverse.primaryHeadingColor).toBe("Paper");
    expect(blueReverse.accentColor).toBe("Blue - Light");
    expect(blueReverse.frameFillColor).toBe("Blue - Extra Dark");
    expect(blueReverse.tableHeaderText).toBe("Blue - Extra Dark");
  });

  it("injects full style matrix, gradients, and tables into InDesign document without creating top-level QGDS group", () => {
    const doc = new MockDocument();
    const service = new QgdsBrandEngineService();

    const result = service.execute(doc, {
      theme: "Blue",
      styleMode: "standard",
      autoCopyDiagnostics: false,
      notifyOnCompletion: false
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    const data = result.data!;
    expect(data.themeApplied).toBe("Blue");
    expect(data.styleModeApplied).toBe("standard");
    // Only imports selected theme (7 Blue) + 7 Neutral = 14 colors
    expect(data.colorsCreated).toBe(14);
    expect(data.gradientsCreated).toBeGreaterThan(0);
    expect(data.layersCreated).toBe(3);
    expect(data.paragraphStylesCreated).toBe(42);
    expect(data.characterStylesCreated).toBe(16);
    expect(data.cellStylesCreated).toBe(5);
    expect(data.tableStylesCreated).toBe(2);

    // Verify only Blue and Neutral are imported, other themes are NOT imported
    expect(doc.colors.itemByName("Blue - Medium").isValid).toBe(true);
    expect(doc.colors.itemByName("Neutral - Extra Dark").isValid).toBe(true);
    expect(doc.colors.itemByName("Gum - Medium").isValid).toBe(false);
    expect(doc.colors.itemByName("Sand - Medium").isValid).toBe(false);
    expect(doc.colors.itemByName("BVRT - Medium").isValid).toBe(false);

    // Verify QGDS top-level group was NOT created; subfolders are directly placed at top-level
    expect(doc.paragraphStyleGroups.itemByName("QGDS").isValid).toBe(false);
    expect(doc.paragraphStyleGroups.itemByName("Headings").isValid).toBe(true);
    expect(doc.paragraphStyleGroups.itemByName("Narrative").isValid).toBe(true);
    expect(doc.characterStyleGroups.itemByName("Character").isValid).toBe(true);
    expect(doc.cellStyleGroups.itemByName("Tables").isValid).toBe(true);
    expect(doc.tableStyleGroups.itemByName("Tables").isValid).toBe(true);

    // Verify CMYK color space when specified
    const cmykDoc = new MockDocument();
    const cmykResult = service.execute(cmykDoc, {
      theme: "Blue",
      colorMode: "CMYK",
      autoCopyDiagnostics: false,
      notifyOnCompletion: false
    });
    expect(cmykResult.success).toBe(true);
    const primaryColor = cmykDoc.colors.itemByName("Blue - Medium");
    expect(primaryColor.isValid).toBe(true);
    expect(primaryColor.space).toBe(1129142603); // CMYK FourCC
  });

  it("synchronizes document intent, transparency blending space, and Black/Paper swatches for CMYK vs RGB", () => {
    const service = new QgdsBrandEngineService();

    // 1. CMYK Document
    const cmykDoc = new MockDocument();
    service.execute(cmykDoc, {
      theme: "Blue",
      colorMode: "CMYK",
      autoCopyDiagnostics: false,
      notifyOnCompletion: false
    });
    expect(cmykDoc.documentPreferences.intent).toBe(1886547822); // PRINT_INTENT
    expect(cmykDoc.transparencyPreferences.blendingSpace).toBe(1129142603); // CMYK
    const cmykBlack = cmykDoc.colors.itemByName("Black");
    expect(cmykBlack.space).toBe(1129142603);
    expect(cmykBlack.colorValue).toEqual([0, 0, 0, 100]);
    const cmykPaper = cmykDoc.colors.itemByName("Paper");
    expect(cmykPaper.space).toBe(1129142603);
    expect(cmykPaper.colorValue).toEqual([0, 0, 0, 0]);

    // 2. RGB Document
    const rgbDoc = new MockDocument();
    service.execute(rgbDoc, {
      theme: "Blue",
      colorMode: "RGB",
      autoCopyDiagnostics: false,
      notifyOnCompletion: false
    });
    expect(rgbDoc.documentPreferences.intent).toBe(1986359924); // WEB_INTENT
    expect(rgbDoc.transparencyPreferences.blendingSpace).toBe(1666336572); // RGB
    const rgbBlack = rgbDoc.colors.itemByName("Black");
    expect(rgbBlack.space).toBe(1666336572);
    expect(rgbBlack.colorValue).toEqual([0, 0, 0]);
    const rgbPaper = rgbDoc.colors.itemByName("Paper");
    expect(rgbPaper.space).toBe(1666336572);
    expect(rgbPaper.colorValue).toEqual([255, 255, 255]);
  });

  it("updates the brand theme on an existing document, remapping old theme swatches and styles seamlessly", () => {
    const doc = new MockDocument();
    const service = new QgdsBrandEngineService();

    // Initial run with Blue theme
    service.execute(doc, {
      theme: "Blue",
      colorMode: "CMYK",
      autoCopyDiagnostics: false,
      notifyOnCompletion: false
    });
    expect(doc.colors.itemByName("Blue - Medium").isValid).toBe(true);
    expect(doc.colors.itemByName("Gum - Medium").isValid).toBe(false);

    // Re-run to update existing document to Gum theme
    const updateResult = service.execute(doc, {
      theme: "Gum",
      colorMode: "CMYK",
      autoCopyDiagnostics: false,
      notifyOnCompletion: false
    });
    expect(updateResult.success).toBe(true);

    // Old Blue swatches should be remapped and removed
    expect(doc.colors.itemByName("Blue - Medium").isValid).toBe(false);
    // New Gum swatches should be present
    expect(doc.colors.itemByName("Gum - Medium").isValid).toBe(true);
    expect(doc.colors.itemByName("Neutral - Extra Dark").isValid).toBe(true);

    // Paragraph styles should reflect Gum colors
    const headingsGroup = doc.paragraphStyleGroups.itemByName("Headings");
    expect(headingsGroup.isValid).toBe(true);
    const h1Style = headingsGroup.paragraphStyles.itemByName("H1 - Title");
    expect(h1Style.isValid).toBe(true);
    expect(h1Style.fillColor.name).toBe("Gum - Medium");
  });

  it("handles reverse mode by placing styles in Reverse group hierarchy", () => {
    const doc = new MockDocument();
    const service = new QgdsBrandEngineService();

    const result = service.execute(doc, {
      theme: "Gum",
      styleMode: "reverse",
      autoCopyDiagnostics: false,
      notifyOnCompletion: false
    });

    expect(result.success).toBe(true);
    expect(result.data!.themeApplied).toBe("Gum");
    expect(result.data!.styleModeApplied).toBe("reverse");

    // Reverse style group should be created
    const reverseGroup = doc.paragraphStyleGroups.itemByName("Reverse");
    expect(reverseGroup.isValid).toBe(true);
  });

  it("supports non-destructive layout simulation with dryRun", () => {
    const doc = new MockDocument();
    const service = new QgdsBrandEngineService();

    const result = service.execute(doc, {
      theme: "Sand",
      dryRun: true,
      autoCopyDiagnostics: false,
      notifyOnCompletion: false
    });

    expect(result.success).toBe(true);
    expect(result.data!.paragraphStylesCreated).toBe(42);
    // Because dryRun was true, DOM collections remain untouched
    expect(doc.gradients.length).toBe(0);
  });
});

