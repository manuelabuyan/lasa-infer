import type { Evidence, StageParams } from "./types.js";

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Map evidence coverage to discrete visual stage + motion params.
 * Renderers should hard-cap geometry; this only suggests budgets.
 */
export function computeStage(
  evidence: Evidence,
  motifs: string[] = [],
): StageParams {
  const platformCount = new Set(evidence.platforms).size;
  const postCount = evidence.posts?.length ?? 0;
  const bioCount = evidence.bios?.length ?? 0;
  const volume = postCount + bioCount;

  let stage: StageParams["stage"] = 0;
  if (platformCount >= 1 && volume >= 1) stage = 1;
  if (platformCount >= 2 || volume >= 6) stage = 2;
  if (platformCount >= 3 || (platformCount >= 2 && volume >= 10)) stage = 3;

  const complexity = clamp01(0.15 + stage * 0.22 + Math.min(volume, 12) * 0.02);
  const pulse = clamp01(0.7 + stage * 0.08);

  const palette =
    motifs.includes("night")
      ? ["#0f0e17", "#7f5af0", "#2cb67d", "#fffffe"]
      : motifs.includes("creative")
        ? ["#1a1a2e", "#e94560", "#f5a623", "#eaeaea"]
        : ["#121212", "#4a4e69", "#9a8c98", "#f2e9e4"];

  return {
    stage,
    pulse,
    complexity,
    palette,
    motifs,
  };
}
