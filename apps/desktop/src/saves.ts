import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { deserializeCampaign } from "@storyteller/engine";

/** Campaign files live where people look for them: Documents/Storyteller. */
export function savesDir(): string {
  const docs = join(homedir(), "Documents");
  const dir = join(existsSync(docs) ? docs : homedir(), "Storyteller");
  mkdirSync(dir, { recursive: true });
  return dir;
}

const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,80}$/;

export function listSaves(): { id: string; text: string }[] {
  const dir = savesDir();
  const out: { id: string; text: string }[] = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    const id = name.slice(0, -5);
    if (!SAFE_ID.test(id)) continue;
    try {
      const text = readFileSync(join(dir, name), "utf8");
      deserializeCampaign(text);
      out.push({ id, text });
    } catch {
      // Not a campaign file: leave it alone.
    }
  }
  return out;
}

export function writeSave(id: string, text: string): void {
  if (!SAFE_ID.test(id)) throw new Error("bad campaign id");
  const c = deserializeCampaign(text);
  if (c.id !== id) throw new Error("campaign id does not match the file name");
  const dir = savesDir();
  const tmp = join(dir, `.${id}.json.tmp`);
  writeFileSync(tmp, text, "utf8");
  renameSync(tmp, join(dir, `${id}.json`));
}

export function deleteSave(id: string): void {
  if (!SAFE_ID.test(id)) throw new Error("bad campaign id");
  rmSync(join(savesDir(), `${id}.json`), { force: true });
}
