import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sunday OCR (lib/sunday/ocr.ts): loads OpenCV.js + onnxruntime-node at runtime, keep it unbundled.
  serverExternalPackages: ["ppu-paddle-ocr"],
  // onnxruntime_binding.node loads libonnxruntime.so through the OS loader, which file tracing
  // cannot see. Without this the Cron function fails on Vercel (Linux x64).
  outputFileTracingIncludes: {
    "/api/cron/sunday": ["./node_modules/onnxruntime-node/bin/napi-v6/linux/x64/libonnxruntime.so.1"],
  },
  turbopack: {
    // box2d-wasm (pinball) has Emscripten code that requires fs / path only when it runs in Node.
    resolveAlias: {
      fs: { browser: "./lib/empty-module.ts" },
      path: { browser: "./lib/empty-module.ts" },
    },
  },
};

export default nextConfig;
