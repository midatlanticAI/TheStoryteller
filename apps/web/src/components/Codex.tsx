import { useState } from "react";
import { gateFromBooks, isRevealed, type Campaign, type World } from "@storyteller/engine";

type Tab = "places" | "peoples" | "creatures" | "figures" | "magic" | "lore";

export function Codex({ world, campaign }: { world: World; campaign: Campaign }) {
  const [tab, setTab] = useState<Tab>("places");
  const gate = gateFromBooks(world, campaign.knownBookIds);
  const seen = new Set(campaign.codex.discoveredIds);
  const book = (id: string) => world.books.get(id)?.title ?? id;
  const tabs: Tab[] = ["places", "peoples", "creatures", "figures", "magic", "lore"];
  return (
    <aside className="drawer">
      <div className="row wrap">
        {tabs.map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <p className="muted small">Entries appear as the party meets them. Each notes the book where it is first told.</p>
      {tab === "places" &&
        [...world.locations.values()]
          .filter((l) => seen.has(l.id) && isRevealed(world, gate, l))
          .map((l) => (
            <Entry key={l.id} title={l.name} sub={`${world.regions.get(l.regionId)?.name} · ${book(l.revealedIn)}`} body={l.description} />
          ))}
      {tab === "peoples" &&
        [...world.species.values()].filter((s) => isRevealed(world, gate, s)).map((s) => <Entry key={s.id} title={s.name} sub={book(s.revealedIn)} body={`${s.summary} ${s.traits.join(" ")}`} />)}
      {tab === "creatures" &&
        [...world.creatures.values()]
          .filter((c) => seen.has(c.id) && isRevealed(world, gate, c))
          .map((c) => <Entry key={c.id} title={c.name} sub={`tier ${c.tier} · ${book(c.revealedIn)}`} body={c.summary} />)}
      {tab === "figures" &&
        [...world.canonFigures.values()]
          .filter((f) => seen.has(f.id) && isRevealed(world, gate, f))
          .map((f) => <Entry key={f.id} title={f.name} sub={`${f.role} · ${book(f.revealedIn)}`} body={f.summary} />)}
      {tab === "magic" &&
        [...world.magicSources.values()].filter((m) => isRevealed(world, gate, m)).map((m) => <Entry key={m.id} title={m.name} sub={`${m.kind} · ${book(m.revealedIn)}`} body={`${m.summary} Cost: ${m.cost}`} />)}
      {tab === "lore" &&
        [...world.lore.values()].filter((l) => isRevealed(world, gate, l)).map((l) => <Entry key={l.id} title={l.title} sub={book(l.revealedIn)} body={l.body} />)}
    </aside>
  );
}

function Entry({ title, sub, body }: { title: string; sub: string; body: string }) {
  return (
    <details className="card">
      <summary>
        <strong>{title}</strong> <span className="muted small">{sub}</span>
      </summary>
      <p className="small">{body}</p>
    </details>
  );
}
