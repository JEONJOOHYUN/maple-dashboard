import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // box2d-wasm (pinball) has Emscripten code that requires fs / path only when it runs in Node.
    resolveAlias: {
      fs: { browser: "./lib/empty-module.ts" },
      path: { browser: "./lib/empty-module.ts" },
    },
  },
};

export default nextConfig;
