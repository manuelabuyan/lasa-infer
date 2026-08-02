export type {
  DataConfidence,
  DataConfidenceBreakdown,
  RegistryStatus,
  TasteAxisDef,
  TasteAxisResult,
  TasteModelDescription,
  TasteProfile,
  TasteScoreContext,
  TasteSignalDef,
  TasteSignalInput,
  TasteSignalResult,
} from "./types.js";

export { TASTE_AXES, listTasteAxes, getTasteAxis } from "./registry.js";
export {
  TASTE_SIGNALS,
  listTasteSignals,
  getTasteSignal,
} from "./signals/registry.js";
export { listExtractorIds } from "./signals/extractors.js";
export { describeTasteModel, printTasteModel } from "./describe.js";
export { computeDataConfidence } from "./confidence.js";
export {
  computeTasteRank,
  normalCdf,
  TASTE_POPULATION,
  type TasteRankResult,
} from "./rank.js";
export {
  scoreTaste,
  formatTasteProfile,
  type ScoreTasteOptions,
} from "./score.js";
export {
  COLOUR_DEFS,
  listTasteColours,
  getTasteColour,
  inferTasteColour,
  type ColourAttribution,
  type ColourContribution,
  type ColourContributionSource,
  type ColourLinkEvidence,
  type InferColourOptions,
  type TasteColourDef,
  type TasteColourResult,
} from "./colour.js";
