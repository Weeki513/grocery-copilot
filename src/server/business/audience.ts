export type ServingGroup = {
  id: string;
  servings: number;
  dietaryPreferences: string[];
};

type PartialPreference = { id: string; count: number; tag: "vegetarian" | "vegan" };

function findPartialPreference(request: string): PartialPreference | undefined {
  const definitions: Array<{ id: string; tag: PartialPreference["tag"]; term: string }> = [
    { id: "vegan", tag: "vegan", term: "(?:vegan\\w*|веган\\w*)" },
    { id: "vegetarian", tag: "vegetarian", term: "(?:vegetarian\\w*|вег[ае]тариан\\w*)" },
  ];
  for (const definition of definitions) {
    const patterns = [
      new RegExp(`(?:ещ[её]\\s+|из\\s+них\\s+)?(\\d{1,3})\\s*(?:человек|гост(?:я|ей)?|мужчин|женщин)?\\s*(?:[-—–,:]|это|будут)?\\s*${definition.term}`, "iu"),
      new RegExp(`(\\d{1,3})\\s*(?:of\\s+them\\s+|people\\s+|guests?\\s+)?(?:are\\s+)?${definition.term}`, "iu"),
      new RegExp(`(\\d{1,3})\\s+из\\s+\\d{1,3}\\s*(?:[-—–,:])?\\s*${definition.term}`, "iu"),
    ];
    for (const pattern of patterns) {
      const count = Number(request.match(pattern)?.[1]);
      if (Number.isInteger(count) && count > 0) return { id: definition.id, count, tag: definition.tag };
    }
  }
  return undefined;
}

export function parseServingGroups(request: string, totalServings?: number): ServingGroup[] | undefined {
  if (!totalServings) return undefined;
  const partial = findPartialPreference(request);
  if (!partial || partial.count > totalServings) return undefined;
  if (partial.count === totalServings) return [{ id: partial.id, servings: totalServings, dietaryPreferences: [partial.tag] }];
  return [
    { id: "standard", servings: totalServings - partial.count, dietaryPreferences: [] },
    { id: partial.id, servings: partial.count, dietaryPreferences: [partial.tag] },
  ];
}
