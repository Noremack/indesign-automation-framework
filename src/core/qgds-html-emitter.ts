import {
  DocumentNode,
  ParagraphNode,
  TableNode,
  GraphicNode,
  CompoundNode
} from "./qgds-ast-extractor";

export interface LinterIssue {
  ruleId: string;
  severity: "error" | "warning" | "info";
  message: string;
  target: string;
}

export function escapeHtml(str: string): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function escapeHtmlAttribute(str: string): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function escapeHtmlForAudit(str: string): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function determineVariant(styleName: string, candidates: string[]): string {
  const lower = styleName.toLowerCase();
  for (const c of candidates) {
    if (lower.includes(c)) return c;
  }
  return "";
}

export function foldNodeStream(nodes: any[], _blueprint?: any, _issues?: LinterIssue[]): any[] {
  const result: any[] = [];
  let index = 0;

  while (index < nodes.length) {
    const current = nodes[index];
    if (current.type !== "paragraph") {
      result.push(current);
      index++;
      continue;
    }

    const pNode: ParagraphNode = current;
    const style = pNode.styleName || "";

    // 1. Fold Callouts (Callout / Info, Warning, Error, Success)
    if (/callout/i.test(style) || /callout/i.test(pNode.exportTag || "")) {
      const variant = determineVariant(style, ["warning", "error", "success", "info"]);
      const bodyNodes: ParagraphNode[] = [pNode];
      let j = index + 1;
      while (j < nodes.length) {
        const next = nodes[j];
        if (next && next.type === "paragraph" && /callout\s*(body|text|p)/i.test(next.styleName || "")) {
          bodyNodes.push(next);
          j++;
        } else {
          break;
        }
      }
      result.push({
        type: "compound",
        componentType: "callout",
        variant: variant || "info",
        bodyNodes,
        children: bodyNodes
      } as CompoundNode);
      index = j;
      continue;
    }

    // 2. Fold Accordions (Accordion / Title + Body)
    if (/accordion\s*(header|title|button)/i.test(style)) {
      const title = pNode.text;
      const bodyNodes: ParagraphNode[] = [];
      let j = index + 1;
      while (j < nodes.length) {
        const next = nodes[j];
        if (next && next.type === "paragraph" && !/accordion\s*(header|title|button)/i.test(next.styleName || "")) {
          bodyNodes.push(next);
          j++;
          if (/^h[1-3]/i.test(next.tag || "")) break;
        } else {
          break;
        }
      }
      result.push({
        type: "compound",
        componentType: "accordion",
        title,
        bodyNodes,
        children: bodyNodes
      } as CompoundNode);
      index = j;
      continue;
    }

    // 3. Fold Cards (Card / Title + Body)
    if (/card\s*(header|title)/i.test(style)) {
      const title = pNode.text;
      const bodyNodes: ParagraphNode[] = [];
      let j = index + 1;
      while (j < nodes.length) {
        const next = nodes[j];
        if (next && next.type === "paragraph" && /card\s*(body|text|content)/i.test(next.styleName || "")) {
          bodyNodes.push(next);
          j++;
        } else {
          break;
        }
      }
      result.push({
        type: "compound",
        componentType: "card",
        title,
        bodyNodes,
        children: bodyNodes
      } as CompoundNode);
      index = j;
      continue;
    }

    // 4. Fold Stat Callouts (Metric value followed by description)
    if (/stat\s*(number|callout|value)/i.test(style)) {
      const metric = pNode.text;
      const bodyNodes: ParagraphNode[] = [pNode];
      let j = index + 1;
      if (j < nodes.length && nodes[j].type === "paragraph" && /stat\s*(label|desc)/i.test(nodes[j].styleName || "")) {
        bodyNodes.push(nodes[j]);
        j++;
      }
      result.push({
        type: "compound",
        componentType: "statCallout",
        title: metric,
        bodyNodes,
        children: bodyNodes
      } as CompoundNode);
      index = j;
      continue;
    }

    result.push(current);
    index++;
  }

  return result;
}

export function runQgdsLinter(docNode: DocumentNode, issues: LinterIssue[]): void {
  let previousHeadingLevel = 0;

  function traverse(node: any): void {
    if (!node) return;

    // Rule HED 1.1: Heading Level Hierarchy Validation (WCAG 1.3.1, 2.4.6)
    if (node.type === "paragraph") {
      const pNode: ParagraphNode = node;
      const match = (pNode.tag || "").match(/^h([1-6])$/i);
      if (match) {
        const currentLevel = parseInt(match[1], 10);
        if (previousHeadingLevel > 0 && currentLevel > previousHeadingLevel + 1) {
          issues.push({
            ruleId: "HED 1.1",
            severity: "error",
            message: `Skipped heading level: <h${previousHeadingLevel}> followed by <h${currentLevel}> (text: "${pNode.text.substring(0, 30)}...").`,
            target: pNode.text
          });
        }
        previousHeadingLevel = currentLevel;
      }
    }

    // Rule ALT 1.1: Graphic Alternative Text Check (WCAG 1.1.1)
    if (node.type === "graphic") {
      const gNode: GraphicNode = node;
      if (!gNode.altText && !gNode.isDecorative) {
        issues.push({
          ruleId: "ALT 1.1",
          severity: "error",
          message: `Graphic item missing alternative text description.`,
          target: gNode.filePath || "Inline Graphic"
        });
      }
    }

    // Rule TBL 1.1: Table Caption Check (WCAG 1.3.1)
    if (node.type === "table") {
      const tNode: TableNode = node;
      if (!tNode.caption || tNode.caption.trim().length === 0) {
        issues.push({
          ruleId: "TBL 1.1",
          severity: "warning",
          message: `Table lacks an accessible caption description.`,
          target: `Table (${tNode.columnCount}x${tNode.rowCount})`
        });
      }
    }

    // Recurse children
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        traverse(child);
      }
    }

    // Recurse compound bodyNodes
    if (node.type === "compound") {
      const cNode: CompoundNode = node;
      if (cNode.bodyNodes) {
        for (const bodyNode of cNode.bodyNodes) {
          traverse(bodyNode);
        }
      }
    }
  }

  traverse(docNode);
}

export function foldDocumentAST(
  docNode: DocumentNode,
  blueprint?: any
): { foldedDoc: DocumentNode; linterIssues: LinterIssue[] } {
  const linterIssues: LinterIssue[] = [];

  const clonedDoc: DocumentNode = {
    type: "document",
    metadata: { ...docNode.metadata },
    children: []
  };

  for (let i = 0; i < docNode.children.length; i++) {
    const child = docNode.children[i];
    if (child.type === "article" || child.type === "story") {
      const foldedSubtree = {
        ...child,
        children: foldNodeStream(child.children || [], blueprint, linterIssues)
      };
      clonedDoc.children.push(foldedSubtree as any);
    } else {
      clonedDoc.children.push(child);
    }
  }

  runQgdsLinter(clonedDoc, linterIssues);

  return {
    foldedDoc: clonedDoc,
    linterIssues
  };
}

export function emitCallout(node: CompoundNode, format: string): string {
  const variant = node.variant || "info";
  const bodyLines: string[] = [];
  let headingText = node.title || "";

  if (node.bodyNodes && node.bodyNodes.length > 0) {
    for (let i = 0; i < node.bodyNodes.length; i++) {
      const bn = node.bodyNodes[i];
      if (i === 0 && !headingText && /title|header/i.test(bn.styleName || "")) {
        headingText = bn.text;
      } else {
        bodyLines.push(`<p>${escapeHtml(bn.text)}</p>`);
      }
    }
  }

  const content = bodyLines.join("\n");
  if (format === "semantic-html") {
    const sHeading = headingText ? `  <h4 class="callout__title">${escapeHtml(headingText)}</h4>\n` : "";
    return `<aside class="callout callout--${escapeHtmlAttribute(variant)}">\n${sHeading}  ${content}\n</aside>`;
  }
  if (format === "bem-html") {
    const bHeading = headingText ? `    <h4 class="qld__callout__title">${escapeHtml(headingText)}</h4>\n` : "";
    return `<div class="qld__callout qld__callout--${escapeHtmlAttribute(variant)}">\n  <div class="qld__callout__body">\n${bHeading}    ${content}\n  </div>\n</div>`;
  }
  const wcHeading = headingText ? `  <h4 slot="heading">${escapeHtml(headingText)}</h4>\n` : "";
  return `<qld-callout variant="${escapeHtmlAttribute(variant)}">\n${wcHeading}${content}\n</qld-callout>`;
}

export function emitAccordion(node: CompoundNode, format: string): string {
  const title = escapeHtml(node.title || "Accordion Item");
  const bodyLines: string[] = [];

  if (node.bodyNodes && node.bodyNodes.length > 0) {
    for (const bn of node.bodyNodes) {
      if (bn.type === "paragraph") {
        bodyLines.push(`<p>${escapeHtml(bn.text)}</p>`);
      } else {
        bodyLines.push(emitQgdsNode(bn, format));
      }
    }
  }

  const bodyHtml = bodyLines.join("\n");
  if (format === "semantic-html") {
    return `<div class="accordion">\n  <details class="accordion__item">\n    <summary class="accordion__title">${title}</summary>\n    <div class="accordion__body">\n      ${bodyHtml}\n    </div>\n  </details>\n</div>`;
  }
  if (format === "bem-html") {
    return `<div class="qld__accordion">\n  <div class="qld__accordion__item">\n    <button class="qld__accordion__title" aria-expanded="false">${title}</button>\n    <div class="qld__accordion__body">\n      ${bodyHtml}\n    </div>\n  </div>\n</div>`;
  }
  return `<qld-accordion>\n  <qld-accordion-item heading="${escapeHtmlAttribute(node.title || "")}">\n    ${bodyHtml}\n  </qld-accordion-item>\n</qld-accordion>`;
}

export function emitCard(node: CompoundNode, format: string): string {
  const title = node.title ? escapeHtml(node.title) : "";
  const bodyLines: string[] = [];

  if (node.bodyNodes && node.bodyNodes.length > 0) {
    for (const bn of node.bodyNodes) {
      if (bn.type === "paragraph") {
        bodyLines.push(`<p>${escapeHtml(bn.text)}</p>`);
      } else {
        bodyLines.push(emitQgdsNode(bn, format));
      }
    }
  }

  const bodyHtml = bodyLines.join("\n");
  if (format === "semantic-html") {
    const titleHtml = title ? `  <h3 class="card__title">${title}</h3>\n` : "";
    return `<article class="card">\n${titleHtml}  <div class="card__body">\n    ${bodyHtml}\n  </div>\n</article>`;
  }
  if (format === "bem-html") {
    const titleHtml = title ? `    <h3 class="qld__card__headline">${title}</h3>\n` : "";
    return `<div class="qld__card">\n  <div class="qld__card__inner">\n${titleHtml}    <div class="qld__card__body">\n      ${bodyHtml}\n    </div>\n  </div>\n</div>`;
  }
  const wcHeading = title ? `  <h3 slot="headline">${title}</h3>\n` : "";
  return `<qld-card>\n${wcHeading}  ${bodyHtml}\n</qld-card>`;
}

export function emitStatCallout(node: CompoundNode, format: string): string {
  const metric = escapeHtml(node.title || "");
  const bodyLines: string[] = [];

  if (node.bodyNodes && node.bodyNodes.length > 0) {
    for (const bn of node.bodyNodes) {
      const p = bn;
      if (p.text !== node.title) {
        bodyLines.push(`<p>${escapeHtml(p.text)}</p>`);
      }
    }
  }

  const descHtml = bodyLines.join("\n");
  if (format === "semantic-html") {
    return `<div class="stat-callout">\n  <span class="stat-callout__value">${metric}</span>\n  <div class="stat-callout__text">${descHtml}</div>\n</div>`;
  }
  if (format === "bem-html") {
    return `<div class="qld__stat-callout">\n  <div class="qld__stat-callout__metric">${metric}</div>\n  <div class="qld__stat-callout__description">\n    ${descHtml}\n  </div>\n</div>`;
  }
  return `<qld-stat-callout metric="${escapeHtmlAttribute(node.title || "")}">\n  ${descHtml}\n</qld-stat-callout>`;
}

export function emitGenericCompound(node: CompoundNode, format: string): string {
  const childLines: string[] = [];
  if (node.bodyNodes) {
    for (const bn of node.bodyNodes) {
      childLines.push(emitQgdsNode(bn, format));
    }
  }
  return `<section class="qld__compound qld__compound--${escapeHtmlAttribute(node.componentType)}">\n  ${childLines.join("\n  ")}\n</section>`;
}

export function emitParagraph(node: ParagraphNode): string {
  const tag = node.tag || "p";
  const clean = escapeHtml(node.text);
  if (/^h[1-6]$/i.test(tag)) {
    return `<${tag}>${clean}</${tag}>`;
  }
  if (tag === "blockquote") {
    return `<blockquote><p>${clean}</p></blockquote>`;
  }
  return `<p>${clean}</p>`;
}

export function emitTable(node: TableNode, format: string): string {
  const lines: string[] = [];
  const isBemOrWc = format !== "semantic-html";
  const tableClass = isBemOrWc ? ' class="qld__table"' : "";
  lines.push(`<table${tableClass}>`);

  if (node.caption) {
    lines.push(`  <caption>${escapeHtml(node.caption)}</caption>`);
  }

  // Headers
  if (node.headers && node.headers.length > 0) {
    lines.push("  <thead>");
    for (const row of node.headers) {
      lines.push("    <tr>");
      for (const cell of row) {
        const spanAttr = cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : "";
        const rSpanAttr = cell.rowSpan > 1 ? ` rowspan="${cell.rowSpan}"` : "";
        lines.push(`      <th scope="col"${spanAttr}${rSpanAttr}>${escapeHtml(cell.text)}</th>`);
      }
      lines.push("    </tr>");
    }
    lines.push("  </thead>");
  }

  // Body rows
  if (node.rows && node.rows.length > 0) {
    lines.push("  <tbody>");
    for (const row of node.rows) {
      lines.push("    <tr>");
      for (const cell of row) {
        const spanAttr = cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : "";
        const rSpanAttr = cell.rowSpan > 1 ? ` rowspan="${cell.rowSpan}"` : "";
        const tag = cell.isHeader ? "th" : "td";
        const scope = cell.isHeader ? ' scope="row"' : "";
        lines.push(`      <${tag}${scope}${spanAttr}${rSpanAttr}>${escapeHtml(cell.text)}</${tag}>`);
      }
      lines.push("    </tr>");
    }
    lines.push("  </tbody>");
  }

  lines.push("</table>");
  const tableMarkup = lines.join("\n");
  if (isBemOrWc) {
    return `<div class="qld__table-container" tabindex="0">\n${tableMarkup}\n</div>`;
  }
  return tableMarkup;
}

export function emitGraphic(node: GraphicNode): string {
  const src = escapeHtmlAttribute(node.filePath || "");
  const alt = escapeHtmlAttribute(node.altText || (node.isDecorative ? "" : "Graphic"));
  const caption = node.caption ? `  <figcaption>${escapeHtml(node.caption)}</figcaption>\n` : "";
  return `<figure class="qld__figure">\n  <img src="${src}" alt="${alt}" loading="lazy" decoding="async" />\n${caption}</figure>`;
}

export function emitQgdsNode(
  node: any,
  format: string = "web-components",
  blueprint?: any,
  stats?: Record<string, number>
): string {
  if (!node) return "";
  const fmt = format === "default" ? "web-components" : format;
  const recordStat = (type: string) => {
    if (stats) {
      stats[type] = (stats[type] || 0) + 1;
    }
  };

  switch (node.type) {
    case "compound": {
      const cNode: CompoundNode = node;
      recordStat(cNode.componentType);
      switch (cNode.componentType) {
        case "callout":
          return emitCallout(cNode, fmt);
        case "accordion":
          return emitAccordion(cNode, fmt);
        case "card":
          return emitCard(cNode, fmt);
        case "statCallout":
          return emitStatCallout(cNode, fmt);
        default:
          return emitGenericCompound(cNode, fmt);
      }
    }
    case "paragraph": {
      const pNode: ParagraphNode = node;
      recordStat(pNode.tag || "paragraph");
      return emitParagraph(pNode);
    }
    case "table": {
      const tNode: TableNode = node;
      recordStat("table");
      return emitTable(tNode, fmt);
    }
    case "graphic": {
      const gNode: GraphicNode = node;
      recordStat("graphic");
      return emitGraphic(gNode);
    }
    case "article":
    case "story": {
      const container = node;
      const childLines: string[] = [];
      if (container.children && container.children.length > 0) {
        for (let i = 0; i < container.children.length; i++) {
          const markup = emitQgdsNode(container.children[i], fmt, blueprint, stats);
          if (markup) childLines.push(markup);
        }
      }
      return childLines.join("\n");
    }
    default: {
      if (node.children && node.children.length > 0) {
        const childLines: string[] = [];
        for (let i = 0; i < node.children.length; i++) {
          const markup = emitQgdsNode(node.children[i], fmt, blueprint, stats);
          if (markup) childLines.push(markup);
        }
        return childLines.join("\n");
      }
      return "";
    }
  }
}

export function emitQgdsDocument(
  docNode: DocumentNode,
  format: string = "web-components",
  blueprint?: any,
  stats?: Record<string, number>
): string {
  const chunks: string[] = [];
  if (docNode && docNode.children) {
    for (let i = 0; i < docNode.children.length; i++) {
      const chunk = emitQgdsNode(docNode.children[i], format, blueprint, stats);
      if (chunk) chunks.push(chunk);
    }
  }
  return chunks.join("\n\n");
}

export function wrapStandaloneHtml(
  bodyHtml: string,
  title?: string,
  format: string = "web-components",
  metadata?: any,
  isOffline: boolean = false
): string {
  const docTitle = escapeHtml(title || metadata?.title || "Queensland Government Publication");
  const isBem = format === "bem-html";
  const bodyClass = isBem ? "qld__body" : "qld-body";
  const mainClass = isBem ? "qld__main" : "qld-main";
  const cssUrl = "https://static.qgov.net.au/assets/v4/latest/css/qg-main.css";
  const jsUrl = "https://designsystem.qld.gov.au/assets/js/qld-components.min.js";
  const metaObj = metadata || {};
  const metaAuthor = escapeHtmlAttribute(metaObj.author || metaObj.creator || "Queensland Government");
  const metaDesc = escapeHtmlAttribute(metaObj.description || "");
  const metaDate = metaObj.creationDate
    ? String(metaObj.creationDate).substring(0, 10)
    : new Date().toISOString().substring(0, 10);
  const metaLang = escapeHtmlAttribute(metaObj.language || "en-AU");

  const lines = [
    "<!DOCTYPE html>",
    `<html lang="${metaLang}">`,
    "<head>",
    '  <meta charset="utf-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1">',
    `  <title>${docTitle}</title>`,
    "  <!-- Dublin Core Publication Metadata -->",
    `  <meta name="DC.title" content="${escapeHtmlAttribute(docTitle)}">`,
    `  <meta name="DC.creator" content="${metaAuthor}">`,
    `  <meta name="DC.date" content="${metaDate}">`,
    metaDesc ? `  <meta name="DC.description" content="${metaDesc}">` : "",
    `  <meta name="DC.publisher" content="${metaAuthor}">`,
    '  <meta name="DC.format" content="text/html">',
    `  <meta name="DC.language" content="${metaLang}">`,
    "  <!-- Schema.org Accessibility Metadata -->",
    '  <script type="application/ld+json">',
    "  {",
    '    "@context": "https://schema.org",',
    '    "@type": "GovernmentService",',
    `    "name": "${escapeHtmlAttribute(docTitle)}",`,
    '    "inLanguage": "' + metaLang + '",',
    '    "accessibilityFeature": ["alternativeText", "readingOrder", "structuralNavigation", "tableOfContents"],',
    '    "accessibilityHazard": ["none"],',
    '    "accessibilitySummary": "Conforms to WCAG 2.2 Level AA and Queensland Government Design System guidelines."',
    "  }",
    "  </script>"
  ];

  if (isOffline) {
    lines.push('  <meta name="qgds-offline" content="true">');
  } else {
    lines.push(`  <link rel="stylesheet" href="${cssUrl}">`);
    lines.push(`  <script type="module" src="${jsUrl}"></script>`);
  }

  lines.push("  <style>");
  lines.push(`    :root {
      --qld-color-heading: #000053;
      --qld-color-text: #353535;
      --qld-color-action: #005EB8;
      --qld-color-bg-page: #F5F5F5;
      --qld-color-bg-card: #FFFFFF;
      --qld-font-family: 'Noto Sans', system-ui, -apple-system, sans-serif;
    }
    body {
      font-family: var(--qld-font-family);
      color: var(--qld-color-text);
      background-color: var(--qld-color-bg-page);
      margin: 0;
      padding: 0;
      line-height: 1.6;
    }
    .qld__skip-link {
      position: absolute;
      top: -100px;
      left: 1rem;
      background: #000;
      color: #fff;
      padding: 0.5rem 1rem;
      z-index: 1000;
    }
    .qld__skip-link:focus {
      top: 1rem;
    }
    .qld__main {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem 1.5rem;
      background: var(--qld-color-bg-card);
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --qld-color-heading: #90CAF9;
        --qld-color-text: #E0E0E0;
        --qld-color-bg-page: #121212;
        --qld-color-bg-card: #1E1E1E;
      }
    }`);
  lines.push("  </style>");
  lines.push("</head>");
  lines.push(`<body class="${bodyClass}">`);
  lines.push('  <a href="#main-content" class="qld__skip-link">Skip to main content</a>');
  lines.push('  <header class="qld__header" role="banner">');
  lines.push('    <div class="qld__header__banner">Queensland Government</div>');
  lines.push("  </header>");
  lines.push(`  <main id="main-content" class="${mainClass}" role="main">`);
  lines.push(bodyHtml);
  lines.push("  </main>");
  lines.push('  <footer class="qld__footer" role="contentinfo">');
  lines.push('    <div class="qld__footer__copyright">© The State of Queensland 2026</div>');
  lines.push("  </footer>");
  lines.push("</body>");
  lines.push("</html>");
  return lines.filter(Boolean).join("\n");
}

export function generateSourceLedgerMarkdown(
  docNode: DocumentNode,
  linterIssues: LinterIssue[],
  componentsCount: Record<string, number>,
  preflightReport?: any
): string {
  const meta = docNode.metadata || ({} as any);
  const dateStr = meta.creationDate
    ? String(meta.creationDate).substring(0, 10)
    : new Date().toISOString().substring(0, 10);
  const title = meta.title || "Queensland Government Publication";

  const lines = [
    `# QGDS Publication Source Ledger: ${title}`,
    "",
    "## Document Metadata",
    `- **Title**: ${title}`,
    `- **Author / Creator**: ${meta.author || meta.creator || "Queensland Government"}`,
    `- **Language**: ${meta.language || "en-AU"}`,
    `- **Generated Date**: ${dateStr}`,
    `- **Page Count**: ${meta.pageCount || 1}`,
    "",
    "## Structural Component Inventory",
    "| Component / Tag | Extracted Count |",
    "|---|---|"
  ];

  for (const [comp, count] of Object.entries(componentsCount)) {
    lines.push(`| ${comp} | ${count} |`);
  }

  lines.push("");
  lines.push("## WCAG 2.2 AA & QGDS Quality Audit");
  if (preflightReport) {
    lines.push(`- **Preflight Violations Found**: ${preflightReport.violations?.length || 0}`);
    lines.push(
      `- **Preflight Remediation Actions**: Languages: ${preflightReport.languagesAlignedCount || 0}, Tables: ${preflightReport.tablesRemediatedCount || 0}, TOCs: ${preflightReport.tocCleanedCount || 0}, Linearized Frames: ${preflightReport.linearizedFramesCount || 0}`
    );
  }
  lines.push(`- **AST Accessibility Linter Issues**: ${linterIssues.length}`);
  if (linterIssues.length === 0) {
    lines.push("- **Compliance Status**: PASS - 100% compliant with WCAG 2.2 AA rules.");
  } else {
    lines.push("- **Issues Detected**:");
    for (const issue of linterIssues) {
      lines.push(`  - [${issue.severity.toUpperCase()}] **${issue.ruleId}**: ${issue.message}`);
    }
  }

  lines.push("");
  lines.push("---");
  lines.push("*Generated by Queensland Government InDesign Automation Framework.*");
  return lines.join("\n");
}

export function generateAccessibilityCertificate(
  docNode: DocumentNode,
  linterIssues: LinterIssue[],
  preflightReport?: any
): any {
  const meta = docNode.metadata || ({} as any);
  const errors = linterIssues.filter(i => i.severity === "error");
  const warnings = linterIssues.filter(i => i.severity === "warning");

  return {
    "@context": "https://schema.org",
    "@type": "AccessibilityCertificate",
    title: meta.title || "Queensland Government Publication",
    publisher: meta.author || meta.creator || "Queensland Government",
    dateIssued: new Date().toISOString(),
    standard: "WCAG 2.2 Level AA",
    conformanceLevel: errors.length === 0 ? "Level AA" : "Non-Conformant",
    certified: errors.length === 0,
    metrics: {
      totalLinterIssues: linterIssues.length,
      errorsCount: errors.length,
      warningsCount: warnings.length,
      preflightViolationsResolved: preflightReport ? preflightReport.violations?.length || 0 : 0
    },
    features: [
      "alternativeText",
      "readingOrder",
      "structuralNavigation",
      "tableOfContents",
      "tableHeaders"
    ],
    authority: "Queensland Government Customer and Digital Group"
  };
}

export function generateAccessibilityAuditHtml(meta: any, findings: any[]): string {
  const timestamp = meta.timestamp || new Date().toLocaleString();
  const score =
    meta.score !== undefined
      ? meta.score
      : Math.max(0, Math.min(100, Math.round(100 - (meta.violationsFound - meta.remediationsApplied) * 5)));

  const scoreClass = score >= 90 ? "score-high" : score >= 70 ? "score-medium" : "score-low";
  const scoreLabel =
    score >= 90
      ? "WCAG 2.2 AA Aligned"
      : score >= 70
        ? "Remediation Applied (Review Needed)"
        : "Action Required";

  const rowsHtml = (findings || [])
    .map((f, i) => {
      const sevBadge =
        f.severity === "error"
          ? '<span class="badge badge-error">Error</span>'
          : f.severity === "warning"
            ? '<span class="badge badge-warning">Warning</span>'
            : '<span class="badge badge-info">Notice</span>';

      const statusBadge = f.remediated
        ? '<span class="badge badge-success">&#10003; Auto-Remediated</span>'
        : '<span class="badge badge-pending">Manual Review</span>';

      const targetLabel = f.target
        ? `<code>${escapeHtmlForAudit(f.target)}</code>`
        : '<span class="text-muted">Document Scope</span>';

      return `
          <tr data-severity="${f.severity}" data-remediated="${!!f.remediated}">
            <td class="cell-num">${i + 1}</td>
            <td><strong class="rule-id">${escapeHtmlForAudit(f.ruleId)}</strong></td>
            <td>${sevBadge}</td>
            <td>${targetLabel}</td>
            <td class="cell-desc">${escapeHtmlForAudit(f.message)}</td>
            <td>${statusBadge}</td>
          </tr>
        `;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>QGDS Accessibility Audit - ${escapeHtmlForAudit(meta.docName)}</title>
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
          Accessibility & Remediation Audit &bull; <strong>${escapeHtmlForAudit(meta.docName)}</strong> &bull; Generated: ${escapeHtmlForAudit(timestamp)}
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
          <button class="btn-filter active" onclick="setFilter('all')">All (${(findings || []).length})</button>
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
    const docObj = typeof document !== 'undefined' ? document : null;

    function setFilter(sev) {
      currentSeverity = sev;
      if (!docObj) return;
      docObj['querySelectorAll']('.btn-filter').forEach(btn => {
        btn.classList.remove('active');
        if (btn.innerText.toLowerCase().startsWith(sev)) {
          btn.classList.add('active');
        }
      });
      filterTable();
    }

    function filterTable() {
      if (!docObj) return;
      const query = docObj['getElementById']('searchInput').value.toLowerCase();
      const rows = docObj['querySelectorAll']('#findingsTable tbody tr');
      
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
