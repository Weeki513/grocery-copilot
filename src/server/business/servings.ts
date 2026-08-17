const MAX_SUPPORTED_SERVINGS = 500;

export function parseRequestedServings(request: string) {
  const patterns = [
    /(?:на|для)\s+(\d{1,3})\s*(?:человек|чел\.?|персон(?:ы|у)?|гост(?:я|ей)?|мужчин|женщин|порци(?:ю|и|й))/i,
    /(?:for|serves?)\s+(\d{1,3})\s*(?:people|persons?|guests?|servings?|pax)/i,
    /(\d{1,3})\s*(?:servings?|portions?)\b/i,
    /(\d{1,3})\s*(?:человек|персон(?:ы|у)?|мужчин|женщин|порци(?:ю|и|й))(?=\s|$|[.,!?])/i,
  ];
  for (const pattern of patterns) {
    const value = Number(request.match(pattern)?.[1]);
    if (Number.isInteger(value) && value >= 1 && value <= MAX_SUPPORTED_SERVINGS) return value;
  }
  return undefined;
}
