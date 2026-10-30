import { BaseService } from "./base-service";
import { isElementEditable } from "./app-state";
import { BaseBatchOptions } from "./types";
import { DomResolver } from "./dom-resolver";
import { withFindChangeScope } from "./find-change-scope";
import { QGDS_ABBREVIATIONS, QGDS_LEGISLATION_ACTS } from "./qgds-lexicons";

export interface SemanticEditorialOptions extends BaseBatchOptions {
  abbreviationDictionary?: any;
  abbreviations?: any;
  legislationDictionary?: any;
  legislationActs?: any;
  enforceHeadingFullName?: boolean;
  expandFirstOccurrence?: boolean;
  styleLegislationActs?: boolean;
  applyLegislationItalics?: boolean;
  wholeWordOnly?: boolean;
  caseSensitive?: boolean;
}

export interface SemanticEditorialReport {
  storiesScanned: number;
  acronymsExpanded: number;
  actsStyled: number;
  headingsAudited: number;
  headingViolationsFound: number;
  skippedCount: number;
  details: string[];
}

export interface AbbreviationEntry {
  expansions: string[];
  enabled: boolean;
}

export function loadAbbreviationMappings(rawJson: any): Record<string, AbbreviationEntry> {
  if (!rawJson) {
    const fallback: Record<string, AbbreviationEntry> = {};
    for (const [k, v] of Object.entries(QGDS_ABBREVIATIONS)) {
      fallback[k] = { expansions: [v], enabled: true };
    }
    return fallback;
  }
  const result: Record<string, AbbreviationEntry> = {};
  const target = rawJson.abbreviations || rawJson;
  for (const key of Object.keys(target)) {
    const val = target[key];
    if (typeof val === "string") {
      result[key] = { expansions: [val], enabled: true };
    } else if (typeof val === "object" && val !== null) {
      const expList: string[] = [];
      if (Array.isArray(val.expansions)) {
        expList.push(...val.expansions);
      } else if (typeof val.expansion === "string") {
        expList.push(val.expansion);
      }
      result[key] = {
        expansions: expList,
        enabled: val.enabled !== false
      };
    }
  }
  if (Object.keys(result).length > 0) return result;

  const fallback: Record<string, AbbreviationEntry> = {};
  for (const [k, v] of Object.entries(QGDS_ABBREVIATIONS)) {
    fallback[k] = { expansions: [v], enabled: true };
  }
  return fallback;
}

export function loadLegislationMappings(rawJson: any): string[] {
  const defaultActs = Object.keys(QGDS_LEGISLATION_ACTS);
  if (!rawJson) return defaultActs;
  if (Array.isArray(rawJson)) {
    return rawJson.map(item => (typeof item === "string" ? item : item.name || item.title || "")).filter(Boolean);
  }
  if (Array.isArray(rawJson.acts)) {
    return rawJson.acts.map((item: any) => (typeof item === "string" ? item : item.name || item.title || "")).filter(Boolean);
  }
  if (Array.isArray(rawJson.legislation)) {
    return rawJson.legislation.map((item: any) => (typeof item === "string" ? item : item.name || item.title || "")).filter(Boolean);
  }
  return defaultActs;
}

export class QgdsSemanticEditorialService extends BaseService<SemanticEditorialOptions, SemanticEditorialReport> {
  public override readonly actionName = "QGDS Semantic Editorial Styler";

  protected process(doc: any, options: SemanticEditorialOptions): SemanticEditorialReport {
    const report: SemanticEditorialReport = {
      storiesScanned: 0,
      acronymsExpanded: 0,
      actsStyled: 0,
      headingsAudited: 0,
      headingViolationsFound: 0,
      skippedCount: 0,
      details: []
    };

    doc.recompose();

    const abbreviations = options.abbreviationDictionary
      ? loadAbbreviationMappings(options.abbreviationDictionary)
      : options.abbreviations
        ? loadAbbreviationMappings(options.abbreviations)
        : loadAbbreviationMappings(null);

    const acts = options.legislationDictionary
      ? loadLegislationMappings(options.legislationDictionary)
      : options.legislationActs
        ? loadLegislationMappings(options.legislationActs)
        : loadLegislationMappings(null);

    const enforceHeadings = options.enforceHeadingFullName !== false;
    const expandFirst = options.expandFirstOccurrence !== false;
    const styleActs = options.styleLegislationActs !== false;
    const wholeWord = options.wholeWordOnly !== false;
    const caseSensitive = options.caseSensitive !== false;

    const stories = doc.stories
      ? (doc.stories.everyItem ? doc.stories.everyItem().getElements() : doc.stories)
      : [];
    const totalStories = stories.length;

    const expandedTerms = new Set<string>();

    withFindChangeScope("TEXT", () => {
      for (let s = 0; s < totalStories; s++) {
        const story = stories[s];
        this.reportProgress(options, `Auditing story ${s + 1} of ${totalStories}`, s + 1, totalStories);

        try {
          if (!isElementEditable(story)) {
            report.skippedCount++;
            continue;
          }

          report.storiesScanned++;
          const storyContents = story.contents || "";

          // 1. Heading Editorial Auditing (Headings must spell out names in full, never lone abbreviations)
          if (enforceHeadings && story.paragraphs) {
            const paragraphs = story.paragraphs.everyItem
              ? story.paragraphs.everyItem().getElements()
              : story.paragraphs;

            for (let p = 0; p < paragraphs.length; p++) {
              const para = paragraphs[p];
              const styleName = para.appliedParagraphStyle?.name || "";
              const isHeading = /heading|title|h[1-6]/i.test(styleName);

              if (isHeading) {
                report.headingsAudited++;
                const pText = para.contents || "";

                for (const abbr of Object.keys(abbreviations)) {
                  const flags = caseSensitive ? "" : "i";
                  const boundary = wholeWord ? `\\b${abbr}\\b` : abbr;
                  const reg = new RegExp(boundary, flags);

                  if (reg.test(pText)) {
                    report.headingViolationsFound++;
                    report.details.push(
                      `Heading violation in "${styleName}": lone acronym "${abbr}" found. Headings must spell out names in full.`
                    );
                  }
                }
              }
            }
          }

          // 2. First-occurrence acronym expansion
          if (expandFirst && !options.dryRun) {
            for (const [abbr, entry] of Object.entries(abbreviations)) {
              if (!entry.enabled || expandedTerms.has(abbr)) continue;
              const expansion = entry.expansions && entry.expansions.length > 0 ? entry.expansions[0] : "";
              if (!expansion) continue;

              const flags = caseSensitive ? "" : "i";
              const boundary = wholeWord ? `\\b${abbr}\\b` : abbr;
              const pattern = new RegExp(boundary, flags);
              const alreadyPattern = new RegExp(`${expansion}\\s*\\(${abbr}\\)`, flags);

              if (pattern.test(storyContents) && !alreadyPattern.test(storyContents)) {
                const replacement = `${expansion} (${abbr})`;
                story.contents = story.contents.replace(pattern, replacement);
                expandedTerms.add(abbr);
                report.acronymsExpanded++;
                report.details.push(`Expanded first occurrence: "${abbr}" -> "${replacement}".`);
              }
            }
          } else if (expandFirst && options.dryRun) {
            for (const [abbr, entry] of Object.entries(abbreviations)) {
              if (!entry.enabled || expandedTerms.has(abbr)) continue;
              const flags = caseSensitive ? "" : "i";
              const boundary = wholeWord ? `\\b${abbr}\\b` : abbr;
              const pattern = new RegExp(boundary, flags);

              if (pattern.test(storyContents)) {
                expandedTerms.add(abbr);
                report.acronymsExpanded++;
                report.details.push(`[Dry Run] Would expand first occurrence of "${abbr}".`);
              }
            }
          }

          // 3. Queensland Legislation Acts Styling
          if (styleActs) {
            for (const act of acts) {
              if (storyContents.indexOf(act) !== -1) {
                report.actsStyled++;
                report.details.push(`Identified legislation Act "${act}" for editorial styling.`);
                if (options.applyLegislationItalics && !options.dryRun && doc.characterStyles) {
                  let italicStyle = DomResolver.getCharacterStyleSafely(doc, "Legislation Italic");
                  if (!italicStyle || !italicStyle.isValid) {
                    try {
                      italicStyle = doc.characterStyles.add({
                        name: "Legislation Italic",
                        fontStyle: "Italic"
                      });
                    } catch (_) {}
                  }
                }
              }
            }
          }
        } catch (err: any) {
          if (options.failurePolicy === "strict") throw err;
          report.skippedCount++;
          report.details.push(`Error auditing story ${s + 1}: ${err.message || String(err)}`);
        }
      }
    });

    return report;
  }
}
