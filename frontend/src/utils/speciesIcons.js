export const SPECIES_ICONS = {
  Tiger: "🐅",
  Elephant: "🐘",
  Deer: "🦌",
  Leopard: "🐆",
  "Wild Boar": "🐗",
  Peacock: "🦚",
  Jackal: "🐺",
  Bear: "🐻",
  Lion: "🦁",
  Zebra: "🦓",
  Monkey: "🐒",
  Rabbit: "🐇",
  Fox: "🦊",
  Wolf: "🐺",
  Dog: "🐕",
  Cat: "🐈",
  Bird: "🦅",
};

export function getSpeciesIcon(species) {
  if (!species) return "🐾";
  const match = Object.keys(SPECIES_ICONS).find(
    (key) => key.toLowerCase() === species.toLowerCase()
  );
  return match ? SPECIES_ICONS[match] : "🐾";
}

export default getSpeciesIcon;
