#!/usr/bin/env node
import fs from "fs";
import path from "path";
import os from "os";

function getInDesignBaseDir() {
  const home = os.homedir();
  if (process.platform === "win32") {
    const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");
    return path.join(appData, "Adobe", "InDesign");
  } else if (process.platform === "darwin") {
    return path.join(home, "Library", "Preferences", "Adobe InDesign");
  }
  return null;
}

function findScriptPanelDirs() {
  const baseDir = getInDesignBaseDir();
  if (!baseDir || !fs.existsSync(baseDir)) {
    return [];
  }

  const results = [];
  const versionDirs = fs.readdirSync(baseDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith("Version "))
    .map(d => d.name)
    .sort((a, b) => {
      const vA = parseFloat(a.replace("Version ", ""));
      const vB = parseFloat(b.replace("Version ", ""));
      return vB - vA; // Highest version first
    });

  for (const vDir of versionDirs) {
    const versionPath = path.join(baseDir, vDir);
    const subEntries = fs.readdirSync(versionPath, { withFileTypes: true })
      .filter(d => d.isDirectory());

    for (const localeDir of subEntries) {
      const scriptsPanelPath = path.join(versionPath, localeDir.name, "Scripts", "Scripts Panel");
      if (fs.existsSync(scriptsPanelPath)) {
        results.push({
          version: vDir,
          locale: localeDir.name,
          path: scriptsPanelPath
        });
      }
    }
  }

  return results;
}

export function linkToHost({ targetScriptDir = "dist/scripts", linkName = "InDesignAutomation" } = {}) {
  const scriptDirs = findScriptPanelDirs();

  if (scriptDirs.length === 0) {
    console.warn("No InDesign Scripts Panel directories found on this system.");
    console.log("Expected location:");
    console.log(`  ${getInDesignBaseDir() || "OS not supported for auto-discovery"}`);
    return false;
  }

  const resolvedSource = path.resolve(targetScriptDir);
  if (!fs.existsSync(resolvedSource)) {
    fs.mkdirSync(resolvedSource, { recursive: true });
  }

  console.log(`Discovered ${scriptDirs.length} InDesign installation(s):`);

  let successCount = 0;

  for (const info of scriptDirs) {
    const destination = path.join(info.path, linkName);

    try {
      if (fs.existsSync(destination)) {
        const stat = fs.lstatSync(destination);
        if (stat.isSymbolicLink()) {
          fs.unlinkSync(destination);
        } else if (stat.isDirectory()) {
          // If already a directory junction or folder
          fs.rmSync(destination, { recursive: true, force: true });
        }
      }

      // On Windows, use 'junction' which does not require administrative privileges
      const linkType = process.platform === "win32" ? "junction" : "dir";
      fs.symlinkSync(resolvedSource, destination, linkType);

      console.log(`  ✓ Linked: InDesign ${info.version} (${info.locale})`);
      console.log(`    ↳ ${destination} -> ${resolvedSource}`);
      successCount++;
    } catch (err) {
      console.error(`  ✗ Failed linking to ${info.version}: ${err.message}`);
    }
  }

  if (successCount > 0) {
    console.log(`\nSuccessfully linked ${successCount} host environment(s)!`);
    console.log("Your compiled scripts in dist/scripts will now appear immediately inside InDesign's Scripts Panel.");
    return true;
  }

  return false;
}

// CLI Execution
if (process.argv[1] && (process.argv[1].endsWith("link-host.mjs") || process.argv[1].endsWith("link-host"))) {
  linkToHost();
}
