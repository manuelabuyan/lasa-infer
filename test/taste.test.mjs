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

  assert.ok(high.colour?.id);
  assert.ok(high.colour.rgb.includes(","));
  assert.ok(high.colour.blend?.length >= 1);
  // Film/photo language should not be pure error
  assert.ok(typeof high.colour.confidence === "number");

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
  assert.ok(first.colour.id);
  assert.ok(first.colour.confidence > 0);

  // Higher conf should generally be bolder (not washed to soft slate grey mean)
  assert.ok(high.colour.confidence >= first.colour.confidence - 0.05);

  const text = formatTasteProfile(high);
  assert.ok(text.includes("data confidence"));
  assert.ok(text.includes("colour:"));
});