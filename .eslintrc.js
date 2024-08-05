module.exports = {
  env: { node: true },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 10,
    project: ["./tsconfig.json"],
    sourceType: "module",
    tsConfigRootDir: __dirname,
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier",
  ],
  ignorePatterns: ["coverage", "dist", "test/__test", "typings", ".eslintrc.js"],
  rules: {
    "comma-dangle": ["error", "always-multiline"],
    "dot-notation": ["error"],
    "max-classes-per-file": ["error", 1],
    "max-len": ["warn", { code: 120 }],
    "no-console": "error",
    "@typescript-eslint/naming-convention": [
      "warn",
      {
        selector: "interface",
        format: ["PascalCase"],
        prefix: ["T"],
        custom: {
          regex: "^I[A-Z]",
          match: false,
        },
      },
    ],
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        vars: "all",
        args: "all",
        argsIgnorePattern: "^_",
      },
    ],
    "@typescript-eslint/no-unsafe-member-access": "off",
  },
  overrides: [
    {
      files: ["test/**/*"],
      env: { mocha: true },
      extends: ["plugin:mocha/recommended"],
      parserOptions: { project: "test/tsconfig.json" },
      plugins: ["mocha"],
      rules: {
        "@typescript-eslint/ban-ts-ignore": "off",
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/unbound-method": "off",
        "@typescript-eslint/no-empty-function": "off",
        "dot-notation": ["off"],
        "mocha/no-hooks-for-single-case": "off",
      },
    },
  ],
};
