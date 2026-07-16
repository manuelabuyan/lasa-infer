import type { Evidence } from "../types.js";
import type { LinkSnapshot } from "../linkEvidence.js";
import { linkSnapshotRichness } from "../linkEvidence.js";
import type { DataConfidence, DataConfidenceBreakdown } from "./types.js";

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function accessScore(access: LinkSnapshot["access"]): number {
  switch (access) {
    case "public_meta":
      return 1;
    case "partial":
      return 0.45;
    case "unknown":
      return 0.25;
    case "blocked":
      return 0.1;
    case "error":
      return 0;
    default:
      return 0.2;
  }
}

function labelFor(score: number): DataConfidence["label"] {
  if (score < 0.25) return "low";
  if (score < 0.5) return "limited";
  if (score < 0.75) return "moderate";
  return "high";
}

/**
 * Overall data confidence for the UI bar.
 * High: many public links with rich meta. Low: one private/empty profile.
 *
 * Formula (documented for open audit):
 *   0.30 * linkCount + 0.30 * access + 0.25 * textVolume + 0.15 * structure
 */
export function computeDataConfidence(
  snapshots: LinkSnapshot[],
  evidence: Evidence,
): DataConfidence {
  const n = snapshots.length;
  const linkCountFactor = clamp01(n / 5);

  let accessFactor = 0;
  if (n > 0) {
    accessFactor =
      snapshots.reduce((s, snap) => s + accessScore(snap.access), 0) / n;
  }

  const texts: string[] = [];
  for (const b of evidence.bios ?? []) texts.push(b.text);
  for (const p of evidence.posts ?? []) {
    if (p.caption) texts.push(p.caption);
  }
  for (const snap of snapshots) {
    texts.push(...snap.textSignals);
  }
  const totalChars = texts.join("").length;
  const textVolumeFactor = clamp01(totalChars / 400);

  const platforms = new Set(evidence.platforms).size;
  const kinds = new Set<string>();
  for (const snap of snapshots) kinds.add(snap.contentKind);
  const structureFactor = clamp01(platforms / 3 + kinds.size / 6);

  // Soft boost from average snapshot richness
  const richness =
    n > 0
      ? snapshots.reduce((s, snap) => s + linkSnapshotRichness(snap), 0) / n
      : 0;

  const breakdown: DataConfidenceBreakdown = {
    linkCountFactor,
    accessFactor: clamp01(accessFactor * 0.85 + richness * 0.15),
    textVolumeFactor,
    structureFactor,
  };

  const score = clamp01(
    0.3 * breakdown.linkCountFactor +
      0.3 * breakdown.accessFactor +
      0.25 * breakdown.textVolumeFactor +
      0.15 * breakdown.structureFactor,
  );

  const label = labelFor(score);
  const publicish = snapshots.filter(
    (s) => s.access === "public_meta" || s.access === "partial",
  ).length;
  const summary =
    n === 0
      ? "No links yet — add public profiles to raise confidence."
      : `${n} link${n === 1 ? "" : "s"} · ${publicish} with public/partial meta · ${label} confidence`;

  return { score, label, summary, breakdown };
}
