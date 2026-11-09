import { useEffect, useMemo, useState } from "react";
import { loadShannara } from "@storyteller/world-shannara";
import { serializeCampaign, type Campaign } from "@storyteller/engine";
import { Home } from "./components/Home";
import { NewCampaign } from "./components/NewCampaign";
import { Play } from "./components/Play";
import { SettingsPanel } from "./components/Settings";
import { SignIn } from "./components/SignIn";
import { Tables } from "./components/Tables";
import { OnlinePlay } from "./components/OnlinePlay";
import { enableRemoteSaves, loadCampaign, loadSettings, saveCampaign, saveSettings, type Settings } from "./store";
import { localHealth, type LocalHealth } from "./local";
import { serverHealth, table, type ServerHealth, type ServerUser } from "./online";
import { NARRATOR_LABEL, resolveNarrator } from "./narrators";
import { canInstall, isIos, isStandalone, onInstallChange, promptInstall } from "./install";

type Route =
  | { name: "home" }
  | { name: "new" }
  | { name: "new-online" }
  | { name: "play"; campaign: Campaign }
  | { name: "online"; id: string }
  | { name: "settings" }
  | { name: "signin" };

function inviteFromPath(): string | undefined {
  const m = /^\/join\/([A-Za-z0-9]{4,10})\/?$/.exec(location.pathname);
  return m ? m[1]!.toUpperCase() : undefined;
}

export function App() {
  const world = useMemo(() => loadShannara(), []);
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [route, setRoute] = useState<Route>({ name: "home" });
  const [local, setLocal] = useState<LocalHealth>();
  const [server, setServer] = useState<ServerHealth>();
  const [user, setUser] = useState<ServerUser | null>(null);
  const [ready, setReady] = useState(false);
  const [pendingCode, setPendingCode] = useState<string | undefined>(() => inviteFromPath());
  const [installable, setInstallable] = useState(canInstall());
  const [soloOnly, setSoloOnly] = useState(false);

  useEffect(() => onInstallChange(() => setInstallable(canInstall())), []);

  useEffect(() => {
    void (async () => {
      const [h, s] = await Promise.all([localHealth(), serverHealth()]);
      setLocal(h);
      setServer(s);
      setUser(s?.user ?? null);
      if (h) await enableRemoteSaves().catch(() => undefined);
      if (s && !s.user && s.auth !== "closed") setRoute({ name: "signin" });
      if (pendingCode) history.replaceState(null, "", "/");
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const shared = !!server && !!user && !soloOnly;

  return (
    <div className="app">
      <header className="topbar">
        <button className="link" onClick={() => setRoute({ name: "home" })}>
          Storyteller
        </button>
        <span className="muted">
          {world.pack.name}
          {!server && ` · ${NARRATOR_LABEL[narrator]}`}
        </span>
        <span className="row tight">
          {!isStandalone() && installable && (
            <button className="link install" onClick={() => void promptInstall()}>
              Install
            </button>
          )}
          <button className="link" onClick={() => setRoute({ name: "settings" })}>
            Settings
          </button>
        </span>
      </header>
      {needsSignIn && route.name !== "settings" && (
        <div className="banner">
          {local!.claude.found ? "Sign in with Claude to have Claude narrate on your subscription." : "Install Claude Code to have Claude narrate on your subscription."}{" "}
          <button className="link" onClick={() => setRoute({ name: "settings" })}>
            {local!.claude.found ? "Sign in" : "Set up"}
          </button>
        </div>
      )}
      {!isStandalone() && !installable && isIos() && route.name === "home" && <div className="banner">To install: tap Share, then Add to Home Screen.</div>}
      {!ready && <p className="page muted">Loading…</p>}
      {ready && route.name === "signin" && server && (
        <SignIn
          health={server}
          onSignedIn={(u) => {
            setUser(u);
            setRoute({ name: "home" });
          }}
          onLocal={() => {
            setSoloOnly(true);
            setRoute({ name: "home" });
          }}
        />
      )}
      {ready && route.name === "home" && (
        <main className="page">
          {shared && (
            <Tables
              health={server!}
              user={user!}
              pendingCode={pendingCode}
              onOpen={(id) => {
                setPendingCode(undefined);
                setRoute({ name: "online", id });
              }}
              onNew={() => setRoute({ name: "new-online" })}
              onSignOut={async () => {
                await table.signOut().catch(() => undefined);
                setUser(null);
                setRoute({ name: "signin" });
              }}
            />
          )}
          <div className={shared ? "section-gap" : ""}>
            <Home title={shared ? "On this device" : "Campaigns"} onNew={() => setRoute({ name: "new" })} onOpen={open} />
          </div>
        </main>
      )}
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
      {route.name === "new-online" && user && (
        <NewCampaign
          world={world}
          online={user}
          onCancel={() => setRoute({ name: "home" })}
          onCreated={async (c) => {
            const meta = await table.create(serializeCampaign(c));
            setRoute({ name: "online", id: meta.id });
          }}
        />
      )}
      {route.name === "play" && <Play world={world} initial={route.campaign} settings={settings} local={local} onExit={() => setRoute({ name: "home" })} />}
      {route.name === "online" && user && <OnlinePlay world={world} id={route.id} me={user} settings={settings} onExit={() => setRoute({ name: "home" })} />}
      {route.name === "settings" && <SettingsPanel settings={settings} onChange={setSettings} onBack={() => setRoute({ name: "home" })} local={local} onLocal={setLocal} />}
    </div>
  );
}
