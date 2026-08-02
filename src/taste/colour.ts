/**
 * Person colour — continuous hex space (not a fixed named palette).
 *
 * Design goals (v0.6):
 * - Output any #RRGGBB via weighted RGB blend of evidence samples
 * - Text maps to soft semantic hue anchors (not a closed output list)
 * - Image swatches contribute their actual hex values directly
 * - Axes nudge hue/sat/lightness continuously when content exists
 * - No platform-type bias; strip platform chrome
 * - Strength ramp: 1 solid link → clear tint; 3 links → bold
 */

import {
  linkSnapshotRichness,
  type ImagePaletteSignal,
  type LinkSnapshot,
} from "../linkEvidence.js";
import type { Evidence } from "../types.js";
import { collectText, topicHits } from "./lexicons.js";
import { scoreFollowQuality } from "./signals/extractors.js";
import type {
  DataConfidence,
  TasteAxisResult,
  TasteScoreContext,
} from "./types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Soft semantic anchors for text → continuous colour (not an output palette). */
export interface TasteColourDef {
  id: string;
  label: string;
  /** Anchor RGB for text/topic mapping only. */
  rgb: string;
  hex: string;
  description: string;
  topics: string[];
  keywords?: string[];
  status: "active" | "disabled";
}

export type ColourContributionSource =
  | "topic"
  | "keyword"
  | "image_swatch"
  | "image_warmth"
  | "image_hue"
  | "image_lightness"
  | "image_vibrance"
  | "axis"
  | "baseline";

export interface ColourContribution {
  /** Continuous sample hex that was mixed in. */
  hex: string;
  /** Soft family name for UI (e.g. "warm amber"), not a closed enum. */
  label: string;
  source: ColourContributionSource;
  detail: string;
  /** Mix weight for this sample (before normalize). */
  amount: number;
  from?: string;
}

export interface ColourLinkEvidence {
  from: string;
  platform?: string;
  topics: string[];
  keywords: string[];
  /** Hex samples this link suggested. */
  sampleHexes: string[];
  imageTags?: string[];
  imageSwatches?: string[];
  textPreview?: string;
}

export interface ColourAttribution {
  contributions: ColourContribution[];
  /** Normalized mix recipe of the final colour. */
  bySample: Array<{
    hex: string;
    label: string;
    weight: number;
    totalRaw: number;
    parts: ColourContribution[];
  }>;
  linkEvidence: ColourLinkEvidence[];
  topicsHit: string[];
  keywordsHit: string[];
  textLen: number;
  contentMax: number;
  signalTooWeak: boolean;
  temperature: number | null;
  winnerBias: number | null;
  linkFloor: number;
  confidenceParts: {
    dataC: number;
    confFromText: number;
    confFromImage: number;
    decisiveness: number;
    contentConf: number;
    final: number;
  };
}

export interface TasteColourResult {
  /**
   * Continuous id = primary hex (e.g. "#D25C3A").
   * Not limited to a fixed palette list.
   */
  id: string;
  /** Soft human label derived from the blended hue (e.g. "warm amber"). */
  label: string;
  /** Display RGB already adjusted for confidence. */
  rgb: string;
  hex: string;
  /** Full-bold hex before confidence softening. */
  boldHex: string;
  confidence: number;
  summary: string;
  /**
   * Aggregate weight per sample hex (debug).
   * Keys are #RRGGBB.
   */
  scores: Record<string, number>;
  /** Normalized blend recipe (top contributors). */
  blend: Array<{ id: string; label: string; weight: number; hex: string }>;
  attribution: ColourAttribution;
}

// ---------------------------------------------------------------------------
// Semantic anchors (text → continuous colour samples only)
// ---------------------------------------------------------------------------

/**
 * Topic/keyword → hue anchors.
 * These are NOT the only allowed output colours — free #RRGGBB blending is.
 */
export const COLOUR_DEFS: readonly TasteColourDef[] = [
  {
    id: "crimson",
    label: "warm red",
    rgb: "190, 45, 55",
    hex: "#BE2D37",
    description: "Sports / fashion heat.",
    topics: ["sports", "fashion"],
    keywords: ["red", "passion", "fierce", "power", "bold"],
    status: "active",
  },
  {
    id: "ember",
    label: "warm amber",
    rgb: "210, 92, 58",
    hex: "#D25C3A",
    description: "Film / photo warmth.",
    topics: ["film", "photo"],
    keywords: ["analog", "35mm", "darkroom", "warm", "sunset", "amber", "orange"],
    status: "active",
  },
  {
    id: "coral",
    label: "soft coral",
    rgb: "232, 120, 96",
    hex: "#E87860",
    description: "Travel / food social warmth.",
    topics: ["travel", "food"],
    keywords: ["coral", "peach", "friendly", "bright", "summer"],
    status: "active",
  },
  {
    id: "sand",
    label: "soft sand",
    rgb: "196, 168, 120",
    hex: "#C4A878",
    description: "Calm lifestyle.",
    topics: ["travel", "fashion"],
    keywords: ["beige", "sand", "neutral", "minimal", "calm"],
    status: "active",
  },
  {
    id: "gold",
    label: "antique gold",
    rgb: "196, 148, 64",
    hex: "#C49440",
    description: "Literature / archive.",
    topics: ["literature"],
    keywords: ["book", "essay", "poem", "archive", "gold", "vintage"],
    status: "active",
  },
  {
    id: "honey",
    label: "honey yellow",
    rgb: "214, 170, 72",
    hex: "#D6AA48",
    description: "Food / hospitality.",
    topics: ["food"],
    keywords: ["honey", "yellow", "sunny", "kitchen", "bake", "coffee"],
    status: "active",
  },
  {
    id: "lime",
    label: "fresh green",
    rgb: "132, 180, 64",
    hex: "#84B440",
    description: "Outdoors / active.",
    topics: ["sports", "travel"],
    keywords: ["lime", "fresh", "hike", "active", "outdoor"],
    status: "active",
  },
  {
    id: "moss",
    label: "moss green",
    rgb: "72, 132, 96",
    hex: "#488460",
    description: "Nature / place.",
    topics: ["food", "travel", "sports"],
    keywords: ["green", "garden", "forest", "nature", "earth"],
    status: "active",
  },
  {
    id: "forest",
    label: "deep green",
    rgb: "46, 98, 72",
    hex: "#2E6248",
    description: "Trail / wild.",
    topics: ["travel"],
    keywords: ["forest", "pine", "trail", "wild", "camp"],
    status: "active",
  },
  {
    id: "sage",
    label: "muted sage",
    rgb: "140, 156, 132",
    hex: "#8C9C84",
    description: "Soft design green.",
    topics: ["design", "fashion"],
    keywords: ["sage", "muted", "quiet", "soft green"],
    status: "active",
  },
  {
    id: "teal",
    label: "teal",
    rgb: "48, 140, 140",
    hex: "#308C8C",
    description: "Creative-tech balance.",
    topics: ["design", "music"],
    keywords: ["teal", "aqua", "balanced", "wave"],
    status: "active",
  },
  {
    id: "aqua",
    label: "aqua",
    rgb: "64, 170, 180",
    hex: "#40AAB4",
    description: "Coastal / light digital.",
    topics: ["travel", "tech"],
    keywords: ["aqua", "ocean", "coast", "sea", "swim"],
    status: "active",
  },
  {
    id: "sky",
    label: "sky blue",
    rgb: "96, 156, 214",
    hex: "#609CD6",
    description: "Open / clear.",
    topics: ["travel", "sports"],
    keywords: ["sky", "blue", "open", "clear", "day"],
    status: "active",
  },
  {
    id: "ink",
    label: "ink blue",
    rgb: "62, 98, 168",
    hex: "#3E62A8",
    description: "Design / tech systems.",
    topics: ["design", "tech", "architecture"],
    keywords: ["code", "ui", "type", "product", "build", "system"],
    status: "active",
  },
  {
    id: "navy",
    label: "deep navy",
    rgb: "40, 64, 112",
    hex: "#284070",
    description: "Serious craft.",
    topics: ["tech", "literature", "architecture"],
    keywords: ["navy", "deep", "serious", "focus", "professional"],
    status: "active",
  },
  {
    id: "ice",
    label: "ice blue",
    rgb: "160, 188, 214",
    hex: "#A0BCD6",
    description: "Cool minimal.",
    topics: ["tech", "design"],
    keywords: ["ice", "cool", "minimal", "clean", "frost"],
    status: "active",
  },
  {
    id: "lavender",
    label: "soft lavender",
    rgb: "164, 140, 196",
    hex: "#A48CC4",
    description: "Gentle art.",
    topics: ["art", "music"],
    keywords: ["lavender", "soft", "dream", "gentle"],
    status: "active",
  },
  {
    id: "violet",
    label: "violet",
    rgb: "124, 92, 196",
    hex: "#7C5CC4",
    description: "Music / experimental.",
    topics: ["music", "art"],
    keywords: ["jazz", "techno", "experimental", "gallery", "night", "violet"],
    status: "active",
  },
  {
    id: "plum",
    label: "plum",
    rgb: "112, 64, 112",
    hex: "#704070",
    description: "Night culture.",
    topics: ["music", "fashion", "art"],
    keywords: ["plum", "night", "club", "rich", "velvet"],
    status: "active",
  },
  {
    id: "blush",
    label: "blush pink",
    rgb: "196, 106, 138",
    hex: "#C46A8A",
    description: "Fashion polish.",
    topics: ["fashion"],
    keywords: ["style", "fit", "beauty", "pink", "soft", "blush"],
    status: "active",
  },
  {
    id: "rose",
    label: "rose",
    rgb: "188, 84, 108",
    hex: "#BC546C",
    description: "Romantic aesthetic.",
    topics: ["fashion", "art"],
    keywords: ["rose", "romantic", "aesthetic", "floral"],
    status: "active",
  },
  {
    id: "magenta",
    label: "magenta",
    rgb: "180, 64, 140",
    hex: "#B4408C",
    description: "Bold creative.",
    topics: ["art", "music", "fashion"],
    keywords: ["magenta", "bold", "statement", "pop"],
    status: "active",
  },
  {
    id: "copper",
    label: "copper",
    rgb: "168, 96, 64",
    hex: "#A86040",
    description: "Crafted warmth.",
    topics: ["photo", "film", "art"],
    keywords: ["copper", "handmade", "craft", "metal", "raw"],
    status: "active",
  },
  {
    id: "espresso",
    label: "espresso brown",
    rgb: "92, 64, 48",
    hex: "#5C4030",
    description: "Cafe / intimate.",
    topics: ["food", "literature"],
    keywords: ["coffee", "espresso", "brown", "cozy", "cafe"],
    status: "active",
  },
  {
    id: "charcoal",
    label: "charcoal",
    rgb: "72, 76, 84",
    hex: "#484C54",
    description: "Dark minimal.",
    topics: ["design", "architecture", "tech"],
    keywords: ["black", "dark", "minimal", "mono", "charcoal"],
    status: "active",
  },
] as const;

const NEUTRAL_HEX = "#787E8A";
const NEUTRAL_RGB = { r: 120, g: 126, b: 138 };

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

// ---------------------------------------------------------------------------
// Colour math
// ---------------------------------------------------------------------------

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function parseRgb(rgb: string): { r: number; g: number; b: number } {
  const p = rgb.split(",").map((x) => Number(x.trim()));
  return { r: p[0] ?? 120, g: p[1] ?? 126, b: p[2] ?? 138 };
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return null;
  const n = Number.parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
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
  if (w <= 0) return { ...NEUTRAL_RGB };
  return { r: r / w, g: g / w, b: b / w };
}

function rgbToHsl(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case rn:
      h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
      break;
    case gn:
      h = ((bn - rn) / d + 2) / 6;
      break;
    default:
      h = ((rn - gn) / d + 4) / 6;
      break;
  }
  return { h: h * 360, s, l };
}

function hslToRgb(
  h: number,
  s: number,
  l: number,
): { r: number; g: number; b: number } {
  const hh = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = l - c / 2;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (hh < 60) {
    rp = c;
    gp = x;
  } else if (hh < 120) {
    rp = x;
    gp = c;
  } else if (hh < 180) {
    gp = c;
    bp = x;
  } else if (hh < 240) {
    gp = x;
    bp = c;
  } else if (hh < 300) {
    rp = x;
    bp = c;
  } else {
    rp = c;
    bp = x;
  }
  return {
    r: (rp + m) * 255,
    g: (gp + m) * 255,
    b: (bp + m) * 255,
  };
}

/** Soft English label from continuous hue — not a fixed palette id. */
export function labelFromRgb(r: number, g: number, b: number): string {
  const { h, s, l } = rgbToHsl(r, g, b);
  if (s < 0.12) {
    if (l < 0.25) return "deep charcoal";
    if (l < 0.45) return "soft slate";
    if (l > 0.75) return "pale grey";
    return "neutral grey";
  }
  const warm = h < 90 || h >= 330;
  const tone =
    l < 0.28 ? "deep" : l > 0.72 ? "pale" : s > 0.55 ? "vivid" : "soft";
  let family: string;
  if (h < 15 || h >= 345) family = "red";
  else if (h < 40) family = "amber";
  else if (h < 65) family = "gold";
  else if (h < 95) family = "lime";
  else if (h < 150) family = "green";
  else if (h < 185) family = "teal";
  else if (h < 220) family = "sky";
  else if (h < 255) family = "blue";
  else if (h < 290) family = "violet";
  else if (h < 330) family = "magenta";
  else family = "rose";
  if (warm && (family === "amber" || family === "gold" || family === "red")) {
    return `${tone} ${family}`;
  }
  return `${tone} ${family}`;
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

function termHit(text: string, term: string): boolean {
  const t = term.toLowerCase().trim();
  if (!t) return false;
  if (t.includes(" ")) return text.includes(t);
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

function applyConfidenceBoldness(
  rgb: { r: number; g: number; b: number },
  confidence: number,
): { r: number; g: number; b: number } {
  const c = clamp01(confidence);
  const soft = {
    r: 188 + (rgb.r - 188) * 0.55,
    g: 188 + (rgb.g - 188) * 0.55,
    b: 188 + (rgb.b - 188) * 0.55,
  };
  const t = 0.58 + 0.42 * c;
  let r = soft.r + (rgb.r - soft.r) * t;
  let g = soft.g + (rgb.g - soft.g) * t;
  let b = soft.b + (rgb.b - soft.b) * t;

  const mean = (r + g + b) / 3;
  const satBoost = 0.12 + 0.22 * c;
  r = mean + (r - mean) * (1 + satBoost);
  g = mean + (g - mean) * (1 + satBoost);
  b = mean + (b - mean) * (1 + satBoost);

  const depth = 0.97 - 0.04 * (1 - c);
  return {
    r: Math.max(0, Math.min(255, r * depth)),
    g: Math.max(0, Math.min(255, g * depth)),
    b: Math.max(0, Math.min(255, b * depth)),
  };
}

function linkCountStrength(n: number, hasSignal: boolean): number {
  if (!hasSignal || n <= 0) return 0;
  if (n === 1) return 0.62;
  if (n === 2) return 0.78;
  if (n === 3) return 0.9;
  return 0.95;
}

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

function hueToRgb(h: number, s: number, l: number): {
  r: number;
  g: number;
  b: number;
  hex: string;
} {
  const rgb = hslToRgb(h, s, l);
  return { ...rgb, hex: rgbToHex(rgb.r, rgb.g, rgb.b) };
}

// ---------------------------------------------------------------------------
// Inference
// ---------------------------------------------------------------------------

export type InferColourOptions = {
  axes?: TasteAxisResult[];
  dataConfidence?: DataConfidence;
};

type Sample = {
  hex: string;
  r: number;
  g: number;
  b: number;
  w: number;
  label: string;
  source: ColourContributionSource;
  detail: string;
  from?: string;
};

/**
 * Infer person colour as a continuous #RRGGBB blend of evidence samples.
 */
export function inferTasteColour(
  evidence: Evidence,
  snapshots: LinkSnapshot[] = [],
  options: InferColourOptions = {},
): TasteColourResult {
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
      const reps = Math.max(1, Math.round(w * 4));
      for (let i = 0; i < reps; i++) weightedText += ` ${chunk}`;
      totalWeight += w;
    }
  }

  weightedText += ` ${stripPlatformChrome(collectText(evidence))}`;

  // Follow graph — niche creators colour taste more; celeb/mainstream follows less.
  // Base scale ~0.4 of self; each follow re-weighted by niche quality (0.15–1.2).
  const FOLLOW_SCALE = 0.4;
  const follows =
    evidence.follows ??
    snapshots.flatMap((s) => s.follows ?? []);
  if (follows.length > 0) {
    let followWeightSum = 0;
    let followChunk = "";
    for (const f of follows) {
      const q = scoreFollowQuality(f);
      // Niche creators: full/boosted; mainstream celebs: thin
      const unit = 0.15 + q.niche * 0.85 - q.mainstream * 0.55;
      const u = Math.max(0.05, unit);
      const piece = stripPlatformChrome(
        [f.handle, f.displayName, f.bio].filter(Boolean).join(" "),
      );
      if (!piece.trim()) continue;
      // Repeat piece by quality (cheap weighted bag-of-words)
      const pieceReps = Math.max(1, Math.round(u * 3));
      for (let i = 0; i < pieceReps; i++) followChunk += ` ${piece}`;
      followWeightSum += u;
    }
    if (followChunk.trim()) {
      const fw =
        FOLLOW_SCALE *
        clamp01(followWeightSum / Math.max(3, follows.length * 0.6));
      const reps = Math.max(1, Math.round(fw * 4));
      for (let i = 0; i < reps; i++) weightedText += ` ${followChunk}`;
      totalWeight += fw;
    }
  }

  const text = weightedText.toLowerCase();
  const textLen = text.replace(/\s+/g, " ").trim().length;

  const topics = topicHits(text);
  const topicScores = new Map<string, number>();
  for (const [topic, count] of topics) topicScores.set(topic, count);

  const anchors = listTasteColours();
  const samples: Sample[] = [];
  const keywordsHitGlobal: string[] = [];

  const addSample = (
    hex: string,
    amount: number,
    source: ColourContributionSource,
    detail: string,
    label?: string,
    from?: string,
  ) => {
    if (amount <= 0.001) return;
    const rgb = parseHex(hex);
    if (!rgb) return;
    const softLabel = label ?? labelFromRgb(rgb.r, rgb.g, rgb.b);
    const s: Sample = {
      hex: hex.toUpperCase(),
      r: rgb.r,
      g: rgb.g,
      b: rgb.b,
      w: amount,
      label: softLabel,
      source,
      detail,
    };
    if (from) s.from = from;
    samples.push(s);
  };

  // --- Text channel: semantic anchors become continuous RGB samples ---
  for (const def of anchors) {
    for (const t of def.topics) {
      const count = topicScores.get(t) ?? 0;
      if (count <= 0) continue;
      const amount = count * 1.15;
      addSample(
        def.hex,
        amount,
        "topic",
        `topic “${t}” ×${count} → sample ${def.hex} +${amount.toFixed(2)}`,
        def.label,
      );
    }
    const { matched } = countTermHits(text, def.keywords ?? []);
    for (const kw of matched) {
      if (!keywordsHitGlobal.includes(kw)) keywordsHitGlobal.push(kw);
      addSample(
        def.hex,
        1.25,
        "keyword",
        `keyword “${kw}” → sample ${def.hex} +1.25`,
        def.label,
      );
    }
  }

  const textThin = textLen < 40;
  const imageSignals = snapshots
    .map((s) => s.imageSignals)
    .filter((s): s is ImagePaletteSignal => Boolean(s && s.confidence > 0.15));

  // --- Image channel: real swatch hexes + continuous hue samples ---
  addImageSamples(samples, imageSignals, textThin, snapshots, addSample);

  const contentMax = samples
    .filter((s) => s.source !== "baseline")
    .reduce((m, s) => Math.max(m, s.w), 0);

  // --- Axes: continuous hue/sat nudges as free hex samples ---
  const axisScore = (id: string) =>
    options.axes?.find((a) => a.axisId === id && a.score !== null)?.score ?? 0;
  const craft = axisScore("craft");
  const depth = axisScore("depth");
  const discovery = axisScore("discovery_orientation");
  const curation = axisScore("curation");
  const distinct = axisScore("distinctiveness");
  const axisPull = (score: number) =>
    score < 0.45 ? 0 : score - 0.35;
  const axisScale = contentMax >= 0.35 ? 1 : contentMax >= 0.15 ? 0.5 : 0;

  if (axisScale > 0) {
    const c = axisPull(craft) * axisScale;
    const d = axisPull(depth) * axisScale;
    const disc = axisPull(discovery) * axisScale;
    const cur = axisPull(curation) * axisScale;
    const dist = axisPull(distinct) * axisScale;
    // Freeform HSL samples (not fixed palette slots)
    if (c > 0) {
      const { hex } = hueToRgb(28, 0.62, 0.48); // craft heat
      addSample(hex, c * 0.5, "axis", `axis craft ${craft.toFixed(2)} → ${hex}`, undefined);
    }
    if (d > 0) {
      const { hex } = hueToRgb(220, 0.45, 0.38); // depth cool focus
      addSample(hex, d * 0.4, "axis", `axis depth ${depth.toFixed(2)} → ${hex}`, undefined);
    }
    if (disc > 0) {
      const { hex } = hueToRgb(275, 0.55, 0.52); // discovery violet
      addSample(hex, disc * 0.45, "axis", `axis discovery ${discovery.toFixed(2)} → ${hex}`, undefined);
    }
    if (cur > 0) {
      const { hex } = hueToRgb(340, 0.35, 0.55); // curation soft rose
      addSample(hex, cur * 0.25, "axis", `axis curation ${curation.toFixed(2)} → ${hex}`, undefined);
    }
    if (dist > 0) {
      const { hex } = hueToRgb(310, 0.5, 0.42); // distinct magenta
      addSample(hex, dist * 0.3, "axis", `axis distinct ${distinct.toFixed(2)} → ${hex}`, undefined);
    }
  }

  const signalTooWeak = contentMax < 0.2;
  const linkN = snapshots.length;

  // Aggregate sample weights by exact hex
  const scoreMap = new Map<string, number>();
  for (const s of samples) {
    scoreMap.set(s.hex, (scoreMap.get(s.hex) ?? 0) + s.w);
  }
  // Softmax-like sharpening on continuous samples: raise weights to power
  const temperature =
    linkN >= 3 ? 0.85 : linkN === 2 ? 0.95 : textThin ? 0.9 : 1.0;
  let weights: Array<{ hex: string; w: number; label: string }>;

  if (signalTooWeak) {
    weights = [{ hex: NEUTRAL_HEX, w: 1, label: "soft slate" }];
    addSample(
      NEUTRAL_HEX,
      0.15,
      "baseline",
      "neutral baseline (weak signal)",
      "soft slate",
    );
  } else {
    const entries = [...scoreMap.entries()].filter(([, v]) => v > 0);
    const max = Math.max(...entries.map(([, v]) => v), 0.001);
    // Lower temperature → sharper: exp((v-max)/T) style via power
    const power = 1 / Math.max(0.35, temperature);
    weights = entries.map(([hex, v]) => {
      const rgb = parseHex(hex)!;
      return {
        hex,
        w: Math.pow(v / max, power) * v,
        label: labelFromRgb(rgb.r, rgb.g, rgb.b),
      };
    });
    // Winner bias toward strongest sample (still continuous hex)
    weights.sort((a, b) => b.w - a.w);
    if (weights[0] && weights[0].hex !== NEUTRAL_HEX) {
      const bias = linkN >= 3 ? 0.35 : linkN === 2 ? 0.28 : 0.22;
      weights[0] = { ...weights[0], w: weights[0].w + bias * max };
    }
    // Tiny neutral floor
    const slateW = contentMax < 0.8 ? 0.04 : 0.015;
    weights.push({ hex: NEUTRAL_HEX, w: slateW, label: "soft slate" });
    const sum = weights.reduce((a, x) => a + x.w, 0) || 1;
    weights = weights.map((x) => ({ ...x, w: x.w / sum }));
  }

  const blendParts = weights.map((x) => {
    const rgb = parseHex(x.hex) ?? NEUTRAL_RGB;
    return { ...rgb, w: x.w, hex: x.hex, label: x.label };
  });
  const blended = mixRgb(blendParts);
  const boldHex = rgbToHex(blended.r, blended.g, blended.b);
  const primaryLabel = labelFromRgb(blended.r, blended.g, blended.b);

  // Primary = highest weight sample (for id), or bold hex if mixed
  weights.sort((a, b) => b.w - a.w);
  const primaryHex = signalTooWeak
    ? NEUTRAL_HEX
    : boldHex; // continuous result is the blend itself
  const primaryId = primaryHex;

  const blendMeta = weights
    .filter((x) => x.w >= 0.02)
    .slice(0, 8)
    .map((x) => ({
      id: x.hex,
      label: x.label,
      weight: x.w,
      hex: x.hex,
    }));

  // Confidence
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
  const hasColourSignal = !signalTooWeak;
  const linkFloor = linkCountStrength(linkN, hasColourSignal);
  const confidence = signalTooWeak
    ? clamp01(0.25 * dataC + 0.2 * confFromText)
    : clamp01(Math.max(contentConf, linkFloor));

  const display = applyConfidenceBoldness(blended, confidence);
  const rgbStr = `${Math.round(display.r)}, ${Math.round(display.g)}, ${Math.round(display.b)}`;
  const hex = rgbToHex(display.r, display.g, display.b);
  const displayLabel = labelFromRgb(display.r, display.g, display.b);

  const topTopics = [...topicScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);

  const blendLabels = blendMeta
    .filter((b) => b.weight >= 0.08)
    .slice(0, 3)
    .map((b) => `${b.hex} ${Math.round(b.weight * 100)}%`)
    .join(", ");

  const imageTags = [
    ...new Set(imageSignals.flatMap((i) => i.tags).slice(0, 4)),
  ];
  const imageNote =
    imageSignals.length > 0
      ? ` · image${imageTags.length ? ` ${imageTags.join("/")}` : ""}`
      : "";

  const summary = (() => {
    if (signalTooWeak) {
      if (snapshots.length === 0) {
        return "Soft slate — add a public profile to begin.";
      }
      if (imageSignals.length === 0 && textLen < 24) {
        return "Soft slate — little public text or image colour yet.";
      }
      return "Soft slate — mixed or thin public signal so far.";
    }
    return `${displayLabel} ${hex}${
      blendLabels ? ` (mix: ${blendLabels})` : ""
    }${topTopics.length ? ` · ${topTopics.join(", ")}` : ""}${imageNote}.`;
  })();

  // Scores record: weight by hex
  const scores: Record<string, number> = {};
  for (const [h, v] of scoreMap) scores[h] = v;
  if (signalTooWeak) scores[NEUTRAL_HEX] = 0.15;

  // Attribution
  const contributions: ColourContribution[] = samples
    .map((s) => {
      const row: ColourContribution = {
        hex: s.hex,
        label: s.label,
        source: s.source,
        detail: s.detail,
        amount: s.w,
      };
      if (s.from) row.from = s.from;
      return row;
    })
    .sort((a, b) => b.amount - a.amount);

  const bySampleMap = new Map<
    string,
    ColourAttribution["bySample"][number]
  >();
  for (const c of contributions) {
    let row = bySampleMap.get(c.hex);
    if (!row) {
      const bw = blendMeta.find((b) => b.hex === c.hex)?.weight ?? 0;
      row = {
        hex: c.hex,
        label: c.label,
        weight: bw,
        totalRaw: 0,
        parts: [],
      };
      bySampleMap.set(c.hex, row);
    }
    row.totalRaw += c.amount;
    row.parts.push(c);
  }
  for (const b of blendMeta) {
    const row = bySampleMap.get(b.hex);
    if (row) row.weight = b.weight;
    else {
      bySampleMap.set(b.hex, {
        hex: b.hex,
        label: b.label,
        weight: b.weight,
        totalRaw: scores[b.hex] ?? 0,
        parts: contributions.filter((x) => x.hex === b.hex),
      });
    }
  }
  const bySample = [...bySampleMap.values()].sort(
    (a, b) => b.weight - a.weight || b.totalRaw - a.totalRaw,
  );

  const linkEvidence = buildLinkEvidence(snapshots, anchors);

  const attribution: ColourAttribution = {
    contributions: contributions.slice(0, 80),
    bySample: bySample.slice(0, 12),
    linkEvidence,
    topicsHit: topTopics,
    keywordsHit: keywordsHitGlobal.slice(0, 24),
    textLen,
    contentMax,
    signalTooWeak,
    temperature: signalTooWeak ? null : temperature,
    winnerBias: signalTooWeak
      ? null
      : linkN >= 3
        ? 0.35
        : linkN === 2
          ? 0.28
          : 0.22,
    linkFloor,
    confidenceParts: {
      dataC,
      confFromText,
      confFromImage,
      decisiveness,
      contentConf,
      final: confidence,
    },
  };

  return {
    id: primaryId,
    label: signalTooWeak ? "soft slate" : displayLabel,
    rgb: rgbStr,
    hex,
    boldHex,
    confidence,
    summary,
    scores,
    blend: blendMeta,
    attribution,
  };
}

export function inferTasteColourFromContext(
  ctx: TasteScoreContext,
  options: InferColourOptions = {},
): TasteColourResult {
  return inferTasteColour(ctx.evidence, ctx.snapshots, options);
}

// ---------------------------------------------------------------------------
// Image samples
// ---------------------------------------------------------------------------

function addImageSamples(
  _samples: Sample[],
  images: ImagePaletteSignal[],
  textThin: boolean,
  snapshots: LinkSnapshot[],
  addSample: (
    hex: string,
    amount: number,
    source: ColourContributionSource,
    detail: string,
    label?: string,
    from?: string,
  ) => void,
): void {
  const scale = textThin ? 1.35 : 0.7;

  const fromFor = (idx: number): string => {
    let n = 0;
    for (const s of snapshots) {
      if (s.imageSignals && s.imageSignals.confidence > 0.15) {
        if (n === idx) {
          return s.handle
            ? `@${s.handle}`
            : s.platformLabel || s.platform;
        }
        n++;
      }
    }
    return `image#${idx + 1}`;
  };

  for (let imgIdx = 0; imgIdx < images.length; imgIdx++) {
    const img = images[imgIdx]!;
    const conf = clamp01(img.confidence);
    const base = scale * conf;
    const from = fromFor(imgIdx);
    const tags = img.tags.length ? img.tags.join("/") : "palette";

    // Direct freeform hex from swatches (whole #RRGGBB range)
    for (let i = 0; i < img.swatches.length; i++) {
      const hex = img.swatches[i]!.toUpperCase();
      const rankW = 1 - i * 0.12;
      const amount = base * rankW * 1.25;
      const rgb = parseHex(hex);
      addSample(
        hex,
        amount,
        "image_swatch",
        `swatch ${hex} (#${i + 1}) → +${amount.toFixed(2)}`,
        rgb ? labelFromRgb(rgb.r, rgb.g, rgb.b) : undefined,
        from,
      );
    }

    // Continuous warmth → free HSL sample
    if (img.warmth > 0.15) {
      const t = base * img.warmth;
      const { hex } = hueToRgb(28 + img.warmth * 12, 0.55 + img.vibrance * 0.2, 0.48);
      addSample(
        hex,
        t * 0.9,
        "image_warmth",
        `warmth +${img.warmth.toFixed(2)} (${tags}) → ${hex}`,
        undefined,
        from,
      );
    } else if (img.warmth < -0.15) {
      const t = base * -img.warmth;
      const { hex } = hueToRgb(210 - img.warmth * 10, 0.4 + img.vibrance * 0.15, 0.45);
      addSample(
        hex,
        t * 0.9,
        "image_warmth",
        `cool ${img.warmth.toFixed(2)} (${tags}) → ${hex}`,
        undefined,
        from,
      );
    }

    // Continuous mean hue sample (full wheel)
    if (img.saturation >= 0.12) {
      const { hex } = hueToRgb(
        img.hue,
        Math.min(0.85, 0.35 + img.saturation * 0.55),
        Math.min(0.72, Math.max(0.28, img.lightness)),
      );
      const amount = base * img.saturation * 0.85;
      addSample(
        hex,
        amount,
        "image_hue",
        `hue ${img.hue.toFixed(0)}° sat ${img.saturation.toFixed(2)} → ${hex}`,
        undefined,
        from,
      );
    }

    if (img.lightness < 0.32) {
      const t = base * (0.32 - img.lightness) * 2;
      const { hex } = hueToRgb(img.hue || 220, 0.2, 0.22);
      addSample(hex, t * 0.6, "image_lightness", `dark L=${img.lightness.toFixed(2)} → ${hex}`, undefined, from);
    } else if (img.lightness > 0.72) {
      const t = base * (img.lightness - 0.72) * 2;
      const { hex } = hueToRgb(img.hue || 200, 0.18, 0.78);
      addSample(hex, t * 0.5, "image_lightness", `light L=${img.lightness.toFixed(2)} → ${hex}`, undefined, from);
    }

    if (img.vibrance > 0.55) {
      const t = base * (img.vibrance - 0.4);
      const { hex } = hueToRgb(img.hue || 320, Math.min(0.9, img.saturation + 0.25), img.lightness);
      addSample(hex, t * 0.55, "image_vibrance", `vivid V=${img.vibrance.toFixed(2)} → ${hex}`, undefined, from);
    } else if (img.vibrance < 0.28 && img.neutralShare > 0.45) {
      const t = base * 0.45;
      const { hex } = hueToRgb(img.hue || 100, 0.12, 0.55);
      addSample(hex, t, "image_vibrance", `muted V=${img.vibrance.toFixed(2)} → ${hex}`, undefined, from);
    }
  }
}

function buildLinkEvidence(
  snapshots: LinkSnapshot[],
  anchors: TasteColourDef[],
): ColourLinkEvidence[] {
  const out: ColourLinkEvidence[] = [];
  for (const snap of snapshots) {
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
    const lower = chunk.toLowerCase();
    const topics = [...topicHits(lower).keys()];
    const keywords: string[] = [];
    const sampleHexes: string[] = [];
    for (const def of anchors) {
      for (const t of def.topics) {
        if (topics.includes(t) && !sampleHexes.includes(def.hex)) {
          sampleHexes.push(def.hex);
        }
      }
      const { matched } = countTermHits(lower, def.keywords ?? []);
      for (const kw of matched) {
        if (!keywords.includes(kw)) keywords.push(kw);
        if (!sampleHexes.includes(def.hex)) sampleHexes.push(def.hex);
      }
    }
    if (snap.imageSignals?.swatches) {
      for (const h of snap.imageSignals.swatches) {
        const u = h.toUpperCase();
        if (!sampleHexes.includes(u)) sampleHexes.push(u);
      }
    }
    const from = snap.handle
      ? `@${snap.handle}`
      : snap.platformLabel || snap.platform;
    const row: ColourLinkEvidence = {
      from,
      platform: snap.platformLabel || snap.platform,
      topics,
      keywords: keywords.slice(0, 16),
      sampleHexes: sampleHexes.slice(0, 10),
    };
    if (snap.imageSignals?.tags?.length) row.imageTags = snap.imageSignals.tags;
    if (snap.imageSignals?.swatches?.length) {
      row.imageSwatches = snap.imageSignals.swatches.slice(0, 4);
    }
    const preview = chunk.replace(/\s+/g, " ").trim().slice(0, 120);
    if (preview) row.textPreview = preview;
    out.push(row);
  }
  return out;
}
