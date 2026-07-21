import type { TasteAxisDef } from "./types.js";

/**
 * Master list of taste axes.
 * Toggle `status` to active | stub | parked | disabled without deleting.
 * Order controls default UI sort.
 */
export const TASTE_AXES: readonly TasteAxisDef[] = [
  {
    id: "breadth",
    label: "Breadth",
    description:
      "Range of topic domains and content kinds (not which hosts were linked).",
    status: "active",
    version: 1,
    order: 10,
  },
  {
    id: "depth",
    label: "Depth",
    description:
      "Specificity and craft-level language suggesting sustained attention in a domain.",
    status: "active",
    version: 1,
    order: 20,
  },
  {
    id: "distinctiveness",
    label: "Distinctiveness",
    description:
      "How far the profile sits from generic template / cliché self-presentation.",
    status: "active",
    version: 1,
    order: 30,
  },
  {
    id: "coherence",
    label: "Coherence",
    description:
      "Whether themes agree across text items rather than feeling scattered.",
    status: "active",
    version: 1,
    order: 40,
  },
  {
    id: "discovery_orientation",
    label: "Discovery orientation",
    description:
      "Niche/exploratory language vs mainstream or template trend language (proxy; not true trend-lag).",
    status: "active",
    version: 1,
    order: 50,
  },
  {
    id: "curation",
    label: "Curation",
    description:
      "Selectivity and point-of-view framing versus keyword stuffing or pure promo.",
    status: "active",
    version: 1,
    order: 60,
  },
  {
    id: "craft",
    label: "Craft",
    description:
      "Maker, process, and intentional practice signals (making vs only consuming).",
    status: "active",
    version: 1,
    order: 70,
  },
  {
    id: "t_shape",
    label: "T-shape",
    description:
      "Derived: combination of depth and breadth (specialist with range).",
    status: "active",
    version: 1,
    order: 80,
  },
  // --- Stubs: listed & traversable, not scored yet ---
  {
    id: "visual_consistency",
    label: "Visual consistency",
    description:
      "Palette coherence across linked images. MVP: per-link imageSignals already feed person colour; multi-image consistency scoring still stubbed.",
    status: "stub",
    version: 1,
    order: 100,
  },
  {
    id: "temporal_evolution",
    label: "Temporal evolution",
    description:
      "Reserved: how taste shifts over time (needs post timestamps / history).",
    status: "stub",
    version: 1,
    order: 110,
  },
  {
    id: "social_graph",
    label: "Social graph",
    description:
      "Reserved: taste implied by follows and boosts (needs graph APIs).",
    status: "stub",
    version: 1,
    order: 120,
  },
  {
    id: "tone",
    label: "Tone",
    description:
      "Reserved: humor and voice (dry, earnest, chaotic) from longer text.",
    status: "stub",
    version: 1,
    order: 130,
  },
  {
    id: "local_global",
    label: "Local vs global",
    description:
      "Reserved: place-rooted scenes vs cosmopolitan references (needs geo entities).",
    status: "stub",
    version: 1,
    order: 140,
  },
] as const;

export function listTasteAxes(
  opts: { include?: RegistryStatusFilter } = {},
): TasteAxisDef[] {
  const include = opts.include ?? ["active", "stub"];
  return [...TASTE_AXES]
    .filter((a) => include.includes(a.status))
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

export function getTasteAxis(id: string): TasteAxisDef | undefined {
  return TASTE_AXES.find((a) => a.id === id);
}

type RegistryStatusFilter = TasteAxisDef["status"][];
