/**
 * Editable word lists for taste signals.
 * Tweak freely — all open and versioned with the package.
 */

export const TOPIC_BUCKETS: Record<string, string[]> = {
  music: [
    "music",
    "song",
    "album",
    "band",
    "dj",
    "vinyl",
    "guitar",
    "piano",
    "jazz",
    "techno",
    "hip-hop",
    "hiphop",
    "rap",
    "playlist",
  ],
  film: [
    "film",
    "cinema",
    "movie",
    "director",
    "cinemat",
    "35mm",
    "16mm",
    "arri",
    "contax",
    "shot on",
    "short film",
  ],
  photo: [
    "photo",
    "photography",
    "photographer",
    "camera",
    "lens",
    "darkroom",
    "portrait",
    "street photo",
  ],
  design: [
    "design",
    "designer",
    "typography",
    "graphic",
    "ui",
    "ux",
    "brand",
    "layout",
    "figma",
  ],
  art: ["art", "artist", "gallery", "paint", "drawing", "sculpture", "exhibit"],
  fashion: [
    "fashion",
    "style",
    "runway",
    "tailor",
    "streetwear",
    "archive",
    "fit",
  ],
  food: ["food", "chef", "recipe", "coffee", "wine", "kitchen", "cook"],
  tech: [
    "tech",
    "code",
    "software",
    "startup",
    "ai",
    "engineer",
    "developer",
    "product",
  ],
  sports: ["sport", "football", "soccer", "basketball", "run", "gym", "fitness"],
  travel: ["travel", "city", "flight", "wander", "trip", "explore"],
  literature: ["book", "writer", "poem", "novel", "read", "essay", "literature"],
  architecture: ["architect", "architecture", "brutalism", "building", "urban"],
};

/** Specific / craft language → depth */
export const CRAFT_MARKERS = [
  "process",
  "practice",
  "study",
  "research",
  "draft",
  "edit",
  "editing",
  "shoot",
  "shot on",
  "rig",
  "workflow",
  "technique",
  "composition",
  "exposure",
  "color grade",
  "grade",
  "mix",
  "master",
  "prototype",
  "build",
  "making",
  "handmade",
  "analog",
  "film stock",
  "f-stop",
  "iso",
  "aperture",
  "darkroom",
  "studio",
  "rehearsal",
  "sketch",
];

/** Generic template / cliché → lowers distinctiveness */
export const CLICHE_MARKERS = [
  "living my best life",
  "good vibes only",
  "vibe",
  "vibes",
  "aesthetic",
  "slay",
  "hustle",
  "grind",
  "ceo",
  "founder",
  "entrepreneur",
  "dm for collab",
  "link in bio",
  "blessed",
  "grateful",
  "no days off",
  "rise and grind",
  "influencer",
  "content creator",
  "just a girl",
  "main character",
  "soft launch",
  "hot take",
  "iykyk",
];

/** Niche / discovery-leaning markers */
export const NICHE_MARKERS = [
  "underground",
  "diy",
  "zine",
  "archive",
  "obscure",
  "cult",
  "experimental",
  "avant",
  "micro",
  "local scene",
  "independent",
  "indie",
  "offbeat",
  "rare",
  "unreleased",
  "bootleg",
  "field recording",
  "small press",
];

/** Mainstream / template trend-following markers */
export const MAINSTREAM_MARKERS = [
  "viral",
  "trending",
  "challenge",
  "duet",
  "fyp",
  "tiktok famous",
  "chart",
  "billboard",
  "spotify wrapped",
  "netflix",
  "marvel",
  "disney",
  "taylor swift",
  "beyonce",
  "bts",
  "mrbeast",
];

/** POV / curation language */
export const CURATION_MARKERS = [
  "prefer",
  "favorite",
  "favourite",
  "obsessed with",
  "currently into",
  "collecting",
  "curating",
  "only",
  "mostly",
  "never",
  "against",
  "for fans of",
  "if you like",
  "recommendations",
  "not for everyone",
];

export function collectText(evidence: {
  bios?: { text: string }[];
  posts?: { caption?: string }[];
}): string {
  const parts: string[] = [];
  for (const b of evidence.bios ?? []) parts.push(b.text);
  for (const p of evidence.posts ?? []) {
    if (p.caption) parts.push(p.caption);
  }
  return parts.join(" \n ").toLowerCase();
}

export function countHits(text: string, terms: string[]): {
  count: number;
  matched: string[];
} {
  const matched: string[] = [];
  for (const term of terms) {
    const t = term.toLowerCase();
    if (t.length < 2) continue;
    if (text.includes(t)) matched.push(term);
  }
  return { count: matched.length, matched };
}

export function topicHits(text: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const [topic, words] of Object.entries(TOPIC_BUCKETS)) {
    let n = 0;
    for (const w of words) {
      const term = w.toLowerCase();
      if (!term) continue;
      // Multi-word: substring. Single word: boundary match so e.g. "graphic"
      // does not fire inside "Geographic".
      if (term.includes(" ")) {
        if (text.includes(term)) n += 1;
      } else {
        try {
          const re = new RegExp(
            `(?:^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[^a-z0-9]|$)`,
            "i",
          );
          if (re.test(text)) n += 1;
        } catch {
          if (text.includes(term)) n += 1;
        }
      }
    }
    if (n > 0) map.set(topic, n);
  }
  return map;
}
