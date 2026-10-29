import { useEffect, useMemo, useState } from "react";
import { loadShannara } from "@storyteller/world-shannara";
import type { Campaign } from "@storyteller/engine";
import { Home } from "./components/Home";
import { NewCampaign } from "./components/NewCampaign";
import { Play } from "./components/Play";
import { SettingsPanel } from "./components/Settings";
import { loadCampaign, loadSettings, saveCampaign, saveSettings, type Settings } from "./store";

type Route = { name: "home" } | { name: "new" } | { name: "play"; campaign: Campaign } | { name: "settings" };

export function App() {
  const world = useMemo(() => loadShannara(), []);
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [route, setRoute] = useState<Route>({ name: "home" });

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

  return (
    <div className="app">
      <header className="topbar">
        <button className="link" onClick={() => setRoute({ name: "home" })}>
          Storyteller
        </button>
        <span className="muted">{world.pack.name}</span>
        <button className="link" onClick={() => setRoute({ name: "settings" })}>
          Settings
        </button>
      </header>
      {route.name === "home" && <Home onNew={() => setRoute({ name: "new" })} onOpen={open} />}
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
      {route.name === "play" && <Play world={world} initial={route.campaign} settings={settings} onExit={() => setRoute({ name: "home" })} />}
      {route.name === "settings" && <SettingsPanel settings={settings} onChange={setSettings} onBack={() => setRoute({ name: "home" })} />}
    </div>
  );
}
