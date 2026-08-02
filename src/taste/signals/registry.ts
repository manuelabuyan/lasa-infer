import type { TasteSignalDef } from "../types.js";

/**
 * Master list of taste signals.
 * Toggle status / change weight / reassign axisId without rewriting the scorer.
 * Each active signal id must have an extractor in signals/extractors.ts.
 */
export const TASTE_SIGNALS: readonly TasteSignalDef[] = [
  // --- breadth ---
  {
    id: "platform_count",
    axisId: "breadth",
    title: "Platform count",
    description:
      "Disabled: link host (Instagram vs TikTok etc.) must not affect taste.",
    inputs: ["platforms"],
    weight: 0,
    status: "disabled",
    version: 2,
  },
  {
    id: "topic_diversity",
    axisId: "breadth",
    title: "Topic diversity",
    description: "How many topic buckets fire in bios/captions.",
    inputs: ["bios", "captions"],
    weight: 0.55,
    status: "active",
    version: 1,
  },
  {
    id: "media_kind_diversity",
    axisId: "breadth",
    title: "Media kind diversity",
    description: "Spread across profile / post / video / channel content kinds.",
    inputs: ["tags", "link_snapshots"],
    weight: 0.45,
    status: "active",
    version: 1,
  },

  // --- depth ---
  {
    id: "craft_lexicon",
    axisId: "depth",
    title: "Craft lexicon",
    description: "Specific craft/process terms vs empty text.",
    inputs: ["bios", "captions"],
    weight: 0.45,
    status: "active",
    version: 1,
  },
  {
    id: "topic_concentration",
    axisId: "depth",
    title: "Topic concentration",
    description: "Strongest topic bucket strength (focus within a domain).",
    inputs: ["bios", "captions"],
    weight: 0.35,
    status: "active",
    version: 1,
  },
  {
    id: "text_specificity",
    axisId: "depth",
    title: "Text specificity",
    description: "Longer, denser free text when available.",
    inputs: ["bios", "captions"],
    weight: 0.2,
    status: "active",
    version: 1,
  },

  // --- distinctiveness ---
  {
    id: "cliche_penalty",
    axisId: "distinctiveness",
    title: "Cliché inverse",
    description: "Higher when generic template phrases are rare.",
    inputs: ["bios", "captions"],
    weight: 0.55,
    status: "active",
    version: 1,
  },
  {
    id: "rare_topic_mix",
    axisId: "distinctiveness",
    title: "Unusual topic mix",
    description: "Less common combinations of topic buckets (content only).",
    inputs: ["bios", "captions"],
    weight: 0.45,
    status: "active",
    version: 2,
  },

  // --- coherence ---
  {
    id: "cross_platform_topics",
    axisId: "coherence",
    title: "Cross-source topics",
    description:
      "Same topic buckets appear in more than one text item (host/platform ignored).",
    inputs: ["bios", "captions"],
    weight: 0.6,
    status: "active",
    version: 2,
  },
  {
    id: "multi_item_theme",
    axisId: "coherence",
    title: "Multi-item theme",
    description: "Repeated motifs across multiple text items.",
    inputs: ["bios", "captions"],
    weight: 0.4,
    status: "active",
    version: 1,
  },

  // --- discovery_orientation ---
  {
    id: "niche_markers",
    axisId: "discovery_orientation",
    title: "Niche markers",
    description: "Underground / experimental / archival language.",
    inputs: ["bios", "captions"],
    weight: 0.5,
    status: "active",
    version: 1,
  },
  {
    id: "mainstream_inverse",
    axisId: "discovery_orientation",
    title: "Mainstream inverse",
    description: "Higher when viral/template trend language is low.",
    inputs: ["bios", "captions"],
    weight: 0.5,
    status: "active",
    version: 1,
  },

  // --- curation ---
  {
    id: "pov_markers",
    axisId: "curation",
    title: "Point-of-view markers",
    description: "Preference and opinion framing language.",
    inputs: ["bios", "captions"],
    weight: 0.5,
    status: "active",
    version: 1,
  },
  {
    id: "anti_spam_density",
    axisId: "curation",
    title: "Anti-spam density",
    description: "Not overloaded with cliché promo phrases.",
    inputs: ["bios", "captions"],
    weight: 0.5,
    status: "active",
    version: 1,
  },

  // --- craft ---
  {
    id: "maker_language",
    axisId: "craft",
    title: "Maker language",
    description: "Making / building / creative practice terms.",
    inputs: ["bios", "captions"],
    weight: 0.6,
    status: "active",
    version: 1,
  },
  {
    id: "process_language",
    axisId: "craft",
    title: "Process language",
    description: "Process and practice markers (edit, study, shoot, …).",
    inputs: ["bios", "captions"],
    weight: 0.4,
    status: "active",
    version: 1,
  },

  // --- t_shape (derived; extractors read other signal outputs via context later — v1 uses evidence directly) ---
  {
    id: "t_shape_combo",
    axisId: "t_shape",
    title: "Depth × breadth combo",
    description: "Joint presence of focus and range in the text/platform mix.",
    inputs: ["platforms", "bios", "captions", "derived"],
    weight: 1,
    status: "active",
    version: 1,
  },

  // --- social_graph (who they follow) ---
  {
    id: "follow_volume",
    axisId: "social_graph",
    title: "Follow volume",
    description:
      "How many followed accounts we observed publicly (coverage of the graph).",
    inputs: ["follows", "link_snapshots"],
    weight: 0.3,
    status: "active",
    version: 1,
  },
  {
    id: "follow_topic_range",
    axisId: "social_graph",
    title: "Follow topic range",
    description:
      "Topic diversity across followed accounts’ public bios/handles.",
    inputs: ["follows"],
    weight: 0.35,
    status: "active",
    version: 1,
  },
  {
    id: "follow_self_overlap",
    axisId: "social_graph",
    title: "Follow–self theme overlap",
    description:
      "Shared topics between the person’s own text and accounts they follow (curated affinity).",
    inputs: ["follows", "bios", "captions"],
    weight: 0.35,
    status: "active",
    version: 1,
  },
] as const;

export function listTasteSignals(
  opts: {
    axisId?: string;
    include?: TasteSignalDef["status"][];
  } = {},
): TasteSignalDef[] {
  const include = opts.include ?? ["active", "stub"];
  return TASTE_SIGNALS.filter((s) => {
    if (!include.includes(s.status)) return false;
    if (opts.axisId && s.axisId !== opts.axisId) return false;
    return true;
  });
}

export function getTasteSignal(id: string): TasteSignalDef | undefined {
  return TASTE_SIGNALS.find((s) => s.id === id);
}
