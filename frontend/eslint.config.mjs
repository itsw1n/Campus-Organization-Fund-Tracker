import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Treat a leading underscore as "deliberately unused". Needed for
      // parameters that exist to satisfy an interface but aren't read yet,
      // and for intentionally discarded destructured values.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated from the deployed contract by `stellar contract bindings
    // typescript`. Linting it is pointless -- every complaint would be fixed
    // by hand and then wiped out by the next regeneration.
    "src/contracts/**",
  ]),
]);

export default eslintConfig;
