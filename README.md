# lasa-infer

**Open-source inference algorithm for [Lasa](https://github.com/manuelabuyan/lasa).**

This package is the only public part of Lasa’s “how we conclude” layer:

- **Taste axes** — breadth, depth, distinctiveness, coherence, etc. (declarative registry)  
- **Signals** — weighted, toggleable extractors per axis  
- **Data confidence** — how much public evidence we have (for the UI confidence bar)  
- **Factors / traits** — older keyword traits still available via `analyze()`  

The Lasa product app (auth, OAuth, UI, sync, hosting) stays **private**. This repo has **no network calls, no API keys, and no platform OAuth code**.

## Taste model (flexible registry)

Axes and signals live in plain lists so you can toggle and inspect them:

| File | What to edit |
|------|----------------|
| `src/taste/registry.ts` | `TASTE_AXES` — set `status` to `active` / `stub` / `parked` / `disabled` |
| `src/taste/signals/registry.ts` | `TASTE_SIGNALS` — weights, axis assignment, status |
| `src/taste/lexicons.ts` | Word lists for topics, clichés, craft, etc. |
| `src/taste/signals/extractors.ts` | Signal id → scoring function |

**List everything:**

```ts
import {
  listTasteAxes,
  listTasteSignals,
  describeTasteModel,
  printTasteModel,
  scoreTaste,
} from "lasa-infer";

console.log(printTasteModel()); // human-readable dump of axes → signals

const profile = scoreTaste({ snapshots: [/* LinkSnapshot[] from the app */] });
console.log(profile.dataConfidence); // bar: score + label + summary
console.log(profile.axes);           // per-axis scores (stubs have score: null)
```

**Add an axis later:** append to `TASTE_AXES`, add signals with that `axisId`, implement extractors with matching ids, bump `INFER_VERSION`.

## Install

```bash
npm install lasa-infer
```

Or depend on this git repo from the private app.

## Core idea

```text
Evidence (normalized posts, bios, platforms)
        │
        ▼
   lasa-infer
   · extract factors
   · score & merge
   · attach explanations
   · compute visual stage params
        │
        ▼
InsightSnapshot (traits + confidence + explanations + version)
```

The private app is responsible for **fetching** social data after the user connects accounts, then calling `analyze()`.

## Quick example

```ts
import { analyze, INFER_VERSION } from "lasa-infer";

const snapshot = analyze({
  platforms: ["instagram"],
  bios: [{ platform: "instagram", text: "coffee, film, late nights" }],
  posts: [
    {
      id: "ig_1",
      platform: "instagram",
      caption: "midnight walk with the contax",
      createdAt: "2026-06-01T00:00:00.000Z",
    },
  ],
});

console.log(INFER_VERSION, snapshot.traits, snapshot.explanations);
```

## Progressive multi-account inference

Each newly connected platform should expand `Evidence` and re-run `analyze()`:

1. User connects Instagram → sync posts → `analyze(evidence)` → snapshot v1  
2. User connects TikTok → merge posts → `analyze(evidence)` → snapshot v2 (usually higher confidence when themes agree)

`computeStage(evidence)` maps coverage to a discrete visual stage (0–3+) for the app’s breathing graphic.

## What’s in / out of scope

| In this repo | Not in this repo |
|--------------|------------------|
| Factor IDs and scoring | OAuth / token storage |
| Confidence & stage rules | Instagram / TikTok API clients |
| Explanation objects | Product UI |
| Versioned snapshots | Database, jobs, secrets |

## Versioning

Every snapshot includes `inferVersion` (see `INFER_VERSION` in source). Pin this package in the private app so past results stay auditable when the algorithm changes.

## License

MIT — see [LICENSE](./LICENSE).
