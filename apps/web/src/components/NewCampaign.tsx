import { useMemo, useState } from "react";
import { applyAction, createCampaign, gateFromBooks, revealed, type Campaign, type World } from "@storyteller/engine";

interface Member {
  name: string;
  speciesId: string;
  archetypeId: string;
  controller: "player" | "ai";
  playerId: string;
  background: string;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
}

export function NewCampaign({ world, onCancel, onCreated }: { world: World; onCancel: () => void; onCreated: (c: Campaign) => void }) {
  const eras = world.pack.eras.filter((e) => e.playable);
  const [name, setName] = useState("A Road from the Vale");
  const [eraId, setEraId] = useState(eras[0]!.id);
  const [players, setPlayers] = useState<string[]>(["You"]);
  const [mode, setMode] = useState<"solo" | "hotseat">("solo");
  const [knownBooks, setKnownBooks] = useState<string>(world.eras.get(eras[0]!.id)!.bookIds[0]!);
  const gate = useMemo(() => gateFromBooks(world, [knownBooks]), [world, knownBooks]);
  const species = useMemo(() => revealed(world, gate, world.species.values()).filter((s) => s.playable), [world, gate]);
  const archetypes = useMemo(() => revealed(world, gate, world.archetypes.values()), [world, gate]);
  const [members, setMembers] = useState<Member[]>([
    { name: "Jace", speciesId: "half-elf", archetypeId: "valeman", controller: "player", playerId: "p1", background: "" },
    { name: "Tamsin", speciesId: "human", archetypeId: "highlander", controller: "ai", playerId: "", background: "A Highlander who left Leah after a quarrel." },
  ]);
  const [error, setError] = useState<string>();
  const books = world.pack.books.filter((b) => world.eras.get(eraId)!.bookIds.includes(b.id) || b.order <= (world.books.get(world.eras.get(eraId)!.bookIds[0]!)?.order ?? 1));

  const create = () => {
    try {
      const playerList = players.map((p, i) => ({ id: `p${i + 1}`, name: p.trim() || `Player ${i + 1}` }));
      let c = createCampaign(world, { id: `${slug(name)}-${Date.now().toString(36)}`, name: name.trim() || "Untitled", eraId, mode: playerList.length > 1 ? mode : "solo", players: playerList, knownBookIds: [knownBooks] });
      members.forEach((m, i) => {
        c = applyAction(world, c, {
          type: "recruit_new",
          id: `${slug(m.name)}-${i + 1}`,
          name: m.name.trim() || `Companion ${i + 1}`,
          speciesId: m.speciesId,
          archetypeId: m.archetypeId,
          background: m.background,
          ...(m.controller === "player" ? { playerId: m.playerId || "p1" } : {}),
        }).campaign;
      });
      onCreated(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const edit = (i: number, patch: Partial<Member>) => setMembers((ms) => ms.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  return (
    <main className="page">
      <h1>New campaign</h1>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Era
        <select value={eraId} onChange={(e) => setEraId(e.target.value)}>
          {eras.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
      <p className="muted">{world.eras.get(eraId)!.summary}</p>
      <label>
        Read up to
        <select value={knownBooks} onChange={(e) => setKnownBooks(e.target.value)}>
          {world.pack.books
            .filter((b) => b.order >= (books[0]?.order ?? 1))
            .map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
        </select>
        <span className="muted">The narrator never reveals anything from later books.</span>
      </label>
      <fieldset>
        <legend>Players</legend>
        {players.map((p, i) => (
          <div className="row" key={i}>
            <input value={p} onChange={(e) => setPlayers((ps) => ps.map((x, j) => (j === i ? e.target.value : x)))} />
            {players.length > 1 && <button onClick={() => setPlayers((ps) => ps.filter((_, j) => j !== i))}>Remove</button>}
          </div>
        ))}
        <div className="row">
          <button onClick={() => setPlayers((ps) => [...ps, `Player ${ps.length + 1}`])}>Add player</button>
          {players.length > 1 && (
            <label className="inline">
              Mode
              <select value={mode} onChange={(e) => setMode(e.target.value as "solo" | "hotseat")}>
                <option value="hotseat">Hotseat (one device, take turns)</option>
                <option value="solo">Shared party (one controller)</option>
              </select>
            </label>
          )}
        </div>
      </fieldset>
      <fieldset>
        <legend>Party</legend>
        {members.map((m, i) => (
          <div className="card column" key={i}>
            <div className="row">
              <input value={m.name} placeholder="Name" onChange={(e) => edit(i, { name: e.target.value })} />
              <select value={m.speciesId} onChange={(e) => edit(i, { speciesId: e.target.value })}>
                {species.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select value={m.archetypeId} onChange={(e) => edit(i, { archetypeId: e.target.value })}>
                {archetypes
                  .filter((a) => !a.speciesAllowed || a.speciesAllowed.includes(m.speciesId))
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="row">
              <select value={m.controller === "ai" ? "ai" : m.playerId || "p1"} onChange={(e) => edit(i, e.target.value === "ai" ? { controller: "ai", playerId: "" } : { controller: "player", playerId: e.target.value })}>
                <option value="ai">Companion (engine-run)</option>
                {players.map((p, j) => (
                  <option key={j} value={`p${j + 1}`}>
                    Played by {p}
                  </option>
                ))}
              </select>
              <button onClick={() => setMembers((ms) => ms.filter((_, j) => j !== i))}>Remove</button>
            </div>
            <textarea value={m.background} placeholder="Background (optional)" rows={2} onChange={(e) => edit(i, { background: e.target.value })} />
            <p className="muted small">{world.archetypes.get(m.archetypeId)?.summary}</p>
          </div>
        ))}
        {members.length < 6 && (
          <button onClick={() => setMembers((ms) => [...ms, { name: "", speciesId: "human", archetypeId: "tracker", controller: "ai", playerId: "", background: "" }])}>
            Add member
          </button>
        )}
      </fieldset>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="primary" onClick={create} disabled={members.length === 0}>
          Begin
        </button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </main>
  );
}
