import type { Evidence, FactorHit } from "../types.js";
import type { LinkSnapshot } from "../linkEvidence.js";

export type { Evidence, FactorHit, LinkSnapshot };

/** Lifecycle of an axis or signal — toggle without deleting. */
export type RegistryStatus = "active" | "stub" | "parked" | "disabled";

export type TasteSignalInput =
  | "platforms"
  | "bios"
  | "captions"
  | "tags"
  | "link_snapshots"
  | "follows"
  | "derived";

/** Declarative axis — edit TASTE_AXES to add/remove/toggle dimensions. */
export interface TasteAxisDef {
  id: string;
  label: string;
  description: string;
  /** active = scored; stub = listed, not scored; parked/disabled = filterable */
  status: RegistryStatus;
  version: number;
  /** Optional sort order for UI (lower first). */
  order?: number;
}

/** Declarative signal — points at an axis; extractor registered by id. */
export interface TasteSignalDef {
  id: string;
  axisId: string;
  title: string;
  description: string;
  inputs: TasteSignalInput[];
  /** Relative weight within its axis (among active signals). */
  weight: number;
  status: RegistryStatus;
  version: number;
}

/** Result of running one signal extractor. */
export interface TasteSignalResult {
  signalId: string;
  axisId: string;
  /** 0–1 contribution (higher = more of this quality). */
  score: number;
  /** 0–1 how much evidence this signal had. */
  confidence: number;
  detail?: string;
  factors: FactorHit[];
}

export interface TasteAxisResult {
  axisId: string;
  label: string;
  status: RegistryStatus;
  /** null when stub/parked/disabled or no active signals. */
  score: number | null;
  confidence: number;
  signals: TasteSignalResult[];
  summary?: string;
  note?: string;
}

export interface DataConfidenceBreakdown {
  linkCountFactor: number;
  accessFactor: number;
  textVolumeFactor: number;
  structureFactor: number;
}

export interface DataConfidence {
  /** 0–1 overall “how much usable data we have”. */
  score: number;
  label: "low" | "limited" | "moderate" | "high";
  summary: string;
  breakdown: DataConfidenceBreakdown;
}

export interface TasteProfile {
  inferVersion: string;
  axes: TasteAxisResult[];
  dataConfidence: DataConfidence;
  /** First visual conclusion — drives the living graphic colour. */
  colour: import("./colour.js").TasteColourResult;
  /** Nested tree for docs / debugging / UI. */
  model: TasteModelDescription;
}

export interface TasteModelDescription {
  axes: Array<{
    axis: TasteAxisDef;
    signals: TasteSignalDef[];
  }>;
}

/** Context passed to every signal extractor. */
export interface TasteScoreContext {
  evidence: Evidence;
  snapshots: LinkSnapshot[];
}

export type TasteSignalExtractor = (
  ctx: TasteScoreContext,
) => Omit<TasteSignalResult, "signalId" | "axisId">;
