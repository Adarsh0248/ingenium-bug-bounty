export const regions = [
  {
    id: "neon",
    category: "ARRAYS",
    name: "Neon District",
    family: "Relay wasp",
    specialty: "Signal interceptors",
    description: "Rain-slick towers. Hologram traffic. Hunt the signal.",
    color: "#fa81de",
    shell: "#6c526e",
    limb: "#bb9ebd",
    dark: "#160e28",
    sky: "#382042",
  },
  {
    id: "foundry",
    category: "SYSTEMS",
    name: "Ember Foundry",
    family: "Furnace scarab",
    specialty: "Armoured scavengers",
    description: "Molten cores. Heavy machinery. Break the armour.",
    color: "#ffc477",
    shell: "#816044",
    limb: "#c6a078",
    dark: "#211016",
    sky: "#593126",
  },
  {
    id: "verdant",
    category: "GRAPHS",
    name: "Verdant Circuit",
    family: "Prism mantis",
    specialty: "Camouflaged stalkers",
    description: "Overgrown servers. Living circuits. Trace the anomaly.",
    color: "#a9f6a0",
    shell: "#4f745b",
    limb: "#93ba8c",
    dark: "#0b1b1c",
    sky: "#23473b",
  },
  {
    id: "cryo",
    category: "LOGIC",
    name: "Cryo Vault",
    family: "Crystal weaver",
    specialty: "Ice-web sentinels",
    description: "Frozen archives. Aurora light. Unravel the web.",
    color: "#9cddff",
    shell: "#58758d",
    limb: "#a6c9df",
    dark: "#0c1626",
    sky: "#293f60",
  },
] as const;
export type RegionId = (typeof regions)[number]["id"];

// Shared by scenery and target placement so a creature never leaves its habitat.
export function regionField(
  width: number,
  height: number,
  region: RegionId | null,
  decorative = false,
) {
  const mobile = width <= 720;
  const left = decorative ? width * 0.52 : mobile ? 18 : 350;
  const top = decorative ? height * 0.24 : mobile ? 338 : 236;
  const field = {
    left,
    top,
    width: Math.max(100, width - left - (mobile ? 18 : 84)),
    height: Math.max(
      90,
      height - top - (decorative ? 120 : mobile ? height * 0.29 + 85 : 106),
    ),
  };
  if (region === null) return field;
  const index = regions.findIndex((item) => item.id === region),
    gap = mobile ? 8 : 18;
  return {
    left: field.left + ((index % 2) * (field.width + gap)) / 2,
    top: field.top + (Math.floor(index / 2) * (field.height + gap)) / 2,
    width: (field.width - gap) / 2,
    height: (field.height - gap) / 2,
  };
}
