import assert from "node:assert/strict";
import { test } from "node:test";
import {
  analyze,
  evidenceFromLinkSnapshots,
  INFER_VERSION,
  linkSnapshotRichness,
} from "../dist/index.js";

test("empty evidence yields stage 0 and low coverage", () => {
  const snap = analyze({ platforms: [] });
  assert.equal(snap.inferVersion, INFER_VERSION);
  assert.equal(snap.stageParams.stage, 0);
  assert.equal(snap.meta.platformCount, 0);
});

test("one platform with night captions raises night_oriented", () => {
  const snap = analyze({
    platforms: ["instagram"],
    bios: [{ platform: "instagram", text: "film & coffee" }],
    posts: [
      {
        id: "ig_1",
        platform: "instagram",
        caption: "midnight walk with the contax",
      },
    ],
  });
  assert.equal(snap.stageParams.stage, 1);
  assert.ok(snap.traits.some((t) => t.id === "night_oriented"));
  assert.ok(snap.traits.some((t) => t.id === "creative_maker"));
  assert.ok(snap.explanations.length > 0);
  assert.ok(snap.stageParams.motifs.includes("night"));
});

test("second platform increases stage and can add overlap factor", () => {
  const snap = analyze({
    platforms: ["instagram", "tiktok"],
    bios: [
      { platform: "instagram", text: "night shooter" },
      { platform: "tiktok", text: "late night edits" },
    ],
    posts: [
      { id: "ig_1", platform: "instagram", caption: "midnight city" },
      { id: "tt_1", platform: "tiktok", caption: "nocturnal tips" },
    ],
  });
  assert.ok(snap.stageParams.stage >= 2);
  assert.ok(snap.meta.overallConfidence > 0);
  const coverage = snap.traits.find((t) => t.id === "signal_coverage");
  assert.ok(coverage && coverage.confidence > 0.2);
});
