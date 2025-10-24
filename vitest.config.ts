import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      exclude: [
        "**/index.ts", // Barrel export files
        "**/dist/**",  // Built files
        "**/node_modules/**", // Dependencies
        "**/*.config.*", // Config files
        "**/*.d.ts", // Type definitions
      ],
    },
  },
});
