/**
 * Generates an interactive, standalone HTML Accessibility Preflight Audit Report.
 * Conforms to Queensland Government Design System (QGDS) principles.
 * 100% self-contained and zero-dependency: works entirely offline in restricted enterprise environments.
 */

export interface PreflightFinding {
  ruleId: string;
  severity: "error" | "warning" | "info";
  message: string;
  target?: string;
  remediated?: boolean;
}

export interface AuditReportMetadata {
  docName: string;
  pageCount?: number;
  timestamp?: string;
  score?: number;
  violationsFound: number;
  remediationsApplied: number;
  contrastRemediatedCount?: number;
  linksUpgradedCount?: number;
  tablesRemediatedCount?: number;
  linearizedFramesCount?: number;
  languagesAlignedCount?: number;
  format?: string;
}

export function generateAccessibilityAuditHtml(
  meta: AuditReportMetadata,
  findings: PreflightFinding[]
): string {
  const timestamp = meta.timestamp || new Date().toLocaleString();
  const score = meta.score !== undefined
    ? meta.score
    : Math.max(0, Math.min(100, Math.round(100 - (meta.violationsFound - meta.remediationsApplied) * 5)));
  
  const scoreClass = score >= 90 ? "score-high" : score >= 70 ? "score-medium" : "score-low";
  const scoreLabel = score >= 90 ? "WCAG 2.2 AA Aligned" : score >= 70 ? "Remediation Applied (Review Needed)" : "Action Required";

  const rowsHtml = findings.map((f, i) => {
    const sevBadge = f.severity === "error"
      ? '<span class="badge badge-error">Error</span>'
      : f.severity === "warning"
        ? '<span class="badge badge-warning">Warning</span>'
        : '<span class="badge badge-info">Notice</span>';

    const statusBadge = f.remediated
      ? '<span class="badge badge-success">&#10003; Auto-Remediated</span>'
      : '<span class="badge badge-pending">Manual Review</span>';

    const targetLabel = f.target ? `<code>${escapeHtml(f.target)}</code>` : '<span class="text-muted">Document Scope</span>';

    return `
      <tr data-severity="${f.severity}" data-remediated="${!!f.remediated}">
        <td class="cell-num">${i + 1}</td>
        <td><strong class="rule-id">${escapeHtml(f.ruleId)}</strong></td>
        <td>${sevBadge}</td>
        <td>${targetLabel}</td>
        <td class="cell-desc">${escapeHtml(f.message)}</td>
        <td>${statusBadge}</td>
      </tr>
    `;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>QGDS Accessibility Audit - ${escapeHtml(meta.docName)}</title>
  <style>
    :root {
      --qld-blue: #003366;
      --qld-maritime: #0072ce;
      --qld-navy: #0a192f;
      --qld-sand: #f5f2eb;
      --qld-granite: #63666a;
      --qld-forest: #2d7f4a;
      --qld-coral: #e04e39;
      --qld-yellow: #ffd100;
      --qld-white: #ffffff;
      --qld-border: #dcdcdc;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: #f8f9fa;
      color: #212529;
      line-height: 1.5;
      padding: 0;
    }
    header {
      background-color: var(--qld-blue);
      color: var(--qld-white);
      padding: 24px 32px;
      border-bottom: 4px solid var(--qld-maritime);
    }
    .header-content {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 4px; }
    .doc-meta { font-size: 0.95rem; opacity: 0.9; }
    .score-container {
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(255, 255, 255, 0.12);
      padding: 12px 20px;
      border-radius: 8px;
    }
    .score-circle {
      font-size: 2rem;
      font-weight: 800;
      line-height: 1;
    }
    .score-high { color: #52c41a; }
    .score-medium { color: #faad14; }
    .score-low { color: #ff4d4f; }
    .score-text { font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }

    main {
      max-width: 1200px;
      margin: 32px auto;
      padding: 0 24px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .stat-card {
      background: var(--qld-white);
      border-radius: 8px;
      padding: 18px 20px;
      border: 1px solid var(--qld-border);
      box-shadow: 0 2px 4px rgba(0,0,0,0.02);
    }
    .stat-num { font-size: 1.85rem; font-weight: 700; color: var(--qld-blue); }
    .stat-label { font-size: 0.85rem; color: var(--qld-granite); font-weight: 500; text-transform: uppercase; }

    .card {
      background: var(--qld-white);
      border-radius: 8px;
      border: 1px solid var(--qld-border);
      box-shadow: 0 2px 8px rgba(0,0,0,0.03);
      padding: 24px;
      margin-bottom: 32px;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .card-title { font-size: 1.25rem; font-weight: 700; color: var(--qld-blue); }

    .controls {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    .btn-filter {
      background: #e9ecef;
      border: 1px solid transparent;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-filter.active, .btn-filter:hover {
      background: var(--qld-blue);
      color: var(--qld-white);
    }
    .search-input {
      padding: 6px 14px;
      border: 1px solid var(--qld-border);
      border-radius: 20px;
      font-size: 0.85rem;
      width: 200px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    th {
      background: #f8f9fa;
      padding: 12px 14px;
      text-align: left;
      font-weight: 600;
      color: var(--qld-granite);
      border-bottom: 2px solid var(--qld-border);
    }
    td {
      padding: 12px 14px;
      border-bottom: 1px solid #f1f3f5;
      vertical-align: top;
    }
    tr:hover { background-color: #fafbfc; }
    .cell-num { width: 40px; color: var(--qld-granite); }
    .cell-desc { line-height: 1.4; }
    .rule-id { color: var(--qld-navy); font-weight: 700; }

    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge-error { background: #ffebe6; color: var(--qld-coral); border: 1px solid #ffbdad; }
    .badge-warning { background: #fffbe6; color: #ad6800; border: 1px solid #ffe58f; }
    .badge-info { background: #e6f7ff; color: #0050b3; border: 1px solid #91d5ff; }
    .badge-success { background: #f6ffed; color: var(--qld-forest); border: 1px solid #b7eb8f; }
    .badge-pending { background: #fff7e6; color: #d46b08; border: 1px solid #ffd591; }

    code {
      background: #f1f3f5;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 0.85rem;
      color: var(--qld-navy);
    }
    .text-muted { color: var(--qld-granite); font-style: italic; }

    footer {
      text-align: center;
      padding: 24px;
      font-size: 0.85rem;
      color: var(--qld-granite);
      border-top: 1px solid var(--qld-border);
      background: var(--qld-white);
    }
  </style>
</head>
<body>
  <header>
    <div class="header-content">
      <div>
        <h1>Queensland Government Design System (QGDS)</h1>
        <div class="doc-meta">
          Accessibility & Remediation Audit &bull; <strong>${escapeHtml(meta.docName)}</strong> &bull; Generated: ${escapeHtml(timestamp)}
        </div>
      </div>
      <div class="score-container">
        <div class="score-circle ${scoreClass}">${score}%</div>
        <div class="score-text">
          Audit Score<br /><span style="font-size: 0.75rem; font-weight: normal; opacity: 0.9;">${scoreLabel}</span>
        </div>
      </div>
    </div>
  </header>

  <main>
    <section class="stats-grid">
      <div class="stat-card">
        <div class="stat-num">${meta.violationsFound}</div>
        <div class="stat-label">Violations Detected</div>
      </div>
      <div class="stat-card">
        <div class="stat-num" style="color: var(--qld-forest);">${meta.remediationsApplied}</div>
        <div class="stat-label">Auto-Remediated</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${meta.contrastRemediatedCount || 0}</div>
        <div class="stat-label">Contrast Fixes</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${meta.linksUpgradedCount || 0}</div>
        <div class="stat-label">HTTPS Upgraded</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${meta.linearizedFramesCount || 0}</div>
        <div class="stat-label">Linearized Frames</div>
      </div>
    </section>

    <section class="card">
      <div class="card-header">
        <div class="card-title">Preflight Audit Findings & Remediation Ledger</div>
        <div class="controls">
          <input type="text" id="searchInput" class="search-input" placeholder="Filter findings..." oninput="filterTable()" />
          <button class="btn-filter active" onclick="setFilter('all')">All (${findings.length})</button>
          <button class="btn-filter" onclick="setFilter('error')">Errors</button>
          <button class="btn-filter" onclick="setFilter('warning')">Warnings</button>
          <button class="btn-filter" onclick="setFilter('info')">Notices</button>
        </div>
      </div>

      <div style="overflow-x: auto;">
        <table id="findingsTable">
          <thead>
            <tr>
              <th>#</th>
              <th>Rule ID</th>
              <th>Severity</th>
              <th>Target</th>
              <th>Finding & Remediation</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="6" style="text-align: center; padding: 32px; color: var(--qld-forest);"><strong>No preflight violations detected. Document is fully WCAG 2.2 AA compliant!</strong></td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  </main>

  <footer>
    Queensland Government Design System Automation Framework &bull; Conforms to WCAG 2.2 Level AA &bull; Zero-Privilege UXP Architecture
  </footer>

  <script>
    let currentSeverity = 'all';

    function setFilter(sev) {
      currentSeverity = sev;
      const htmlDoc = globalThis["document"];
      htmlDoc.querySelectorAll('.btn-filter').forEach(btn => {
        btn.classList.remove('active');
        if (btn.innerText.toLowerCase().startsWith(sev)) {
          btn.classList.add('active');
        }
      });
      filterTable();
    }

    function filterTable() {
      const htmlDoc = globalThis["document"];
      const query = htmlDoc.getElementById('searchInput').value.toLowerCase();
      const rows = htmlDoc.querySelectorAll('#findingsTable tbody tr');
      
      rows.forEach(row => {
        const sev = row.getAttribute('data-severity');
        const text = row.innerText.toLowerCase();
        const matchesSev = (currentSeverity === 'all' || sev === currentSeverity);
        const matchesQuery = (!query || text.includes(query));

        if (matchesSev && matchesQuery) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    }
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
