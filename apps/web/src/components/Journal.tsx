import type { Campaign } from "@storyteller/engine";
import { Prose } from "./Play";

export function Journal({ campaign }: { campaign: Campaign }) {
  return (
    <aside className="drawer">
      {campaign.journal.map((s) => (
        <article key={s.seq} className="card column">
          <span className="muted small">Turn {s.turn}</span>
          <Prose text={s.prose} />
          {s.chosenChoiceId && <p className="chosen">▸ {s.choices.find((c) => c.id === s.chosenChoiceId)?.label ?? s.chosenChoiceId}</p>}
        </article>
      ))}
    </aside>
  );
}
