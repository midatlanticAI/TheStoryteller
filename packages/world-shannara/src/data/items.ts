import type { WorldPackInput } from "@storyteller/engine";

export const items: WorldPackInput["items"] = [
  // weapons
  { id: "hunting-knife", name: "Hunting Knife", kind: "weapon", summary: "A Valeman's working blade.", damage: "1d4", skill: "melee", value: 2, revealedIn: "sword" },
  { id: "dagger", name: "Dagger", kind: "weapon", summary: "A long knife, easily hidden.", damage: "1d4", skill: "melee", value: 3, revealedIn: "sword" },
  { id: "short-sword", name: "Short Sword", kind: "weapon", summary: "A plain soldier's sword of the Border country.", damage: "1d6", skill: "melee", value: 8, revealedIn: "sword" },
  { id: "broadsword", name: "Broadsword", kind: "weapon", summary: "A heavy blade of the kind the Highlanders and the Legion carry.", damage: "1d8", skill: "melee", value: 15, revealedIn: "sword" },
  { id: "walking-staff", name: "Walking Staff", kind: "weapon", summary: "A traveller's staff of ash or oak.", damage: "1d6", skill: "melee", value: 1, revealedIn: "sword" },
  { id: "dwarf-mace", name: "Dwarf Mace", kind: "weapon", summary: "The iron-headed mace favoured by Dwarf warriors of the Anar.", damage: "1d8+1", skill: "melee", value: 18, revealedIn: "sword" },
  { id: "dwarf-axe", name: "Dwarf Axe", kind: "weapon", summary: "A broad-bladed Dwarf axe, as good for a door as for a Gnome.", damage: "1d10", skill: "melee", value: 20, revealedIn: "sword" },
  { id: "troll-mace", name: "Troll Mace", kind: "weapon", summary: "A great iron mace sized for a Rock Troll; a Human needs both hands and a strong back.", damage: "2d6", skill: "melee", value: 25, traits: ["heavy"], revealedIn: "sword" },
  { id: "hunting-bow", name: "Hunting Bow", kind: "weapon", summary: "A light bow for game and, at need, for Gnomes.", damage: "1d6", skill: "archery", value: 10, revealedIn: "sword" },
  { id: "ash-bow", name: "Ash Bow", kind: "weapon", summary: "A tall Highland bow of ash, the hunter's pride.", damage: "1d8", skill: "archery", value: 18, revealedIn: "sword" },
  // armor
  { id: "travel-cloak", name: "Travel Cloak", kind: "armor", summary: "A hooded cloak of oiled wool; it turns rain better than blades.", defense: 0, value: 3, revealedIn: "sword" },
  { id: "leather-jerkin", name: "Leather Jerkin", kind: "armor", summary: "Boiled leather over the chest and shoulders.", defense: 1, value: 10, revealedIn: "sword" },
  { id: "chain-mail", name: "Chain Mail", kind: "armor", summary: "A shirt of linked rings, Dwarf-made and heavy.", defense: 3, value: 40, traits: ["heavy"], revealedIn: "sword" },
  { id: "legion-mail", name: "Legion Mail", kind: "armor", summary: "The Border Legion's issue: mail over leather, with the Legion's mark.", defense: 2, value: 30, revealedIn: "sword" },
  { id: "troll-hide-armor", name: "Troll Plate", kind: "armor", summary: "Iron plates on hide, as the Troll nations make them.", defense: 4, value: 50, traits: ["heavy", "Troll-sized"], revealedIn: "sword" },
  { id: "wooden-shield", name: "Wooden Shield", kind: "shield", summary: "A round shield of bound oak.", defense: 1, value: 6, revealedIn: "sword" },
  // consumables and provisions
  { id: "waybread", name: "Waybread", kind: "provision", summary: "Dense travel bread that keeps for weeks.", value: 1, revealedIn: "sword" },
  { id: "herb-poultice", name: "Herb Poultice", kind: "consumable", summary: "Vale remedies: comfrey, moss, and clean linen.", heal: 4, value: 2, revealedIn: "sword" },
  { id: "stor-salve", name: "Stor Salve", kind: "consumable", summary: "A healing ointment of the Stors of Storlock, the best in the Four Lands.", heal: 8, value: 12, revealedIn: "sword" },
  // tools
  { id: "rope", name: "Rope", kind: "tool", summary: "Fifty feet of good hemp.", value: 2, revealedIn: "sword" },
  { id: "lantern", name: "Lantern", kind: "tool", summary: "An oil lantern with a shutter.", value: 3, revealedIn: "sword" },
  // relics and talismans
  { id: "blue-elfstones", name: "The Blue Elfstones", kind: "talisman", summary: "Three blue stones of the old Elven magic that seek what is hidden and burn what is of dark magic. They answer only to Elven blood, and they cost the user with every use.", magicSourceId: "elfstones-blue", unique: true, value: 0, traits: ["three stones in a leather pouch", "Elven blood only"], revealedIn: "sword" },
  { id: "sword-of-shannara", name: "The Sword of Shannara", kind: "relic", summary: "The blade forged in the age of Bremen and borne by Jerle Shannara: it holds no fire and no edge of magic, only the truth, which it forces on its bearer first and then on whatever the bearer faces.", magicSourceId: "sword-of-shannara", unique: true, value: 0, traits: ["a blade with a raised fist holding a torch on its hilt", "only a Shannara heir can draw its power"], revealedIn: "sword" },
  { id: "sword-of-leah", name: "The Sword of Leah", kind: "weapon", summary: "The heirloom blade of the Leah family, carried by its Princes. In this age it is fine steel and nothing more.", damage: "1d8+1", skill: "melee", unique: true, value: 0, traits: ["heirloom of Leah"], revealedIn: "sword" },
  { id: "black-elfstone", name: "The Black Elfstone", kind: "relic", summary: "The single black stone that drinks magic into itself, which restored Paranor from where the Druids hid it.", unique: true, value: 0, traits: ["consumes magic"], revealedIn: "druid" },
  { id: "ellcrys-seed", name: "The Ellcrys Seed", kind: "relic", summary: "The seed the dying Ellcrys gives one Chosen, to be carried to the Bloodfire so the tree may be reborn.", unique: true, value: 0, revealedIn: "elfstones" },
  { id: "the-stiehl", name: "The Stiehl", kind: "weapon", summary: "A blade of the age of Faerie that cuts through any protection, sought by assassins.", damage: "2d6+2", skill: "melee", unique: true, value: 0, traits: ["cuts through any ward"], revealedIn: "stiehl-assassin" },
];
