#!/usr/bin/env node
import fs from "fs";
import path from "path";

const SUGGESTIONS = {
  ERR_ELEMENT_NOT_EDITABLE: "Guard item with 'isElementEditable(item)' before modifying geometric bounds, contents, or styles.",
  ERR_TRANSACTION_FAILED: "Check failure policy: re-throw for atomic rollback ([A]), or wrap item in try/catch to record skipped ([B]).",
  ERR_UNSUPPORTED_HOST_VERSION: "Host InDesign version is below minimum requirement (v18.0+ / UXP ES2020).",
  ERR_INVALID_DOCUMENT: "Verify active document exists and doc.isValid is true before executing service.",
  ERR_NESTED_TRANSACTION_FAILED: "Async operation detected inside synchronous transaction boundary. Transactions must be strictly synchronous."
};

export function analyzeRoadblocks(logPath = ".framework/telemetry.jsonl") {
  const resolved = path.resolve(logPath);
  if (!fs.existsSync(resolved)) {
    return {
      total: 0,
      byCode: [],
      byDomain: [],
      incidents: []
    };
  }

  const lines = fs.readFileSync(resolved, "utf8").split("\n").filter(Boolean);
  const incidents = [];
  const codeCounts = {};
  const domainCounts = {};
  const actionCounts = {};

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      incidents.push(entry);

      const code = entry.code || "ERR_UNKNOWN";
      const domain = entry.domain || "GENERAL";
      const action = entry.action || "UnknownAction";

      codeCounts[code] = (codeCounts[code] || 0) + 1;
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
      actionCounts[action] = (actionCounts[action] || 0) + 1;
    } catch (_) {}
  }

  const total = incidents.length;

  const byCode = Object.entries(codeCounts)
    .map(([code, count]) => ({
      code,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      suggestion: SUGGESTIONS[code] || "Review service logic against framework architectural invariants."
    }))
    .sort((a, b) => b.count - a.count);

  const byDomain = Object.entries(domainCounts)
    .map(([domain, count]) => ({
      domain,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0
    }))
    .sort((a, b) => b.count - a.count);

  return {
    total,
    byCode,
    byDomain,
    incidents
  };
}

// CLI Execution Support
if (
  process.argv[1] &&
  (process.argv[1].endsWith("roadblocks.mjs") || process.argv[1].endsWith("roadblocks"))
) {
  const args = process.argv.slice(2);
  const logFile = ".framework/telemetry.jsonl";

  if (args.includes("--clear")) {
    const resolved = path.resolve(logFile);
    if (fs.existsSync(resolved)) {
      fs.unlinkSync(resolved);
      console.log(`✔ Cleared telemetry ledger at ${logFile}`);
    } else {
      console.log(`Telemetry ledger is already empty.`);
    }
    process.exit(0);
  }

  const analysis = analyzeRoadblocks(logFile);

  if (args.includes("--format=json")) {
    console.log(JSON.stringify(analysis, null, 2));
    process.exit(0);
  }

  console.log("================================================================================");
  console.log("InDesign Automation Framework - Empirical Roadblocks & AI Friction Report");
  console.log("================================================================================");

  if (analysis.total === 0) {
    console.log("\n✔ No roadblocks recorded yet! The framework ledger is clean.");
    console.log("Roadblock incidents are automatically captured when prompt:fix or test:fix runs.\n");
    console.log("Ledger file: .framework/telemetry.jsonl");
    console.log("================================================================================\n");
    process.exit(0);
  }

  console.log(`\nTotal Incidents Recorded: ${analysis.total}`);

  console.log("\nTop Failure Modes by Error Code:");
  analysis.byCode.forEach((item, idx) => {
    console.log(`  ${idx + 1}. ${item.code} (${item.count}x / ${item.percentage}%)`);
    console.log(`     Actionable Fix: ${item.suggestion}`);
  });

  console.log("\nFailure Distribution by Domain:");
  analysis.byDomain.forEach((d) => {
    console.log(`  • ${d.domain}: ${d.count} (${d.percentage}%)`);
  });

  console.log(`\nLedger location: ${logFile}`);
  console.log("To clear this log: npm run roadblocks -- --clear");
  console.log("================================================================================\n");
}
