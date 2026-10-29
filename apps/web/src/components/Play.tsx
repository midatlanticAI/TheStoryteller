import { useEffect, useMemo, useRef, useState } from "react";
import { runTurn, type Campaign, type GameEvent, type World } from "@storyteller/engine";
import { narratorFor, usage } from "../narrators";
import { exportCampaign, saveCampaign, type Settings } from "../store";
import { PartyPanel } from "./PartyPanel";
import { Codex } from "./Codex";
import { Journal } from "./Journal";

type Drawer = "none" | "party" | "codex" | "journal";

export function Play({ world, initial, settings, onExit }: { world: World; initial: Campaign; settings: Settings; onExit: () => void }) {
  const [campaign, setCampaign] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [eventText, setEventText] = useState<string[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [lastEvents, setLastEvents] = useState<GameEvent[]>([]);
  const [drawer, setDrawer] = useState<Drawer>("none");
  const [freeText, setFreeText] = useState("");
  const [activePlayer, setActivePlayer] = useState(campaign.players[0]!.id);
  const narrator = useMemo(() => narratorFor(settings), [settings]);
  const bottom = useRef<HTMLDivElement>(null);

  const scene = campaign.journal[campaign.journal.length - 1];
  const needsOpening = !scene;

  const take = async (input: { choiceId?: string; freeText?: string }) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await runTurn(world, campaign, narrator, { ...input, playerId: activePlayer });
      setCampaign(r.campaign);
      saveCampaign(r.campaign);
      setEventText(r.eventText);
      setLastEvents(r.events);
      setProblems(r.problems);
      setFreeText("");
      if (campaign.mode === "hotseat" && campaign.players.length > 1) {
        const i = campaign.players.findIndex((p) => p.id === activePlayer);
        setActivePlayer(campaign.players[(i + 1) % campaign.players.length]!.id);
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (needsOpening) void take({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [campaign.journal.length, busy]);

  const loc = world.locations.get(campaign.party.locationId);
  const fight = campaign.encounter?.status === "active" ? campaign.encounter : undefined;
  const wiped = campaign.party.memberIds.every((id) => !campaign.characters[id]?.alive);

  return (
    <main className="play">
      <div className="statusbar">
        <span>
          <strong>{campaign.name}</strong>
        </span>
        <span className="muted">
          {campaign.party.travel ? `On the road to ${world.locations.get(campaign.party.travel.toLocationId)?.name}` : loc?.name} · day {campaign.day}
          {campaign.attention >= 10 ? ` · attention ${campaign.attention}` : ""}
        </span>
        <span className="row tight">
          <button className={drawer === "party" ? "active" : ""} onClick={() => setDrawer(drawer === "party" ? "none" : "party")}>
            Party
          </button>
          <button className={drawer === "codex" ? "active" : ""} onClick={() => setDrawer(drawer === "codex" ? "none" : "codex")}>
            Codex
          </button>
          <button className={drawer === "journal" ? "active" : ""} onClick={() => setDrawer(drawer === "journal" ? "none" : "journal")}>
            Journal
          </button>
          <button onClick={() => exportCampaign(campaign)}>Export</button>
          <button onClick={onExit}>Leave</button>
        </span>
      </div>

      {drawer === "party" && <PartyPanel world={world} campaign={campaign} onChange={(c) => { setCampaign(c); saveCampaign(c); }} />}
      {drawer === "codex" && <Codex world={world} campaign={campaign} />}
      {drawer === "journal" && <Journal campaign={campaign} />}

      <section className="scene">
        {campaign.journal.slice(-3, -1).map((s) => (
          <article key={s.seq} className="past">
            <Prose text={s.prose} />
            {s.chosenChoiceId && <p className="chosen">▸ {s.choices.find((c) => c.id === s.chosenChoiceId)?.label ?? s.chosenChoiceId}</p>}
            {s.freeText && !s.chosenChoiceId && <p className="chosen">▸ {s.freeText}</p>}
          </article>
        ))}
        {settings.showRolls && eventText.length > 0 && (
          <details className="events" open>
            <summary>Dice and events</summary>
            <ul>
              {eventText.map((e, i) => (
                <li key={i} className={rollClass(lastEvents[i])}>{e}</li>
              ))}
            </ul>
          </details>
        )}
        {scene && (
          <article className="current">
            <Prose text={scene.prose} />
          </article>
        )}
        {fight && (
          <div className="fight">
            <strong>Round {fight.round}.</strong>{" "}
            {fight.enemies.map((e) => (
              <span key={e.id} className={e.alive ? "" : "muted"}>
                {e.name} {e.alive ? `${e.vitality.current}/${e.vitality.max}` : "down"}
                {"  "}
              </span>
            ))}
          </div>
        )}
        {problems.length > 0 && (
          <details className="problems">
            <summary>Narrator notes ({problems.length})</summary>
            <ul>
              {problems.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </details>
        )}
        {busy && <p className="muted thinking">The narrator is writing…</p>}
        {wiped && <p className="error">The party has fallen. Export the journal, or start a new campaign.</p>}
        <div ref={bottom} />
      </section>

      {!busy && scene && !scene.chosenChoiceId && !wiped && (
        <section className="choices">
          {campaign.players.length > 1 && (
            <p className="muted small">
              {campaign.mode === "hotseat" ? "Acting now: " : "Controller: "}
              <select value={activePlayer} onChange={(e) => setActivePlayer(e.target.value)}>
                {campaign.players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </p>
          )}
          {scene.choices.map((c, i) => (
            <button key={c.id} className="choice" onClick={() => void take({ choiceId: c.id })} title={c.hint}>
              <span className="num">{i + 1}</span> {c.label}
            </button>
          ))}
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              if (freeText.trim()) void take({ freeText: freeText.trim() });
            }}
          >
            <input value={freeText} placeholder="Or say what you do…" onChange={(e) => setFreeText(e.target.value)} />
            <button type="submit" disabled={!freeText.trim()}>
              Act
            </button>
          </form>
          <p className="muted small">
            Narrator: {narrator.name}
            {narrator.name === "claude" && usage.turns > 0 ? ` · ${usage.turns} turns, ${usage.cached} cached of ${usage.input + usage.cached} input tokens` : ""}
          </p>
        </section>
      )}
    </main>
  );
}

function rollClass(e: GameEvent | undefined): string {
  if (!e || e.type !== "roll") return "";
  return e.critical === "hit" ? "crit" : e.critical === "miss" ? "fumble" : e.success ? "ok" : "fail";
}

export function Prose({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </>
  );
}
