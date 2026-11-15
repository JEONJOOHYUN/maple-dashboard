import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Untouched third-party originals (reference only, not built).
    "vendor/**",
    // The weekly Sunday model job's local Python environment and outputs (git-ignored).
    "scripts/sunday-ml/.venv/**",
    "scripts/sunday-ml/out/**",
  ]),
]);

export default eslintConfig;
