/**
 * Global relative taste rank (0–100).
 *
 * Latent quality is scored from open axes, then mapped through a standard
 * normal CDF so placements are relative (most people mid, extremes rare).
 * Population μ/σ are fixed open parameters until we have empirical calibration.
 */

import type { TasteAxisResult, TasteProfile } from "./types.js";

export type TasteRankResult = {
  /** 0–100 relative rank (higher = higher taste). Φ(z)×100. */
  score: number;
  /** Latent quality 0–1 before population mapping. */
  latent: number;
  /** Standard-score under assumed population N(μ, σ). */
  z: number;
  /** Short band label for UI. */
  band: "very low" | "low" | "below average" | "average" | "above average" | "high" | "very high";
  summary: string;
  /** Axis contributions used in latent (for audit). */
  parts: Array<{ axisId: string; label: string; weight: number; score: number }>;
};

/**
 * Assumed worldwide latent distribution on [0,1] quality scale.
 * Tunable open constants — not secret.
 */
export const TASTE_POPULATION = {
  /** Mean latent taste quality in the assumed population. */
  mean: 0.42,
  /** Spread of latent quality. */
  sd: 0.14,
} as const;

/**
 * Weights for composite “high taste” latent (must sum ~1).
 * Craft is heavy: what someone *creates* (and whether it’s original vs dupe)
 * should move rank as much as who they follow.
 */
const LATENT_AXIS_WEIGHTS: Array<{ axisId: string; weight: number }> = [
  { axisId: "craft", weight: 0.26 },
  { axisId: "social_graph", weight: 0.22 },
  { axisId: "distinctiveness", weight: 0.15 },
  { axisId: "discovery_orientation", weight: 0.14 },
  { axisId: "curation", weight: 0.1 },
  { axisId: "depth", weight: 0.08 },
];

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Approximate standard normal CDF (Abramowitz & Stegun 26.2.17). */
export function normalCdf(z: number): number {
  if (z < -8) return 0;
  if (z > 8) return 1;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

function bandFor(score: number): TasteRankResult["band"] {
  if (score < 10) return "very low";
  if (score < 25) return "low";
  if (score < 40) return "below average";
  if (score < 60) return "average";
  if (score < 75) return "above average";
  if (score < 90) return "high";
  return "very high";
}

function axisScore(
  axes: TasteAxisResult[],
  id: string,
): { score: number; label: string; present: boolean } {
  const a = axes.find((x) => x.axisId === id);
  if (!a || a.score === null) {
    return { score: 0.35, label: id, present: false }; // mild prior when missing
  }
  return { score: clamp01(a.score), label: a.label, present: true };
}

/**
 * Build relative taste rank from a scored profile.
 * Pure rules — no network.
 */
export function computeTasteRank(profile: TasteProfile): TasteRankResult {
  const parts: TasteRankResult["parts"] = [];
  let wSum = 0;
  let acc = 0;

  for (const { axisId, weight } of LATENT_AXIS_WEIGHTS) {
    const { score, label, present } = axisScore(profile.axes, axisId);
    // Down-weight missing axes so empty profiles don't fake high rank
    const w = present ? weight : weight * 0.35;
    wSum += w;
    acc += score * w;
    parts.push({ axisId, label, weight: w, score });
  }

  // Colour boldness / decisiveness as a small polish signal (not dominant)
  const colourConf = clamp01(profile.colour?.confidence ?? 0);
  const colourIsNeutral =
    !profile.colour ||
    profile.colour.hex?.toUpperCase() === "#787E8A" ||
    profile.colour.label?.includes("slate") ||
    profile.colour.label?.includes("grey") ||
    profile.colour.label?.includes("gray");
  const colourPart = colourIsNeutral ? 0.3 * colourConf : colourConf;
  const colourW = 0.08;
  wSum += colourW;
  acc += colourPart * colourW;
  parts.push({
    axisId: "colour",
    label: "Colour strength",
    weight: colourW,
    score: colourPart,
  });

  // Data confidence softens extremes when evidence is thin
  const dataC = clamp01(profile.dataConfidence?.score ?? 0);
  let latent = wSum > 0 ? acc / wSum : 0.35;
  // Pull toward population mean when data is thin (regression to the mean)
  latent = clamp01(latent * (0.45 + 0.55 * dataC) + TASTE_POPULATION.mean * (1 - dataC) * 0.55);

  const z =
    (latent - TASTE_POPULATION.mean) / Math.max(0.05, TASTE_POPULATION.sd);
  const percentile = normalCdf(z) * 100;
  // Keep a hair off exact 0/100 for UI honesty
  const score = Math.max(1, Math.min(99, Math.round(percentile * 10) / 10));
  const band = bandFor(score);

  const summary =
    dataC < 0.25
      ? `Relative taste ~${Math.round(score)} — still early; more public signal moves the rank.`
      : `Relative taste ~${Math.round(score)} (${band}) under a normal population model.`;

  return {
    score,
    latent,
    z,
    band,
    summary,
    parts,
  };
}
