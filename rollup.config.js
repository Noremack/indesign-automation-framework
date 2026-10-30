import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import fs from "fs";
import path from "path";

const config = JSON.parse(
  fs.readFileSync(new URL("./app.config.json", import.meta.url), "utf8")
);

const target = process.env.TARGET || "all";

const builds = [];

function syncToHostPlugin(scriptName) {
  return {
    name: "sync-to-host",
    writeBundle(_options, bundle) {
      const baseDir = "C:/Users/Noremac/AppData/Roaming/Adobe/InDesign";
      const versions = ["Version 18.0", "Version 19.0", "Version 20.0", "Version 21.0"];
      for (const [fileName, fileInfo] of Object.entries(bundle)) {
        if (fileName.endsWith(".idjs")) {
          const content = fileInfo.type === "chunk" ? fileInfo.code : fileInfo.source;
          if (content) {
            for (const v of versions) {
              const spDir = path.join(baseDir, v, "en_US", "Scripts", "Scripts Panel");
              if (fs.existsSync(spDir)) {
                const dest1 = path.join(spDir, `${scriptName}.idjs`);
                fs.writeFileSync(dest1, content, "utf8");
                if (scriptName === "InDesignQGDSPublishingSuite") {
                  const dest2 = path.join(spDir, "InDesign QGDS Publishing Suite.idjs");
                  fs.writeFileSync(dest2, content, "utf8");
                }
                console.log(`  ✓ Synced ${scriptName}.idjs to: ${dest1}`);
              }
            }
          }
        }
      }
    }
  };
}

if (target === "all" || target === "script") {
  builds.push({
    input: config.mainScript,
    output: {
      file: `dist/scripts/${config.name}.idjs`,
      format: "cjs",
      exports: "auto",
      sourcemap: true,
      banner: "(function () {\n'use strict';\n",
      footer: "\n})();\n"
    },
    external: ["indesign", "uxp", "fs", "path", "os"],
    plugins: [
      resolve(),
      commonjs(),
      typescript({ tsconfig: "./tsconfig.json" }),
      syncToHostPlugin(config.name)
    ]
  });
}

if (target === "all" || target === "suite") {
  builds.push({
    input: "src/targets/suite/index.ts",
    output: {
      file: "dist/scripts/InDesignQGDSPublishingSuite.idjs",
      format: "cjs",
      exports: "auto",
      sourcemap: true,
      banner: "(function () {\n'use strict';\n",
      footer: "\n})();\n"
    },
    external: ["indesign", "uxp", "fs", "path", "os"],
    plugins: [
      resolve(),
      commonjs(),
      typescript({ tsconfig: "./tsconfig.json" }),
      syncToHostPlugin("InDesignQGDSPublishingSuite")
    ]
  });
}

function uxpManifestPlugin() {
  return {
    name: "uxp-manifest",
    generateBundle() {
      const manifest = {
        manifestVersion: 5,
        id: config.id,
        name: config.name,
        version: config.version,
        description: config.description,
        main: "index.js",
        host: [
          {
            app: "ID",
            minVersion: "18.0"
          }
        ],
        entrypoints: [
          {
            type: "panel",
            id: "mainPanel",
            name: `${config.name} Panel`,
            main: "index.js"
          }
        ],
        requiredPermissions: config.permissions || {}
      };

      this.emitFile({
        type: "asset",
        fileName: "manifest.json",
        source: JSON.stringify(manifest, null, 2)
      });
    }
  };
}

if (target === "all" || target === "plugin") {
  builds.push({
    input: config.mainPlugin,
    output: {
      file: `dist/plugins/${config.name}/index.js`,
      format: "cjs",
      exports: "auto",
      sourcemap: true
    },
    external: ["indesign", "uxp", "fs", "path", "os"],
    plugins: [
      resolve(),
      commonjs(),
      typescript({ tsconfig: "./tsconfig.json" }),
      uxpManifestPlugin()
    ]
  });
}

if (target === "all" || target === "lib") {
  builds.push({
    input: "src/index.ts",
    output: [
      {
        file: "dist/index.cjs",
        format: "cjs",
        exports: "named",
        sourcemap: true
      },
      {
        file: "dist/index.js",
        format: "esm",
        sourcemap: true
      }
    ],
    external: ["indesign", "uxp", "fs", "path", "os"],
    plugins: [
      resolve(),
      commonjs(),
      typescript({ tsconfig: "./tsconfig.json" })
    ]
  });
}

export default builds;
