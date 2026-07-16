import { listTasteAxes } from "./registry.js";
import { listTasteSignals } from "./signals/registry.js";
import type { TasteModelDescription } from "./types.js";

/**
 * Nested axes → signals tree for open-source docs and UI.
 * Easy to print, serialize, or render.
 */
export function describeTasteModel(
  opts: {
    axisStatus?: Array<"active" | "stub" | "parked" | "disabled">;
    signalStatus?: Array<"active" | "stub" | "parked" | "disabled">;
  } = {},
): TasteModelDescription {
  const axes = listTasteAxes({
    include: opts.axisStatus ?? ["active", "stub", "parked", "disabled"],
  });
  return {
    axes: axes.map((axis) => ({
      axis,
      signals: listTasteSignals({
        axisId: axis.id,
        include: opts.signalStatus ?? ["active", "stub", "parked", "disabled"],
      }),
    })),
  };
}

/** Pretty-print the full model (handy in REPL / tests / README generation). */
export function printTasteModel(): string {
  const model = describeTasteModel();
  const lines: string[] = ["# Lasa taste model", ""];
  for (const { axis, signals } of model.axes) {
    lines.push(
      `## ${axis.label} (\`${axis.id}\`) [${axis.status}] v${axis.version}`,
    );
    lines.push(axis.description);
    lines.push("");
    if (signals.length === 0) {
      lines.push("_No signals registered._");
      lines.push("");
      continue;
    }
    for (const s of signals) {
      lines.push(
        `- **${s.title}** (\`${s.id}\`) [${s.status}] weight=${s.weight}`,
      );
      lines.push(`  ${s.description}`);
      lines.push(`  inputs: ${s.inputs.join(", ")}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
