import { BaseService } from "./base-service";
import { BaseBatchOptions } from "./types";

export interface ResetOptions extends BaseBatchOptions {
  resetMasters?: boolean;
  resetTextFrames?: boolean;
  resetStyles?: boolean;
  resetStyleGroups?: boolean;
  resetSwatches?: boolean;
}

export interface ResetReport {
  layersUnlocked: number;
  masterItemsCleared: number;
  textFramesReset: number;
  stylesRemoved: number;
  groupsRemoved: number;
  swatchesRemoved: number;
  skippedCount: number;
  details: string[];
}

/**
 * Safe document sanitization service. Wipes all Brand Engine custom styles,
 * swatches, and master page decorations while protecting user text content
 * and document structure, restoring InDesign default styling.
 */
export class QgdsResetService extends BaseService<ResetOptions, ResetReport> {
  protected actionName = "QGDS Document Sanitization Protocol";

  protected process(doc: any, options: ResetOptions): ResetReport {
    doc.recompose();
    const report: ResetReport = {
      layersUnlocked: 0,
      masterItemsCleared: 0,
      textFramesReset: 0,
      stylesRemoved: 0,
      groupsRemoved: 0,
      swatchesRemoved: 0,
      skippedCount: 0,
      details: []
    };

    // 1. Unlock all document layers
    if (doc.layers) {
      try {
        const layers = doc.layers.everyItem ? doc.layers.everyItem().getElements() : doc.layers;
        for (let l = 0; l < layers.length; l++) {
          const layer = layers[l];
          if (layer && layer.isValid && layer.locked) {
            try {
              if (!options.dryRun) layer.locked = false;
              report.layersUnlocked++;
            } catch (_) {}
          }
        }
        report.details.push(`Unlocked ${report.layersUnlocked} locked layer(s).`);
      } catch (err: any) {
        if (options.failurePolicy === "strict") throw err;
        report.skippedCount++;
      }
    }

    // 2. Clear master page decorations on A-Cover, B-Content, C-Back
    if (options.resetMasters !== false && doc.masterSpreads) {
      try {
        const masters = doc.masterSpreads.everyItem ? doc.masterSpreads.everyItem().getElements() : doc.masterSpreads;
        for (let m = 0; m < masters.length; m++) {
          const master = masters[m];
          if (!master || !master.isValid) continue;

          // 1. Clear spread-level items
          const spreadItems = master.pageItems ? (master.pageItems.everyItem ? master.pageItems.everyItem().getElements() : master.pageItems) : [];
          for (let j = spreadItems.length - 1; j >= 0; j--) {
            const item = spreadItems[j];
            if (item && item.isValid) {
              try {
                if (item.itemLayer && item.itemLayer.isValid && item.itemLayer.locked && !options.dryRun) {
                  item.itemLayer.locked = false;
                }
                if (item.locked && !options.dryRun) item.locked = false;
                if (!options.dryRun) item.remove();
                report.masterItemsCleared++;
              } catch (_) {}
            }
          }

          // 2. Clear page-level items on all master pages
          const mPages = master.pages ? (master.pages.everyItem ? master.pages.everyItem().getElements() : master.pages) : [];
          for (let p = 0; p < mPages.length; p++) {
            const mp = mPages[p];
            if (!mp || !mp.isValid) continue;
            const pItems = mp.pageItems ? (mp.pageItems.everyItem ? mp.pageItems.everyItem().getElements() : mp.pageItems) : [];
            for (let pi = pItems.length - 1; pi >= 0; pi--) {
              const item = pItems[pi];
              if (item && item.isValid) {
                try {
                  if (item.itemLayer && item.itemLayer.isValid && item.itemLayer.locked && !options.dryRun) {
                    item.itemLayer.locked = false;
                  }
                  if (item.locked && !options.dryRun) item.locked = false;
                  if (!options.dryRun) item.remove();
                  report.masterItemsCleared++;
                } catch (_) {}
              }
            }
          }
        }
        report.details.push(`Cleared ${report.masterItemsCleared} decoration item(s) from master spreads.`);
      } catch (err: any) {
        if (options.failurePolicy === "strict") throw err;
        report.skippedCount++;
      }
    }

    // 3. Reassign text frames to [Basic Paragraph] and clear overrides
    if (options.resetTextFrames !== false) {
      try {
        const basicPara = doc.paragraphStyles?.itemByName("[Basic Paragraph]");
        const frames: any[] = [];

        if (doc.pages) {
          const pages = doc.pages.everyItem ? doc.pages.everyItem().getElements() : doc.pages;
          for (let p = 0; p < pages.length; p++) {
            const page = pages[p];
            if (page && page.isValid && page.textFrames) {
              const tfs = page.textFrames.everyItem ? page.textFrames.everyItem().getElements() : page.textFrames;
              frames.push(...tfs);
            }
          }
        }
        if (frames.length === 0 && doc.textFrames) {
          const tfs = doc.textFrames.everyItem ? doc.textFrames.everyItem().getElements() : doc.textFrames;
          frames.push(...tfs);
        }

        for (let i = 0; i < frames.length; i++) {
          const frame = frames[i];
          if (!frame || !frame.isValid) continue;

          try {
            if (basicPara && basicPara.isValid && !options.dryRun) {
              if (typeof frame.applyParagraphStyle === "function") {
                frame.applyParagraphStyle(basicPara, true);
              } else if (frame.parentStory) {
                frame.parentStory.appliedParagraphStyle = basicPara;
              }
            }
            if (typeof frame.clearOverrides === "function" && !options.dryRun) {
              frame.clearOverrides();
            }
            report.textFramesReset++;
          } catch (_) {}
        }
        report.details.push(`Reassigned ${report.textFramesReset} text frame(s) to [Basic Paragraph].`);
      } catch (err: any) {
        if (options.failurePolicy === "strict") throw err;
        report.skippedCount++;
      }
    }

    // 4. Remove custom styles (including inside style groups)
    if (options.resetStyles !== false) {
      try {
        // Paragraph styles
        if (doc.paragraphStyles) {
          const pStyles = doc.paragraphStyles.everyItem ? doc.paragraphStyles.everyItem().getElements() : doc.paragraphStyles;
          for (let p = pStyles.length - 1; p >= 0; p--) {
            const st = pStyles[p];
            if (st && st.isValid && st.name !== "[No Paragraph Style]" && st.name !== "[Basic Paragraph]") {
              try {
                if (!options.dryRun) st.remove();
                report.stylesRemoved++;
              } catch (_) {}
            }
          }
        }

        if (doc.paragraphStyleGroups) {
          const groups = doc.paragraphStyleGroups.everyItem ? doc.paragraphStyleGroups.everyItem().getElements() : doc.paragraphStyleGroups;
          for (let g = 0; g < groups.length; g++) {
            const grp = groups[g];
            if (grp && grp.isValid && grp.paragraphStyles) {
              const nested = grp.paragraphStyles.everyItem ? grp.paragraphStyles.everyItem().getElements() : grp.paragraphStyles;
              for (let np = nested.length - 1; np >= 0; np--) {
                const nst = nested[np];
                if (nst && nst.isValid) {
                  try {
                    if (!options.dryRun) nst.remove();
                    report.stylesRemoved++;
                  } catch (_) {}
                }
              }
            }
          }
        }

        // Character styles
        if (doc.characterStyles) {
          const cStyles = doc.characterStyles.everyItem ? doc.characterStyles.everyItem().getElements() : doc.characterStyles;
          for (let c = cStyles.length - 1; c >= 0; c--) {
            const st = cStyles[c];
            if (st && st.isValid && st.name !== "[None]") {
              try {
                if (!options.dryRun) st.remove();
                report.stylesRemoved++;
              } catch (_) {}
            }
          }
        }

        if (doc.characterStyleGroups) {
          const groups = doc.characterStyleGroups.everyItem ? doc.characterStyleGroups.everyItem().getElements() : doc.characterStyleGroups;
          for (let g = 0; g < groups.length; g++) {
            const grp = groups[g];
            if (grp && grp.isValid && grp.characterStyles) {
              const nested = grp.characterStyles.everyItem ? grp.characterStyles.everyItem().getElements() : grp.characterStyles;
              for (let nc = nested.length - 1; nc >= 0; nc--) {
                const nst = nested[nc];
                if (nst && nst.isValid) {
                  try {
                    if (!options.dryRun) nst.remove();
                    report.stylesRemoved++;
                  } catch (_) {}
                }
              }
            }
          }
        }

        // Object styles
        if (doc.objectStyles) {
          const oStyles = doc.objectStyles.everyItem ? doc.objectStyles.everyItem().getElements() : doc.objectStyles;
          for (let o = oStyles.length - 1; o >= 0; o--) {
            const st = oStyles[o];
            if (st && st.isValid && st.name !== "[None]" && !st.name.startsWith("[Basic")) {
              try {
                if (!options.dryRun) st.remove();
                report.stylesRemoved++;
              } catch (_) {}
            }
          }
        }

        // Table & Cell styles
        if (doc.tableStyles) {
          const tStyles = doc.tableStyles.everyItem ? doc.tableStyles.everyItem().getElements() : doc.tableStyles;
          for (let t = tStyles.length - 1; t >= 0; t--) {
            const st = tStyles[t];
            if (st && st.isValid && st.name !== "[Basic Table]" && st.name !== "[No Table Style]") {
              try {
                if (!options.dryRun) st.remove();
                report.stylesRemoved++;
              } catch (_) {}
            }
          }
        }

        if (doc.cellStyles) {
          const cellStyles = doc.cellStyles.everyItem ? doc.cellStyles.everyItem().getElements() : doc.cellStyles;
          for (let cs = cellStyles.length - 1; cs >= 0; cs--) {
            const st = cellStyles[cs];
            if (st && st.isValid && st.name !== "[None]") {
              try {
                if (!options.dryRun) st.remove();
                report.stylesRemoved++;
              } catch (_) {}
            }
          }
        }

        report.details.push(`Purged ${report.stylesRemoved} custom style definition(s).`);
      } catch (err: any) {
        if (options.failurePolicy === "strict") throw err;
        report.skippedCount++;
      }
    }

    // 5. Purge empty style groups
    if (options.resetStyleGroups !== false) {
      try {
        const groupCollections = [
          doc.paragraphStyleGroups,
          doc.characterStyleGroups,
          doc.objectStyleGroups,
          doc.tableStyleGroups,
          doc.cellStyleGroups
        ];

        for (const coll of groupCollections) {
          if (!coll) continue;
          const groups = coll.everyItem ? coll.everyItem().getElements() : coll;
          for (let g = groups.length - 1; g >= 0; g--) {
            const grp = groups[g];
            if (grp && grp.isValid) {
              try {
                if (!options.dryRun) grp.remove();
                report.groupsRemoved++;
              } catch (_) {}
            }
          }
        }
        report.details.push(`Purged ${report.groupsRemoved} style group(s).`);
      } catch (err: any) {
        if (options.failurePolicy === "strict") throw err;
        report.skippedCount++;
      }
    }

    // 6. Purge custom brand swatches while preserving built-ins
    if (options.resetSwatches !== false && doc.swatches) {
      try {
        const keepSwatches = ["[None]", "[Registration]", "[Paper]", "[Black]", "None", "Registration", "Paper", "Black"];
        const swatches = doc.swatches.everyItem ? doc.swatches.everyItem().getElements() : doc.swatches;

        for (let s = swatches.length - 1; s >= 0; s--) {
          const sw = swatches[s];
          if (!sw || !sw.isValid) continue;

          if (!keepSwatches.includes(sw.name)) {
            try {
              if (!options.dryRun) sw.remove();
              report.swatchesRemoved++;
            } catch (_) {}
          }
        }
        report.details.push(`Purged ${report.swatchesRemoved} custom swatch(es).`);
      } catch (err: any) {
        if (options.failurePolicy === "strict") throw err;
        report.skippedCount++;
      }
    }

    if (options.dryRun) {
      report.details.push("[DryRun] Simulation completed: no changes made to active publication");
    }

    return report;
  }
}
