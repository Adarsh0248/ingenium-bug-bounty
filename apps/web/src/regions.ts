export const regions = [
  {
    id: "neon",
    category: "ARRAYS",
    name: "Neon District",
    family: "Signal swarm",
    aura: "Signal halo",
    specialty: "Signal interceptors",
    description: "Circuit paths. Memory banks. Hunt the corrupted signal.",
    color: "#ff4ed6",
    shell: "#152b47",
    limb: "#49e9ff",
    dark: "#060c22",
    sky: "#442460",
  },
  {
    id: "foundry",
    category: "SYSTEMS",
    name: "Silicon Hive",
    family: "Armoured automata",
    aura: "Circuit corona",
    specialty: "Hardware interceptors",
    description: "Copper traces. Encrypted traffic. Breach the armoured swarm.",
    color: "#ffc477",
    shell: "#816044",
    limb: "#c6a078",
    dark: "#211016",
    sky: "#593126",
  },
  {
    id: "verdant",
    category: "GRAPHS",
    name: "Verdant Nexus",
    family: "Network anomalies",
    aura: "Branching signal",
    specialty: "Graphs, trees & traversal",
    description:
      "Living networks. Branching pulses. Trace the escaped anomaly.",
    color: "#a9f6a0",
    shell: "#4f745b",
    limb: "#93ba8c",
    dark: "#0b1b1c",
    sky: "#23473b",
  },
  {
    id: "cryo",
    category: "LOGIC",
    name: "Zero-Day Core",
    family: "Intrusion entities",
    aura: "Intrusion field",
    specialty: "Logic, state & concurrency",
    description:
      "Compromised memory. Active countermeasures. Trace the breach.",
    color: "#b9ff4f",
    shell: "#243645",
    limb: "#b2c6b5",
    dark: "#05090f",
    sky: "#16303a",
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
