import { useEffect, useState } from "react";
import { table, type ServerHealth, type ServerUser, type TableMeta } from "../online";

export function Tables({
  health,
  user,
  onOpen,
  onNew,
  onSignOut,
  pendingCode,
}: {
  health: ServerHealth;
  user: ServerUser;
  onOpen: (id: string) => void;
  onNew: () => void;
  onSignOut: () => void;
  pendingCode?: string;
}) {
  const [tables, setTables] = useState<TableMeta[]>();
  const [code, setCode] = useState(pendingCode ?? "");
  const [error, setError] = useState<string>();

  const refresh = () => table.list().then(setTables).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  useEffect(() => {
    void refresh();
  }, []);

  const join = async (c: string) => {
    setError(undefined);
    try {
      const meta = await table.join(c.trim());
      onOpen(meta.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    if (pendingCode) void join(pendingCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCode]);

  return (
    <section>
      <div className="row between">
        <h1>Shared tables</h1>
        <span className="muted small">
          {user.name}
          {health.auth === "passphrase" && (
            <button className="link small" onClick={onSignOut}>
              sign out
            </button>
          )}
        </span>
      </div>
      {health.narrator === "offline" && <p className="muted small">Claude isn't signed in on the server yet, so scenes come from the offline narrator. The table's owner signs in under Settings.</p>}
      <div className="row">
        <button className="primary" onClick={onNew}>
          New shared campaign
        </button>
      </div>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) void join(code);
        }}
      >
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Invite code" maxLength={8} />
        <button type="submit" disabled={!code.trim()}>
          Join
        </button>
      </form>
      {error && <p className="error">{error}</p>}
      {tables && tables.length === 0 && <p className="muted">No shared campaigns yet. Start one, or join with a friend's invite code.</p>}
      <ul className="list">
        {tables?.map((t) => (
          <li key={t.id} className="card">
            <button className="link grow" onClick={() => onOpen(t.id)}>
              <strong>{t.name}</strong>
              <span className="muted small">
                {" "}
                {t.members.map((m) => m.name).join(", ")} · turn {t.turn}
              </span>
            </button>
            {t.ownerId === user.id && (
              <button
                className="danger"
                onClick={async () => {
                  if (confirm(`Delete the table "${t.name}" for everyone? This cannot be undone.`)) {
                    await table.remove(t.id).catch(() => undefined);
                    void refresh();
                  }
                }}
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
