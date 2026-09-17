const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const prettierConfig = require("eslint-config-prettier/flat");

module.exports = defineConfig([
  {
    ignores: ["dist/**", ".expo/**", ".pnpm-store/**", "node_modules/**"],
  },
  expoConfig,
  {
    linterOptions: {
      reportUnusedDisableDirectives: "error",
    },
  },
  prettierConfig,
]);
