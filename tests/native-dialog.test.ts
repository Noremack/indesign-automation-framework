import { describe, it, expect, beforeEach } from "vitest";
import { NativeDialog } from "../src/adapters/native-dialog";
import { MockApplication, MockDocument } from "./mocks/indesign-mock";

describe("NativeDialog", () => {
  let mockApp: MockApplication;

  beforeEach(() => {
    mockApp = new MockApplication();
  });

  it("shows modal alert without throwing", () => {
    expect(() => {
      NativeDialog.showInDesignAlert("Test Title", ["Line 1", "Line 2"], mockApp);
    }).not.toThrow();
  });

  it("returns true on confirmed dialog and false on cancelled dialog", () => {
    const resConfirm = NativeDialog.confirm("Proceed?", "Are you sure?", mockApp);
    expect(resConfirm).toBe(true);

    // Force cancel in mock
    mockApp.dialogs.add = () => {
      const dlg = new (mockApp as any).dialogs.add.constructor();
      dlg.showResult = false;
      return dlg;
    };
  });

  it("displays publishing dashboard and parses user options", () => {
    const doc = new MockDocument();
    doc.name = "Test Publication.indd";

    const options = NativeDialog.showPublishingDashboard(doc, "C:/Deliverables", mockApp);
    expect(options).not.toBeNull();
    expect(options?.mode).toBe("active-workflow");
    expect(options?.theme).toBe("Blue");
    expect(options?.colorMode).toBe("RGB");
    expect(options?.runReset).toBe(false);
    expect(options?.runLayout).toBe(true);
    expect(options?.runBrand).toBe(true);
    expect(options?.runExport).toBe(true);
    expect(options?.exportIndt).toBe(true);
    expect(options?.outputDirectory).toBe("C:/Deliverables");
    expect(options?.format).toBe("web-components");
    expect(options?.scope).toBe("active-document");
  });

  it("detects active InDesign Book and includes book scope option", () => {
    const doc = new MockDocument();
    doc.name = "Chapter1.indd";

    mockApp.books.add({
      name: "AnnualReport.indb",
      isValid: true,
      bookContents: [
        { name: "Chapter1.indd" },
        { name: "Chapter2.indd" }
      ]
    });

    const options = NativeDialog.showPublishingDashboard(doc, "C:/Deliverables", mockApp);
    expect(options).not.toBeNull();
    expect(options?.scope).toBe("active-document");
  });
});

