import type { Settings } from "../store";

export function SettingsPanel({ settings, onChange, onBack }: { settings: Settings; onChange: (s: Settings) => void; onBack: () => void }) {
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });
  return (
    <main className="page">
      <h1>Settings</h1>
      <fieldset>
        <legend>Narrator</legend>
        <label>
          Who writes the scenes
          <select value={settings.narrator} onChange={(e) => set({ narrator: e.target.value as Settings["narrator"] })}>
            <option value="offline">Offline (engine only, no AI)</option>
            <option value="claude">Claude (needs an API key)</option>
          </select>
        </label>
        {settings.narrator === "claude" && (
          <>
            <label>
              Anthropic API key
              <input type="password" value={settings.apiKey} onChange={(e) => set({ apiKey: e.target.value })} placeholder="sk-ant-…" autoComplete="off" />
              <span className="muted small">Stored only in this browser. Calls go straight from this device to Anthropic. Each turn costs a few cents; the standing canon is cached between turns.</span>
            </label>
            <label>
              Model
              <input value={settings.model} onChange={(e) => set({ model: e.target.value })} />
            </label>
          </>
        )}
      </fieldset>
      <fieldset>
        <legend>Display</legend>
        <label className="inline">
          <input type="checkbox" checked={settings.showRolls} onChange={(e) => set({ showRolls: e.target.checked })} /> Show dice rolls and events
        </label>
        <label>
          Text size
          <select value={settings.textSize} onChange={(e) => set({ textSize: e.target.value as Settings["textSize"] })}>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </label>
        <label>
          Theme
          <select value={settings.theme} onChange={(e) => set({ theme: e.target.value as Settings["theme"] })}>
            <option value="system">System</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
      </fieldset>
      <button onClick={onBack}>Back</button>
    </main>
  );
}
