import type { WorldPackInput } from "@storyteller/engine";

export const archetypes: WorldPackInput["archetypes"] = [
  {
    id: "valeman",
    name: "Valeman",
    summary:
      "A son or daughter of the small towns of the Southland, raised to work an inn, a farm, or a trade. Knows the woods near home, little of the wider world, and more courage than anyone expects.",
    skills: { survival: 1, perception: 1, persuasion: 1 },
    startingItemIds: ["hunting-knife", "travel-cloak", "waybread", "herb-poultice"],
    revealedIn: "sword",
  },
  {
    id: "highlander",
    name: "Highlander",
    summary:
      "A hunter and swordsman from the Highlands of Leah, proud, restless, and sure of a blade. The Leah nobility hunt the hills and take the road for adventure as readily as duty.",
    skills: { melee: 2, archery: 1, athletics: 1 },
    startingItemIds: ["broadsword", "ash-bow", "leather-jerkin", "waybread"],
    revealedIn: "sword",
  },
  {
    id: "borderman",
    name: "Borderman",
    summary:
      "A soldier of Callahorn, the border kingdom that has held the Northland off the Southland for generations. Drilled in the Border Legion's discipline, used to command and to being obeyed.",
    skills: { melee: 2, command: 1, athletics: 1 },
    startingItemIds: ["broadsword", "legion-mail", "wooden-shield", "waybread"],
    revealedIn: "sword",
  },
  {
    id: "dwarf-warrior",
    name: "Warrior of the Anar",
    summary:
      "A fighter of the Dwarf nation, blooded against Gnome raiders in the Eastland forests. Carries a mace or axe and a long memory for the enemy.",
    skills: { melee: 2, survival: 1, perception: 1 },
    startingItemIds: ["dwarf-mace", "chain-mail", "waybread", "rope"],
    speciesAllowed: ["dwarf"],
    revealedIn: "sword",
  },
  {
    id: "elven-hunter",
    name: "Elven Hunter",
    summary:
      "One of the Elven king's hunters and scouts, at home in the deep Westland forests, light on the trail and deadly with a bow.",
    skills: { archery: 2, stealth: 1, survival: 1 },
    startingItemIds: ["hunting-bow", "short-sword", "leather-jerkin", "waybread"],
    speciesAllowed: ["elf", "half-elf"],
    revealedIn: "sword",
  },
  {
    id: "tracker",
    name: "Tracker",
    summary:
      "A hunter of the hills who reads a trail the way others read a page. Gnome trackers are the finest in the Four Lands; a few serve coin rather than tribe.",
    skills: { survival: 2, stealth: 1, perception: 1 },
    startingItemIds: ["short-sword", "hunting-knife", "travel-cloak", "waybread"],
    revealedIn: "sword",
  },
  {
    id: "thief",
    name: "Thief",
    summary:
      "A wanderer who lives on wit, a quick hand, and a quicker tongue. Thieves of the Border country are as likely to save your life as take your purse, and will tell you so.",
    skills: { thievery: 2, stealth: 1, persuasion: 1 },
    startingItemIds: ["short-sword", "dagger", "travel-cloak", "waybread"],
    revealedIn: "sword",
  },
  {
    id: "stor-healer",
    name: "Healer of Storlock",
    summary:
      "Trained by the Stors, the silent healers of Storlock at the edge of the Wolfsktaag, whose skill with herb and wound is the best in the Four Lands and whose doors are open to all.",
    skills: { healing: 2, lore: 1, perception: 1 },
    startingItemIds: ["stor-salve", "stor-salve", "herb-poultice", "walking-staff", "travel-cloak"],
    revealedIn: "sword",
  },
  {
    id: "loremaster",
    name: "Loremaster",
    summary:
      "A scholar of the histories, the kind the Druids once trained at Paranor. Few remain who believe the old tales; fewer still who know which are true. A touch of Druid teaching sits in the memory.",
    skills: { lore: 2, arcana: 1, persuasion: 1 },
    startingItemIds: ["walking-staff", "dagger", "travel-cloak", "waybread"],
    magicSourceIds: ["druid-lore"],
    revealedIn: "sword",
  },
  {
    id: "troll-soldier",
    name: "Troll Soldier",
    summary:
      "A warrior of a Rock Troll nation, trained from childhood in the long spear and the shield wall. Those who leave their nation, by exile or choice, carry its discipline with them.",
    skills: { melee: 2, command: 1, athletics: 1 },
    startingItemIds: ["troll-mace", "troll-hide-armor", "waybread"],
    speciesAllowed: ["rock-troll"],
    revealedIn: "sword",
  },
  {
    id: "rover",
    name: "Rover",
    summary:
      "One of the wandering clans of the Westland and Southland roads, traders and horse-breeders who answer to no king. Sharp bargainers, better riders, and loyal only to the family.",
    skills: { persuasion: 2, thievery: 1, survival: 1 },
    startingItemIds: ["short-sword", "dagger", "travel-cloak", "waybread"],
    revealedIn: "elfstones",
  },
  {
    id: "wing-rider",
    name: "Wing Rider",
    summary:
      "An Elf of the Wing Hove on the western coast, bonded to a great Roc and flying the Blue Divide. The Wing Riders keep apart from the land Elves and owe Arborlon no allegiance.",
    skills: { archery: 1, perception: 2, survival: 1 },
    startingItemIds: ["hunting-bow", "short-sword", "leather-jerkin"],
    speciesAllowed: ["elf"],
    revealedIn: "elfstones",
  },
];
