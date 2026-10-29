import { useRef, useState } from "react";
import { deleteCampaign, importCampaign, listCampaigns } from "../store";

export function Home({ onNew, onOpen }: { onNew: () => void; onOpen: (id: string) => void }) {
  const [campaigns, setCampaigns] = useState(() => listCampaigns());
  const [error, setError] = useState<string>();
  const file = useRef<HTMLInputElement>(null);
  return (
    <main className="page">
      <h1>Campaigns</h1>
      <div className="row">
        <button className="primary" onClick={onNew}>
          New campaign
        </button>
        <button onClick={() => file.current?.click()}>Import file</button>
        <input
          ref={file}
          type="file"
          accept="application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const c = await importCampaign(f);
              setCampaigns(listCampaigns());
              onOpen(c.id);
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
            }
          }}
        />
      </div>
      {error && <p className="error">{error}</p>}
      {campaigns.length === 0 && <p className="muted">No campaigns yet. Start one, or import a file saved from Claude Code.</p>}
      <ul className="list">
        {campaigns.map((c) => (
          <li key={c.id} className="card">
            <button className="link grow" onClick={() => onOpen(c.id)}>
              <strong>{c.name}</strong>
              <span className="muted">
                {" "}
                turn {c.turn}, {new Date(c.updatedAt).toLocaleString()}
              </span>
            </button>
            <button
              className="danger"
              onClick={() => {
                if (confirm(`Delete ${c.name}? This cannot be undone.`)) {
                  deleteCampaign(c.id);
                  setCampaigns(listCampaigns());
                }
              }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
