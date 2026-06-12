import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["eslint.config.mjs"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      globals: globals.node,
      sourceType: "module"
    }
  },
  {
    files: ["assets/**/*.js"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      globals: globals.browser,
      sourceType: "script"
    },
    rules: {
      "no-unused-vars": ["error", {
        caughtErrors: "all",
        caughtErrorsIgnorePattern: "^_"
      }]
    }
  },
  {
    files: ["api/**/*.js", "core/**/*.js", "tests/**/*.js"],
    plugins: { js },
    extends: ["js/recommended"],
    languageOptions: {
      globals: globals.node,
      sourceType: "commonjs"
    },
    rules: {
      "no-unused-vars": ["error", {
        caughtErrors: "all",
        caughtErrorsIgnorePattern: "^_"
      }]
    }
  }
]);
