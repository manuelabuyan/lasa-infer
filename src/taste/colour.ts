/**
 * Person colour — first visual taste conclusion.
 *
 * Design goals (v0.4):
 * - Wide editable palette (COLOUR_DEFS)
 * - Blend top colours (not only winner-take-all)
 * - Weight evidence by access / richness
 * - Word-boundary token matching
 * - Soft influence from taste axes
 * - Soft platform hints (low weight)
 * - Change after first link; low confidence → lighter/softer colour
 */

import { linkSnapshotRichness, type LinkSnapshot } from "../linkEvidence.js";
import type { Evidence, PlatformId } from "../types.js";
import { collectText, topicHits } from "./lexicons.js";
import type { DataConfidence, TasteAxisResult, TasteScoreContext } from "./types.js";

export interface TasteColourDef {
  id: string;
  label: string;
  /** Full-confidence CSS "r, g, b". */
  rgb: string;
  hex: string;
  description: string;
  /** Topic bucket ids from lexicons that pull toward this colour. */
  topics: string[];
  /** Extra keywords (matched on word boundaries). */
  keywords?: string[];
  status: "active" | "disabled";
}

/**
 * Wide palette — add/remove/disable freely.
 * `slate` is the neutral fallback (always kept as soft baseline).
 */
export const COLOUR_DEFS: readonly TasteColourDef[] = [
  // Reds / warm
  {
    id: "crimson",
    label: "Crimson",
    rgb: "190, 45, 55",
    hex: "#BE2D37",
    description: "Bold passion, performance energy.",
    topics: ["sports", "fashion"],
    keywords: ["red", "passion", "fierce", "power", "bold"],
    status: "active",
  },
  {
    id: "ember",
    label: "Ember",
    rgb: "210, 92, 58",
    hex: "#D25C3A",
    description: "Warm film / photo / craft heat.",
    topics: ["film", "photo"],
    keywords: ["analog", "35mm", "darkroom", "warm", "sunset", "amber", "orange"],
    status: "active",
  },
  {
    id: "coral",
    label: "Coral",
    rgb: "232, 120, 96",
    hex: "#E87860",
    description: "Social warmth, soft energy.",
    topics: ["travel", "food"],
    keywords: ["coral", "peach", "friendly", "bright", "summer"],
    status: "active",
  },
  {
    id: "sand",
    label: "Sand",
    rgb: "196, 168, 120",
    hex: "#C4A878",
    description: "Calm lifestyle, earthy soft.",
    topics: ["travel", "fashion"],
    keywords: ["beige", "sand", "neutral", "minimal", "calm"],
    status: "active",
  },
  {
    id: "gold",
    label: "Gold",
    rgb: "196, 148, 64",
    hex: "#C49440",
    description: "Literature / reflective / archival warmth.",
    topics: ["literature"],
    keywords: ["book", "essay", "poem", "archive", "gold", "vintage"],
    status: "active",
  },
  {
    id: "honey",
    label: "Honey",
    rgb: "214, 170, 72",
    hex: "#D6AA48",
    description: "Warm optimism, food and hospitality.",
    topics: ["food"],
    keywords: ["honey", "yellow", "sunny", "kitchen", "bake", "coffee"],
    status: "active",
  },
  // Greens
  {
    id: "lime",
    label: "Lime",
    rgb: "132, 180, 64",
    hex: "#84B440",
    description: "Fresh, active, outdoors.",
    topics: ["sports", "travel"],
    keywords: ["lime", "fresh", "hike", "active", "outdoor"],
    status: "active",
  },
  {
    id: "moss",
    label: "Moss",
    rgb: "72, 132, 96",
    hex: "#488460",
    description: "Place, food, travel, grounded scenes.",
    topics: ["food", "travel", "sports"],
    keywords: ["green", "garden", "forest", "nature", "earth"],
    status: "active",
  },
  {
    id: "forest",
    label: "Forest",
    rgb: "46, 98, 72",
    hex: "#2E6248",
    description: "Deep grounded calm.",
    topics: ["travel"],
    keywords: ["forest", "pine", "trail", "wild", "camp"],
    status: "active",
  },
  {
    id: "sage",
    label: "Sage",
    rgb: "140, 156, 132",
    hex: "#8C9C84",
    description: "Soft minimal green.",
    topics: ["design", "fashion"],
    keywords: ["sage", "muted", "quiet", "soft green"],
    status: "active",
  },
  // Teals / cyans
  {
    id: "teal",
    label: "Teal",
    rgb: "48, 140, 140",
    hex: "#308C8C",
    description: "Balanced creative-tech.",
    topics: ["design", "music"],
    keywords: ["teal", "aqua", "balanced", "wave"],
    status: "active",
  },
  {
    id: "aqua",
    label: "Aqua",
    rgb: "64, 170, 180",
    hex: "#40AAB4",
    description: "Light digital / coastal.",
    topics: ["travel", "tech"],
    keywords: ["aqua", "ocean", "coast", "sea", "swim"],
    status: "active",
  },
  // Blues
  {
    id: "sky",
    label: "Sky",
    rgb: "96, 156, 214",
    hex: "#609CD6",
    description: "Open, social, clear.",
    topics: ["travel", "sports"],
    keywords: ["sky", "blue", "open", "clear", "day"],
    status: "active",
  },
  {
    id: "ink",
    label: "Ink",
    rgb: "62, 98, 168",
    hex: "#3E62A8",
    description: "Design, tech, systems thinking.",
    topics: ["design", "tech", "architecture"],
    keywords: ["code", "ui", "type", "product", "build", "system"],
    status: "active",
  },
  {
    id: "navy",
    label: "Navy",
    rgb: "40, 64, 112",
    hex: "#284070",
    description: "Serious craft, deep focus.",
    topics: ["tech", "literature", "architecture"],
    keywords: ["navy", "deep", "serious", "focus", "professional"],
    status: "active",
  },
  {
    id: "ice",
    label: "Ice",
    rgb: "160, 188, 214",
    hex: "#A0BCD6",
    description: "Cool minimal digital.",
    topics: ["tech", "design"],
    keywords: ["ice", "cool", "minimal", "clean", "frost"],
    status: "active",
  },
  // Purples
  {
    id: "lavender",
    label: "Lavender",
    rgb: "164, 140, 196",
    hex: "#A48CC4",
    description: "Soft creative, gentle art.",
    topics: ["art", "music"],
    keywords: ["lavender", "soft", "dream", "gentle"],
    status: "active",
  },
  {
    id: "violet",
    label: "Violet",
    rgb: "124, 92, 196",
    hex: "#7C5CC4",
    description: "Music, art, experimental edges.",
    topics: ["music", "art"],
    keywords: ["jazz", "techno", "experimental", "gallery", "night", "violet"],
    status: "active",
  },
  {
    id: "plum",
    label: "Plum",
    rgb: "112, 64, 112",
    hex: "#704070",
    description: "Rich night culture.",
    topics: ["music", "fashion", "art"],
    keywords: ["plum", "night", "club", "rich", "velvet"],
    status: "active",
  },
  // Pinks
  {
    id: "blush",
    label: "Blush",
    rgb: "196, 106, 138",
    hex: "#C46A8A",
    description: "Fashion, style, soft social polish.",
    topics: ["fashion"],
    keywords: ["style", "fit", "beauty", "pink", "soft", "blush"],
    status: "active",
  },
  {
    id: "rose",
    label: "Rose",
    rgb: "188, 84, 108",
    hex: "#BC546C",
    description: "Romantic / aesthetic polish.",
    topics: ["fashion", "art"],
    keywords: ["rose", "romantic", "aesthetic", "floral"],
    status: "active",
  },
  {
    id: "magenta",
    label: "Magenta",
    rgb: "180, 64, 140",
    hex: "#B4408C",
    description: "Bold creative statement.",
    topics: ["art", "music", "fashion"],
    keywords: ["magenta", "bold", "statement", "pop"],
    status: "active",
  },
  // Neutrals / earth
  {
    id: "copper",
    label: "Copper",
    rgb: "168, 96, 64",
    hex: "#A86040",
    description: "Crafted, handmade warmth.",
    topics: ["photo", "film", "art"],
    keywords: ["copper", "handmade", "craft", "metal", "raw"],
    status: "active",
  },
  {
    id: "espresso",
    label: "Espresso",
    rgb: "92, 64, 48",
    hex: "#5C4030",
    description: "Grounded, intimate, cafe culture.",
    topics: ["food", "literature"],
    keywords: ["coffee", "espresso", "brown", "cozy", "cafe"],
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
  {
    id: "charcoal",
    label: "Charcoal",
    rgb: "72, 76, 84",
    hex: "#484C54",
    description: "Dark minimal, high craft seriousness.",
    topics: ["design", "architecture", "tech"],
    keywords: ["black", "dark", "minimal", "mono", "charcoal"],
    status: "active",
  },
] as const;

export interface TasteColourResult {
  id: string;
  label: string;
  /** Display RGB already adjusted for confidence (lighter when low conf). */
  rgb: string;
  hex: string;
  /** Full-bold palette hex (before confidence softening). */
  boldHex: string;
  confidence: number;
  summary: string;
  /** Raw attraction scores before softmax. */
  scores: Record<string, number>;
  /** Blend weights after softmax (for debugging / UI). */
  blend: Array<{ id: string; label: string; weight: number; hex: string }>;
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

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function accessWeight(access: LinkSnapshot["access"]): number {
  switch (access) {
    case "public_meta":
      return 1;
    case "partial":
      return 0.55;
    case "unknown":
      return 0.35;
    case "blocked":
      return 0.12;
    case "error":
      return 0.05;
    default:
      return 0.2;
  }
}

/** Word-boundary-ish match (handles multi-word phrases). */
function termHit(text: string, term: string): boolean {
  const t = term.toLowerCase().trim();
  if (!t) return false;
  if (t.includes(" ")) return text.includes(t);
  // Avoid tiny tokens that false-fire (e.g. "ai", "ui" still allowed if exact word)
  try {
    const re = new RegExp(
      `(?:^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[^a-z0-9]|$)`,
      "i",
    );
    return re.test(text);
  } catch {
    return text.includes(t);
  }
}

function countTermHits(text: string, terms: string[]): {
  count: number;
  matched: string[];
} {
  const matched: string[] = [];
  for (const term of terms) {
    if (termHit(text, term)) matched.push(term);
  }
  return { count: matched.length, matched };
}

function parseRgb(rgb: string): { r: number; g: number; b: number } {
  const p = rgb.split(",").map((x) => Number(x.trim()));
  return { r: p[0] ?? 120, g: p[1] ?? 126, b: p[2] ?? 138 };
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

function mixRgb(
  parts: Array<{ r: number; g: number; b: number; w: number }>,
): { r: number; g: number; b: number } {
  let r = 0;
  let g = 0;
  let b = 0;
  let w = 0;
  for (const p of parts) {
    r += p.r * p.w;
    g += p.g * p.w;
    b += p.b * p.w;
    w += p.w;
  }
  if (w <= 0) return { r: 120, g: 126, b: 138 };
  return { r: r / w, g: g / w, b: b / w };
}

/** Softmax over positive scores. */
function softmax(scores: Record<string, number>, temperature = 0.85): Record<string, number> {
  const entries = Object.entries(scores).filter(([, v]) => v > 0);
  if (entries.length === 0) return { slate: 1 };
  const max = Math.max(...entries.map(([, v]) => v));
  const exps = entries.map(([id, v]) => {
    const e = Math.exp((v - max) / Math.max(0.15, temperature));
    return [id, e] as const;
  });
  const sum = exps.reduce((s, [, e]) => s + e, 0);
  const out: Record<string, number> = {};
  for (const [id, e] of exps) out[id] = e / sum;
  return out;
}

/**
 * Low confidence → lighter / softer; high confidence → bolder (higher sat, deeper mid).
 * confidence 0 → wash toward light slate; 1 → full blended colour.
 */
function applyConfidenceBoldness(
  rgb: { r: number; g: number; b: number },
  confidence: number,
): { r: number; g: number; b: number } {
  const c = clamp01(confidence);
  // Low conf → pastel of the same hue family (still visibly coloured).
  // High conf → full bold chroma.
  const soft = {
    r: 210 + (rgb.r - 210) * 0.35,
    g: 210 + (rgb.g - 210) * 0.35,
    b: 210 + (rgb.b - 210) * 0.35,
  };
  // Floor at 0.42 so first-link / low conf still reads as a clear tint
  const t = 0.42 + 0.58 * c;
  let r = soft.r + (rgb.r - soft.r) * t;
  let g = soft.g + (rgb.g - soft.g) * t;
  let b = soft.b + (rgb.b - soft.b) * t;

  const mean = (r + g + b) / 3;
  const satBoost = 0.25 + 0.45 * c;
  r = mean + (r - mean) * (1 + satBoost);
  g = mean + (g - mean) * (1 + satBoost);
  b = mean + (b - mean) * (1 + satBoost);

  const depth = 1 - 0.1 * c;
  return {
    r: Math.max(0, Math.min(255, r * depth)),
    g: Math.max(0, Math.min(255, g * depth)),
    b: Math.max(0, Math.min(255, b * depth)),
  };
}

export type InferColourOptions = {
  axes?: TasteAxisResult[];
  dataConfidence?: DataConfidence;
};

/**
 * Infer person colour from evidence + link snapshots (+ optional taste axes).
 * Pure rules — no network.
 */
export function inferTasteColour(
  evidence: Evidence,
  snapshots: LinkSnapshot[] = [],
  options: InferColourOptions = {},
): TasteColourResult {
  // --- Build weighted text: public rich links count more ---
  let weightedText = "";
  let totalWeight = 0;

  if (snapshots.length > 0) {
    for (const snap of snapshots) {
      const w =
        accessWeight(snap.access) * (0.4 + 0.6 * linkSnapshotRichness(snap));
      const chunk = [
        snap.handle,
        snap.title,
        snap.description,
        snap.author,
        ...snap.textSignals,
      ]
        .filter(Boolean)
        .join(" ");
      if (!chunk.trim()) continue;
      // Repeat text proportionally to weight (cheap weighted bag-of-words)
      const reps = Math.max(1, Math.round(w * 4));
      for (let i = 0; i < reps; i++) weightedText += ` ${chunk}`;
      totalWeight += w;
    }
  }

  // Also fold generic evidence text once
  weightedText += ` ${collectText(evidence)}`;
  const text = weightedText.toLowerCase();
  const textLen = text.replace(/\s+/g, " ").trim().length;

  const topics = topicHits(text); // still substring for multi-word phrases in buckets
  // Refine topic counts with word-boundary where possible
  const topicScores = new Map<string, number>();
  for (const [topic, count] of topics) {
    topicScores.set(topic, count);
  }

  const active = listTasteColours();
  const rawScores: Record<string, number> = {};

  for (const def of active) {
    if (def.id === "slate") {
      rawScores[def.id] = 0.15; // always present soft baseline
      continue;
    }
    let s = 0;
    for (const t of def.topics) {
      s += (topicScores.get(t) ?? 0) * 1.15;
    }
    const { count: kwCount, matched: kwMatched } = countTermHits(
      text,
      def.keywords ?? [],
    );
    s += kwCount * 1.25;
    void kwMatched;
    rawScores[def.id] = s;
  }

  // Platform hints — stronger when text is thin so the *first* link still tints.
  const platforms = new Set(evidence.platforms);
  const textThin = textLen < 40;
  const platformHints: Array<{
    platform: PlatformId;
    colourId: string;
    w: number;
  }> = [
    { platform: "tiktok", colourId: "violet", w: 0.9 },
    { platform: "tiktok", colourId: "magenta", w: 0.45 },
    { platform: "linkedin", colourId: "navy", w: 0.85 },
    { platform: "linkedin", colourId: "ink", w: 0.55 },
    { platform: "instagram", colourId: "blush", w: 0.85 },
    { platform: "instagram", colourId: "coral", w: 0.55 },
    { platform: "instagram", colourId: "ember", w: 0.4 },
    { platform: "youtube", colourId: "crimson", w: 0.7 },
    { platform: "youtube", colourId: "ink", w: 0.45 },
    { platform: "x", colourId: "sky", w: 0.65 },
    { platform: "x", colourId: "charcoal", w: 0.4 },
  ];
  const platformScale = textThin ? 1.35 : 0.45;
  for (const h of platformHints) {
    if (platforms.has(h.platform) && rawScores[h.colourId] !== undefined) {
      rawScores[h.colourId] =
        (rawScores[h.colourId] ?? 0) + h.w * platformScale;
    }
  }

  // Taste axis influence (when provided)
  const axisScore = (id: string) =>
    options.axes?.find((a) => a.axisId === id && a.score !== null)?.score ?? 0;

  const craft = axisScore("craft");
  const depth = axisScore("depth");
  const discovery = axisScore("discovery_orientation");
  const curation = axisScore("curation");
  const distinct = axisScore("distinctiveness");

  rawScores.ember = (rawScores.ember ?? 0) + craft * 0.35 + depth * 0.2;
  rawScores.copper = (rawScores.copper ?? 0) + craft * 0.4;
  rawScores.violet = (rawScores.violet ?? 0) + discovery * 0.35;
  rawScores.magenta = (rawScores.magenta ?? 0) + discovery * 0.2 + distinct * 0.15;
  rawScores.ink = (rawScores.ink ?? 0) + depth * 0.15 + curation * 0.1;
  rawScores.navy = (rawScores.navy ?? 0) + depth * 0.25;
  rawScores.charcoal = (rawScores.charcoal ?? 0) + curation * 0.15 + distinct * 0.1;
  rawScores.blush = (rawScores.blush ?? 0) + curation * 0.1;
  rawScores.gold = (rawScores.gold ?? 0) + depth * 0.1;

  // First-link friendly: platform alone is enough to leave pure slate
  const maxNonSlate = Math.max(
    0,
    ...Object.entries(rawScores)
      .filter(([id]) => id !== "slate")
      .map(([, v]) => v),
  );

  // Only pure slate if we have literally nothing (no links at all)
  const useSlateOnly =
    snapshots.length === 0 && platforms.size === 0 && maxNonSlate < 0.05;

  let weights: Record<string, number>;
  if (useSlateOnly) {
    weights = { slate: 1 };
  } else {
    // Prefer sharper colour assignment (lower temperature)
    weights = softmax(rawScores, textThin ? 0.55 : 0.7);
    // Small slate floor only when signal is weak
    const slateFloor =
      maxNonSlate < 0.5 ? 0.12 : maxNonSlate < 1.5 ? 0.05 : 0.02;
    weights.slate = (weights.slate ?? 0) * 0.5 + slateFloor;
    const sum = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
    for (const id of Object.keys(weights)) weights[id]! /= sum;
  }

  // Pick primary label = highest weight
  let primaryId = "slate";
  let primaryW = -1;
  for (const [id, w] of Object.entries(weights)) {
    if (w > primaryW) {
      primaryW = w;
      primaryId = id;
    }
  }
  const primary = getTasteColour(primaryId) ?? getTasteColour("slate")!;

  // Blend RGB of top contributors (weights > 2%)
  const blendParts: Array<{ r: number; g: number; b: number; w: number }> = [];
  const blendMeta: TasteColourResult["blend"] = [];
  for (const def of active) {
    const w = weights[def.id] ?? 0;
    if (w < 0.02 && def.id !== primaryId) continue;
    const rgb = parseRgb(def.rgb);
    blendParts.push({ ...rgb, w: Math.max(w, def.id === primaryId ? 0.01 : 0) });
    if (w >= 0.02 || def.id === primaryId) {
      blendMeta.push({
        id: def.id,
        label: def.label,
        weight: w,
        hex: def.hex,
      });
    }
  }
  blendMeta.sort((a, b) => b.weight - a.weight);

  const blended = mixRgb(blendParts);
  const boldHex = rgbToHex(blended.r, blended.g, blended.b);

  // Confidence: data conf + text + decisiveness of blend
  const dataC = options.dataConfidence?.score ?? clamp01(totalWeight / 3);
  const confFromText =
    textLen < 8 ? 0.25 : textLen < 40 ? 0.45 : textLen < 120 ? 0.65 : 0.85;
  const top1 = blendMeta[0]?.weight ?? 0;
  const top2 = blendMeta[1]?.weight ?? 0;
  const decisiveness = clamp01((top1 - top2) * 2 + top1 * 0.3);
  const confidence = clamp01(
    0.35 * dataC + 0.35 * confFromText + 0.3 * decisiveness,
  );

  const display = applyConfidenceBoldness(blended, confidence);
  const rgbStr = `${Math.round(display.r)}, ${Math.round(display.g)}, ${Math.round(display.b)}`;
  const hex = rgbToHex(display.r, display.g, display.b);

  const topTopics = [...topicScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);

  const blendLabels = blendMeta
    .filter((b) => b.weight >= 0.08)
    .slice(0, 3)
    .map((b) => `${b.label} ${Math.round(b.weight * 100)}%`)
    .join(", ");

  const summary =
    primaryId === "slate" && confidence < 0.35
      ? "Soft slate — still gathering public signal."
      : `${primary.label}${blendLabels && blendMeta.length > 1 ? ` (blend: ${blendLabels})` : ""}${
          topTopics.length ? ` · ${topTopics.join(", ")}` : ""
        }.`;

  return {
    id: primaryId,
    label: primary.label,
    rgb: rgbStr,
    hex,
    boldHex,
    confidence,
    summary,
    scores: rawScores,
    blend: blendMeta,
  };
}

export function inferTasteColourFromContext(
  ctx: TasteScoreContext,
  options: InferColourOptions = {},
): TasteColourResult {
  return inferTasteColour(ctx.evidence, ctx.snapshots, options);
}
