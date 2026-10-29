import { expect, test } from "claude-code/testing";

const PANE = {
  plugin: "storyteller",
  component: "Pane",
  requestId: "storyteller",
  props: { title: "Storyteller", isFocused: false, bodyColumns: 60, placement: "dock", scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const;

function engineStandIns(on: Parameters<Parameters<typeof test>[1]>[1]) {
  const files = new Map<string, string>();
  const store = new Map<string, unknown>();
  on("tool.register", (_, e) => ({ value: { tool: `mcp__storyteller__${e.name}` } }));
  on("command.register", () => ({ value: { command: "storyteller" } }));
  on("ui.open", () => ({ value: { isPlaced: true } }));
  on("session.start", (_, e) => ({ cwd: e.cwd }));
  on("fs.write", (_, e) => {
    files.set(e.path, e.text);
    return { value: undefined };
  });
  on("fs.read", (_, e) => ({ value: files.get(e.path) ?? "" }));
  on("fs.list", () => ({ value: [...files.keys()].map((name) => ({ name: name.split("/").pop()!, kind: "file", size: 1, mtimeMs: 0, isLink: false })) }));
  on("store.get", (_, e) => ({ value: store.get(e.key) }));
  on("store.set", (_, e) => {
    store.set(e.key, e.value);
    return { value: undefined };
  });
  return { files, store };
}

const textOf = (r: unknown) => ((r as { result?: { content?: { text?: string }[] } }).result?.content?.[0]?.text ?? "");

test("a campaign can be created, acted in, and shown in the pane", async ($, on) => {
  const { files } = engineStandIns(on);
  await $.session.start({ cwd: "/", surface: "desktop", isInteractive: true });

  const nothing = await $.tool.call({ tool: "mcp__storyteller__storyteller_status" });
  expect(textOf(nothing)).toContain("no campaign is loaded");

  const made = await $.tool.call({
    tool: "mcp__storyteller__storyteller_new_campaign",
    name: "Test Road",
    party: [
      { id: "jace", name: "Jace", speciesId: "half-elf", archetypeId: "valeman", playerId: "p1" },
      { id: "tam", name: "Tamsin", speciesId: "human", archetypeId: "highlander", background: "A Highlander." },
    ],
  });
  const text = textOf(made);
  expect(text).toContain("created and saved");
  expect(text).toContain("Allanon");
  expect(text).toContain("Shady Vale");
  expect([...files.keys()].some((f) => f.includes("storyteller-campaigns/"))).toBe(true);

  const acted = await $.tool.call({
    tool: "mcp__storyteller__storyteller_act",
    actions: [{ type: "skill_check", characterId: "jace", skill: "perception", difficulty: 12, purpose: "noticing the stranger at the inn", flag: "saw-stranger" }],
  });
  expect(textOf(acted)).toContain("noticing the stranger");

  const scene = await $.tool.call({
    tool: "mcp__storyteller__storyteller_scene",
    prose: "The inn is quiet tonight.",
    choices: [
      { id: "road", label: "Take the Vale road into the Duln", actions: [{ type: "travel", to: "duln-forest" }] },
      { id: "fly", label: "Fly to Paranor", actions: [{ type: "travel", to: "paranor" }] },
    ],
  });
  expect(textOf(scene)).toContain("recorded with 1 choice");
  expect(textOf(scene)).toContain("Fly to Paranor");

  for (const surface of ["terminal", "desktop"] as const) {
    const ui = await $.ui.mount({ ...PANE, surface });
    expect((await ui.find({ type: "Text", text: /Test Road/ }))?.text).toContain("Shady Vale");
    expect(await ui.find({ type: "Button", key: "c-road" })).toBeTruthy();
    await ui.unmount();
  }
});

test("/storyteller new leaves the kickoff in the prompt box and a choice press submits one", async ($, on) => {
  engineStandIns(on);
  const submitted: string[] = [];
  const filled: string[] = [];
  on("prompt.submit", (_, e) => {
    submitted.push(e.text);
    return { text: e.text };
  });
  on("prompt.fill", (_, e) => {
    filled.push(e.text);
    return { isFilled: true };
  });
  await $.session.start({ cwd: "/", surface: "terminal", isInteractive: true });

  const ran = await $.command.run({ command: "storyteller", args: "new Rivers" });
  expect(ran.text).toContain("Setting up");
  expect(ran.context?.[0]).toContain("Rivers");
  expect(submitted.length).toBe(0);
  expect(filled.length).toBe(1);
  expect(filled[0]).toContain("[Storyteller] Set up a new campaign");

  await $.tool.call({
    tool: "mcp__storyteller__storyteller_new_campaign",
    name: "Rivers",
    party: [{ id: "jace", name: "Jace", speciesId: "half-elf", archetypeId: "valeman", playerId: "p1" }],
  });
  await $.tool.call({
    tool: "mcp__storyteller__storyteller_scene",
    prose: "Evening at the inn.",
    choices: [{ id: "road", label: "Take the Vale road", actions: [{ type: "travel", to: "duln-forest" }] }],
  });
  const ui = await $.ui.mount({ ...PANE, surface: "terminal" });
  await ui.press({ key: "c-road" });
  expect(submitted.length).toBe(1);
  expect(submitted[0]).toContain("The player chose");
  expect(submitted[0]).toContain("Take the Vale road");
  await ui.unmount();
});
