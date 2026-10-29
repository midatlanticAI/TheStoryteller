import { build } from "esbuild";

await build({
  entryPoints: ["src/bundle.ts"],
  bundle: true,
  format: "esm",
  platform: "neutral",
  target: "es2022",
  outfile: "hooks/storyteller.js",
  legalComments: "none",
  logLevel: "info",
});
