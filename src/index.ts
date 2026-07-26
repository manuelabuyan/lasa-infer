export { INFER_VERSION } from "./version.js";
export { analyze } from "./analyze.js";
export { computeStage } from "./stage.js";
export { extractFactors } from "./factors/extract.js";
export {
  FACTOR_REGISTRY,
  getFactorDefinition,
  type FactorDefinition,
} from "./factors/registry.js";
export {
  evidenceFromLinkSnapshots,
  linkSnapshotRichness,
  platformFromHost,
  type ImagePaletteSignal,
  type LinkAccess,
  type LinkContentKind,
  type LinkSnapshot,
} from "./linkEvidence.js";
export {
  TASTE_AXES,
  TASTE_SIGNALS,
  listTasteAxes,
  listTasteSignals,
  getTasteAxis,
  getTasteSignal,
  listExtractorIds,
  describeTasteModel,
  printTasteModel,
  computeDataConfidence,
  scoreTaste,
  formatTasteProfile,
  COLOUR_DEFS,
  listTasteColours,
  getTasteColour,
  inferTasteColour,
  type ColourAttribution,
  type ColourContribution,
  type ColourContributionSource,
  type ColourLinkEvidence,
  type InferColourOptions,
  type ScoreTasteOptions,
  type DataConfidence,
  type TasteAxisDef,
  type TasteAxisResult,
  type TasteProfile,
  type TasteSignalDef,
  type TasteSignalResult,
  type TasteColourDef,
  type TasteColourResult,
  type RegistryStatus,
} from "./taste/index.js";
export type {
  BioItem,
  ContentItem,
  Evidence,
  Explanation,
  FactorHit,
  InsightSnapshot,
  PlatformId,
  StageParams,
  TraitResult,
} from "./types.js";