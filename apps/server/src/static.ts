import { ASSETS } from "./assets.generated";

const decoded = new Map<string, Uint8Array>();

function bytes(path: string, body: string): Uint8Array {
  let b = decoded.get(path);
  if (!b) {
    const bin = atob(body);
    b = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    decoded.set(path, b);
  }
  return b;
}

/** Serves the PWA from the bundle; unknown paths get index.html so client routes like /join/CODE work. */
export function serveStatic(req: Request): Response {
  const url = new URL(req.url);
  const path = url.pathname === "/" ? "/index.html" : url.pathname;
  const hit = ASSETS[path];
  const isFile = /\.[a-z0-9]+$/i.test(path);
  if (!hit && isFile) return new Response("not found", { status: 404 });
  const key = hit ? path : "/index.html";
  const asset = hit ?? ASSETS["/index.html"];
  if (!asset) return new Response("the app is not built into this Worker", { status: 500 });
  const immutable = key.startsWith("/assets/");
  const headers = {
    "content-type": asset.type,
    "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
    "x-content-type-options": "nosniff",
    "referrer-policy": "same-origin",
    ...(key === "/sw.js" ? { "service-worker-allowed": "/" } : {}),
  };
  return new Response(req.method === "HEAD" ? null : bytes(key, asset.body), { headers });
}
