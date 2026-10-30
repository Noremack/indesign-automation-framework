import { BaseService } from "./base-service";
import { BaseBatchOptions } from "./types";

export interface DocumentMetadata {
  title: string;
  author: string;
  description: string;
  keywords: string[];
  copyrightNotice: string;
  creator: string;
  creationDate: string;
  modificationDate: string;
  language: string;
  pageCount: number;
  extractedAt: string;
}

export interface TableCellNode {
  text: string;
  colSpan: number;
  rowSpan: number;
  isHeader: boolean;
  scope: string;
  align: string;
  styleName: string;
}

export interface TableNode {
  type: "table";
  columnCount: number;
  rowCount: number;
  caption: string;
  headers: TableCellNode[][];
  rows: TableCellNode[][];
}

export interface ParagraphNode {
  type: "paragraph";
  styleName: string;
  text: string;
  rawText: string;
  tag: string;
  exportTag?: string;
  index: number;
  tables?: TableNode[];
}

export interface GraphicNode {
  type: "graphic";
  filePath?: string;
  altText?: string;
  isDecorative?: boolean;
  caption?: string;
}

export interface CompoundNode {
  type: "compound";
  componentType: "callout" | "accordion" | "card" | "statCallout" | string;
  variant?: string;
  title?: string;
  bodyNodes: ParagraphNode[];
  children?: any[];
}

export interface StoryNode {
  type: "story";
  id: string;
  source: string;
  children: (ParagraphNode | TableNode | GraphicNode | CompoundNode)[];
}

export interface ArticleNode {
  type: "article";
  name: string;
  id: string;
  children: StoryNode[];
}

export interface DocumentNode {
  type: "document";
  metadata: DocumentMetadata;
  children: (ArticleNode | StoryNode | ParagraphNode | TableNode | GraphicNode | CompoundNode)[];
}

export interface AstExtractorOptions extends BaseBatchOptions {
  preferArticlesReadingOrder?: boolean;
}

export class QgdsAstExtractorService extends BaseService<AstExtractorOptions, DocumentNode> {
  public override readonly actionName = "QGDS Document AST Extractor";

  protected process(doc: any, options: AstExtractorOptions): DocumentNode {
    // Invariant: Always recompose prior to layout inspections
    doc.recompose();
    const metadata = this.extractMetadata(doc);
    const docNode: DocumentNode = {
      type: "document",
      metadata,
      children: []
    };

    const preferArticles = options.preferArticlesReadingOrder !== false;
    let hasArticles = false;

    // 1. Articles Panel Authored Reading Order Priority
    if (preferArticles && doc.articles && doc.articles.length > 0) {
      try {
        const articles = doc.articles.everyItem ? doc.articles.everyItem().getElements() : doc.articles;
        for (let a = 0; a < articles.length; a++) {
          const art = articles[a];
          if (!art || !art.isValid) continue;

          const artNode: ArticleNode = {
            type: "article",
            name: art.name || `Article ${a + 1}`,
            id: String(art.id || a + 1),
            children: []
          };

          const members = art.articleMembers
            ? art.articleMembers.everyItem
              ? art.articleMembers.everyItem().getElements()
              : art.articleMembers
            : [];

          for (let m = 0; m < members.length; m++) {
            const member = members[m];
            if (!member || !member.isValid) continue;

            const story = member.parentStory || (member.constructor?.name === "Story" ? member : null);
            if (story && story.isValid) {
              const storyNode = this.extractStory(story, String(story.id || m));
              if (storyNode && storyNode.children.length > 0) {
                artNode.children.push(storyNode);
              }
            }
          }

          if (artNode.children.length > 0) {
            docNode.children.push(artNode);
            hasArticles = true;
          }
        }
      } catch (_) {
        hasArticles = false;
      }
    }

    // 2. Hierarchical Spatial Fallback (Spreads -> Pages -> Top-to-Bottom Geometric Sorting)
    if (!hasArticles || docNode.children.length === 0) {
      const stories = this.getStoriesInHierarchicalReadingOrder(doc, options);
      const total = stories.length;
      for (let s = 0; s < total; s++) {
        const story = stories[s];
        this.reportProgress(options, `Extracting story ${s + 1} of ${total}`, s + 1, total);
        try {
          const storyNode = this.extractStory(story, String(story?.id || s));
          if (storyNode && storyNode.children.length > 0) {
            docNode.children.push(storyNode);
          }
        } catch (err: any) {
          if (options.failurePolicy === "strict") throw err;
          // Permissive: continue extracting remaining stories
        }
      }
    }

    doc.recompose();
    return docNode;
  }

  public extractMetadata(doc: any): DocumentMetadata {
    const meta = doc.metadataPreferences;
    const docName = doc.name ? String(doc.name).replace(/\.[^.]+$/, "") : "Queensland Government Publication";

    return {
      title: meta?.documentTitle || docName,
      author: meta?.author || "",
      description: meta?.description || "",
      keywords: meta?.keywords || [],
      copyrightNotice: meta?.copyrightNotice || "",
      creator: meta?.creator || "Queensland Government",
      creationDate: meta?.creationDate || new Date().toISOString().substring(0, 10),
      modificationDate: meta?.modificationDate || new Date().toISOString().substring(0, 10),
      language: "en-AU",
      pageCount: doc.pages?.length || 1,
      extractedAt: new Date().toISOString()
    };
  }

  public getStoriesInHierarchicalReadingOrder(doc: any, _options: AstExtractorOptions): any[] {
    const orderedStories: any[] = [];
    const seenStoryIds = new Set<any>();

    // Memory invariant: Iterate by Spread -> Page hierarchically (never unscoped doc.allPageItems)
    const spreads = doc.spreads ? (doc.spreads.everyItem ? doc.spreads.everyItem().getElements() : doc.spreads) : [];
    for (let sp = 0; sp < spreads.length; sp++) {
      const spread = spreads[sp];
      const pages = spread.pages ? (spread.pages.everyItem ? spread.pages.everyItem().getElements() : spread.pages) : [];
      for (let pg = 0; pg < pages.length; pg++) {
        const page = pages[pg];
        const textFrames = page.textFrames ? (page.textFrames.everyItem ? page.textFrames.everyItem().getElements() : page.textFrames) : [];

        // Sort text frames geometrically: primary top (y1), secondary left (x1)
        const sortedFrames = [...textFrames].sort((a, b) => {
          const bA = a.geometricBounds || [0, 0, 0, 0];
          const bB = b.geometricBounds || [0, 0, 0, 0];
          const diffY = bA[0] - bB[0];
          if (Math.abs(diffY) > 5) return diffY;
          return bA[1] - bB[1];
        });

        for (let f = 0; f < sortedFrames.length; f++) {
          const frame = sortedFrames[f];
          const story = frame.parentStory;
          if (story && story.isValid) {
            const sid = story.id || story;
            if (!seenStoryIds.has(sid)) {
              seenStoryIds.add(sid);
              orderedStories.push(story);
            }
          }
        }
      }
    }

    // If no stories were harvested via pages (e.g. unplaced text or minimalist mock), fallback to doc.stories
    if (orderedStories.length === 0 && doc.stories) {
      const allStories = doc.stories.everyItem ? doc.stories.everyItem().getElements() : doc.stories;
      for (let i = 0; i < allStories.length; i++) {
        orderedStories.push(allStories[i]);
      }
    }

    return orderedStories;
  }

  public extractStory(story: any, storyId: string): StoryNode | null {
    if (!story || !story.isValid) return null;

    const storyNode: StoryNode = {
      type: "story",
      id: storyId,
      source: "normal",
      children: []
    };

    const paragraphs = story.paragraphs ? (story.paragraphs.everyItem ? story.paragraphs.everyItem().getElements() : story.paragraphs) : [];
    for (let p = 0; p < paragraphs.length; p++) {
      const para = paragraphs[p];
      if (!para) continue;

      const styleName = para.appliedParagraphStyle?.name || "[Basic Paragraph]";
      const rawText = para.contents || "";
      const cleanText = String(rawText).replace(/[\r\n\u0003]/g, "").trim();

      // Determine HTML tag mapping
      let tag = "p";
      if (/heading\s*1|h1/i.test(styleName)) tag = "h1";
      else if (/heading\s*2|h2/i.test(styleName)) tag = "h2";
      else if (/heading\s*3|h3/i.test(styleName)) tag = "h3";
      else if (/heading\s*4|h4/i.test(styleName)) tag = "h4";
      else if (/heading\s*5|h5/i.test(styleName)) tag = "h5";
      else if (/heading\s*6|h6/i.test(styleName)) tag = "h6";
      else if (/blockquote/i.test(styleName)) tag = "blockquote";

      const pNode: ParagraphNode = {
        type: "paragraph",
        styleName,
        text: cleanText,
        rawText,
        tag,
        exportTag: tag,
        index: p
      };

      // Extract tables if embedded in this paragraph
      if (para.tables && para.tables.length > 0) {
        const tables = para.tables.everyItem ? para.tables.everyItem().getElements() : para.tables;
        pNode.tables = [];
        for (let t = 0; t < tables.length; t++) {
          const tbl = tables[t];
          const tableNode = this.extractTable(tbl);
          if (tableNode) {
            pNode.tables.push(tableNode);
          }
        }
      }

      storyNode.children.push(pNode);
    }

    return storyNode;
  }

  public extractTable(table: any): TableNode | null {
    if (!table) return null;

    const headerRowCount = table.headerRowCount || 0;
    const bodyRows = table.rows ? (table.rows.everyItem ? table.rows.everyItem().getElements() : table.rows) : [];
    const colCount = table.columns ? table.columns.length : 1;
    const headers: TableCellNode[][] = [];
    const rows: TableCellNode[][] = [];

    for (let r = 0; r < bodyRows.length; r++) {
      const row = bodyRows[r];
      const cells = row.cells ? (row.cells.everyItem ? row.cells.everyItem().getElements() : row.cells) : [];
      const rowDesc: TableCellNode[] = [];
      for (let c = 0; c < cells.length; c++) {
        const cell = cells[c];
        const cellText = (cell.contents || "").trim();
        const isHeader = r < headerRowCount;
        rowDesc.push({
          text: cellText,
          colSpan: cell.columnSpan || 1,
          rowSpan: cell.rowSpan || 1,
          isHeader,
          scope: isHeader ? "col" : "",
          align: "left",
          styleName: cell.appliedCellStyle?.name || ""
        });
      }
      if (r < headerRowCount) {
        headers.push(rowDesc);
      } else {
        rows.push(rowDesc);
      }
    }

    return {
      type: "table",
      columnCount: colCount,
      rowCount: bodyRows.length,
      caption: table.caption || "",
      headers,
      rows
    };
  }
}

