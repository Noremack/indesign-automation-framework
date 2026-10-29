import { describe, it, expect, beforeEach } from "vitest";
import { MockDocument } from "./mocks/indesign-mock";
import { auditDocumentContrast, remediateDocumentContrast } from "../src/core/contrast-engine";
import { QGDS_BRAND_TOKENS } from "../src/core/qgds-tokens";
import { QGDS_ABBREVIATIONS, QGDS_LEGISLATION_ACTS } from "../src/core/qgds-lexicons";

describe("QGDS Publishing Suite Parity & Preflight Rules", () => {
  let doc: MockDocument;

  beforeEach(() => {
    doc = new MockDocument();
    doc.name = "QGDS-Test-Publication.indd";
  });

  it("embeds complete brand tokens and lexicons", () => {
    expect(Object.keys(QGDS_BRAND_TOKENS.colors).length).toBe(37);
    expect(Object.keys(QGDS_ABBREVIATIONS).length).toBeGreaterThan(1000);
    expect(Object.keys(QGDS_LEGISLATION_ACTS).length).toBeGreaterThan(600);
  });

  it("evaluates and auto-remediates WCAG 2.2 AA color contrast (COL 1.1)", () => {
    doc.paragraphStyles.add({
      name: "QGDS Warning Text",
      pointSize: 12,
      fillColor: { name: "Yellow Text", colorValue: [240, 230, 200] }
    });

    const audit = auditDocumentContrast(doc);
    expect(audit.violationsCount).toBeGreaterThanOrEqual(1);

    const remediated = remediateDocumentContrast(doc, "Black");
    expect(remediated).toBeGreaterThanOrEqual(1);

    const postAudit = auditDocumentContrast(doc);
    expect(postAudit.violationsCount).toBe(0);
  });

  it("contains QGDS legislation acts and abbreviation expansions", () => {
    expect(QGDS_ABBREVIATIONS["QGDS"]).toBeDefined();
    expect(QGDS_ABBREVIATIONS["TMR"]).toBeDefined();
    expect(QGDS_LEGISLATION_ACTS["Human Rights Act 2019"]).toBeDefined();
    expect(QGDS_LEGISLATION_ACTS["Information Privacy Act 2009"]).toBeDefined();
  });
});

