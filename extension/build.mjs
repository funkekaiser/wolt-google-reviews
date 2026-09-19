// Bundles the extension into dist/. The Google Maps Embed API key is baked in
// at build time (it is free and usage-capped by Google's own restrictions, so
// shipping it in the extension is expected):
//   GOOGLE_EMBED_KEY=AIza... npm run build
import * as esbuild from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

const embedKey = process.env.GOOGLE_EMBED_KEY ?? "";
const watch = process.argv.includes("--watch");

if (process.argv.includes("--release") && !/^AIza[\w-]{35}$/.test(embedKey)) {
  console.error("Refusing to build a release without a valid GOOGLE_EMBED_KEY.");
  process.exit(1);
}
if (!embedKey) console.warn("Warning: no GOOGLE_EMBED_KEY set; maps will not load.");

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp("static", "dist", { recursive: true });

const ctx = await esbuild.context({
  entryPoints: ["src/content.ts"],
  bundle: true,
  outdir: "dist",
  format: "iife",
  target: "chrome120",
  define: { __EMBED_KEY__: JSON.stringify(embedKey) },
  logLevel: "info",
});

if (watch) await ctx.watch();
else {
  await ctx.rebuild();
  await ctx.dispose();
}
