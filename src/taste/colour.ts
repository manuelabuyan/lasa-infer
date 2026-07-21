/**
 * Person colour — first visual taste conclusion.
 *
 * Design goals (v0.5):
 * - Wide editable palette (COLOUR_DEFS)
 * - Blend top colours (not only winner-take-all), sharper when signal is clear
 * - Weight evidence by access / richness
 * - Word-boundary token matching
 * - Soft axis nudge only when text/image already has colour signal
 * - No platform-type bias (Instagram vs TikTok etc. never tints taste)
 * - Strip platform chrome (e.g. IG "photos and videos" boilerplate)
 * - Image palette signals (swatches / warmth / vibrance) as second channel
 * - Strength ramp: 1 solid link → clear tint; 3 links → strong / bold colour
 */

import {
  linkSnapshotRichness,
  type ImagePaletteSignal,
  type LinkSnapshot,
} from "../linkEvidence.js";
import type { Evidence } from "../types.js";
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
 * Map confidence → display colour strength.
 * Soft end keeps hue (not grey wash); hard end is full palette RGB.
 * Avoids neon overshoot — we approach `rgb`, we do not push past it.
 */
function applyConfidenceBoldness(
  rgb: { r: number; g: number; b: number },
  confidence: number,
): { r: number; g: number; b: number } {
  const c = clamp01(confidence);
  // Soft: still clearly tinted (was too washed toward 210 → looked weak)
  const soft = {
    r: 188 + (rgb.r - 188) * 0.55,
    g: 188 + (rgb.g - 188) * 0.55,
    b: 188 + (rgb.b - 188) * 0.55,
  };
  // c=0.55 (typical 1-link) → t≈0.82; c=0.9 (3 links) → t≈0.96
  const t = 0.58 + 0.42 * c;
  let r = soft.r + (rgb.r - soft.r) * t;
  let g = soft.g + (rgb.g - soft.g) * t;
  let b = soft.b + (rgb.b - soft.b) * t;

  // Mild chroma lift only — enough to pop, not blow past palette
  const mean = (r + g + b) / 3;
  const satBoost = 0.12 + 0.22 * c;
  r = mean + (r - mean) * (1 + satBoost);
  g = mean + (g - mean) * (1 + satBoost);
  b = mean + (b - mean) * (1 + satBoost);

  // Slightly deeper as confidence rises (richer, not washed-out)
  const depth = 0.97 - 0.04 * (1 - c);
  return {
    r: Math.max(0, Math.min(255, r * depth)),
    g: Math.max(0, Math.min(255, g * depth)),
    b: Math.max(0, Math.min(255, b * depth)),
  };
}

/**
 * Link-count strength targets the product brief:
 * - 1 link with real signal → clear colour change
 * - 3 links → strong / bold
 */
function linkCountStrength(n: number, hasSignal: boolean): number {
  if (!hasSignal || n <= 0) return 0;
  if (n === 1) return 0.62;
  if (n === 2) return 0.78;
  if (n === 3) return 0.9;
  return 0.95;
}

export type InferColourOptions = {
  axes?: TasteAxisResult[];
  dataConfidence?: DataConfidence;
};

/**
 * Strip platform chrome that would otherwise fake a colour signal.
 * e.g. every IG profile title ends with "Instagram photos and videos"
 * which used to always hit the photo → ember path.
 */
function stripPlatformChrome(text: string): string {
  return text
    .replace(/\binstagram\s+photos?\s+and\s+videos?\b/gi, " ")
    .replace(/\bphotos?\s+and\s+videos?\s+from\b/gi, " ")
    .replace(/\bsee\s+instagram\b/gi, " ")
    .replace(/\bon\s+instagram\b/gi, " ")
    .replace(/\b•\s*instagram\b/gi, " ")
    .replace(/\binstagram\b/gi, " ")
    .replace(/\btiktok\s*[-–—]?\s*make\s+your\s+day\b/gi, " ")
    .replace(/\bon\s+tiktok\b/gi, " ")
    .replace(/\btiktok\b/gi, " ")
    .replace(/\blinkedin\b/gi, " ")
    .replace(/\byoutube\b/gi, " ")
    .replace(/\btwitter\b/gi, " ")
    .replace(/\bx\.com\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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
      const chunk = stripPlatformChrome(
        [
          snap.handle,
          snap.title,
          snap.description,
          snap.author,
          ...snap.textSignals,
        ]
          .filter(Boolean)
          .join(" "),
      );
      if (!chunk.trim()) continue;
      // Repeat text proportionally to weight (cheap weighted bag-of-words)
      const reps = Math.max(1, Math.round(w * 4));
      for (let i = 0; i < reps; i++) weightedText += ` ${chunk}`;
      totalWeight += w;
    }
  }

  // Also fold generic evidence text once
  weightedText += ` ${stripPlatformChrome(collectText(evidence))}`;
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

  const textThin = textLen < 40;

  // --- Image palette channel (from private app, not raw pixels) ---
  // Strong when text is thin; still contributes when bios are rich.
  const imageSignals = snapshots
    .map((s) => s.imageSignals)
    .filter((s): s is ImagePaletteSignal => Boolean(s && s.confidence > 0.15));
  if (imageSignals.length > 0) {
    applyImagePaletteToScores(rawScores, imageSignals, textThin);
  }

  // Real colour evidence from text + image only (before soft axis nudges).
  const contentMax = maxScoreExcludingSlate(rawScores);

  // Taste axes may nudge colour only when we already have content/image signal.
  // Mid-range axis defaults (e.g. discovery ≈ 0.5) used to inject tiny violet/
  // magenta scores, pass the weak-signal gate, flatten softmax, and leave the UI
  // stuck on slate "still gathering public signal" forever.
  const axisScore = (id: string) =>
    options.axes?.find((a) => a.axisId === id && a.score !== null)?.score ?? 0;

  const craft = axisScore("craft");
  const depth = axisScore("depth");
  const discovery = axisScore("discovery_orientation");
  const curation = axisScore("curation");
  const distinct = axisScore("distinctiveness");

  // Only strong axis values pull; mid-band is treated as neutral (0).
  const axisPull = (score: number) => {
    if (score < 0.45) return 0;
    return score - 0.35; // 0.45 → 0.10 … 1.0 → 0.65
  };
  // No content/image → axes must not invent a colour (scale 0).
  const axisScale = contentMax >= 0.35 ? 1 : contentMax >= 0.15 ? 0.5 : 0;

  if (axisScale > 0) {
    const c = axisPull(craft) * axisScale;
    const d = axisPull(depth) * axisScale;
    const disc = axisPull(discovery) * axisScale;
    const cur = axisPull(curation) * axisScale;
    const dist = axisPull(distinct) * axisScale;

    rawScores.ember = (rawScores.ember ?? 0) + c * 0.35 + d * 0.2;
    rawScores.copper = (rawScores.copper ?? 0) + c * 0.4;
    rawScores.violet = (rawScores.violet ?? 0) + disc * 0.35;
    rawScores.magenta =
      (rawScores.magenta ?? 0) + disc * 0.2 + dist * 0.15;
    rawScores.ink = (rawScores.ink ?? 0) + d * 0.15 + cur * 0.1;
    rawScores.navy = (rawScores.navy ?? 0) + d * 0.25;
    rawScores.charcoal =
      (rawScores.charcoal ?? 0) + cur * 0.15 + dist * 0.1;
    rawScores.blush = (rawScores.blush ?? 0) + cur * 0.1;
    rawScores.gold = (rawScores.gold ?? 0) + d * 0.1;
  }

  const maxNonSlate = maxScoreExcludingSlate(rawScores);

  // Gate on content/image — not on axis crumbs
  const signalTooWeak = contentMax < 0.2;
  const linkN = snapshots.length;

  let weights: Record<string, number>;
  if (signalTooWeak) {
    weights = { slate: 1 };
  } else {
    // Lower temperature = sharper primary (more decisive colour)
    // More links → slightly sharper still
    const temperature =
      linkN >= 3 ? 0.38 : linkN === 2 ? 0.45 : textThin ? 0.42 : 0.5;
    weights = softmax(rawScores, temperature);

    // Winner bias: pull mass toward top colour so 1 clear hit isn't a muddy blend
    let topId = "slate";
    let topW = -1;
    for (const [id, w] of Object.entries(weights)) {
      if (w > topW) {
        topW = w;
        topId = id;
      }
    }
    if (topId !== "slate" && topW > 0) {
      const bias = linkN >= 3 ? 0.35 : linkN === 2 ? 0.28 : 0.22;
      weights[topId] = topW + bias;
    }

    // Tiny slate floor only when signal is weak
    const slateFloor =
      maxNonSlate < 0.8 ? 0.04 : maxNonSlate < 2 ? 0.02 : 0.01;
    weights.slate = (weights.slate ?? 0) * 0.25 + slateFloor;
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

  // Confidence: content quality + link-count strength ramp
  const dataC = options.dataConfidence?.score ?? clamp01(totalWeight / 3);
  const confFromText =
    textLen < 8 ? 0.35 : textLen < 40 ? 0.55 : textLen < 120 ? 0.75 : 0.9;
  const confFromImage =
    imageSignals.length === 0
      ? 0
      : clamp01(
          imageSignals.reduce((s, i) => s + i.confidence, 0) /
            imageSignals.length,
        );
  const top1 = blendMeta[0]?.weight ?? 0;
  const top2 = blendMeta[1]?.weight ?? 0;
  const decisiveness = clamp01((top1 - top2) * 2.2 + top1 * 0.35);
  const contentConf = clamp01(
    0.28 * dataC +
      0.28 * confFromText +
      0.22 * confFromImage +
      0.22 * decisiveness,
  );
  // Once we have a real colour signal, link count floors strength (1 → clear, 3 → strong)
  const hasColourSignal = !signalTooWeak && primaryId !== "slate";
  const linkFloor = linkCountStrength(linkN, hasColourSignal || !signalTooWeak);
  const confidence = signalTooWeak
    ? clamp01(0.25 * dataC + 0.2 * confFromText)
    : clamp01(Math.max(contentConf, linkFloor));

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

  const imageTags = [
    ...new Set(imageSignals.flatMap((i) => i.tags).slice(0, 4)),
  ];
  const imageNote =
    imageSignals.length > 0
      ? ` · image${imageTags.length ? ` ${imageTags.join("/")}` : ""}`
      : "";

  const summary = (() => {
    if (primaryId === "slate" && signalTooWeak) {
      if (snapshots.length === 0) {
        return "Soft slate — add a public profile to begin.";
      }
      if (imageSignals.length === 0 && textLen < 24) {
        return "Soft slate — little public text or image colour yet.";
      }
      return "Soft slate — mixed or thin public signal so far.";
    }
    return `${primary.label}${
      blendLabels && blendMeta.length > 1 ? ` (blend: ${blendLabels})` : ""
    }${topTopics.length ? ` · ${topTopics.join(", ")}` : ""}${imageNote}.`;
  })();

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

function maxScoreExcludingSlate(scores: Record<string, number>): number {
  return Math.max(
    0,
    ...Object.entries(scores)
      .filter(([id]) => id !== "slate")
      .map(([, v]) => v),
  );
}

/**
 * Map image palette stats → colour raw scores.
 * Returns a rough boost magnitude for confidence / summary.
 */
function applyImagePaletteToScores(
  rawScores: Record<string, number>,
  images: ImagePaletteSignal[],
  textThin: boolean,
): number {
  // Text still wins when rich; images matter a lot when bios are thin.
  const scale = textThin ? 1.35 : 0.7;
  let totalBoost = 0;

  for (const img of images) {
    const conf = clamp01(img.confidence);
    const base = scale * conf;

    // Nearest palette colours from swatches (dominant image colours)
    for (let i = 0; i < img.swatches.length; i++) {
      const hex = img.swatches[i]!;
      const rankW = 1 - i * 0.12;
      const near = nearestColourIds(hex, 3);
      for (const { id, closeness } of near) {
        if (id === "slate") continue;
        const add = base * rankW * closeness * 1.1;
        rawScores[id] = (rawScores[id] ?? 0) + add;
        totalBoost += add;
      }
    }

    // Warmth / cool axis
    const w = img.warmth; // −1…+1
    if (w > 0.15) {
      const t = base * w;
      rawScores.ember = (rawScores.ember ?? 0) + t * 0.55;
      rawScores.coral = (rawScores.coral ?? 0) + t * 0.4;
      rawScores.honey = (rawScores.honey ?? 0) + t * 0.3;
      rawScores.copper = (rawScores.copper ?? 0) + t * 0.35;
      rawScores.gold = (rawScores.gold ?? 0) + t * 0.25;
      totalBoost += t;
    } else if (w < -0.15) {
      const t = base * -w;
      rawScores.ink = (rawScores.ink ?? 0) + t * 0.5;
      rawScores.ice = (rawScores.ice ?? 0) + t * 0.4;
      rawScores.navy = (rawScores.navy ?? 0) + t * 0.45;
      rawScores.aqua = (rawScores.aqua ?? 0) + t * 0.3;
      rawScores.sky = (rawScores.sky ?? 0) + t * 0.25;
      totalBoost += t;
    }

    // Lightness / darkness
    if (img.lightness < 0.32) {
      const t = base * (0.32 - img.lightness) * 2;
      rawScores.charcoal = (rawScores.charcoal ?? 0) + t * 0.5;
      rawScores.espresso = (rawScores.espresso ?? 0) + t * 0.35;
      rawScores.navy = (rawScores.navy ?? 0) + t * 0.25;
      totalBoost += t * 0.5;
    } else if (img.lightness > 0.72) {
      const t = base * (img.lightness - 0.72) * 2;
      rawScores.sand = (rawScores.sand ?? 0) + t * 0.35;
      rawScores.ice = (rawScores.ice ?? 0) + t * 0.3;
      rawScores.lavender = (rawScores.lavender ?? 0) + t * 0.25;
      totalBoost += t * 0.4;
    }

    // Vibrance vs muted
    if (img.vibrance > 0.55) {
      const t = base * (img.vibrance - 0.4);
      rawScores.magenta = (rawScores.magenta ?? 0) + t * 0.3;
      rawScores.crimson = (rawScores.crimson ?? 0) + t * 0.25;
      rawScores.violet = (rawScores.violet ?? 0) + t * 0.2;
      totalBoost += t * 0.4;
    } else if (img.vibrance < 0.28 && img.neutralShare > 0.45) {
      const t = base * 0.5;
      rawScores.sage = (rawScores.sage ?? 0) + t * 0.35;
      rawScores.sand = (rawScores.sand ?? 0) + t * 0.3;
      rawScores.charcoal = (rawScores.charcoal ?? 0) + t * 0.25;
      totalBoost += t * 0.35;
    }

    // Hue family soft pull (in addition to swatch match)
    const huePull = hueFamilyColourBoosts(img.hue, img.saturation);
    for (const [id, wHue] of Object.entries(huePull)) {
      const add = base * wHue * 0.65;
      rawScores[id] = (rawScores[id] ?? 0) + add;
      totalBoost += add;
    }
  }

  return totalBoost;
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return null;
  const n = Number.parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function colourDistance(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** Closest palette colours to a swatch hex. */
function nearestColourIds(
  hex: string,
  k: number,
): Array<{ id: string; closeness: number }> {
  const rgb = parseHex(hex);
  if (!rgb) return [];
  const ranked = listTasteColours()
    .filter((c) => c.id !== "slate")
    .map((c) => {
      const d = colourDistance(rgb, parseRgb(c.rgb));
      // 0 distance → 1; ~180+ → ~0
      const closeness = clamp01(1 - d / 180);
      return { id: c.id, closeness, d };
    })
    .sort((a, b) => a.d - b.d)
    .slice(0, k)
    .filter((x) => x.closeness > 0.2);
  return ranked.map(({ id, closeness }) => ({ id, closeness }));
}

/** Soft boosts from mean hue (degrees) when saturation is meaningful. */
function hueFamilyColourBoosts(
  hue: number,
  saturation: number,
): Record<string, number> {
  if (saturation < 0.12) return {};
  const h = ((hue % 360) + 360) % 360;
  const s = clamp01(saturation);
  const out: Record<string, number> = {};
  const add = (id: string, w: number) => {
    out[id] = (out[id] ?? 0) + w * s;
  };

  if (h < 20 || h >= 345) {
    add("crimson", 0.7);
    add("rose", 0.45);
    add("blush", 0.35);
  } else if (h < 45) {
    add("ember", 0.75);
    add("coral", 0.5);
    add("copper", 0.4);
  } else if (h < 70) {
    add("honey", 0.7);
    add("gold", 0.55);
    add("sand", 0.35);
  } else if (h < 150) {
    add("moss", 0.55);
    add("lime", 0.45);
    add("forest", 0.4);
    add("sage", 0.3);
  } else if (h < 195) {
    add("teal", 0.65);
    add("aqua", 0.55);
  } else if (h < 250) {
    add("sky", 0.5);
    add("ink", 0.55);
    add("ice", 0.35);
  } else if (h < 290) {
    add("navy", 0.4);
    add("violet", 0.65);
    add("lavender", 0.4);
  } else {
    add("plum", 0.5);
    add("magenta", 0.6);
    add("violet", 0.4);
  }
  return out;
}
