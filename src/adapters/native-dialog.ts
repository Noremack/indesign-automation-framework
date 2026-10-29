import { app as defaultApp } from "indesign";

export interface PublishingDashboardOptions {
  mode: "active-workflow" | "batch-templates";
  scope?: "active-document" | "active-book" | "all-documents";
  bookName?: string;
  totalDocs?: number;
  theme?: "Blue" | "Gum" | "Sand" | "BVRT";
  styleMode?: "standard" | "reverse";
  colorMode?: "RGB" | "CMYK";
  runReset: boolean;
  runLayout: boolean;
  runBrand: boolean;
  runSpecimen: boolean;
  runEditorial: boolean;
  runPreflight: boolean;
  runExport: boolean;
  exportIndt?: boolean;
  exportIndd?: boolean;
  targetTemplateFormat?: string;
  format: "web-components" | "bem";
  outputDirectory: string;
}

/**
 * Adapter for InDesign native DOM dialogs (`app.dialogs.add`).
 * Provides interactive UI within headless InDesign UXP scripts (.idjs)
 * without requiring HTML DOM, webviews, or administrator privileges.
 */
export class NativeDialog {
  /**
   * Displays a native InDesign modal alert with clean line formatting.
   */
  public static showInDesignAlert(
    title: string,
    messageOrLines: string | string[],
    customApp?: any
  ): void {
    const app = customApp || defaultApp;
    const lines = Array.isArray(messageOrLines) ? messageOrLines : String(messageOrLines).split("\n");

    try {
      if (app && app.dialogs && typeof app.dialogs.add === "function") {
        const dlg = app.dialogs.add({ name: title, canCancel: false });
        const col = dlg.dialogColumns.add();
        for (const line of lines) {
          const row = col.dialogRows.add();
          row.staticTexts.add({ staticLabel: line || " " });
        }
        dlg.show();
        dlg.destroy();
        return;
      }
    } catch (err: any) {
      console.warn(`[NativeDialog] Dialog display failed: ${err?.message}`);
    }

    console.log(`[Dialog Alert] ${title}:\n${lines.join("\n")}`);
  }

  /**
   * Displays a confirmation dialog returning true if confirmed, false if cancelled.
   */
  public static confirm(
    title: string,
    messageOrLines: string | string[],
    customApp?: any
  ): boolean {
    const app = customApp || defaultApp;
    const lines = Array.isArray(messageOrLines) ? messageOrLines : String(messageOrLines).split("\n");

    try {
      if (app && app.dialogs && typeof app.dialogs.add === "function") {
        const dlg = app.dialogs.add({ name: title, canCancel: true });
        const col = dlg.dialogColumns.add();
        for (const line of lines) {
          const row = col.dialogRows.add();
          row.staticTexts.add({ staticLabel: line || " " });
        }
        const result = dlg.show();
        dlg.destroy();
        return !!result;
      }
    } catch (err: any) {
      console.warn(`[NativeDialog] Confirm display failed: ${err?.message}`);
    }

    return false;
  }

  /**
   * Displays the Master Publishing Suite interactive dashboard.
   */
  public static showPublishingDashboard(
    doc: any,
    defaultOutputDir: string,
    customApp?: any
  ): PublishingDashboardOptions | null {
    const app = customApp || defaultApp;

    try {
      if (!app || !app.dialogs || typeof app.dialogs.add !== "function") {
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

      const dlg = app.dialogs.add({
        name: "Queensland Government Publishing Suite (QGDS)",
        canCancel: true
      });

      const mainCol = dlg.dialogColumns.add();

      // Panel 1: Execution Mode & Document Context
      const p1 = mainCol.borderPanels.add();
      const p1Col = p1.dialogColumns.add();
      const docTitle = doc?.name ? doc.name : "Active Document";
      const pageCount = doc?.pages ? doc.pages.length : 1;

      const r1 = p1Col.dialogRows.add();
      r1.staticTexts.add({
        staticLabel: `Target Document: "${docTitle}" (${pageCount} page${pageCount > 1 ? "s" : ""})`
      });

      const rMode = p1Col.dialogRows.add();
      rMode.staticTexts.add({ staticLabel: "Operation Mode:" });
      const ddModeChoice = rMode.dropdowns.add({
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
        if (app.books && app.books.length > 0) {
          const b = app.activeBook || app.books[0];
          if (b && b.isValid) {
            hasBook = true;
            bookName = b.name || "Active Book";
            bookDocCount = b.bookContents?.length || 0;
          }
        }
      } catch (_) {}

      const openDocsCount = app.documents ? app.documents.length : 1;
      const scopeOptions = [`Single Document ("${docTitle}")`];
      if (hasBook) {
        scopeOptions.push(`Entire InDesign Book ("${bookName}" - ${bookDocCount} docs)`);
      }
      if (openDocsCount > 1) {
        scopeOptions.push(`All Open Documents (${openDocsCount} documents)`);
      }

      let ddScope: any = null;
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

      const rStyleSel = pThemeCol.dialogRows.add();
      rStyleSel.staticTexts.add({ staticLabel: "Style Mode:" });
      const ddStyleMode = rStyleSel.dropdowns.add({
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
      r3b.staticTexts.add({ staticLabel: `Deliverables Directory: ${defaultOutputDir}` });

      const confirmed = dlg.show();
      if (confirmed) {
        let scope: "active-document" | "active-book" | "all-documents" = "active-document";
        if (ddScope && ddScope.selectedIndex > 0) {
          if (hasBook && ddScope.selectedIndex === 1) {
            scope = "active-book";
          } else {
            scope = "all-documents";
          }
        }

        const themes: Array<"Blue" | "Gum" | "Sand" | "BVRT"> = ["Blue", "Gum", "Sand", "BVRT"];
        const selectedTheme = themes[ddTheme.selectedIndex] || "Blue";
        const selectedStyleMode: "standard" | "reverse" = ddStyleMode.selectedIndex === 1 ? "reverse" : "standard";
        const selectedColorMode: "RGB" | "CMYK" = ddColorMode.selectedIndex === 1 ? "CMYK" : "RGB";
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

        const options: PublishingDashboardOptions = {
          mode: isBatchTemplates ? "batch-templates" : "active-workflow",
          scope,
          bookName: hasBook ? bookName : undefined,
          totalDocs: scope === "active-book" ? bookDocCount : (scope === "all-documents" ? openDocsCount : 1),
          theme: selectedTheme,
          styleMode: selectedStyleMode,
          colorMode: selectedColorMode,
          runReset: !!cbReset.checkedState,
          runLayout: !!cbLayout.checkedState,
          runBrand: !!cbBrand.checkedState,
          runSpecimen: !!cbSpecimen.checkedState,
          runEditorial: !!cbEditorial.checkedState,
          runPreflight: !!cbPreflight.checkedState,
          runExport: !!cbExport.checkedState,
          exportIndt: !!cbExportIndt.checkedState,
          exportIndd: !!cbExportIndd.checkedState,
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
    } catch (err: any) {
      console.warn(`[NativeDialog] Dashboard dialog failed: ${err?.message}`);
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
}
