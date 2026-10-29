import { app } from "indesign";
import { StandardLogger } from "../../adapters/logger";
import { NativeDialog } from "../../adapters/native-dialog";

(function main() {
  const logger = new StandardLogger("ScriptRunner");
  if (!app.documents || app.documents.length === 0) {
    logger.warn("No active document available to run.");
    NativeDialog.showInDesignAlert(
      "InDesign Automation",
      [
        "No active document found.",
        "",
        "Please open or create an InDesign document (.indd) before running this script."
      ]
    );
    return;
  }

  const doc = app.activeDocument;
  logger.info("Script target initialized against document:", { id: doc.id });
  NativeDialog.showInDesignAlert(
    "InDesign Automation",
    [
      `Script target initialized successfully!`,
      "",
      `Target Document: "${doc.name}"`,
      `Document ID: ${doc.id}`
    ]
  );
})();
