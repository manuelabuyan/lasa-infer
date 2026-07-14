import { extractFactors } from "./factors/extract.js";
import { computeStage } from "./stage.js";
import type {
  Evidence,
  Explanation,
  FactorHit,
  InsightSnapshot,
  TraitResult,
} from "./types.js";
import { INFER_VERSION } from "./version.js";

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function findHit(hits: FactorHit[], id: string): FactorHit | undefined {
  return hits.find((h) => h.id === id);
}

function buildTraits(hits: FactorHit[]): TraitResult[] {
  const traits: TraitResult[] = [];
  const night = findHit(hits, "caption_keyword_night");
  const creative = findHit(hits, "caption_keyword_creative");
  const overlap = findHit(hits, "cross_platform_theme_overlap");
  const coverage = findHit(hits, "platform_coverage");
  const volume = findHit(hits, "evidence_volume");

  const boost = (overlap?.weight ?? 0) * 0.25;

  if (night) {
    const confidence = clamp01(night.weight * 0.75 + boost + (volume?.weight ?? 0) * 0.1);
    traits.push({
      id: "night_oriented",
      label: "Night-oriented",
      confidence,
      factors: [night, ...(overlap ? [overlap] : [])],
      summary: "Language around night and late hours shows up in linked content.",
    });
  }

  if (creative) {
    const confidence = clamp01(
      creative.weight * 0.75 + boost + (volume?.weight ?? 0) * 0.1,
    );
    traits.push({
      id: "creative_maker",
      label: "Creative / maker",
      confidence,
      factors: [creative, ...(overlap ? [overlap] : [])],
      summary: "Creative and maker vocabulary appears in bios or captions.",
    });
  }

  // Always expose a coverage trait so empty → multi-account progression is visible.
  if (coverage) {
    traits.push({
      id: "signal_coverage",
      label: "Signal coverage",
      confidence: clamp01(
        (coverage.weight * 0.6 + (volume?.weight ?? 0) * 0.4) * (1 + boost),
      ),
      factors: [coverage, ...(volume ? [volume] : []), ...(overlap ? [overlap] : [])],
      summary:
        "How much linked-account evidence is available; grows as more accounts and posts are added.",
    });
  }

  return traits.sort((a, b) => b.confidence - a.confidence);
}

function buildExplanations(traits: TraitResult[]): Explanation[] {
  return traits.map((t) => ({
    traitId: t.id,
    summary:
      t.summary ??
      `Derived from public factors: ${t.factors.map((f) => f.id).join(", ")}`,
    factors: t.factors,
    method: "rules" as const,
  }));
}

function overallConfidence(traits: TraitResult[], hits: FactorHit[]): number {
  if (traits.length === 0) return 0;
  const avg =
    traits.reduce((s, t) => s + t.confidence, 0) / Math.max(traits.length, 1);
  const overlap = findHit(hits, "cross_platform_theme_overlap")?.weight ?? 0;
  return clamp01(avg * 0.85 + overlap * 0.15);
}

/**
 * Run the open inference algorithm on normalized evidence.
 * Pure / deterministic for the current rules engine (no I/O).
 */
export function analyze(evidence: Evidence): InsightSnapshot {
  const platforms = [...new Set(evidence.platforms)];
  const hits = extractFactors(evidence);
  const traits = buildTraits(hits);
  const explanations = buildExplanations(traits);

  const motifs: string[] = [];
  // Any positive trait confidence is enough to expose a motif to the UI.
  if (traits.some((t) => t.id === "night_oriented" && t.confidence > 0)) {
    motifs.push("night");
  }
  if (traits.some((t) => t.id === "creative_maker" && t.confidence > 0)) {
    motifs.push("creative");
  }

  const stageParams = computeStage(evidence, motifs);
  const postCount = evidence.posts?.length ?? 0;
  const bioCount = evidence.bios?.length ?? 0;

  return {
    inferVersion: INFER_VERSION,
    traits,
    explanations,
    stageParams,
    platforms,
    meta: {
      postCount,
      bioCount,
      platformCount: platforms.length,
      overallConfidence: overallConfidence(traits, hits),
    },
  };
}
