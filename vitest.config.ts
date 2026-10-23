import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      indesign: path.resolve(__dirname, "tests/mocks/indesign-mock.ts")
    }
  },
  test: {
    environment: "node"
  }
});