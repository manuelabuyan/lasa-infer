/** Supported platform ids in evidence (extend as Lasa adds connectors). */
export type PlatformId =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "x"
  | "linkedin"
  | "other";

/** A single piece of linked-account content, normalized by the private app. */
export interface ContentItem {
  id: string;
  platform: PlatformId;
  caption?: string;
  /** Optional ISO-8601 timestamp from the platform. */
  createdAt?: string;
  /** Optional media hints (URLs stay in the private app; pass tags/stats if needed). */
  mediaKind?: "image" | "video" | "carousel" | "unknown";
  /** Optional precomputed tags from private vision/pipeline (still explainable if listed). */
  tags?: string[];
}

export interface BioItem {
  platform: PlatformId;
  text: string;
}

/**
 * Normalized input to the open algorithm.
 * Built by the private app after OAuth sync — never includes tokens.
 */
export interface Evidence {
  platforms: PlatformId[];
  bios?: BioItem[];
  posts?: ContentItem[];
}

/** One measurable signal used when forming a conclusion. */
export interface FactorHit {
  /** Stable public id, e.g. `caption_keyword_night`. */
  id: string;
  /** 0–1 contribution for this hit in context. */
  weight: number;
  /** Content / bio ids that supported this factor. */
  evidenceIds: string[];
  /** Short human-readable detail. */
  detail?: string;
  /** Raw score before normalization (for debugging / open audit). */
  raw?: number;
}

export interface TraitResult {
  /** Stable trait id. */
  id: string;
  /** User-facing label. */
  label: string;
  /** 0–1. */
  confidence: number;
  /** Factors that produced this trait. */
  factors: FactorHit[];
  /** Optional short narrative derived only from factors (no hidden inputs). */
  summary?: string;
}

export interface Explanation {
  traitId: string;
  /** Plain-language “why we think this”. */
  summary: string;
  factors: FactorHit[];
  method: "rules" | "rules+llm";
}

/** Params the private UI can map to the breathing / evolving graphic. */
export interface StageParams {
  /** Discrete evolution stage from account coverage + evidence richness. */
  stage: 0 | 1 | 2 | 3;
  /** 0–1 breathe speed multiplier. */
  pulse: number;
  /** 0–1 detail budget (renderer must hard-cap geometry). */
  complexity: number;
  /** Suggested palette tokens (hex). */
  palette: string[];
  /** Motif tags derived from factors (e.g. night, warm). */
  motifs: string[];
}

/**
 * Versioned output of the open algorithm.
 * Store this on each analyze pass in the private app.
 */
export interface InsightSnapshot {
  inferVersion: string;
  traits: TraitResult[];
  explanations: Explanation[];
  stageParams: StageParams;
  /** Platforms present in the evidence used for this run. */
  platforms: PlatformId[];
  /** Simple coverage metrics for UI / audit. */
  meta: {
    postCount: number;
    bioCount: number;
    platformCount: number;
    /** 0–1 overall confidence heuristic from coverage + agreement. */
    overallConfidence: number;
  };
}
