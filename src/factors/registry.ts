/**
 * Public registry of factor definitions.
 * Users (and the private app UI) can link "how this was made" to these ids.
 */

export interface FactorDefinition {
  id: string;
  title: string;
  description: string;
  /** What kind of evidence this factor reads. */
  inputs: Array<"bio" | "caption" | "tags" | "platform_coverage">;
}

export const FACTOR_REGISTRY: readonly FactorDefinition[] = [
  {
    id: "platform_coverage",
    title: "Platform coverage",
    description:
      "How many distinct linked platforms contributed evidence. More platforms can raise confidence when themes agree.",
    inputs: ["platform_coverage"],
  },
  {
    id: "evidence_volume",
    title: "Evidence volume",
    description:
      "How many posts/bios were available to inspect. Thin evidence keeps confidence low.",
    inputs: ["caption", "bio"],
  },
  {
    id: "caption_keyword_night",
    title: "Night-oriented language",
    description:
      "Captions/bios mentioning night, midnight, late, nocturnal, etc.",
    inputs: ["caption", "bio"],
  },
  {
    id: "caption_keyword_creative",
    title: "Creative / maker language",
    description:
      "Captions/bios mentioning film, photo, art, design, create, music, etc.",
    inputs: ["caption", "bio"],
  },
  {
    id: "cross_platform_theme_overlap",
    title: "Cross-platform theme overlap",
    description:
      "When the same motif keywords appear on more than one platform, confidence increases.",
    inputs: ["caption", "bio", "platform_coverage"],
  },
] as const;

export function getFactorDefinition(
  id: string,
): FactorDefinition | undefined {
  return FACTOR_REGISTRY.find((f) => f.id === id);
}
