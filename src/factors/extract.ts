import type { Evidence, FactorHit } from "../types.js";

const NIGHT_RE =
  /\b(night|midnight|late[- ]?night|nocturnal|after[- ]?dark|2am|3am)\b/i;
const CREATIVE_RE =
  /\b(film|photo|photography|camera|art|artist|design|create|creative|music|paint|draw)\b/i;

function textsFromEvidence(evidence: Evidence): { id: string; text: string; platform: string }[] {
  const out: { id: string; text: string; platform: string }[] = [];
  for (const bio of evidence.bios ?? []) {
    out.push({
      id: `bio:${bio.platform}`,
      text: bio.text,
      platform: bio.platform,
    });
  }
  for (const post of evidence.posts ?? []) {
    if (post.caption) {
      out.push({
        id: post.id,
        text: post.caption,
        platform: post.platform,
      });
    }
  }
  return out;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Extract public, deterministic factor hits from evidence. */
export function extractFactors(evidence: Evidence): FactorHit[] {
  const hits: FactorHit[] = [];
  const platforms = [...new Set(evidence.platforms)];
  const posts = evidence.posts ?? [];
  const bios = evidence.bios ?? [];
  const texts = textsFromEvidence(evidence);

  // platform_coverage
  const platformCount = platforms.length;
  hits.push({
    id: "platform_coverage",
    weight: clamp01(platformCount / 3),
    evidenceIds: platforms.map((p) => `platform:${p}`),
    detail: `${platformCount} linked platform(s)`,
    raw: platformCount,
  });

  // evidence_volume
  const volume = posts.length + bios.length;
  hits.push({
    id: "evidence_volume",
    weight: clamp01(volume / 10),
    evidenceIds: [
      ...bios.map((b) => `bio:${b.platform}`),
      ...posts.map((p) => p.id),
    ],
    detail: `${volume} bio/post item(s)`,
    raw: volume,
  });

  const nightIds: string[] = [];
  const creativeIds: string[] = [];
  const nightPlatforms = new Set<string>();
  const creativePlatforms = new Set<string>();

  for (const t of texts) {
    if (NIGHT_RE.test(t.text)) {
      nightIds.push(t.id);
      nightPlatforms.add(t.platform);
    }
    if (CREATIVE_RE.test(t.text)) {
      creativeIds.push(t.id);
      creativePlatforms.add(t.platform);
    }
  }

  if (nightIds.length > 0) {
    hits.push({
      id: "caption_keyword_night",
      weight: clamp01(nightIds.length / 5),
      evidenceIds: nightIds,
      detail: `Matched night-oriented language in ${nightIds.length} item(s)`,
      raw: nightIds.length,
    });
  }

  if (creativeIds.length > 0) {
    hits.push({
      id: "caption_keyword_creative",
      weight: clamp01(creativeIds.length / 5),
      evidenceIds: creativeIds,
      detail: `Matched creative language in ${creativeIds.length} item(s)`,
      raw: creativeIds.length,
    });
  }

  // cross_platform_theme_overlap — same motif family on 2+ platforms
  const overlapIds = [
    ...(nightPlatforms.size >= 2 ? nightIds : []),
    ...(creativePlatforms.size >= 2 ? creativeIds : []),
  ];
  const overlapPlatforms =
    (nightPlatforms.size >= 2 ? nightPlatforms.size : 0) +
    (creativePlatforms.size >= 2 ? creativePlatforms.size : 0);

  if (overlapIds.length > 0 && platforms.length >= 2) {
    hits.push({
      id: "cross_platform_theme_overlap",
      weight: clamp01(overlapPlatforms / 4),
      evidenceIds: [...new Set(overlapIds)],
      detail: "Shared motif language across multiple platforms",
      raw: overlapPlatforms,
    });
  }

  return hits;
}
