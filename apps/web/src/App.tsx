import { useEffect, useMemo, useState } from "react";
import { loadShannara } from "@storyteller/world-shannara";
import type { Campaign } from "@storyteller/engine";
import { Home } from "./components/Home";
import { NewCampaign } from "./components/NewCampaign";
import { Play } from "./components/Play";
import { SettingsPanel } from "./components/Settings";
import { enableRemoteSaves, loadCampaign, loadSettings, saveCampaign, saveSettings, type Settings } from "./store";
import { localHealth, type LocalHealth } from "./local";
import { NARRATOR_LABEL, resolveNarrator } from "./narrators";

type Route = { name: "home" } | { name: "new" } | { name: "play"; campaign: Campaign } | { name: "settings" };

export function App() {
  const world = useMemo(() => loadShannara(), []);
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [route, setRoute] = useState<Route>({ name: "home" });
  const [local, setLocal] = useState<LocalHealth>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const h = await localHealth();
      setLocal(h);
      if (h) await enableRemoteSaves().catch(() => undefined);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    saveSettings(settings);
    const root = document.documentElement;
    root.dataset["theme"] = settings.theme;
    root.dataset["size"] = settings.textSize;
  }, [settings]);

  const open = (id: string) => {
    const c = loadCampaign(id);
    if (c) setRoute({ name: "play", campaign: c });
  };

  const narrator = resolveNarrator(settings, local);
  const needsSignIn = !!local && narrator === "offline" && settings.narrator !== "offline";

  return (
    <div className="app">
      <header className="topbar">
        <button className="link" onClick={() => setRoute({ name: "home" })}>
          Storyteller
        </button>
        <span className="muted">
          {world.pack.name} · {NARRATOR_LABEL[narrator]}
        </span>
        <button className="link" onClick={() => setRoute({ name: "settings" })}>
          Settings
        </button>
      </header>
      {needsSignIn && route.name !== "settings" && (
        <div className="banner">
          {local!.claude.found ? "Sign in with Claude to have Claude narrate on your subscription." : "Install Claude Code to have Claude narrate on your subscription."}{" "}
          <button className="link" onClick={() => setRoute({ name: "settings" })}>
            {local!.claude.found ? "Sign in" : "Set up"}
          </button>
        </div>
      )}
      {!ready && <p className="page muted">Loading…</p>}
      {ready && route.name === "home" && <Home onNew={() => setRoute({ name: "new" })} onOpen={open} />}
      {route.name === "new" && (
        <NewCampaign
          world={world}
          onCancel={() => setRoute({ name: "home" })}
          onCreated={(c) => {
            saveCampaign(c);
            setRoute({ name: "play", campaign: c });
          }}
        />
      )}
      {route.name === "play" && <Play world={world} initial={route.campaign} settings={settings} local={local} onExit={() => setRoute({ name: "home" })} />}
      {route.name === "settings" && <SettingsPanel settings={settings} onChange={setSettings} onBack={() => setRoute({ name: "home" })} local={local} onLocal={setLocal} />}
    </div>
  );
}
