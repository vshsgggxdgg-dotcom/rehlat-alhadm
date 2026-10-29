import type { LearningActivityDefinition } from "../content/schema";
export function applyRevealedAnswer(
  source: LearningActivityDefinition,
  answer: string | null | undefined,
): LearningActivityDefinition {
  if (!answer) return source;
  const a = structuredClone(source) as any;
  a.correctOptionId = answer;
  const pairs = Object.fromEntries(
    answer
      .split("||")[0]
      .split("|")
      .map((p) => p.split(":")),
  );
  if (a.fillInConfig)
    for (const b of a.fillInConfig.blanks) b.correctWordId = pairs[b.blankId];
  if (a.orderingConfig) a.orderingConfig.correctOrderIds = answer.split(">");
  if (a.matchingConfig)
    a.matchingConfig.correctPairs = Object.entries(pairs).map(
      ([promptId, targetId]) => ({ promptId, targetId }),
    );
  if (a.imageIdentificationConfig) {
    a.imageIdentificationConfig.correctZoneId = answer;
    for (const l of a.imageIdentificationConfig.labelsToPlace ?? [])
      l.correctZoneId = Object.keys(pairs).find((k) => pairs[k] === l.labelId);
  }
  if (a.villiComparisonConfig) {
    for (const c of a.villiComparisonConfig.criteria)
      c.correctSurfaceId = pairs[c.criterionId];
    a.villiComparisonConfig.correctConclusionId = answer.split("||conc:")[1];
  }
  return a;
}
