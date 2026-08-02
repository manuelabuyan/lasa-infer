import assert from "node:assert/strict";
import { test } from "node:test";
import {
  describeTasteModel,
  formatTasteProfile,
  listExtractorIds,
  listTasteAxes,
  listTasteSignals,
  printTasteModel,
  scoreTaste,
} from "../dist/index.js";

test("taste model is listable and nested", () => {
  const axes = listTasteAxes({ include: ["active", "stub"] });
  assert.ok(axes.length >= 8);
  assert.ok(axes.some((a) => a.id === "breadth" && a.status === "active"));
  assert.ok(axes.some((a) => a.id === "visual_consistency" && a.status === "stub"));

  const signals = listTasteSignals({ include: ["active"] });
  assert.ok(signals.length >= 10);
  assert.ok(signals.every((s) => s.axisId && s.weight > 0));

  const model = describeTasteModel();
  assert.ok(model.axes.length >= 8);
  const breadth = model.axes.find((x) => x.axis.id === "breadth");
  assert.ok(breadth && breadth.signals.length >= 2);

  const dump = printTasteModel();
  assert.ok(dump.includes("Breadth"));
  assert.ok(dump.includes("platform_count"));
});

test("every active signal has an extractor", () => {
  const active = listTasteSignals({ include: ["active"] });
  const extractors = new Set(listExtractorIds());
  for (const s of active) {
    assert.ok(
      extractors.has(s.id),
      `missing extractor for active signal ${s.id}`,
    );
  }
});

test("low vs high data confidence", () => {
  const low = scoreTaste({
    snapshots: [
      {
        url: "https://instagram.com/privateuser",
        platform: "instagram",
        contentKind: "profile",
        access: "blocked",
        textSignals: [],
        notes: ["login wall"],
        fetchedAt: new Date().toISOString(),
      },
    ],
  });
  assert.ok(low.dataConfidence.score < 0.35);
  assert.equal(low.dataConfidence.label, "low");

  const highSnaps = Array.from({ length: 5 }, (_, i) => ({
    url: `https://example.com/u${i}`,
    platform: i % 2 === 0 ? "instagram" : "youtube",
    contentKind: "profile",
    access: "public_meta",
    title: "Film photographer shooting 35mm contax",
    description:
      "Analog process, darkroom practice, experimental short film and jazz records",
    textSignals: [
      "Film photographer shooting 35mm contax",
      "Analog process darkroom practice experimental short film jazz",
    ],
    notes: [],
    fetchedAt: new Date().toISOString(),
    handle: `user${i}`,
  }));
  const high = scoreTaste({ snapshots: highSnaps });
  assert.ok(high.dataConfidence.score > low.dataConfidence.score);
  assert.ok(high.dataConfidence.score >= 0.5);

  const craft = high.axes.find((a) => a.axisId === "craft");
  assert.ok(craft && craft.score !== null && craft.score > 0.2);

  assert.ok(high.colour?.hex?.match(/^#[0-9A-F]{6}$/i));
  assert.ok(high.colour.rgb.includes(","));
  assert.ok(high.colour.blend?.length >= 1);
  assert.ok(typeof high.colour.confidence === "number");
  // Continuous colour: id is a freeform hex (or soft slate)
  assert.ok(high.colour.id.startsWith("#") || high.colour.id.length > 0);

  // First thin public-ish link should still produce a colour (not crash)
  const first = scoreTaste({
    snapshots: [
      {
        url: "https://instagram.com/filmer",
        platform: "instagram",
        contentKind: "profile",
        access: "public_meta",
        title: "35mm film photographer",
        description: "Analog darkroom process",
        textSignals: ["35mm film photographer", "Analog darkroom process"],
        notes: [],
        fetchedAt: new Date().toISOString(),
        handle: "filmer",
      },
    ],
  });
  assert.ok(first.colour.hex.match(/^#[0-9A-F]{6}$/i));
  assert.ok(first.colour.confidence > 0);
  assert.ok(first.colour.attribution?.contributions?.length >= 1);

  // Higher conf should generally be bolder (not washed to soft slate grey mean)
  assert.ok(high.colour.confidence >= first.colour.confidence - 0.05);

  const text = formatTasteProfile(high);
  assert.ok(text.includes("data confidence"));
  assert.ok(text.includes("colour:"));
});

test("image palette can tint colour without bio text", () => {
  const warm = scoreTaste({
    snapshots: [
      {
        url: "https://instagram.com/warmshot",
        platform: "instagram",
        contentKind: "profile",
        access: "public_meta",
        title: "User",
        textSignals: ["User"],
        notes: [],
        fetchedAt: new Date().toISOString(),
        handle: "warmshot",
        imageSignals: {
          swatches: ["#D25C3A", "#C49440", "#A86040"],
          hue: 28,
          saturation: 0.62,
          lightness: 0.48,
          warmth: 0.75,
          vibrance: 0.58,
          neutralShare: 0.18,
          tags: ["warm", "oranges", "vivid"],
          confidence: 0.85,
        },
      },
    ],
  });
  const cool = scoreTaste({
    snapshots: [
      {
        url: "https://instagram.com/coolshot",
        platform: "instagram",
        contentKind: "profile",
        access: "public_meta",
        title: "User",
        textSignals: ["User"],
        notes: [],
        fetchedAt: new Date().toISOString(),
        handle: "coolshot",
        imageSignals: {
          swatches: ["#3E62A8", "#40AAB4", "#A0BCD6"],
          hue: 210,
          saturation: 0.45,
          lightness: 0.5,
          warmth: -0.7,
          vibrance: 0.42,
          neutralShare: 0.22,
          tags: ["cool", "blues"],
          confidence: 0.85,
        },
      },
    ],
  });

  // Continuous freeform hex — not forced to discrete slate/ember ids
  assert.ok(warm.colour.hex.match(/^#[0-9A-F]{6}$/i));
  assert.ok(cool.colour.hex.match(/^#[0-9A-F]{6}$/i));
  assert.notEqual(warm.colour.hex, cool.colour.hex);
  assert.notEqual(warm.colour.hex.toUpperCase(), "#787E8A");
  assert.ok(
    warm.colour.summary.includes("image") || warm.colour.attribution?.contributions?.some((c) => c.source.startsWith("image")),
    `expected image influence: ${warm.colour.summary}`,
  );
});

test("follow graph influences social_graph axis and colour text", () => {
  const withFollows = scoreTaste({
    snapshots: [
      {
        url: "https://instagram.com/filmer",
        platform: "instagram",
        contentKind: "profile",
        access: "public_meta",
        title: "35mm film photographer",
        description: "Analog darkroom",
        textSignals: ["35mm film photographer", "Analog darkroom"],
        notes: [],
        fetchedAt: new Date().toISOString(),
        handle: "filmer",
        follows: [
          {
            handle: "magnumphotos",
            platform: "instagram",
            displayName: "Magnum",
            bio: "Documentary photography and photojournalism",
            source: "embedded",
          },
          {
            handle: "criterion",
            platform: "instagram",
            bio: "Cinema film archive classic movies",
            source: "embedded",
          },
          {
            handle: "analogforever",
            platform: "instagram",
            bio: "35mm film community darkroom",
            source: "public_following",
          },
        ],
      },
    ],
  });

  const graph = withFollows.axes.find((a) => a.axisId === "social_graph");
  assert.ok(graph && graph.status === "active");
  assert.ok(graph.score !== null && graph.score > 0.2, `social_graph score ${graph?.score}`);
  const vol = graph.signals.find((s) => s.signalId === "follow_volume");
  assert.ok(vol && vol.score > 0);
  assert.ok(withFollows.colour.hex.match(/^#[0-9A-F]{6}$/i));
});