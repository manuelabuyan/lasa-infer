/**
 * "Person colour" — first taste conclusion for the living graphic.
 * Edit COLOUR_DEFS / topic→colour map freely; scoring stays declarative.
 */

import { collectText, topicHits } from "./lexicons.js";
import type { Evidence } from "../types.js";
import type { LinkSnapshot } from "../linkEvidence.js";
import type { TasteScoreContext } from "./types.js";

export interface TasteColourDef {
  id: string;
  label: string;
  /** CSS-friendly "r, g, b" for canvas rgba(). */
  rgb: string;
  hex: string;
  description: string;
  /** Topic bucket ids from lexicons that pull toward this colour. */
  topics: string[];
  /** Optional keyword boosts (beyond topics). */
  keywords?: string[];
  status: "active" | "disabled";
}

/**
 * Palette of person colours. Toggle status or add entries as the model evolves.
 * Default / low-data falls back to `slate`.
 */
export const COLOUR_DEFS: readonly TasteColourDef[] = [
  {
    id: "ember",
    label: "Ember",
    rgb: "210, 92, 58",
    hex: "#D25C3A",
    description: "Warm film / photo / craft heat.",
    topics: ["film", "photo"],
    keywords: ["analog", "35mm", "darkroom", "warm", "sunset", "red"],
    status: "active",
  },
  {
    id: "violet",
    label: "Violet",
    rgb: "124, 92, 196",
    hex: "#7C5CC4",
    description: "Music, art, experimental edges.",
    topics: ["music", "art"],
    keywords: ["jazz", "techno", "experimental", "gallery", "night"],
    status: "active",
  },
  {
    id: "ink",
    label: "Ink",
    rgb: "62, 98, 168",
    hex: "#3E62A8",
    description: "Design, tech, systems thinking.",
    topics: ["design", "tech", "architecture"],
    keywords: ["code", "ui", "type", "product", "build"],
    status: "active",
  },
  {
    id: "moss",
    label: "Moss",
    rgb: "72, 132, 96",
    hex: "#488460",
    description: "Place, food, travel, grounded scenes.",
    topics: ["food", "travel", "sports"],
    keywords: ["green", "garden", "city", "kitchen", "run"],
    status: "active",
  },
  {
    id: "blush",
    label: "Blush",
    rgb: "196, 106, 138",
    hex: "#C46A8A",
    description: "Fashion, style, soft social polish.",
    topics: ["fashion"],
    keywords: ["style", "fit", "beauty", "pink", "soft"],
    status: "active",
  },
  {
    id: "gold",
    label: "Gold",
    rgb: "196, 148, 64",
    hex: "#C49440",
    description: "Literature / reflective / archival warmth.",
    topics: ["literature"],
    keywords: ["book", "essay", "poem", "archive", "gold"],
    status: "active",
  },
  {
    id: "slate",
    label: "Slate",
    rgb: "120, 126, 138",
    hex: "#787E8A",
    description: "Neutral default when evidence is thin or mixed.",
    topics: [],
    status: "active",
  },
] as const;

export interface TasteColourResult {
  id: string;
  label: string;
  rgb: string;
  hex: string;
  confidence: number;
  summary: string;
  /** Topic/keyword scores that won. */
  scores: Record<string, number>;
}

export function listTasteColours(
  opts: { includeDisabled?: boolean } = {},
): TasteColourDef[] {
  return COLOUR_DEFS.filter(
    (c) => opts.includeDisabled || c.status === "active",
  );
}

export function getTasteColour(id: string): TasteColourDef | undefined {
  return COLOUR_DEFS.find((c) => c.id === id);
}

/**
 * Infer a single person colour from evidence + link snapshots.
 * Pure rules — no network. Easy to retune via COLOUR_DEFS + lexicons.
 */
export function inferTasteColour(
  evidence: Evidence,
  snapshots: LinkSnapshot[] = [],
): TasteColourResult {
  const extra = snapshots
    .flatMap((s) => s.textSignals)
    .join(" ")
    .toLowerCase();
  const text = `${collectText(evidence)} ${extra}`.toLowerCase();
  const topics = topicHits(text);
  const scores: Record<string, number> = {};

  const active = listTasteColours();
  for (const def of active) {
    if (def.id === "slate") {
      scores[def.id] = 0.05; // tiny baseline
      continue;
    }
    let s = 0;
    for (const t of def.topics) {
      s += (topics.get(t) ?? 0) * 1.2;
    }
    for (const kw of def.keywords ?? []) {
      if (text.includes(kw.toLowerCase())) s += 1.1;
    }
    // Platform soft bias
    if (def.id === "violet" && evidence.platforms.includes("tiktok")) s += 0.3;
    if (def.id === "ink" && evidence.platforms.includes("linkedin")) s += 0.25;
    if (
      (def.id === "ember" || def.id === "blush") &&
      evidence.platforms.includes("instagram")
    ) {
      s += 0.2;
    }
    if (def.id === "ink" && evidence.platforms.includes("youtube")) s += 0.15;
    scores[def.id] = s;
  }

  // Thin text → force slate
  const textLen = text.trim().length;
  const hasSignal = Object.entries(scores).some(
    ([id, v]) => id !== "slate" && v >= 0.8,
  );

  let winner = active.find((c) => c.id === "slate")!;
  let best = -1;
  if (textLen >= 12 && hasSignal) {
    for (const def of active) {
      if (def.id === "slate") continue;
      const v = scores[def.id] ?? 0;
      if (v > best) {
        best = v;
        winner = def;
      }
    }
  }

  // Confidence: how decisive + how much text
  const second = Object.entries(scores)
    .filter(([id]) => id !== winner.id && id !== "slate")
    .map(([, v]) => v)
    .sort((a, b) => b - a)[0] ?? 0;
  const margin = Math.max(0, (scores[winner.id] ?? 0) - second);
  const confFromText =
    textLen < 20 ? 0.2 : textLen < 80 ? 0.45 : textLen < 200 ? 0.65 : 0.8;
  const confFromMargin = winner.id === "slate" ? 0.25 : clamp01(margin / 3);
  const confidence = clamp01(0.45 * confFromText + 0.55 * confFromMargin);

  const topTopics = [...topics.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);

  const summary =
    winner.id === "slate"
      ? "Not enough public signal yet — neutral slate."
      : `${winner.label}: pulled by ${topTopics.join(", ") || "profile language"}.`;

  return {
    id: winner.id,
    label: winner.label,
    rgb: winner.rgb,
    hex: winner.hex,
    confidence,
    summary,
    scores,
  };
}

/** Helper when you already built a score context. */
export function inferTasteColourFromContext(
  ctx: TasteScoreContext,
): TasteColourResult {
  return inferTasteColour(ctx.evidence, ctx.snapshots);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
