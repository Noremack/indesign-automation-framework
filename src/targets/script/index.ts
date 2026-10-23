import { app } from "indesign";
import { StandardLogger } from "../../adapters/logger";

(function main() {
  const logger = new StandardLogger("ScriptRunner");
  if (app.documents.length === 0) {
    logger.warn("No active document available to run.");
    return;
  }
  logger.info("Script target initialized against document:", { id: app.activeDocument.id });
})();
