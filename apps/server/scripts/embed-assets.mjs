// Packs the built PWA (apps/web/dist) into the Worker bundle, so a deploy is a
// single script upload with no separate asset-upload step.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const dist = join(here, "../../web/dist");
const out = join(here, "../src/assets.generated.ts");
if (!existsSync(join(dist, "index.html"))) {
  if (process.argv.includes("--allow-empty")) {
    writeFileSync(out, "// Placeholder: build apps/web, then run scripts/embed-assets.mjs.\nexport const ASSETS: Record<string, { type: string; body: string }> = {};\n");
    process.exit(0);
  }
  console.error("apps/web/dist is missing: run `pnpm --filter @storyteller/web build` first.");
  process.exit(1);
}
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
};
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else files.push(full);
  }
};
walk(dist);
const lines = files.map((f) => {
  const path = "/" + relative(dist, f).split("\\").join("/");
  const type = TYPES[extname(f)] ?? "application/octet-stream";
  return `  ${JSON.stringify(path)}: { type: ${JSON.stringify(type)}, body: ${JSON.stringify(readFileSync(f).toString("base64"))} },`;
});
writeFileSync(out, `// Generated from apps/web/dist by scripts/embed-assets.mjs. Do not edit.\nexport const ASSETS: Record<string, { type: string; body: string }> = {\n${lines.join("\n")}\n};\n`);
console.log(`Embedded ${lines.length} files.`);
