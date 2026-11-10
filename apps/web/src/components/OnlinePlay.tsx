import { useEffect, useRef, useState } from "react";
import type { World } from "@storyteller/engine";
import { connectRoom, table, type RoomState, type ServerUser, type TableMeta } from "../online";
import type { Settings } from "../store";
import { PartyPanel } from "./PartyPanel";
import { Codex } from "./Codex";
import { Journal } from "./Journal";
import { Prose } from "./Play";

type Drawer = "none" | "party" | "codex" | "journal" | "table";

const MODELS: { id: string; label: string }[] = [
  { id: "auto", label: "Smart (Haiku, Sonnet or Opus by scene)" },
  { id: "opus", label: "Always Opus (best prose)" },
  { id: "sonnet", label: "Always Sonnet (balanced)" },
  { id: "haiku", label: "Always Haiku (fastest)" },
];

export function OnlinePlay({ world, id, me, settings, onExit }: { world: World; id: string; me: ServerUser; settings: Settings; onExit: () => void }) {
  const [state, setState] = useState<RoomState>();
  const [meta, setMeta] = useState<TableMeta>();
  const [connected, setConnected] = useState(false);
  const [drawer, setDrawer] = useState<Drawer>("none");
  const [freeText, setFreeText] = useState("");
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => connectRoom(id, setState, setConnected), [id]);
  useEffect(() => {
    void table.meta(id).then(setMeta).catch(() => undefined);
  }, [id]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [state?.campaign.journal.length, state?.room.narrating]);

  if (!state) {
    return (
      <main className="page">
        <p className="muted">{connected ? "Loading the table…" : "Connecting to the table…"}</p>
        <button onClick={onExit}>Back</button>
      </main>
    );
  }

  const { campaign, room } = state;
  const scene = campaign.journal[campaign.journal.length - 1];
  const loc = world.locations.get(campaign.party.locationId);
  const fight = campaign.encounter?.status === "active" ? campaign.encounter : undefined;
  const isOwner = room.ownerId === me.id;
  const myTurn = room.turnMode === "free" || !room.activePlayerId || room.activePlayerId === me.id || isOwner;
  const activeName = room.activePlayerId ? campaign.players.find((p) => p.id === room.activePlayerId)?.name : undefined;
  const wiped = campaign.party.memberIds.length > 0 && campaign.party.memberIds.every((cid) => !campaign.characters[cid]?.alive);
  const mine = campaign.party.memberIds.filter((cid) => {
    const c = campaign.characters[cid];
    return c?.controller.kind === "player" && c.controller.playerId === me.id;
  });

  const act = async (fn: () => Promise<unknown>) => {
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const inviteLink = meta ? `${location.origin}/join/${meta.invite}` : "";

  return (
    <main className="play">
      <div className="statusbar">
        <span>
          <strong>{campaign.name}</strong> <span className={connected ? "dot on" : "dot"} title={connected ? "live" : "reconnecting"} />
        </span>
        <span className="muted">
          {campaign.party.travel ? `On the road to ${world.locations.get(campaign.party.travel.toLocationId)?.name}` : loc?.name} · day {campaign.day}
          {campaign.attention >= 10 ? ` · attention ${campaign.attention}` : ""}
        </span>
        <span className="row tight wrap">
          {(["party", "codex", "journal", "table"] as const).map((d) => (
            <button key={d} className={drawer === d ? "active" : ""} onClick={() => setDrawer(drawer === d ? "none" : d)}>
              {d[0]!.toUpperCase() + d.slice(1)}
            </button>
          ))}
          <button onClick={onExit}>Leave</button>
        </span>
      </div>

      {drawer === "party" && (
        <PartyPanel
          world={world}
          campaign={campaign}
          onSkill={(cid, skill) => void act(() => table.sheet(id, cid, { skill }))}
          onEquip={(cid, equip) => void act(() => table.sheet(id, cid, { equip }))}
          seats={{ meId: me.id, isOwner, onSeat: (cid, pid) => void act(() => table.seat(id, cid, pid)) }}
        />
      )}
      {drawer === "codex" && <Codex world={world} campaign={campaign} />}
      {drawer === "journal" && <Journal campaign={campaign} />}
      {drawer === "table" && (
        <aside className="drawer">
          {meta && (
            <div className="card column">
              <strong>Invite friends</strong>
              <span className="small">
                Code <code className="code">{meta.invite}</code> · they also need the table passphrase.
              </span>
              <div className="row">
                <input readOnly value={inviteLink} onFocus={(e) => e.target.select()} />
                <button
                  onClick={async () => {
                    try {
                      if (navigator.share) await navigator.share({ title: campaign.name, text: `Join my Storyteller table "${campaign.name}"`, url: inviteLink });
                      else {
                        await navigator.clipboard.writeText(inviteLink);
                        setCopied(true);
                      }
                    } catch {
                      // dismissed
                    }
                  }}
                >
                  {copied ? "Copied" : "Share"}
                </button>
              </div>
            </div>
          )}
          <div className="card column">
            <strong>At the table</strong>
            {campaign.players.map((p) => (
              <span key={p.id} className="small">
                {room.online.some((o) => o.id === p.id) ? "● " : "○ "}
                {p.name}
                {p.id === room.ownerId ? " (owner)" : ""}
                {room.activePlayerId === p.id ? " · their turn" : ""}
              </span>
            ))}
          </div>
          {isOwner && (
            <div className="card column">
              <strong>Table settings</strong>
              <label>
                Turns
                <select value={room.turnMode} onChange={(e) => void act(() => table.settings(id, { turnMode: e.target.value as "free" | "rotate" }))}>
                  <option value="free">Anyone can act (best for playing together live)</option>
                  <option value="rotate">Take turns in order (best for playing across the day)</option>
                </select>
              </label>
              <label>
                Narrator model
                <select value={room.model} onChange={(e) => void act(() => table.settings(id, { model: e.target.value }))}>
                  {MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <a href={table.exportUrl(id)} download>
            Download this campaign's file
          </a>
        </aside>
      )}

      <section className="scene">
        {campaign.journal.slice(-3, -1).map((s) => (
          <article key={s.seq} className="past">
            <Prose text={s.prose} />
            {s.chosenChoiceId && <p className="chosen">▸ {s.choices.find((c) => c.id === s.chosenChoiceId)?.label ?? s.chosenChoiceId}</p>}
            {s.freeText && !s.chosenChoiceId && <p className="chosen">▸ {s.freeText}</p>}
          </article>
        ))}
        {settings.showRolls && room.lastEvents.length > 0 && (
          <details className="events" open>
            <summary>Dice and events</summary>
            <ul>
              {room.lastEvents.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </details>
        )}
        {scene ? (
          <article className="current">
            <Prose text={scene.prose} />
          </article>
        ) : (
          <p className="muted thinking">The narrator is setting the opening scene…</p>
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
        {room.lastProblems.length > 0 && (
          <details className="problems">
            <summary>Narrator notes ({room.lastProblems.length})</summary>
            <ul>
              {room.lastProblems.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </details>
        )}
        {room.narrating && <p className="muted thinking">The narrator is writing (for {room.narrating.by})…</p>}
        {wiped && <p className="error">The party has fallen.</p>}
        <div ref={bottom} />
      </section>

      {drawer === "none" && scene && !scene.chosenChoiceId && !room.narrating && !wiped && (
        <section className="choices">
          {mine.length === 0 && (
            <p className="muted small">
              You have no seat yet. Open <button className="link small" onClick={() => setDrawer("party")}>Party</button> and take one, or act for the whole table.
            </p>
          )}
          {!myTurn && <p className="muted small">It's {activeName}'s turn. You can still talk it over; the choice is theirs.</p>}
          {scene.choices.map((c, i) => (
            <button key={c.id} className="choice" disabled={!myTurn} onClick={() => void act(() => table.turn(id, { choiceId: c.id }))} title={c.hint}>
              <span className="num">{i + 1}</span> {c.label}
            </button>
          ))}
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              const t = freeText.trim();
              if (t) void act(() => table.turn(id, { freeText: t })).then(() => setFreeText(""));
            }}
          >
            <input value={freeText} disabled={!myTurn} placeholder={myTurn ? "Or say what you do…" : "Waiting for your turn"} onChange={(e) => setFreeText(e.target.value)} maxLength={600} />
            <button type="submit" disabled={!myTurn || !freeText.trim()}>
              Act
            </button>
          </form>
          {error && <p className="error small">{error}</p>}
          <p className="muted small">
            {room.narrator === "claude-code" ? "Claude (your subscription)" : room.narrator === "claude" ? "Claude (API key)" : "Offline narrator"}
            {room.lastNote ? ` · ${room.lastNote}` : ""}
          </p>
        </section>
      )}
      {(room.narrating || scene?.chosenChoiceId) && error && <p className="error small page">{error}</p>}
    </main>
  );
}
