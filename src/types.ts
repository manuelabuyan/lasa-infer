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
 * An account the person follows (or appears to follow from public HTML).
 * Used as a second taste channel: who you follow shapes inferred taste.
 * When deep-scraped, carries their public text/image evidence too.
 */
export interface FollowItem {
  handle: string;
  platform: PlatformId;
  displayName?: string;
  /** Public bio / description of the followed account when available. */
  bio?: string;
  /** How this edge was observed. */
  source?: "public_following" | "embedded" | "inferred";
  /** Canonical public profile URL when known. */
  profileUrl?: string;
  /** Deep-scrape of the followee’s public page (title, captions, etc.). */
  textSignals?: string[];
  imageUrl?: string;
  /** Palette from their public preview image. */
  imageSignals?: import("./linkEvidence.js").ImagePaletteSignal;
  access?: import("./linkEvidence.js").LinkAccess;
  /** pending | ready | error | skipped */
  scrapeStatus?: "pending" | "ready" | "error" | "skipped";
  scrapeError?: string;
}

/**
 * Normalized input to the open algorithm.
 * Built by the private app after OAuth sync — never includes tokens.
 */
export interface Evidence {
  platforms: PlatformId[];
  bios?: BioItem[];
  posts?: ContentItem[];
  /** Accounts followed by the linked profiles (public scrape / graph). */
  follows?: FollowItem[];
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
