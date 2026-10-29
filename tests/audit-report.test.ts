import { describe, it, expect } from "vitest";
import { generateAccessibilityAuditHtml, PreflightFinding, AuditReportMetadata } from "../src/core/audit-report";

describe("Accessibility Audit Report Generator", () => {
  it("generates a complete, self-contained HTML audit report", () => {
    const meta: AuditReportMetadata = {
      docName: "Queensland-Strategic-Plan.indd",
      pageCount: 12,
      violationsFound: 3,
      remediationsApplied: 2,
      contrastRemediatedCount: 1,
      linksUpgradedCount: 1,
      linearizedFramesCount: 4,
      score: 95
    };

    const findings: PreflightFinding[] = [
      {
        ruleId: "COL 1.1",
        severity: "warning",
        message: "Paragraph style Heading 2 contrast ratio was 2.8:1.",
        target: "Heading 2",
        remediated: true
      },
      {
        ruleId: "LNK 2.5",
        severity: "warning",
        message: "Insecure link http://tmr.qld.gov.au detected.",
        target: "tmr.qld.gov.au",
        remediated: true
      },
      {
        ruleId: "WCAG 1.1.1",
        severity: "warning",
        message: "Graphic hero-banner.png has no alt text.",
        target: "hero-banner.png",
        remediated: false
      }
    ];

    const html = generateAccessibilityAuditHtml(meta, findings);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Queensland-Strategic-Plan.indd");
    expect(html).toContain("95%");
    expect(html).toContain("COL 1.1");
    expect(html).toContain("LNK 2.5");
    expect(html).toContain("WCAG 1.1.1");
    expect(html).toContain("Auto-Remediated");
    expect(html).toContain("Manual Review");
    expect(html).toContain("search-input");
  });
});

