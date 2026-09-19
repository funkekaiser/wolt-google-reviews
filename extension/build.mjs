// Bundles the extension into dist/. The API base URL is baked in at build time:
//   API_BASE=https://wolt-google-reviews.<you>.workers.dev npm run build
import * as esbuild from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const apiBase = (process.env.API_BASE ?? "http://localhost:8787").replace(/\/+$/, "");
const watch = process.argv.includes("--watch");

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp("static", "dist", { recursive: true });

const manifest = JSON.parse(await readFile("static/manifest.json", "utf8"));
manifest.host_permissions.push(`${new URL(apiBase).origin}/*`);
await writeFile("dist/manifest.json", JSON.stringify(manifest, null, 2));

const ctx = await esbuild.context({
  entryPoints: ["src/background.ts", "src/content.ts", "src/options.ts"],
  bundle: true,
  outdir: "dist",
  format: "iife",
  target: "chrome120",
  define: { __API_BASE__: JSON.stringify(apiBase) },
  logLevel: "info",
});

if (watch) await ctx.watch();
else {
  await ctx.rebuild();
  await ctx.dispose();
}
