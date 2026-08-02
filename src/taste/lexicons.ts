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

/**
 * Markers that public text is about work the person *made*
 * (pieces, products, editions, shows) — not only consumption.
 */
export const CREATIVE_OUTPUT_MARKERS = [
  "my work",
  "new work",
  "latest work",
  "body of work",
  "series",
  "edition",
  "limited edition",
  "print",
  "prints",
  "painting",
  "sculpture",
  "installation",
  "exhibition",
  "solo show",
  "group show",
  "gallery show",
  "opening",
  "commission",
  "commissioned",
  "client work",
  "product design",
  "designed",
  "i designed",
  "i made",
  "i built",
  "i shot",
  "i wrote",
  "i directed",
  "prototype",
  "prototyping",
  "released",
  "launching",
  "just released",
  "drop",
  "collection",
  "portfolio",
  "case study",
  "side project",
  "personal project",
  "self-initiated",
  "from scratch",
  "hand-built",
  "handmade",
  "one of one",
  "1/1",
];

/**
 * Originality / adaptation — intentional authorship (high taste when present).
 */
export const ORIGINALITY_MARKERS = [
  "original",
  "self-initiated",
  "in my own",
  "my interpretation",
  "adapted",
  "adaptation",
  "reworked",
  "reimagined",
  "translation of",
  "study after",
  "homage",
  "after",
  "variations on",
  "in conversation with",
  "response to",
  "evolving",
  "iteration",
  "iterating",
  "refined",
  "developed",
  "developed from",
  "years of",
  "long-term",
  "ongoing series",
  "process notes",
  "materials",
  "material study",
  "technique",
  "crafted",
];

/**
 * Blatant copy / lazy derivative / boring mass output (low taste).
 * “Homage” with craft language is different; these lean template/dupe/viral clone.
 */
export const DERIVATIVE_MARKERS = [
  "dupe",
  "exact dupe",
  "dupe of",
  "copy of",
  "copied from",
  "ripped from",
  "stole this",
  "stole the",
  "1:1 replica",
  "identical to",
  "same as the viral",
  "viral remake",
  "recreated the viral",
  "recreate this trend",
  "trend remake",
  "another version of",
  "same outfit as",
  "inspired by the viral",
  "just like the original but",
  "no changes",
  "template",
  "preset pack only",
  "only presets",
  "stock photo",
  "stock footage",
  "canva template",
  "ai generated",
  "fully ai",
  "chatgpt wrote",
  "midjourney only",
  "no effort",
  "low effort",
  "spam",
  "mass produced",
  "dropship",
  "dropshipping",
  "white label",
  "resold",
  "reposted without",
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
  // Craft / artist / small-world creators (follow-graph taste)
  "emerging",
  "studio practice",
  "printmaker",
  "ceramicist",
  "illustrator",
  "filmmaker",
  "photographer",
  "cinematographer",
  "composer",
  "curator",
  "small batch",
  "handmade",
  "analogue",
  "analog",
  "35mm",
  "darkroom",
  "risograph",
  "label",
  "imprint",
  "collective",
  "residency",
  "gallery",
];

/** Mainstream / celebrity / mass-pop markers (low follow-graph taste when dominant) */
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
  // Celebrity / mass-audience follow graph
  "celebrity",
  "celebrities",
  "hollywood",
  "actress",
  "hollywood/actress",
  "pop star",
  "superstar",
  "official account",
  "fan page",
  "fan account",
  "verified",
  "brand ambassador",
  "sponsored",
  "pr package",
  "red carpet",
  "hollywood",
  "reality tv",
  "talk show",
  "late night",
  "box office",
  "hollywood",
  "influencer",
  "content creator",
  "subscribe",
  "smash that like",
  "collab",
  "brand deal",
];

/**
 * Strong celebrity / mass-pop name tokens (handles + bios).
 * Used for follow-graph “mainstream drag” — not a complete celeb DB.
 */
export const CELEB_FOLLOW_MARKERS = [
  "kimkardashian",
  "kyliejenner",
  "justinbieber",
  "taylorswift",
  "beyonce",
  "rihanna",
  "drake",
  "theweeknd",
  "dualipa",
  "arianagrande",
  "selenagomez",
  "mileycyrus",
  "oprah",
  "elonmusk",
  "cristiano",
  "leomessi",
  "neymarjr",
  "therock",
  "zendaya",
  "tomholland",
  "chrishemsworth",
  "mrbeast",
  "pewdiepie",
  "nasa",
  "netflix",
  "marvel",
  "disney",
  "spotify",
  "youtube",
  "nike",
  "adidas",
  "gucci",
  "louisvuitton",
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
