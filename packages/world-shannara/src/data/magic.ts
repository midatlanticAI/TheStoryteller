import type { WorldPackInput } from "@storyteller/engine";

export const magicSources: WorldPackInput["magicSources"] = [
  {
    id: "elfstones-blue",
    name: "The Blue Elfstones",
    kind: "bound-to-item",
    summary:
      "The seeking stones of the old Elven magic: held in the hand, with the mind fixed on what is sought, they show the way; faced with a creature of dark magic, they burn with blue fire. They answer only to Elven blood and only to a willing, open mind.",
    cost: "Each use draws on the holder's body and spirit and leaves a weariness that deepens with use. Every use is a beacon to the Warlock Lord's servants, who feel the magic and come.",
    requires: { speciesIds: ["elf", "half-elf"], itemId: "blue-elfstones" },
    effects: [
      { id: "seek", name: "Seeking", summary: "Shows the holder a vision of the way to a person or place they hold firmly in mind.", kind: "seek", difficulty: 14, strain: 3, attention: 6 },
      { id: "blue-fire", name: "Blue Fire", summary: "A lance of blue flame that burns creatures of dark magic; against ordinary foes it does little.", kind: "attack", difficulty: 16, strain: 4, attention: 8, damage: "3d8" },
    ],
    revealedIn: "sword",
  },
  {
    id: "druid-lore",
    name: "Druid Lore",
    kind: "learned",
    summary:
      "The learned magic of Paranor, drawn from the old sciences and the older magic of Faerie. A true Druid commands fire, sleep, illusion, and the shades of the dead; a scholar with a scrap of Druid teaching can manage far less, and pays as dearly.",
    cost: "Druid magic ages and exhausts its user. The Druid Sleep restores a Druid but steals years. A novice who overreaches collapses.",
    requires: { training: true },
    effects: [
      { id: "druid-fire", name: "Druid Fire", summary: "Blue fire from the hands, enough to burn a foe or a door.", kind: "attack", difficulty: 16, strain: 3, attention: 4, damage: "2d8" },
      { id: "sleep-of-the-mind", name: "Sleep of the Mind", summary: "A touch and a word that send a creature or person into sleep.", kind: "command", difficulty: 15, strain: 2, attention: 2 },
      { id: "far-seeing", name: "Far Seeing", summary: "The mind reaches out to see what is distant or hidden.", kind: "reveal", difficulty: 14, strain: 2, attention: 2 },
      { id: "veil", name: "Veil", summary: "Hides the party from eyes and nose for a short while.", kind: "veil", difficulty: 13, strain: 2, attention: 1 },
      { id: "mending", name: "Mending", summary: "Knits flesh and bone with the old lore, poorly compared to a Stor, but at need.", kind: "heal", difficulty: 13, strain: 3, attention: 1, heal: 6 },
      { id: "call-the-shade", name: "Call the Shade", summary: "At the Hadeshorn at dawn, a Druid calls a shade of the dead to answer a question with a riddle.", kind: "reveal", difficulty: 20, strain: 5, attention: 3 },
    ],
    revealedIn: "sword",
  },
  {
    id: "sword-of-shannara",
    name: "The Sword of Shannara",
    kind: "bound-to-item",
    summary:
      "The Sword's only magic is truth. Drawn by an heir of Jerle Shannara, it shows the bearer every truth about themselves, which is the hardest part, and then shows the enemy its own truth, which the servants of lies cannot survive.",
    cost: "The bearer must first endure the truth about themselves, which has broken people. The Sword gives no fire, no strength, and no protection from steel.",
    requires: { speciesIds: ["half-elf", "elf"], itemId: "sword-of-shannara" },
    effects: [
      { id: "truth", name: "The Truth", summary: "The Sword lays bare what is true, in the bearer and in what the bearer faces. Against a thing made of lies this is fatal to it.", kind: "reveal", difficulty: 18, strain: 5, attention: 10 },
    ],
    revealedIn: "sword",
  },
  {
    id: "skull-magic",
    name: "The Skull Magic",
    kind: "dark",
    summary:
      "The necromancy of the Warlock Lord, drawn from the forbidden lore he stole from Paranor: it keeps the dead moving, twists the living into Skull Bearers, and binds Gnomes and Trolls by fear.",
    cost: "It consumes its user entirely. There is no coming back. The engine never grants it to a player character.",
    requires: { speciesIds: [] },
    effects: [{ id: "black-fire", name: "Black Fire", summary: "Cold fire that kills.", kind: "attack", difficulty: 40, strain: 99, attention: 50, damage: "4d8" }],
    revealedIn: "sword",
  },
  {
    id: "wishsong",
    name: "The Wishsong",
    kind: "innate",
    summary:
      "The magic in the Ohmsford blood, born of the Elfstones' use: a song that makes the world what the singer wishes. In some it is only illusion, song that makes others see what is not there; in others it is real, and can change living things.",
    cost: "The wishsong is wild and grows with use. Its real form can kill without meaning to and changes the singer. It frightens the singer more than anyone.",
    requires: { bloodline: "Ohmsford" },
    effects: [
      { id: "song-of-seeming", name: "Song of Seeming", summary: "Illusions: a sound, a shape, a path that is not there.", kind: "veil", difficulty: 13, strain: 2, attention: 3 },
      { id: "song-of-command", name: "Song of Command", summary: "The real wishsong: living things bend to the singer's wish.", kind: "command", difficulty: 17, strain: 4, attention: 6 },
      { id: "song-of-ruin", name: "Song of Ruin", summary: "The wishsong turned to destruction, which the singer may not be able to stop.", kind: "attack", difficulty: 18, strain: 6, attention: 10, damage: "3d10" },
    ],
    revealedIn: "wishsong",
  },
  {
    id: "faerie-ellcrys",
    name: "The Magic of the Ellcrys",
    kind: "faerie",
    summary:
      "The living magic of the tree that holds the Forbidding shut, given to its Chosen. It does not serve as a weapon; it serves the tree.",
    cost: "It asks everything of the Chosen it selects.",
    requires: { speciesIds: ["elf"] },
    effects: [{ id: "ellcrys-call", name: "The Ellcrys' Call", summary: "The tree speaks to a Chosen and shows what must be done.", kind: "reveal", difficulty: 15, strain: 2, attention: 0 }],
    revealedIn: "elfstones",
  },
];
