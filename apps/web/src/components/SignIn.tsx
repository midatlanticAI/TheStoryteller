import { useState } from "react";
import { table, type ServerHealth, type ServerUser } from "../online";

export function SignIn({ health, onSignedIn, onLocal }: { health: ServerHealth; onSignedIn: (u: ServerUser) => void; onLocal: () => void }) {
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem("storyteller:name") ?? "";
    } catch {
      return "";
    }
  });
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  if (health.auth === "closed") {
    return (
      <main className="page">
        <h1>The table isn't open yet</h1>
        <p className="muted">The owner still needs to set a table passphrase on the server.</p>
        <button onClick={onLocal}>Play on this device instead</button>
      </main>
    );
  }
  if (health.auth === "access") {
    return (
      <main className="page">
        <h1>Signed out</h1>
        <p className="muted">This table uses your email sign-in. Reload the page to sign in again.</p>
      </main>
    );
  }
  return (
    <main className="page">
      <h1>Join the table</h1>
      <p className="muted">Ask whoever runs the table for its passphrase. Use the same name each time and your seats follow you between devices.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(undefined);
          try {
            const r = await table.signIn(name, pass);
            try {
              localStorage.setItem("storyteller:name", name.trim());
            } catch {
              // fine
            }
            onSignedIn(r.user);
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Your name
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" required maxLength={40} />
        </label>
        <label>
          Table passphrase
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="row">
          <button className="primary" type="submit" disabled={busy || !name.trim() || !pass}>
            Sit down
          </button>
          <button type="button" onClick={onLocal}>
            Play solo on this device
          </button>
        </div>
      </form>
    </main>
  );
}
