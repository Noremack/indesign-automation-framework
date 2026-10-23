import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import fs from "fs";

const config = JSON.parse(
  fs.readFileSync(new URL("./app.config.json", import.meta.url), "utf8")
);

const target = process.env.TARGET || "all";

const builds = [];

if (target === "all" || target === "script") {
  builds.push({
    input: config.mainScript,
    output: {
      file: `dist/scripts/${config.name}.idjs`,
      format: "cjs",
      exports: "auto",
      sourcemap: true
    },
    external: ["indesign", "uxp", "fs"],
    plugins: [
      resolve(),
      commonjs(),
      typescript({ tsconfig: "./tsconfig.json" })
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
    external: ["indesign", "uxp", "fs"],
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
    external: ["indesign", "uxp", "fs"],
    plugins: [
      resolve(),
      commonjs(),
      typescript({ tsconfig: "./tsconfig.json" })
    ]
  });
}

export default builds;
