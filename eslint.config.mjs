import js from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettierConfig from "eslint-config-prettier";
import mochaPlugin from "eslint-plugin-mocha";
import { globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  globalIgnores(["**/coverage", "**/dist", "test/__test", "**/typings", "**/.eslintrc.js", "eslint.config.mjs"]),
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  prettierConfig,
  mochaPlugin.configs.recommended,
  {
    plugins: { "@stylistic": stylistic },

    languageOptions: {
      ecmaVersion: 10,
      globals: { ...globals.node },
      parser: tsParser,
      parserOptions: { project: ["./tsconfig.json"], tsConfigRootDir: import.meta.dirname },
      sourceType: "commonjs",
    },

    rules: {
      "dot-notation": ["error"],
      "max-classes-per-file": ["error", 1],
      "no-console": "error",

      "@stylistic/comma-dangle": ["error", "always-multiline"],
      "@stylistic/max-len": ["warn", { code: 120 }],
      "@stylistic/quotes": ["warn", "double", { allowTemplateLiterals: "always", avoidEscape: true }],

      "@typescript-eslint/naming-convention": [
        "warn",
        {
          custom: { regex: "^I[A-Z]", match: false },
          format: ["PascalCase"],
          // prefix: ["T"],
          selector: "interface",
        },
      ],

      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { vars: "all", args: "all", argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-unsafe-member-access": "off",
    },
  },
  {
    files: ["test/**/*"],

    plugins: { mocha: mochaPlugin },

    languageOptions: {
      globals: { ...globals.mocha },

      ecmaVersion: 5,
      sourceType: "commonjs",

      parserOptions: { project: "test/tsconfig.json", tsConfigRootDir: import.meta.dirname },
    },

    rules: {
      "dot-notation": ["off"],
      "mocha/no-hooks-for-single-case": "off",
      "@typescript-eslint/ban-ts-ignore": "off",
      "@typescript-eslint/dot-notation": ["off"],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/unbound-method": "off",
    },
  },
);
