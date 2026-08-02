import type { FactorHit } from "../../types.js";
import {
  CLICHE_MARKERS,
  collectText,
  countHits,
  CRAFT_MARKERS,
  CURATION_MARKERS,
  MAINSTREAM_MARKERS,
  NICHE_MARKERS,
  topicHits,
} from "../lexicons.js";
import type {
  TasteScoreContext,
  TasteSignalExtractor,
  TasteSignalResult,
} from "../types.js";

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function factor(
  id: string,
  weight: number,
  evidenceIds: string[],
  detail?: string,
  raw?: number,
): FactorHit {
  const f: FactorHit = { id, weight: clamp01(weight), evidenceIds };
  if (detail !== undefined) f.detail = detail;
  if (raw !== undefined) f.raw = raw;
  return f;
}

function textConfidence(text: string): number {
  if (text.length < 8) return 0.15;
  if (text.length < 40) return 0.4;
  if (text.length < 120) return 0.65;
  return 0.85;
}

const extractors: Record<string, TasteSignalExtractor> = {
  // Disabled in registry — kept so listExtractorIds stays complete if re-enabled.
  platform_count: () => ({
    score: 0,
    confidence: 0,
    detail: "platform identity/count does not influence taste",
    factors: [],
  }),

  topic_diversity: (ctx) => {
    const text = collectText(ctx.evidence);
    const topics = topicHits(text);
    const n = topics.size;
    const score = clamp01(n / 5);
    return {
      score,
      confidence: textConfidence(text),
      detail: n ? `topics: ${[...topics.keys()].join(", ")}` : "no topics matched",
      factors: [
        factor("topic_diversity", score, [...topics.keys()].map((t) => `topic:${t}`), undefined, n),
      ],
    };
  },

  media_kind_diversity: (ctx) => {
    const kinds = new Set<string>();
    for (const p of ctx.evidence.posts ?? []) {
      for (const t of p.tags ?? []) {
        if (["profile", "post", "video", "channel", "unknown"].includes(t)) {
          kinds.add(t);
        }
      }
      if (p.mediaKind) kinds.add(p.mediaKind);
    }
    for (const s of ctx.snapshots) kinds.add(s.contentKind);
    const n = kinds.size;
    const score = clamp01(n / 3);
    return {
      score,
      confidence: n > 0 ? 0.7 : 0.2,
      detail: `kinds: ${[...kinds].join(", ") || "none"}`,
      factors: [factor("media_kind_diversity", score, [...kinds], undefined, n)],
    };
  },

  craft_lexicon: (ctx) => {
    const text = collectText(ctx.evidence);
    const { count, matched } = countHits(text, CRAFT_MARKERS);
    const score = clamp01(count / 4);
    return {
      score,
      confidence: textConfidence(text),
      detail: matched.length ? `matched: ${matched.slice(0, 6).join(", ")}` : "no craft markers",
      factors: [factor("craft_lexicon", score, matched.map((m) => `term:${m}`), undefined, count)],
    };
  },

  topic_concentration: (ctx) => {
    const text = collectText(ctx.evidence);
    const topics = topicHits(text);
    let max = 0;
    let top = "";
    for (const [k, v] of topics) {
      if (v > max) {
        max = v;
        top = k;
      }
    }
    const score = clamp01(max / 5);
    return {
      score,
      confidence: textConfidence(text),
      detail: top ? `strongest topic: ${top} (${max})` : "no dominant topic",
      factors: [factor("topic_concentration", score, top ? [`topic:${top}`] : [], undefined, max)],
    };
  },

  text_specificity: (ctx) => {
    const text = collectText(ctx.evidence);
    const len = text.trim().length;
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const score = clamp01(len / 280);
    return {
      score,
      confidence: words > 0 ? clamp01(words / 20) : 0.1,
      detail: `${words} words of bio/caption text`,
      factors: [factor("text_specificity", score, ["text:all"], undefined, words)],
    };
  },

  cliche_penalty: (ctx) => {
    const text = collectText(ctx.evidence);
    const { count, matched } = countHits(text, CLICHE_MARKERS);
    // More clichés → lower distinctiveness score
    const score = clamp01(1 - count / 4);
    return {
      score,
      confidence: textConfidence(text),
      detail:
        count === 0
          ? "no cliché markers"
          : `clichés: ${matched.slice(0, 5).join(", ")}`,
      factors: [factor("cliche_penalty", score, matched.map((m) => `cliche:${m}`), undefined, count)],
    };
  },

  rare_topic_mix: (ctx) => {
    const text = collectText(ctx.evidence);
    const topics = [...topicHits(text).keys()];
    // Content-only: unusual mix from topic count (no platform diversity bonus)
    const score = clamp01(topics.length / 4);
    return {
      score,
      confidence: textConfidence(text),
      detail: `mix size ${topics.length} topics`,
      factors: [
        factor("rare_topic_mix", score, topics.map((t) => `topic:${t}`), undefined, topics.length),
      ],
    };
  },

  cross_platform_topics: (ctx) => {
    // Topic agreement across separate text items — ignores host/platform type.
    const itemTopics: Set<string>[] = [];
    for (const b of ctx.evidence.bios ?? []) {
      const t = topicHits(b.text.toLowerCase());
      if (t.size > 0) itemTopics.push(new Set(t.keys()));
    }
    for (const p of ctx.evidence.posts ?? []) {
      const t = topicHits((p.caption ?? "").toLowerCase());
      if (t.size > 0) itemTopics.push(new Set(t.keys()));
    }
    if (itemTopics.length < 2) {
      return {
        score: 0.2,
        confidence: 0.35,
        detail: "need 2+ text items for cross-source coherence",
        factors: [factor("cross_platform_topics", 0.2, ["items:lt2"])],
      };
    }
    const topicCounts = new Map<string, number>();
    for (const set of itemTopics) {
      for (const topic of set) {
        topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
      }
    }
    let overlap = 0;
    for (const c of topicCounts.values()) if (c >= 2) overlap += 1;
    const score = clamp01(overlap / 2 + (overlap > 0 ? 0.3 : 0));
    return {
      score,
      confidence: 0.6,
      detail: overlap
        ? `${overlap} topic(s) shared across text items`
        : "no shared topics across items yet",
      factors: [
        factor("cross_platform_topics", score, [`overlap:${overlap}`], undefined, overlap),
      ],
    };
  },

  multi_item_theme: (ctx) => {
    const text = collectText(ctx.evidence);
    const topics = topicHits(text);
    let multi = 0;
    for (const v of topics.values()) if (v >= 2) multi += 1;
    const score = clamp01(multi / 3);
    return {
      score,
      confidence: textConfidence(text),
      detail: `${multi} topic(s) repeated`,
      factors: [factor("multi_item_theme", score, [], undefined, multi)],
    };
  },

  niche_markers: (ctx) => {
    const text = collectText(ctx.evidence);
    const { count, matched } = countHits(text, NICHE_MARKERS);
    const score = clamp01(count / 3);
    return {
      score,
      confidence: textConfidence(text) * 0.85,
      detail: matched.length ? matched.slice(0, 5).join(", ") : "no niche markers",
      factors: [factor("niche_markers", score, matched.map((m) => `niche:${m}`), undefined, count)],
    };
  },

  mainstream_inverse: (ctx) => {
    const text = collectText(ctx.evidence);
    const { count, matched } = countHits(text, MAINSTREAM_MARKERS);
    const score = clamp01(1 - count / 3);
    return {
      score,
      confidence: textConfidence(text) * 0.75,
      detail:
        count === 0
          ? "no mainstream markers"
          : `mainstream hits: ${matched.slice(0, 5).join(", ")}`,
      factors: [
        factor("mainstream_inverse", score, matched.map((m) => `main:${m}`), undefined, count),
      ],
    };
  },

  pov_markers: (ctx) => {
    const text = collectText(ctx.evidence);
    const { count, matched } = countHits(text, CURATION_MARKERS);
    const score = clamp01(count / 3);
    return {
      score,
      confidence: textConfidence(text),
      detail: matched.length ? matched.slice(0, 5).join(", ") : "no POV markers",
      factors: [factor("pov_markers", score, matched.map((m) => `pov:${m}`), undefined, count)],
    };
  },

  anti_spam_density: (ctx) => {
    const text = collectText(ctx.evidence);
    const { count } = countHits(text, CLICHE_MARKERS);
    const words = Math.max(1, text.trim().split(/\s+/).filter(Boolean).length);
    const density = count / words;
    const score = clamp01(1 - density * 25);
    return {
      score,
      confidence: textConfidence(text),
      detail: `cliché density ~${(density * 100).toFixed(1)}% of terms`,
      factors: [factor("anti_spam_density", score, [], undefined, count)],
    };
  },

  maker_language: (ctx) => {
    const text = collectText(ctx.evidence);
    const maker = [
      "create",
      "creative",
      "maker",
      "artist",
      "designer",
      "photographer",
      "filmmaker",
      "musician",
      "writer",
      "builder",
      "developer",
    ];
    const { count, matched } = countHits(text, maker);
    const score = clamp01(count / 3);
    return {
      score,
      confidence: textConfidence(text),
      detail: matched.length ? matched.join(", ") : "no maker labels",
      factors: [factor("maker_language", score, matched.map((m) => `maker:${m}`), undefined, count)],
    };
  },

  process_language: (ctx) => {
    const text = collectText(ctx.evidence);
    const { count, matched } = countHits(text, CRAFT_MARKERS);
    const score = clamp01(count / 4);
    return {
      score,
      confidence: textConfidence(text),
      detail: matched.length ? matched.slice(0, 6).join(", ") : "no process markers",
      factors: [factor("process_language", score, matched.map((m) => `proc:${m}`), undefined, count)],
    };
  },

  t_shape_combo: (ctx) => {
    // Derived from content depth + topic breadth — not which hosts were linked.
    const text = collectText(ctx.evidence);
    const topics = topicHits(text);
    const breadth = clamp01(topics.size / 5);
    const { count } = countHits(text, CRAFT_MARKERS);
    let maxTopic = 0;
    for (const v of topics.values()) maxTopic = Math.max(maxTopic, v);
    const depth = clamp01(count / 4 + maxTopic / 6);
    // Geometric mean rewards both being present.
    const score = clamp01(Math.sqrt(breadth * depth));
    return {
      score,
      confidence: textConfidence(text) * 0.8,
      detail: `breadth~${breadth.toFixed(2)} depth~${depth.toFixed(2)}`,
      factors: [
        factor("t_shape_combo", score, [`breadth:${breadth}`, `depth:${depth}`]),
      ],
    };
  },

  follow_volume: (ctx) => {
    const follows = collectFollows(ctx);
    const n = follows.length;
    // 0 follows → 0; ~12+ observed follows → high coverage
    const score = clamp01(n / 12);
    const conf = n === 0 ? 0.15 : clamp01(0.4 + n / 20);
    return {
      score,
      confidence: conf,
      detail: n === 0 ? "no public follows observed" : `${n} followed account(s)`,
      factors: [
        factor(
          "follow_volume",
          score,
          follows.slice(0, 12).map((f) => `follow:@${f.handle}`),
          undefined,
          n,
        ),
      ],
    };
  },

  follow_topic_range: (ctx) => {
    const follows = collectFollows(ctx);
    if (follows.length === 0) {
      return {
        score: 0,
        confidence: 0.1,
        detail: "no follows to score topic range",
        factors: [factor("follow_topic_range", 0, [])],
      };
    }
    const text = followText(follows);
    const topics = topicHits(text);
    const score = clamp01(topics.size / 5);
    return {
      score,
      confidence: clamp01(0.35 + follows.length / 25 + textConfidence(text) * 0.3),
      detail: topics.size
        ? `follow topics: ${[...topics.keys()].slice(0, 6).join(", ")}`
        : "follows present but no topic lexicon hits",
      factors: [
        factor(
          "follow_topic_range",
          score,
          [...topics.keys()].map((t) => `ftopic:${t}`),
          undefined,
          topics.size,
        ),
      ],
    };
  },

  follow_self_overlap: (ctx) => {
    const follows = collectFollows(ctx);
    const selfText = collectText(ctx.evidence);
    const selfTopics = topicHits(selfText);
    if (follows.length === 0) {
      return {
        score: 0.2,
        confidence: 0.1,
        detail: "no follows — cannot measure overlap",
        factors: [factor("follow_self_overlap", 0.2, [])],
      };
    }
    if (selfTopics.size === 0) {
      return {
        score: 0.25,
        confidence: 0.25,
        detail: "follows present but self profile has no topics yet",
        factors: [factor("follow_self_overlap", 0.25, [])],
      };
    }
    const followTopics = topicHits(followText(follows));
    let overlap = 0;
    for (const t of selfTopics.keys()) {
      if (followTopics.has(t)) overlap += 1;
    }
    const score = clamp01(overlap / Math.max(1, Math.min(4, selfTopics.size)));
    return {
      score,
      confidence: clamp01(0.4 + follows.length / 30),
      detail:
        overlap > 0
          ? `${overlap} topic(s) shared with follows`
          : "no shared topics with follows yet",
      factors: [
        factor("follow_self_overlap", score, [`overlap:${overlap}`], undefined, overlap),
      ],
    };
  },
};

function collectFollows(ctx: TasteScoreContext) {
  const fromEvidence = ctx.evidence.follows ?? [];
  if (fromEvidence.length > 0) return fromEvidence;
  const out: NonNullable<typeof ctx.evidence.follows> = [];
  const seen = new Set<string>();
  for (const snap of ctx.snapshots) {
    for (const f of snap.follows ?? []) {
      const key = `${f.platform}:${f.handle.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(f);
    }
  }
  return out;
}

function followText(
  follows: Array<{ handle: string; displayName?: string; bio?: string }>,
): string {
  return follows
    .map((f) => [f.handle, f.displayName, f.bio].filter(Boolean).join(" "))
    .join(" \n ")
    .toLowerCase();
}

export function runSignal(
  signalId: string,
  ctx: TasteScoreContext,
): Omit<TasteSignalResult, "signalId" | "axisId"> | null {
  const fn = extractors[signalId];
  if (!fn) return null;
  return fn(ctx);
}

/** For tests / debugging: which extractors are registered. */
export function listExtractorIds(): string[] {
  return Object.keys(extractors).sort();
}
