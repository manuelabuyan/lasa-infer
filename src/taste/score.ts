import { evidenceFromLinkSnapshots } from "../linkEvidence.js";
import type { Evidence } from "../types.js";
import type { LinkSnapshot } from "../linkEvidence.js";
import { INFER_VERSION } from "../version.js";
import { computeDataConfidence } from "./confidence.js";
import { listTasteAxes } from "./registry.js";
import { runSignal } from "./signals/extractors.js";
import { getTasteSignal, listTasteSignals } from "./signals/registry.js";
import type {
  TasteAxisResult,
  TasteProfile,
  TasteScoreContext,
  TasteSignalResult,
} from "./types.js";
import { describeTasteModel } from "./describe.js";
import { inferTasteColour } from "./colour.js";

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export type ScoreTasteOptions = {
  evidence?: Evidence;
  snapshots?: LinkSnapshot[];
  /**
   * Which registry statuses to score.
   * Default: only "active" signals/axes. Stubs still appear with null scores.
   */
  includeAxisStatus?: Array<"active" | "stub" | "parked" | "disabled">;
};

/**
 * Run the public taste model.
 * Axes/signals come from registries — toggle status there to enable/disable.
 */
export function scoreTaste(options: ScoreTasteOptions = {}): TasteProfile {
  const snapshots = options.snapshots ?? [];
  const evidence =
    options.evidence ??
    (snapshots.length > 0
      ? evidenceFromLinkSnapshots(snapshots)
      : { platforms: [] });

  const ctx: TasteScoreContext = { evidence, snapshots };
  const dataConfidence = computeDataConfidence(snapshots, evidence);

  const axisStatuses = options.includeAxisStatus ?? ["active", "stub"];
  const axesOut: TasteAxisResult[] = [];

  for (const axis of listTasteAxes({ include: axisStatuses })) {
    if (axis.status === "stub" || axis.status === "parked" || axis.status === "disabled") {
      axesOut.push({
        axisId: axis.id,
        label: axis.label,
        status: axis.status,
        score: null,
        confidence: 0,
        signals: [],
        note:
          axis.status === "stub"
            ? "Not scored yet — reserved axis."
            : `Axis status: ${axis.status}`,
      });
      continue;
    }

    const signalDefs = listTasteSignals({
      axisId: axis.id,
      include: ["active"],
    });

    const signals: TasteSignalResult[] = [];
    for (const def of signalDefs) {
      const raw = runSignal(def.id, ctx);
      if (!raw) {
        // Missing extractor — skip but keep registry honest
        continue;
      }
      const result: TasteSignalResult = {
        signalId: def.id,
        axisId: axis.id,
        score: clamp01(raw.score),
        confidence: clamp01(raw.confidence),
        factors: raw.factors,
      };
      if (raw.detail !== undefined) result.detail = raw.detail;
      signals.push(result);
    }

    if (signals.length === 0) {
      axesOut.push({
        axisId: axis.id,
        label: axis.label,
        status: axis.status,
        score: null,
        confidence: 0,
        signals: [],
        note: "No active signals or extractors for this axis.",
      });
      continue;
    }

    let weightSum = 0;
    let acc = 0;
    let confAcc = 0;
    for (const s of signals) {
      const w = getTasteSignal(s.signalId)?.weight ?? 1;
      weightSum += w;
      acc += s.score * w;
      confAcc += s.confidence * w;
    }
    const score = weightSum > 0 ? clamp01(acc / weightSum) : null;
    const confidence = clamp01(
      (weightSum > 0 ? confAcc / weightSum : 0) * (0.5 + 0.5 * dataConfidence.score),
    );

    const top = [...signals].sort((a, b) => b.score - a.score)[0];
    const axisResult: TasteAxisResult = {
      axisId: axis.id,
      label: axis.label,
      status: axis.status,
      score,
      confidence,
      signals,
    };
    if (score !== null) {
      axisResult.summary =
        `${axis.label}: ${(score * 100).toFixed(0)}%` +
        (top?.detail ? ` — ${top.detail}` : "");
    }
    axesOut.push(axisResult);
  }

const colour = inferTasteColour(evidence, snapshots, {
    axes: axesOut,
    dataConfidence,
  });

  return {
    inferVersion: INFER_VERSION,
    axes: axesOut,
    dataConfidence,
    colour,
    model: describeTasteModel(),
  };
}

/** Convenience: human-readable lines for debugging. */
export function formatTasteProfile(profile: TasteProfile): string {
  const lines: string[] = [
    `infer ${profile.inferVersion}`,
    `colour: ${profile.colour.label} (${profile.colour.hex}) — ${profile.colour.summary}`,
    `data confidence: ${(profile.dataConfidence.score * 100).toFixed(0)}% (${profile.dataConfidence.label}) — ${profile.dataConfidence.summary}`,
    "axes:",
  ];
  for (const a of profile.axes) {
    if (a.score === null) {
      lines.push(`  - ${a.label} [${a.status}] — ${a.note ?? "n/a"}`);
    } else {
      lines.push(
        `  - ${a.label}: ${(a.score * 100).toFixed(0)}% (conf ${(a.confidence * 100).toFixed(0)}%)`,
      );
      for (const s of a.signals) {
        lines.push(
          `      · ${s.signalId}: ${(s.score * 100).toFixed(0)}%${s.detail ? ` — ${s.detail}` : ""}`,
        );
      }
    }
  }
  return lines.join("\n");
}
