import type { BaseQuantityUnit } from "@/lib/product-quantity";
import type { Locale } from "@/lib/types";
import { FAMILIES } from "./families";

type IngredientIdentity = {
  nameEn: string;
  nameRu: string;
  searchTerms: string[];
};

const familyUnits = Object.values(FAMILIES).flatMap((families) => families.map((family) => ({
  names: { en: family.en, ru: family.ru },
  unit: family.unit as BaseQuantityUnit,
  aliases: [family.en, family.ru, ...family.terms],
})));

function normalize(value: string) {
  return value.toLocaleLowerCase().replaceAll("ё", "е").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function catalogFamilyUnits(locale: Locale) {
  return familyUnits.map((family) => ({ name: family.names[locale], unit: family.unit }));
}

export function canonicalUnitForIngredient(identity: IngredientIdentity): BaseQuantityUnit | undefined {
  const queries = [identity.nameEn, identity.nameRu, ...identity.searchTerms].map(normalize).filter(Boolean);
  let best: { score: number; unit: BaseQuantityUnit } | undefined;
  for (const family of familyUnits) {
    for (const aliasValue of family.aliases) {
      const alias = normalize(aliasValue);
      if (!alias) continue;
      for (const query of queries) {
        const exact = query === alias;
        const contained = query.includes(alias) || (query.length >= 4 && alias.includes(query));
        if (!exact && !contained) continue;
        const score = (exact ? 10_000 : 0) + alias.length;
        if (!best || score > best.score) best = { score, unit: family.unit };
      }
    }
  }
  return best?.unit;
}
