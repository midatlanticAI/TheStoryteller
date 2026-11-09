# Storyteller

A persistent, party-based choose-your-path tabletop RPG with pluggable story
worlds. The first world is Shannara. The engine owns the truth; a narrator
(Claude through the API, Claude Code as Game Master, or no AI at all) only
writes the prose and offers choices the engine has already approved.

Fan work for private play. Not licensed by or affiliated with Terry Brooks or his
publishers. The world pack is paraphrased summary, never quoted text.

## Play it

**Download the app.** Get the file for your computer from the
[latest release](https://github.com/midatlanticAI/TheStoryteller/releases/latest)
and run it. It opens Storyteller in its own window.

- Windows: [Storyteller.exe](https://github.com/midatlanticAI/TheStoryteller/releases/latest/download/Storyteller.exe).
  The first time, Windows may say it protected your PC: choose **More info**, then **Run anyway**.
- Mac (Apple silicon) and Linux builds are on the same page.

**Claude as narrator, on your subscription.** In the app, open **Settings** and choose
**Sign in with Claude**. Your browser opens Claude's own sign-in page; sign in with the
account that has Pro or Max and the app takes it from there. The app does this through
Claude Code, Anthropic's official client, and installs it for you from the same screen
if it is missing. No API key needed. An API key and a fully offline narrator are also
options in Settings.

**Saves** are plain files in `Documents/Storyteller`, one per campaign.

**In a browser, no install:** https://midatlanticai.github.io/TheStoryteller/ runs the
same game on phone or PC once GitHub Pages is published. In the browser, Claude narrates
with an API key; the subscription sign-in needs the downloaded app.

## Layout

| Path | What it is |
| --- | --- |
| `packages/engine` | World-agnostic rules engine: seeded dice, world-pack schema, characters, validated action log, combat, magic with strain and attention, travel, progression, spoiler gating, narrator contract, save format. |
| `packages/world-shannara` | The Shannara world pack: 13 eras (Sword era playable), the Four Lands at depth, the outer realms sketched and gated by book. |
| `packages/narrator` | Claude narrator through the Anthropic SDK: structured scene output, cached canon block, refusal fallback. |
| `apps/web` | The game UI: mobile-first PWA with local saves, export/import, solo and hotseat party play. |
| `apps/desktop` | The downloadable app: one executable that serves the game, saves to `Documents/Storyteller`, and narrates through the player's own Claude Code sign-in. |
| `apps/claude-mod` | Claude Code mod: play in a pane with Claude as GM through engine tools. |

## Run

```bash
pnpm install
pnpm build
pnpm test
```

Run the desktop app from source (needs the Claude Code CLI for the subscription narrator):

```bash
pnpm app
```

Web app dev server:

```bash
pnpm dev
```

Then open the printed URL on a phone or desktop. Settings holds the narrator
choice: offline needs nothing; Claude needs an Anthropic API key, stored only in
that browser.

Claude Code mod, installed globally for your user from any terminal session:

```
/plugin install storyteller --marketplace midatlanticAI/TheStoryteller
```

Then `/storyteller new`. Details and the local-clone install in `apps/claude-mod/README.md`.

## How a turn works

1. The player picks a choice or types what they do.
2. The engine applies the choice's actions and emits events: dice, damage, travel, discoveries.
3. The narrator receives the standing canon (cached), the current state, and the events, and returns prose, choices, and proposed state changes as structured output.
4. The engine validates every proposed action, drops the illegal ones, applies the rest, and records the scene.
5. The campaign file is saved. It is the same JSON in the web app and the mod.

## Adding a world

A world is a data pack that satisfies `WorldPack` in `packages/engine/src/world/schema.ts`:
books in reading order, eras, species, archetypes, regions, locations with roads,
factions, creatures, items, magic sources with costs, canon figures with hard
lines, lore, and a narrator style. `loadWorld` validates every cross-reference.
Tag every entry with the book that first reveals it and the engine's spoiler
gate does the rest.
