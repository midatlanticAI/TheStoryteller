import { useEffect, useState } from "react";
import type { Settings } from "../store";
import { account, localHealth, type JobState, type LocalHealth } from "../local";
import { NARRATOR_LABEL, resolveNarrator } from "../narrators";
import { gm, ownerKey, setOwnerKey, type GmHealth, type ServerHealth } from "../online";

export function SettingsPanel({
  settings,
  onChange,
  onBack,
  local,
  onLocal,
  server,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onBack: () => void;
  local: LocalHealth | undefined;
  onLocal: (h: LocalHealth | undefined) => void;
  server?: ServerHealth;
}) {
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
  const active = resolveNarrator(settings, local);
  return (
    <main className="page">
      <h1>Settings</h1>
      {local && <ClaudeAccount local={local} onLocal={onLocal} />}
      {server?.user && server.hostedGm && <TableClaude />}
      <fieldset>
        <legend>Narrator</legend>
        <label>
          Who writes the scenes
          <select value={settings.narrator} onChange={(e) => set({ narrator: e.target.value as Settings["narrator"] })}>
            <option value="auto">Automatic (best available)</option>
            {local && <option value="claude-code">Claude, with your Claude subscription</option>}
            <option value="claude">Claude, with an API key</option>
            <option value="offline">Offline (engine only, no AI)</option>
          </select>
          <span className="muted small">Now using: {NARRATOR_LABEL[active]}</span>
        </label>
        {(settings.narrator === "claude-code" || (settings.narrator === "auto" && local)) && (
          <label>
            Model for scenes (optional)
            <input value={settings.codeModel} onChange={(e) => set({ codeModel: e.target.value.trim() })} placeholder="Claude Code's default, e.g. opus or sonnet" />
            <span className="muted small">Sonnet writes faster; Opus writes better. Leave empty for your Claude Code default.</span>
          </label>
        )}
        {(settings.narrator === "claude" || (settings.narrator === "auto" && !local)) && (
          <>
            <label>
              Anthropic API key
              <input type="password" value={settings.apiKey} onChange={(e) => set({ apiKey: e.target.value })} placeholder="sk-ant-…" autoComplete="off" />
              <span className="muted small">Stored only on this device. Calls go straight from here to Anthropic and bill to the key's Console account.</span>
            </label>
            <label>
              Model
              <input value={settings.model} onChange={(e) => set({ model: e.target.value })} />
            </label>
          </>
        )}
        {!local && (
          <p className="muted small">
            To play with your Claude subscription instead of an API key, download the Storyteller app from the project's Releases page and sign in from its Settings.
          </p>
        )}
      </fieldset>
      <fieldset>
        <legend>Display</legend>
        <label className="inline">
          <input type="checkbox" checked={settings.showRolls} onChange={(e) => set({ showRolls: e.target.checked })} /> Show dice rolls and events
        </label>
        <label>
          Text size
          <select value={settings.textSize} onChange={(e) => set({ textSize: e.target.value as Settings["textSize"] })}>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </label>
        <label>
          Theme
          <select value={settings.theme} onChange={(e) => set({ theme: e.target.value as Settings["theme"] })}>
            <option value="system">System</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
      </fieldset>
      {local && <p className="muted small">Campaign files are saved in {local.savesDir}</p>}
      <button onClick={onBack}>Back</button>
    </main>
  );
}

function ClaudeAccount({ local, onLocal }: { local: LocalHealth; onLocal: (h: LocalHealth | undefined) => void }) {
  const [job, setJob] = useState<JobState>(local.job);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!job.running) return;
    const t = setInterval(async () => {
      const next = await account.job().catch(() => job);
      setJob(next);
      if (!next.running) {
        clearInterval(t);
        onLocal(await localHealth(true));
      }
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.running]);

  useEffect(() => {
    if (job.kind === "login" && job.running && job.url) window.open(job.url, "_blank", "noopener");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.url]);

  const act = async (fn: () => Promise<JobState>) => {
    setError(undefined);
    try {
      setJob(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const { claude, auth } = local;
  return (
    <fieldset>
      <legend>Claude account</legend>
      {!claude.found && (
        <>
          <p>Claude Code is not installed on this computer. Storyteller uses it to sign in to your Claude subscription and write scenes.</p>
          <button className="primary" disabled={job.running} onClick={() => void act(account.install)}>
            Install Claude Code
          </button>
        </>
      )}
      {claude.found && !auth.loggedIn && (
        <>
          <p>Sign in with the Claude account that has your Pro or Max subscription. Your browser opens Claude's sign-in page; come back here when it says you're done.</p>
          <button className="primary" disabled={job.running} onClick={() => void act(account.login)}>
            Sign in with Claude
          </button>
        </>
      )}
      {claude.found && auth.loggedIn && (
        <div className="row between">
          <span>
            Signed in{auth.email ? ` as ${auth.email}` : ""}
            {auth.subscription ? ` · ${auth.subscription}` : ""}
            <span className="muted small"> · Claude Code {claude.version}</span>
          </span>
          <button disabled={job.running} onClick={() => void act(account.logout)}>
            Sign out
          </button>
        </div>
      )}
      {job.running && (
        <div className="card column">
          <span>{job.kind === "install" ? "Installing Claude Code…" : job.kind === "login" ? "Waiting for you to finish signing in…" : "Signing out…"}</span>
          {job.url && (
            <a href={job.url} target="_blank" rel="noopener noreferrer">
              Open the sign-in page
            </a>
          )}
          {job.kind === "login" && (
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                if (code.trim()) void act(() => account.code(code)).then(() => setCode(""));
              }}
            >
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="If the page shows a code, paste it here" />
              <button type="submit" disabled={!code.trim()}>
                Send
              </button>
            </form>
          )}
          <button onClick={() => void act(account.cancel)}>Cancel</button>
        </div>
      )}
      {!job.running && job.kind !== "none" && job.ok === false && <p className="error">That did not finish. {job.output.trim().split("\n").slice(-3).join(" ")}</p>}
      {error && <p className="error">{error}</p>}
      {claude.error && claude.found === false && claude.path && <p className="muted small">{claude.error}</p>}
    </fieldset>
  );
}

/** The hosted table's Claude sign-in: Claude Code in the server's container, signed in with the owner's subscription. */
function TableClaude() {
  const [key, setKey] = useState(ownerKey());
  const [health, setHealth] = useState<GmHealth>();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setError(undefined);
    try {
      setHealth(await gm.health());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setHealth(undefined);
    }
  };

  useEffect(() => {
    if (key) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!health?.job.running) return;
    const t = setInterval(async () => {
      try {
        const job = await gm.job();
        setHealth((h) => (h ? { ...h, job } : h));
        if (!job.running) {
          clearInterval(t);
          void refresh();
        }
      } catch {
        // keep polling
      }
    }, 1500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [health?.job.running]);

  const act = async (fn: () => Promise<GmHealth["job"]>) => {
    setBusy(true);
    setError(undefined);
    try {
      const job = await fn();
      setHealth((h) => (h ? { ...h, job } : h));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const job = health?.job;
  return (
    <fieldset>
      <legend>Claude subscription (table owner)</legend>
      {!health && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setOwnerKey(key.trim());
            void refresh();
          }}
        >
          <p className="small">Scenes are narrated by Claude Code running on this table's server, signed in with your own Claude Pro or Max plan.</p>
          <label>
            Owner passphrase
            <input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" />
          </label>
          <button type="submit" disabled={!key.trim()}>
            Unlock
          </button>
        </form>
      )}
      {health && !health.auth.loggedIn && !job?.running && (
        <>
          <p className="small">Claude Code {health.claude.version} is ready on the server. Sign in with the Claude account that has your subscription.</p>
          <button className="primary" disabled={busy} onClick={() => void act(gm.login)}>
            Sign in with Claude
          </button>
        </>
      )}
      {health?.auth.loggedIn && !job?.running && (
        <div className="row between wrap">
          <span>
            Signed in{health.auth.email ? ` as ${health.auth.email}` : ""}
            {health.auth.subscription ? ` · ${health.auth.subscription}` : ""}
          </span>
          <button disabled={busy} onClick={() => void act(gm.logout)}>
            Sign out
          </button>
        </div>
      )}
      {job?.running && (
        <div className="card column">
          <span>{job.kind === "login" ? "Finish signing in on Claude's page, then paste the code it shows." : "Working…"}</span>
          {job.url && (
            <a href={job.url} target="_blank" rel="noopener noreferrer" className="primary-link">
              Open Claude's sign-in page
            </a>
          )}
          {job.kind === "login" && (
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                if (code.trim()) void act(() => gm.code(code)).then(() => setCode(""));
              }}
            >
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste the code from Claude's page" autoComplete="one-time-code" />
              <button type="submit" disabled={!code.trim()}>
                Send
              </button>
            </form>
          )}
          <button onClick={() => void act(gm.cancel)}>Cancel</button>
        </div>
      )}
      {job && !job.running && job.kind !== "none" && job.ok === false && <p className="error small">That didn't finish: {job.output.trim().split("\n").slice(-2).join(" ")}</p>}
      {error && <p className="error small">{error}</p>}
    </fieldset>
  );
}
