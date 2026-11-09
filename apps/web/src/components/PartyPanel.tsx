import { SKILLS, xpToNext, type Campaign, type World } from "@storyteller/engine";

export interface SeatControls {
  meId: string;
  isOwner: boolean;
  onSeat: (characterId: string, playerId: string | null) => void;
}

export function PartyPanel({
  world,
  campaign,
  onSkill,
  onEquip,
  seats,
}: {
  world: World;
  campaign: Campaign;
  onSkill: (characterId: string, skill: string) => void;
  onEquip: (characterId: string, instanceId: string) => void;
  seats?: SeatControls;
}) {
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
        const holder = ch.controller.kind === "player" ? ch.controller.playerId : undefined;
        const holderName = holder ? campaign.players.find((p) => p.id === holder)?.name ?? holder : undefined;
        const canEdit = !seats || seats.isOwner || holder === seats.meId;
        return (
          <div key={id} className={`card column ${ch.alive ? "" : "dead"}`}>
            <div className="row between wrap">
              <strong>
                {ch.name} <span className="muted">{species} {arch}, level {ch.level}</span>
              </strong>
              <span className="row tight">
                <span className="muted">{holderName ?? "companion"}</span>
                {seats && !holder && (
                  <button className="small" onClick={() => seats.onSeat(id, seats.meId)}>
                    Take this seat
                  </button>
                )}
                {seats && holder && (holder === seats.meId || seats.isOwner) && (
                  <button className="small" onClick={() => seats.onSeat(id, null)}>
                    {holder === seats.meId ? "Leave seat" : "Free seat"}
                  </button>
                )}
              </span>
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
            {canEdit && ch.unspentSkillPoints > 0 && (
              <div className="row wrap">
                <span className="small">Spend {ch.unspentSkillPoints} skill point(s):</span>
                {SKILLS.filter((s) => ch.skills[s] < 5).map((s) => (
                  <button key={s} className="small" onClick={() => onSkill(id, s)}>
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
                    {canEdit && !equipped && item && ["weapon", "armor", "shield", "talisman", "relic"].includes(item.kind) && (
                      <button className="small inline" onClick={() => onEquip(id, i.instanceId)}>
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
