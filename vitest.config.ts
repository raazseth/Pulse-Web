import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "jsdom",
    coverage: {
      provider: "v8",
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
      },
      exclude: [
        "src/app/providers/theme.ts",
        "src/**/*.d.ts",
        "src/**/*.config.*",
        "src/app/routes.tsx",
        "src/app/main.tsx",
      ],
    },
  },
});
