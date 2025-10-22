import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: false, // good for debugging
  minify: true, // optional, can enable for browser use
  clean: true,
  target: "es2020",
  splitting: false, // no code-splitting needed for Node library
  outDir: "dist", // base folder
  esbuildOptions: (options, ctx) => {
    if (ctx.format === "cjs") {
      options.outdir = "dist/cjs"; // CJS goes here
    } else if (ctx.format === "esm") {
      options.outdir = "dist/esm"; // ESM goes here
    }
  },
});
