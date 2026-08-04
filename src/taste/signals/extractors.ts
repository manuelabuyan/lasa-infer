import type { FactorHit } from "../../types.js";
import {
  CELEB_FOLLOW_MARKERS,
  CLICHE_MARKERS,
  collectText,
  countHits,
  CRAFT_MARKERS,
  CREATIVE_OUTPUT_MARKERS,
  CURATION_MARKERS,
  DERIVATIVE_MARKERS,
  MAINSTREAM_MARKERS,
  NICHE_MARKERS,
  ORIGINALITY_MARKERS,
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

  /**
   * Public evidence of work they made (pieces, products, shows) + soft image intentionality.
   */
  creative_output: (ctx) => {
    const text = collectText(ctx.evidence);
    const { count, matched } = countHits(text, CREATIVE_OUTPUT_MARKERS);
    const posts = ctx.evidence.posts ?? [];
    const madePosts = posts.filter(
      (p) =>
        p.mediaKind === "image" ||
        p.mediaKind === "video" ||
        p.mediaKind === "carousel" ||
        (p.caption && countHits(p.caption.toLowerCase(), CREATIVE_OUTPUT_MARKERS).count > 0),
    ).length;
    // Soft visual proxy: intentional palettes (not a full aesthetic judge)
    let imageIntent = 0;
    let imageN = 0;
    for (const snap of ctx.snapshots) {
      const img = snap.imageSignals;
      if (!img || img.confidence < 0.2) continue;
      imageN += 1;
      // Distinct hue + not fully neutral → slightly more “considered” frame
      const intent =
        img.vibrance * 0.45 +
        (1 - img.neutralShare) * 0.35 +
        (img.saturation > 0.15 ? 0.2 : 0);
      imageIntent += clamp01(intent);
    }
    const imageScore = imageN > 0 ? imageIntent / imageN : 0;

    const score = clamp01(
      count / 4 * 0.55 +
        clamp01(madePosts / 3) * 0.25 +
        imageScore * 0.2,
    );
    return {
      score,
      confidence: clamp01(
        textConfidence(text) * 0.7 + (imageN > 0 ? 0.2 : 0) + (count > 0 ? 0.1 : 0),
      ),
      detail:
        count > 0 || madePosts > 0
          ? `output markers: ${matched.slice(0, 5).join(", ") || "media posts"} · visual intent~${imageScore.toFixed(2)}`
          : "little evidence of authored work in public text",
      factors: [
        factor(
          "creative_output",
          score,
          matched.map((m) => `out:${m}`),
          undefined,
          count,
        ),
      ],
    };
  },

  originality_markers: (ctx) => {
    const text = collectText(ctx.evidence);
    const { count, matched } = countHits(text, ORIGINALITY_MARKERS);
    const { count: craftN } = countHits(text, CRAFT_MARKERS);
    // Originality lands harder when process language co-occurs
    const score = clamp01(count / 3 * 0.75 + clamp01(craftN / 5) * 0.25);
    return {
      score,
      confidence: textConfidence(text),
      detail: matched.length
        ? `originality: ${matched.slice(0, 5).join(", ")}`
        : "no strong originality/adaptation markers",
      factors: [
        factor(
          "originality_markers",
          score,
          matched.map((m) => `orig:${m}`),
          undefined,
          count,
        ),
      ],
    };
  },

  derivative_inverse: (ctx) => {
    const text = collectText(ctx.evidence);
    const { count, matched } = countHits(text, DERIVATIVE_MARKERS);
    // Any blatant dupe language pulls hard toward low craft/taste
    const score = clamp01(1 - count / 2);
    return {
      score,
      confidence: textConfidence(text) * 0.85,
      detail:
        count === 0
          ? "no dupe/template/low-effort copy markers"
          : `derivative hits: ${matched.slice(0, 5).join(", ")}`,
      factors: [
        factor(
          "derivative_inverse",
          score,
          matched.map((m) => `deriv:${m}`),
          undefined,
          count,
        ),
      ],
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

  // Legacy extractors kept so registry ids resolve if re-enabled.
  follow_volume: (ctx) => {
    const follows = collectFollows(ctx);
    const n = follows.length;
    return {
      score: 0,
      confidence: n === 0 ? 0.1 : 0.3,
      detail: "follow_volume disabled — count alone is not taste",
      factors: [factor("follow_volume", 0, [], undefined, n)],
    };
  },

  follow_topic_range: (ctx) => {
    // Proxy to niche breadth for backwards compatibility if re-enabled
    return extractors.follow_niche_breadth!(ctx);
  },

  follow_self_overlap: (ctx) => {
    const follows = collectFollows(ctx);
    const selfText = collectText(ctx.evidence);
    const selfTopics = topicHits(selfText);
    if (follows.length === 0) {
      return {
        score: 0.15,
        confidence: 0.1,
        detail: "no follows — cannot measure overlap",
        factors: [factor("follow_self_overlap", 0.15, [])],
      };
    }
    if (selfTopics.size === 0) {
      return {
        score: 0.2,
        confidence: 0.2,
        detail: "follows present but self profile has no topics yet",
        factors: [factor("follow_self_overlap", 0.2, [])],
      };
    }
    // Prefer overlap with niche-leaning follows only
    const nicheFollows = follows.filter((f) => scoreFollowQuality(f).niche >= 0.35);
    const pool = nicheFollows.length >= 2 ? nicheFollows : follows;
    const followTopics = topicHits(followText(pool));
    let overlap = 0;
    for (const t of selfTopics.keys()) {
      if (followTopics.has(t)) overlap += 1;
    }
    const score = clamp01(overlap / Math.max(1, Math.min(4, selfTopics.size)));
    return {
      score,
      confidence: clamp01(0.35 + pool.length / 30),
      detail:
        overlap > 0
          ? `${overlap} topic(s) shared with ${nicheFollows.length ? "niche " : ""}follows`
          : "no shared topics with follows yet",
      factors: [
        factor("follow_self_overlap", score, [`overlap:${overlap}`], undefined, overlap),
      ],
    };
  },

  /**
   * Depth among follows: craft/artist/niche language concentration.
   * Mass celeb lists score low even if long.
   */
  follow_niche_depth: (ctx) => {
    const follows = collectFollows(ctx);
    if (follows.length === 0) {
      return {
        score: 0,
        confidence: 0.1,
        detail: "no follows for niche depth",
        factors: [factor("follow_niche_depth", 0, [])],
      };
    }
    const qualities = follows.map(scoreFollowQuality);
    const meanNiche =
      qualities.reduce((s, q) => s + q.niche, 0) / qualities.length;
    // Depth: strong peak of craft/niche in the best third of follows
    const sorted = [...qualities].sort((a, b) => b.niche - a.niche);
    const topK = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 3)));
    const peak =
      topK.reduce((s, q) => s + q.niche, 0) / topK.length;
    // Slight penalty if almost no bios (can't assess depth)
    const withText = qualities.filter((q) => q.hasText).length;
    const textCoverage = withText / follows.length;
    const score = clamp01(0.55 * peak + 0.35 * meanNiche + 0.1 * textCoverage);
    return {
      score,
      confidence: clamp01(0.3 + textCoverage * 0.5 + Math.min(0.2, follows.length / 40)),
      detail: `mean niche ${meanNiche.toFixed(2)} · peak third ${peak.toFixed(2)} · ${withText}/${follows.length} with bio text`,
      factors: [
        factor("follow_niche_depth", score, [`peak:${peak}`, `mean:${meanNiche}`], undefined, peak),
      ],
    };
  },

  /**
   * Breadth among *niche-leaning* follows (topic range of creators, not celeb soup).
   */
  follow_niche_breadth: (ctx) => {
    const follows = collectFollows(ctx);
    if (follows.length === 0) {
      return {
        score: 0,
        confidence: 0.1,
        detail: "no follows for niche breadth",
        factors: [factor("follow_niche_breadth", 0, [])],
      };
    }
    const nicheFollows = follows.filter((f) => scoreFollowQuality(f).niche >= 0.3);
    const pool = nicheFollows.length >= 1 ? nicheFollows : follows;
    const text = followText(pool);
    const topics = topicHits(text);
    // Celeb-only lists: few real topics or only fashion/sports mass tags
    const score = clamp01(topics.size / 5);
    // Down-weight if pool is mostly mainstream
    const meanMain =
      pool.reduce((s, f) => s + scoreFollowQuality(f).mainstream, 0) / pool.length;
    const adjusted = clamp01(score * (1 - 0.55 * meanMain));
    return {
      score: adjusted,
      confidence: clamp01(0.3 + pool.length / 25 + textConfidence(text) * 0.25),
      detail: topics.size
        ? `niche-follow topics: ${[...topics.keys()].slice(0, 6).join(", ")} (main drag ${meanMain.toFixed(2)})`
        : "little topic range among follows",
      factors: [
        factor(
          "follow_niche_breadth",
          adjusted,
          [...topics.keys()].map((t) => `ftopic:${t}`),
          undefined,
          topics.size,
        ),
      ],
    };
  },

  /**
   * Inverse of mainstream/celeb density. 1000 celeb follows → low.
   */
  follow_mainstream_inverse: (ctx) => {
    const follows = collectFollows(ctx);
    if (follows.length === 0) {
      return {
        score: 0.5,
        confidence: 0.1,
        detail: "no follows — neutral mainstream inverse",
        factors: [factor("follow_mainstream_inverse", 0.5, [])],
      };
    }
    const qualities = follows.map(scoreFollowQuality);
    const meanMain =
      qualities.reduce((s, q) => s + q.mainstream, 0) / qualities.length;
    const meanNiche =
      qualities.reduce((s, q) => s + q.niche, 0) / qualities.length;
    // High mainstream share → low score; niche presence can still lift slightly
    let score = clamp01(1 - meanMain);
    // Pure mainstream blob: extra drag
    if (meanMain > 0.55 && meanNiche < 0.25) {
      score = clamp01(score * 0.55);
    }
    // Mass follow lists that are mostly mainstream: stronger drag
    if (follows.length >= 20 && meanMain > 0.45) {
      score = clamp01(score * 0.75);
    }
    return {
      score,
      confidence: clamp01(0.35 + Math.min(0.4, follows.length / 30)),
      detail: `mainstream density ${meanMain.toFixed(2)} · niche ${meanNiche.toFixed(2)} · n=${follows.length}`,
      factors: [
        factor(
          "follow_mainstream_inverse",
          score,
          [`main:${meanMain}`, `niche:${meanNiche}`, `n:${follows.length}`],
          undefined,
          meanMain,
        ),
      ],
    };
  },
};

/** Per-account niche vs mainstream score for follow-graph taste. */
export function scoreFollowQuality(f: {
  handle: string;
  displayName?: string;
  bio?: string;
  textSignals?: string[];
}): { niche: number; mainstream: number; hasText: boolean } {
  const text = [f.handle, f.displayName, f.bio, ...(f.textSignals ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const hasText = Boolean(
    (f.bio && f.bio.trim().length > 4) ||
      (f.textSignals && f.textSignals.join(" ").length > 8),
  );
  const handle = f.handle.toLowerCase().replace(/[^a-z0-9]/g, "");

  const { count: nicheLex } = countHits(text, NICHE_MARKERS);
  const { count: craftLex } = countHits(text, CRAFT_MARKERS);
  const { count: mainLex } = countHits(text, MAINSTREAM_MARKERS);
  const celebHit = CELEB_FOLLOW_MARKERS.some(
    (c) => handle.includes(c) || text.includes(c),
  );

  // Topics that lean crafty when present in follow bios
  const topics = topicHits(text);
  const craftTopics = ["film", "photo", "art", "music", "design", "literature", "architecture"];
  let craftTopicHits = 0;
  for (const t of craftTopics) {
    if (topics.has(t)) craftTopicHits += 1;
  }

  let niche = clamp01(
    nicheLex * 0.22 + craftLex * 0.18 + craftTopicHits * 0.2 + (hasText ? 0.08 : 0),
  );
  let mainstream = clamp01(mainLex * 0.28 + (celebHit ? 0.55 : 0));

  // Empty bio + generic handle → neutral, slightly mainstream-leaning noise
  if (!hasText && niche < 0.1 && mainstream < 0.15) {
    niche = 0.12;
    mainstream = 0.25;
  }

  // Mutual exclusion soft: high celeb marker suppresses niche
  if (celebHit) niche = clamp01(niche * 0.35);

  return { niche, mainstream, hasText };
}

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
  follows: Array<{
    handle: string;
    displayName?: string;
    bio?: string;
    textSignals?: string[];
  }>,
): string {
  return follows
    .map((f) =>
      [f.handle, f.displayName, f.bio, ...(f.textSignals ?? [])]
        .filter(Boolean)
        .join(" "),
    )
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
