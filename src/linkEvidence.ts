import type {
  BioItem,
  ContentItem,
  Evidence,
  FollowItem,
  PlatformId,
} from "./types.js";

/**
 * How much we could learn from a pasted URL without OAuth.
 * Pure classification for the open algorithm — no network.
 */
export type LinkAccess =
  | "public_meta"
  | "partial"
  | "blocked"
  | "error"
  | "unknown";

export type LinkContentKind =
  | "profile"
  | "post"
  | "video"
  | "channel"
  | "unknown";

/**
 * Compact visual summary derived from a public image (OG / profile / post).
 * Produced by the private app (decode pixels → stats). The open algorithm
 * never sees image bytes — only this explainable structure.
 */
export interface ImagePaletteSignal {
  /** Dominant swatches as #RRGGBB (typically 3–6). */
  swatches: string[];
  /** Mean chromatic hue in degrees [0, 360). */
  hue: number;
  /** Mean saturation 0–1 among chromatic pixels. */
  saturation: number;
  /** Mean lightness 0–1. */
  lightness: number;
  /** Warmth −1 (cool) … +1 (warm). */
  warmth: number;
  /** Overall chroma / punch 0–1. */
  vibrance: number;
  /** Share of near-neutral pixels 0–1. */
  neutralShare: number;
  /** Soft labels for UI / audit, e.g. warm, muted, dark. */
  tags: string[];
  /** 0–1 how trustworthy this extraction is. */
  confidence: number;
}

/**
 * Normalized snapshot of everything we extracted from a pasted link.
 * Produced by the private app (fetch + HTML parse); consumed by open analyze helpers.
 */
export interface LinkSnapshot {
  url: string;
  /** Canonical platform id for the algorithm. */
  platform: PlatformId;
  /** Human label (Instagram, TikTok, …). */
  platformLabel?: string;
  handle?: string;
  contentKind: LinkContentKind;
  access: LinkAccess;
  title?: string;
  description?: string;
  imageUrl?: string;
  /** Palette / tone summary from imageUrl (private app). */
  imageSignals?: ImagePaletteSignal;
  siteName?: string;
  author?: string;
  /** Free-text signals collected for later taste factors. */
  textSignals: string[];
  /**
   * Public following list (handles + optional bios) when scrape finds them.
   * Open algorithm uses this as a taste weight — not platform type.
   */
  follows?: FollowItem[];
  /** Optional machine notes (login wall, empty meta, …). */
  notes: string[];
  fetchedAt: string;
  httpStatus?: number;
  error?: string;
}

export function platformFromHost(hostname: string): PlatformId {
  const h = hostname.replace(/^www\./i, "").toLowerCase();
  if (h === "instagram.com" || h === "instagr.am") return "instagram";
  if (h === "tiktok.com") return "tiktok";
  if (h === "youtube.com" || h === "youtu.be" || h === "m.youtube.com")
    return "youtube";
  if (h === "x.com" || h === "twitter.com") return "x";
  if (h === "linkedin.com") return "linkedin";
  return "other";
}

/**
 * Merge many link snapshots into Evidence for analyze().
 * Only uses text we already extracted — never fetches.
 */
export function evidenceFromLinkSnapshots(
  snapshots: LinkSnapshot[],
): Evidence {
  const platforms = new Set<PlatformId>();
  const bios: BioItem[] = [];
  const posts: ContentItem[] = [];
  const follows: FollowItem[] = [];
  const seenFollow = new Set<string>();

  for (const snap of snapshots) {
    platforms.add(snap.platform);

    const bioBits = [snap.description, snap.title, snap.author]
      .filter(Boolean)
      .join(" · ")
      .trim();
    if (bioBits) {
      bios.push({ platform: snap.platform, text: bioBits });
    } else if (snap.handle) {
      bios.push({ platform: snap.platform, text: `@${snap.handle}` });
    }

    const caption =
      snap.textSignals.filter(Boolean).join(" · ").trim() ||
      snap.title ||
      snap.description;
    if (caption || snap.contentKind === "post" || snap.contentKind === "video") {
      const item: ContentItem = {
        id: `link:${snap.url}`,
        platform: snap.platform,
        mediaKind:
          snap.contentKind === "video"
            ? "video"
            : snap.imageUrl
              ? "image"
              : "unknown",
        tags: [
          snap.contentKind,
          snap.access,
          ...(snap.handle ? [`handle:${snap.handle}`] : []),
        ],
      };
      if (caption) item.caption = caption;
      posts.push(item);
    }

    for (const f of snap.follows ?? []) {
      const key = `${f.platform}:${f.handle.toLowerCase()}`;
      if (seenFollow.has(key)) continue;
      seenFollow.add(key);
      follows.push(f);
    }
  }

  const out: Evidence = {
    platforms: [...platforms],
    bios,
    posts,
  };
  if (follows.length > 0) out.follows = follows;
  return out;
}

/** Rough richness score for UI / stage hints (0–1). */
export function linkSnapshotRichness(snap: LinkSnapshot): number {
  let score = 0;
  if (snap.handle) score += 0.15;
  if (snap.title) score += 0.15;
  if (snap.description) score += 0.25;
  if (snap.imageUrl) score += 0.08;
  if (snap.imageSignals && snap.imageSignals.confidence > 0.2) score += 0.18;
  if (snap.textSignals.length > 0) score += 0.2;
  if (snap.follows && snap.follows.length > 0) {
    score += Math.min(0.2, 0.05 + snap.follows.length * 0.01);
  }
  if (snap.access === "public_meta") score += 0.15;
  else if (snap.access === "partial") score += 0.05;
  return Math.max(0, Math.min(1, score));
}
