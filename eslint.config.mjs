import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypescript,
  globalIgnores([
    ".next/**",
    ".vitepress/**",
    "coverage/**",
    "docs/.vitepress/cache/**",
    "docs/.vitepress/dist/**",
    "node_modules/**"
  ])
]);
