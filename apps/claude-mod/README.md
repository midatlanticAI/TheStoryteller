# Storyteller for Claude Code

A mod that turns Claude Code into the Game Master of a Storyteller campaign.
The rules engine and the Shannara world pack are bundled into `hooks/storyteller.js`;
Claude plays GM through registered tools and can only change the world through them.

## Build

```bash
pnpm build:mod
```

That writes `hooks/storyteller.js` from the workspace packages.

## Install globally

This repository is a plugin marketplace, so one line at the prompt of any Claude Code
terminal session installs the mod for your user, in every project:

```
/plugin install storyteller --marketplace midatlanticAI/TheStoryteller
```

Answer `y` to add the marketplace, then pick the user scope. From a shell:

```bash
claude plugin install storyteller --marketplace midatlanticAI/TheStoryteller
```

That reads the repository's default branch. Until this work is merged there, or to
run your own edits live, install from a local clone instead:

```bash
claude plugin marketplace add /path/to/TheStoryteller
```

```bash
claude plugin install storyteller@storyteller
```

A plugin installed from a folder marketplace runs from that folder, so after editing
it (or rebuilding the bundle with `pnpm build:mod`) `/reload-plugins` picks up the
change with no reinstall. For a one-off run without installing:

```bash
claude --plugin-dir /path/to/TheStoryteller/apps/claude-mod
```

## Play

In any session with the mod installed:

```
/storyteller new
```

Claude asks for a campaign name and a party, creates the campaign, and opens the
pane. Press a numbered choice or type what you do. Campaign files are saved as
`storyteller-campaigns/<id>.json` in the working directory, in the same format the
web app reads, so a campaign can move between the two.

Other commands: `/storyteller load <file>`, `/storyteller list`, `/storyteller pane`.
