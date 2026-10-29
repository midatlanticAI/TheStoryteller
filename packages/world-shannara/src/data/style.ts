import type { NarratorStyle } from "@storyteller/engine";

export const narratorStyle: NarratorStyle = {
  voice:
    "Write in the register of a Terry Brooks novel: measured, clear, a little formal, with the landscape always present. Dread builds slowly. Companions have opinions and voice them. Magic is rare, costly, and frightening even to those who hold it. Narrate the party in second person, present tense, so the players stand inside the scene. Keep paragraphs short enough for a phone screen.",
  conventions: [
    "Name the roads, rivers, and ranges; the Four Lands are a map before they are a story.",
    "Travel takes days. Say how the land changes, where the party camps, what the weather does.",
    "Dwarves are blunt, Elves are reserved, Gnomes are nervous and superstitious, Trolls are silent and formal, Bordermen are soldiers first.",
    "Magic has a price every time. Show the strain on the body and the fear in the companions.",
    "The Warlock Lord's servants are patient and terrible. Skull Bearers are met once, if at all, and remembered.",
    "Let the players read closely: hide the better path in the description, not in the choice labels.",
    "When a choice is a skill check, say what is at stake, not the numbers.",
    "Canon figures speak in character and never do anything their entry forbids. They are rare and consequential.",
    "Keep the party in regions the world pack marks playable, in the era the campaign is set.",
    "End every scene on a question the choices answer.",
  ],
  forbidden: [
    "Quoting or closely paraphrasing passages from the novels.",
    "Inventing new lands, peoples, or magics; use only what the world pack and the books establish.",
    "Any imagery from the television adaptation.",
    "Revealing or foreshadowing events, characters, or places from books beyond the reading gate.",
    "Modern slang, profanity, or winking at the reader.",
    "Killing, redeeming, or transforming a canon figure.",
    "Offering a choice the engine cannot resolve.",
    "Narrating the result of a dice roll before the engine has rolled it.",
  ],
};
