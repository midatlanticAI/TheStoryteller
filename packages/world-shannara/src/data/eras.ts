import type { Era } from "@storyteller/engine";

/** Chronological order of the world. Only `playable` eras can host a campaign today. */
export const eras: Era[] = [
  {
    id: "word-and-void",
    name: "The Word and the Void",
    order: 1,
    summary:
      "Our own world at the end of the twentieth century, where the Word's Knights fight a quiet war against the Void's demons in small American towns.",
    situation:
      "Magic is hidden and disbelieved. The Void works through corruption and despair. The fall of the Old World has not yet begun.",
    playable: false,
    bookIds: ["running-with-the-demon", "knight-of-the-word", "angel-fire-east"],
  },
  {
    id: "genesis",
    name: "Genesis: the Great Wars",
    order: 2,
    summary:
      "The Old World dies in plague, war, and poison. A Knight of the Word, a street boy with a gift, and the hidden Elves of Cintra try to carry something living through the end.",
    situation:
      "Cities are ruins ruled by once-men and demons. Survivors live in compounds. The Elves still hide inside a mountain with the Ellcrys. Everything that follows grows from who escapes.",
    playable: false,
    bookIds: ["armageddons-children", "elves-of-cintra", "gypsy-morph"],
  },
  {
    id: "legends",
    name: "Legends: the sealed valley",
    order: 3,
    summary:
      "Five hundred years after the Great Wars, the survivors' valley has been sealed from the ruined world by magic. Now the wards are failing and Trolls press at the passes.",
    situation:
      "A single Bearer of the Black Staff watches the valley. The people inside have forgotten the outside. The first steps into what will become the Four Lands are being taken.",
    playable: false,
    bookIds: ["bearers", "measure"],
  },
  {
    id: "first-king",
    name: "First King of Shannara",
    order: 4,
    summary:
      "Centuries before the Sword. The Druid Council at Paranor has grown complacent; the outcast Bremen sees the rebel Druid Brona rising in the Northland with an army of Trolls and Gnomes, and seeks a weapon and a king to carry it.",
    situation:
      "The Second War of the Races is coming. Paranor will not listen. The Sword of Shannara does not yet exist. The Elven king Jerle Shannara has not yet been chosen.",
    playable: false,
    bookIds: ["first-king"],
  },
  {
    id: "sword",
    name: "The Sword of Shannara",
    order: 5,
    summary:
      "The Four Lands, some five hundred years after the Second War of the Races. The Warlock Lord, thought destroyed, is gathering Gnome and Troll armies in the Northland, and his winged Skull Bearers hunt the last heir of the house of Shannara.",
    situation:
      "In Shady Vale, the half-Elf Shea Ohmsford lives quietly with his adoptive family at the inn. The Druid Allanon has come south with a warning. The Sword of Shannara rests at Paranor, which Gnomes now hold. Callahorn's Border Legion stands between the Northland and the Southland, but the Southland's great cities refuse to believe in any threat. Elves, Dwarves, and the free peoples are not yet united.",
    playable: true,
    startLocationId: "shady-vale",
    bookIds: ["sword"],
  },
  {
    id: "elfstones",
    name: "The Elfstones of Shannara",
    order: 6,
    summary:
      "Fifty years after the Sword. The Ellcrys, the tree whose magic holds the demons of the Forbidding away from the world, is dying, and the Elves must carry its seed to the Bloodfire while the demons break through.",
    situation:
      "Wil Ohmsford, Shea's grandson, studies healing at Storlock. Allanon seeks him out to guard the Chosen Amberle. The Elven army under Eventine and his son Ander prepares to hold the Sarandanon. Rovers roam the Westland. The Wing Riders keep to the coast.",
    playable: false,
    startLocationId: "storlock",
    bookIds: ["elfstones"],
  },
  {
    id: "wishsong",
    name: "The Wishsong of Shannara",
    order: 7,
    summary:
      "Twenty years after the Elfstones. The Ildatch, a book of dark magic, has raised the Mord Wraiths in the deep Eastland, and the Ohmsford children Brin and Jair carry the wishsong, a magic in the blood that neither can fully control.",
    situation:
      "Allanon is old and knows it. The Dwarves are at war with Gnome tribes driven by the Mord Wraiths. The Maelmord grows around Graymark. Garet Jax, the Weapons Master, walks the Four Lands. The Sword of Leah is about to become more than steel.",
    playable: false,
    startLocationId: "shady-vale",
    bookIds: ["wishsong"],
  },
  {
    id: "heritage",
    name: "The Heritage of Shannara",
    order: 8,
    summary:
      "Three hundred years after the Wishsong. The Federation rules the Southland and outlaws magic, the Elves have vanished from the Westland, Paranor is gone, and the Shadowen feed in secret on the Four Lands.",
    situation:
      "Allanon's shade calls the Ohmsford scions to the Hadeshorn: Par and Coll, Wren, and Walker Boh. Each is given an impossible task. The Dwarves are enslaved in the Eastland. Morgan Leah carries his family's broken magic sword. Rimmer Dall commands the Seekers.",
    playable: false,
    startLocationId: "tyrsis",
    bookIds: ["scions", "druid", "elf-queen", "talismans"],
  },
  {
    id: "voyage",
    name: "The Voyage of the Jerle Shannara",
    order: 9,
    summary:
      "A hundred and thirty years after the Heritage. Walker Boh, sole Druid of a reborn Paranor, sails the airship Jerle Shannara across the Blue Divide to the far continent of Parkasia, chasing a map and a magic from the Old World, with the Ilse Witch in pursuit.",
    situation:
      "Airships cross the Four Lands. The Federation and the Free-born fight along the Prekkendorran. Grianne Ohmsford, taken as a child and raised by the Morgawr, is the Ilse Witch. Her brother Bek does not know who he is.",
    playable: false,
    startLocationId: "arborlon",
    bookIds: ["ilse-witch", "antrax", "morgawr"],
  },
  {
    id: "high-druid",
    name: "The High Druid of Shannara",
    order: 10,
    summary:
      "Twenty years after the Voyage. Grianne Ohmsford, now Ard Rhys of the Third Druid Council, is betrayed and cast into the Forbidding, and her nephew Pen must find the Tanequil to bring her back.",
    situation:
      "Shadea a'Ru and her faction hold Paranor. The Federation's Prime Minister Sen Dunsidan builds weapons of fire. In the Forbidding, the Straken Lord Tael Riverine rules the Jarka Ruus and plans to trade places with the world.",
    playable: false,
    startLocationId: "paranor",
    bookIds: ["jarka-ruus", "tanequil", "straken"],
  },
  {
    id: "dark-legacy",
    name: "The Dark Legacy of Shannara",
    order: 11,
    summary:
      "A hundred years after the High Druid. The Druid Aphenglow Elessedil finds a diary that speaks of the lost Elfstones, and the search for them opens the Forbidding once more.",
    situation:
      "Khyber Elessedil is Ard Rhys. The Federation's Prime Minister Drust Chazhul wants Paranor broken. The Ellcrys is failing again and a Chosen must carry its seed to the Bloodfire, as Amberle once did.",
    playable: false,
    startLocationId: "paranor",
    bookIds: ["wards", "bloodfire", "witch-wraith"],
  },
  {
    id: "defenders",
    name: "The Defenders of Shannara",
    order: 12,
    summary:
      "Generations later. Paxon Leah, bearer of the Sword of Leah, becomes the Druids' Blade, and the sorcerer Arcannen schemes against Paranor from the shadows of the Federation.",
    situation:
      "Paranor stands but is watched with suspicion. The Federation tolerates the Druids barely. Magic-born children are hunted or exploited. Arcannen's reach is long.",
    playable: false,
    startLocationId: "paranor",
    bookIds: ["high-druids-blade", "darkling-child", "sorcerers-daughter"],
  },
  {
    id: "fall",
    name: "The Fall of Shannara",
    order: 13,
    summary:
      "The last age of the Druids. An invasion force from Skaarsland, a frozen and dying land across the sea, lands in the Northland with the power to become invisible, and Paranor falls to treachery from within.",
    situation:
      "Drisker Arc, Ard Rhys in exile, is drawn back by the Black Elfstone. Tarsha Kaynin carries the wishsong. Clizia Porse betrays the Druid order. The Skaar princess Ajin d'Amphere leads the advance. The Federation's machines march north.",
    playable: false,
    startLocationId: "paranor",
    bookIds: ["black-elfstone", "skaar-invasion", "stiehl-assassin", "last-druid"],
  },
];
