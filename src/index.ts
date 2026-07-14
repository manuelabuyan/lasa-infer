export { INFER_VERSION } from "./version.js";
export { analyze } from "./analyze.js";
export { computeStage } from "./stage.js";
export { extractFactors } from "./factors/extract.js";
export {
  FACTOR_REGISTRY,
  getFactorDefinition,
  type FactorDefinition,
} from "./factors/registry.js";
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
