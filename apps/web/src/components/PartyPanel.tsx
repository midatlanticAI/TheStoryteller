import { applyAction, SKILLS, xpToNext, type Campaign, type World } from "@storyteller/engine";

export function PartyPanel({ world, campaign, onChange }: { world: World; campaign: Campaign; onChange: (c: Campaign) => void }) {
  return (
    <aside className="drawer">
      <div className="row">
        <span className="muted">
          Gold {campaign.party.gold} · Provisions {campaign.party.provisions} · Attention {campaign.attention}
        </span>
      </div>
      {campaign.party.memberIds.map((id) => {
        const ch = campaign.characters[id]!;
        const species = world.species.get(ch.speciesId)?.name;
        const arch = world.archetypes.get(ch.archetypeId)?.name;
        const next = xpToNext(ch.xp);
        return (
          <div key={id} className={`card column ${ch.alive ? "" : "dead"}`}>
            <div className="row between">
              <strong>
                {ch.name} <span className="muted">{species} {arch}, level {ch.level}</span>
              </strong>
              <span className="muted">{ch.controller.kind === "ai" ? "companion" : campaign.players.find((p) => p.id === (ch.controller as { playerId: string }).playerId)?.name}</span>
            </div>
            <div className="bars">
              <Bar label="Vitality" value={ch.vitality.current} max={ch.vitality.max} kind="vit" />
              <Bar label="Strain" value={ch.strain.current} max={ch.strain.max} kind="strain" />
            </div>
            {ch.conditions.length > 0 && <p className="muted small">{ch.conditions.join(", ")}</p>}
            <p className="small">
              {Object.entries(ch.attributes)
                .map(([k, v]) => `${k} ${v}`)
                .join(" · ")}
            </p>
            <p className="small">
              {SKILLS.filter((s) => ch.skills[s] > 0)
                .map((s) => `${s} ${ch.skills[s]}`)
                .join(" · ") || "no trained skills"}
              {next !== undefined ? ` · ${next} xp to next level` : ""}
            </p>
            {ch.unspentSkillPoints > 0 && (
              <div className="row wrap">
                <span className="small">Spend {ch.unspentSkillPoints} skill point(s):</span>
                {SKILLS.filter((s) => ch.skills[s] < 5).map((s) => (
                  <button key={s} className="small" onClick={() => onChange(applyAction(world, campaign, { type: "improve_skill", characterId: id, skill: s }).campaign)}>
                    {s} +1
                  </button>
                ))}
              </div>
            )}
            <p className="small">
              {ch.inventory.map((i) => {
                const item = world.items.get(i.itemId);
                const equipped = Object.values(ch.equipped).includes(i.instanceId);
                return (
                  <span key={i.instanceId} className={equipped ? "equipped" : ""}>
                    {item?.name ?? i.itemId}
                    {i.qty > 1 ? ` x${i.qty}` : ""}
                    {!equipped && item && ["weapon", "armor", "shield", "talisman", "relic"].includes(item.kind) && (
                      <button className="small inline" onClick={() => onChange(applyAction(world, campaign, { type: "equip", characterId: id, instanceId: i.instanceId }).campaign)}>
                        equip
                      </button>
                    )}
                    {"  "}
                  </span>
                );
              })}
            </p>
            {ch.magicSourceIds.length > 0 && <p className="small">Magic: {ch.magicSourceIds.map((m) => world.magicSources.get(m)?.name ?? m).join(", ")}</p>}
            {ch.background && <p className="muted small">{ch.background}</p>}
          </div>
        );
      })}
      {campaign.quests.length > 0 && (
        <div className="card column">
          <strong>Quests</strong>
          {campaign.quests.map((q) => (
            <div key={q.id}>
              <span className={q.status === "done" ? "muted" : ""}>
                [{q.status}] {q.title}
              </span>
              <p className="muted small">{q.summary}</p>
              {q.steps.map((s, i) => (
                <p key={i} className="small">
                  {s.done ? "✓" : "·"} {s.text}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

function Bar({ label, value, max, kind }: { label: string; value: number; max: number; kind: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className={`bar ${kind}`} title={`${label} ${value}/${max}`}>
      <span style={{ width: `${pct}%` }} />
      <em>
        {label} {value}/{max}
      </em>
    </div>
  );
}
