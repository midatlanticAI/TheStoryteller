# Storyteller for Claude Code

A mod that turns Claude Code into the Game Master of a Storyteller campaign.
The rules engine and the Shannara world pack are bundled into `hooks/storyteller.js`;
Claude plays GM through registered tools and can only change the world through them.

## Build

```bash
pnpm build:mod
```

That writes `hooks/storyteller.js` from the workspace packages.

## Play

Load the folder as a plugin (`claude --plugin-dir apps/claude-mod`, or add it as a
marketplace folder), then:

```
/storyteller new
```

Claude asks for a campaign name and a party, creates the campaign, and opens the
pane. Press a numbered choice or type what you do. Campaign files are saved as
`storyteller-campaigns/<id>.json` in the working directory, in the same format the
web app reads, so a campaign can move between the two.

Other commands: `/storyteller load <file>`, `/storyteller list`, `/storyteller pane`.
