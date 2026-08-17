export type BudgetHint = {
  amount?: number | null;
  currencyCode?: string | null;
  currencyDisplay?: string | null;
  ambiguous?: boolean;
};

export type ParsedBudgetInput = {
  amount: number;
  currencyCode?: string;
  display: string;
  ambiguous: boolean;
};

export type BudgetConstraint = {
  amount: number;
  currency: string;
  usdAmount: number;
  source: string;
  rateDate?: string;
  provider: "native" | "frankfurter" | "fallback";
};

export type BudgetResolution =
  | { status: "none" }
  | { status: "invalid"; input: ParsedBudgetInput }
  | { status: "ambiguous"; input: ParsedBudgetInput }
  | { status: "unsupported"; input: ParsedBudgetInput }
  | { status: "unavailable"; input: ParsedBudgetInput }
  | { status: "resolved"; budget: BudgetConstraint };

const AMOUNT = String.raw`[-−]?(?:\d{1,3}(?:[ \u00A0\u202F'’.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d+)?)`;
const KNOWN_CURRENCY_CODES = new Set((
  "AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HRK HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XOF XPF YER ZAR ZMW ZWL"
).split(" "));

const SYMBOLS: Array<[string, string]> = [
  ["A\\$", "AUD"], ["C\\$", "CAD"], ["NZ\\$", "NZD"], ["HK\\$", "HKD"], ["S\\$", "SGD"], ["R\\$", "BRL"],
  ["€", "EUR"], ["£", "GBP"], ["₽", "RUB"], ["₾", "GEL"], ["₸", "KZT"], ["₴", "UAH"],
  ["₹", "INR"], ["₺", "TRY"], ["₫", "VND"], ["₩", "KRW"], ["₪", "ILS"], ["₦", "NGN"],
  ["₱", "PHP"], ["฿", "THB"], ["\\$", "USD"],
];

const ALIASES: Array<[string, string]> = [
  ["dollars?|доллар(?:а|ов)?", "USD"], ["euros?|евро", "EUR"],
  ["pounds?|фунт(?:а|ов)?(?:\\s+стерлингов)?", "GBP"], ["rubles?|руб(?:ль|ля|лей)?|р\\.?", "RUB"],
  ["gel|lari|лари", "GEL"], ["tenge|тенге", "KZT"], ["hryvnias?|грив(?:на|ны|ен)", "UAH"],
  ["rupees?|рупи(?:я|и|й)", "INR"], ["yen|иен|йен", "JPY"], ["yuan|юан(?:ь|я|ей)", "CNY"],
  ["francs?|франк(?:а|ов)?", "CHF"], ["dirhams?|дирхам(?:а|ов)?", "AED"], ["liras?|лир(?:а|ы)?", "TRY"],
];

export function parseLocalizedAmount(value: string | undefined) {
  if (!value) return undefined;
  let normalized = value.trim().replace("−", "-").replace(/[ \u00A0\u202F'’]/g, "");
  const negative = normalized.startsWith("-");
  if (negative) normalized = normalized.slice(1);
  const dot = normalized.lastIndexOf(".");
  const comma = normalized.lastIndexOf(",");
  if (dot >= 0 && comma >= 0) {
    const decimal = dot > comma ? "." : ",";
    const grouping = decimal === "." ? /,/g : /\./g;
    normalized = normalized.replace(grouping, "").replace(decimal, ".");
  } else {
    const separator = dot >= 0 ? "." : comma >= 0 ? "," : undefined;
    if (separator) {
      const parts = normalized.split(separator);
      const grouped = parts.length > 1 && parts.slice(1).every((part) => part.length === 3);
      normalized = grouped ? parts.join("") : `${parts.slice(0, -1).join("")}.${parts.at(-1)}`;
    }
  }
  const parsed = Number(`${negative ? "-" : ""}${normalized}`);
  return Number.isFinite(parsed) && Math.abs(parsed) <= 1_000_000_000_000 ? parsed : undefined;
}

function normalizedCode(value: string | null | undefined) {
  const code = value?.trim().toUpperCase();
  return code && /^[A-Z]{3}$/.test(code) ? code : undefined;
}

export function parseBudgetInput(request: string, hint: BudgetHint = {}): ParsedBudgetInput | undefined {
  const oneCent = /(?:^|\s)(?:one|a|один|одна|одно|одного)\s+(?:cent|цент|цента)(?=\s|$|[.,!?])/i.test(request);
  if (oneCent) return { amount: 0.01, currencyCode: "USD", display: "1 cent", ambiguous: false };
  const oneLari = /(?:^|\s)(?:one|a|один|одна|одно|одного)\s+(?:gel|lari|лари)(?=\s|$|[.,!?])/i.test(request);
  if (oneLari) return { amount: 1, currencyCode: "GEL", display: "1 GEL", ambiguous: false };
  const cents = request.match(new RegExp(`(${AMOUNT})\\s*(?:us\\s*)?(?:cent|cents|цент|цента|центов)(?=\\s|$|[.,!?])`, "i"));
  if (cents) {
    const amount = (parseLocalizedAmount(cents[1]) || 0) / 100;
    return { amount, currencyCode: "USD", display: `${cents[1]} cents`, ambiguous: false };
  }

  for (const [symbol, currencyCode] of SYMBOLS) {
    const before = request.match(new RegExp(`([-−]?)\\s*(?:${symbol})\\s*(${AMOUNT})`, "i"));
    const after = request.match(new RegExp(`(${AMOUNT})\\s*(?:${symbol})`, "i"));
    let amount = parseLocalizedAmount(before?.[2] || after?.[1]);
    if (before?.[1] && amount !== undefined) amount = -Math.abs(amount);
    if (amount !== undefined) return { amount, currencyCode, display: `${amount} ${currencyCode}`, ambiguous: false };
  }

  for (const [alias, currencyCode] of ALIASES) {
    const match = request.match(new RegExp(`(${AMOUNT})\\s*(?:${alias})(?=\\s|$|[.,!?])`, "i"));
    const amount = parseLocalizedAmount(match?.[1]);
    if (amount !== undefined) return { amount, currencyCode, display: `${amount} ${currencyCode}`, ambiguous: false };
  }

  const isoBefore = request.match(new RegExp(`(?:^|\\s)([A-Za-z]{3})\\s*(${AMOUNT})(?=\\s|$|[.,!?])`));
  const isoAfter = request.match(new RegExp(`(${AMOUNT})\\s*([A-Za-z]{3})(?=\\s|$|[.,!?])`));
  for (const candidate of [
    { code: isoBefore?.[1], raw: isoBefore?.[2] },
    { code: isoAfter?.[2], raw: isoAfter?.[1] },
  ]) {
    const currencyCode = normalizedCode(candidate.code);
    const amount = parseLocalizedAmount(candidate.raw);
    if (currencyCode && KNOWN_CURRENCY_CODES.has(currencyCode) && amount !== undefined) {
      return { amount, currencyCode, display: `${amount} ${currencyCode}`, ambiguous: false };
    }
  }

  const hintedAmount = typeof hint.amount === "number" && Number.isFinite(hint.amount) && hint.amount >= 0 ? hint.amount : undefined;
  const hintedCode = normalizedCode(hint.currencyCode);
  if (hintedAmount !== undefined && (hint.ambiguous || !hintedCode)) {
    return { amount: hintedAmount, display: hint.currencyDisplay || String(hintedAmount), ambiguous: true };
  }
  if (hintedAmount !== undefined && hintedCode) {
    return { amount: hintedAmount, currencyCode: hintedCode, display: hint.currencyDisplay || `${hintedAmount} ${hintedCode}`, ambiguous: false };
  }
  return undefined;
}

type RateRow = { date?: string; base?: string; quote?: string; rate?: number };
type RateCache = { expiresAt: number; rates: Record<string, number>; date?: string };
let rateCache: RateCache | undefined;

async function liveUsdRates(fetcher: typeof fetch) {
  if (rateCache && rateCache.expiresAt > Date.now()) return rateCache;
  const response = await fetcher("https://api.frankfurter.dev/v2/rates?base=USD", {
    headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000), cache: "no-store",
  });
  if (!response.ok) throw new Error(`FX service returned ${response.status}.`);
  const rows = await response.json() as RateRow[];
  const rates: Record<string, number> = { USD: 1 };
  let date: string | undefined;
  for (const row of rows) {
    const code = normalizedCode(row.quote);
    if (code && typeof row.rate === "number" && row.rate > 0) rates[code] = row.rate;
    if (!date && row.date) date = row.date;
  }
  if (Object.keys(rates).length < 2) throw new Error("FX service returned no usable rates.");
  rateCache = { rates, date, expiresAt: Date.now() + 6 * 60 * 60 * 1000 };
  return rateCache;
}

function fallbackRate(currencyCode: string) {
  const configured: Record<string, number> = {
    GEL: Number(process.env.GEL_PER_USD || 2.72),
    RUB: Number(process.env.RUB_PER_USD || 90),
  };
  const rate = configured[currencyCode];
  return Number.isFinite(rate) && rate > 0 ? rate : undefined;
}

export async function resolveBudgetConstraint(request: string, hint: BudgetHint = {}, fetcher: typeof fetch = fetch): Promise<BudgetResolution> {
  const input = parseBudgetInput(request, hint);
  if (!input) return { status: "none" };
  if (input.amount <= 0) return { status: "invalid", input };
  if (input.ambiguous || !input.currencyCode) return { status: "ambiguous", input };
  if (input.currencyCode === "USD") {
    return { status: "resolved", budget: { amount: input.amount, currency: "USD", usdAmount: input.amount, source: input.display, provider: "native" } };
  }
  try {
    const current = await liveUsdRates(fetcher);
    const rate = current.rates[input.currencyCode];
    if (!rate) return { status: "unsupported", input };
    return {
      status: "resolved",
      budget: { amount: input.amount, currency: input.currencyCode, usdAmount: Math.round(input.amount / rate * 100) / 100, source: input.display, rateDate: current.date, provider: "frankfurter" },
    };
  } catch {
    const rate = fallbackRate(input.currencyCode);
    if (!rate) return { status: "unavailable", input };
    return {
      status: "resolved",
      budget: { amount: input.amount, currency: input.currencyCode, usdAmount: Math.round(input.amount / rate * 100) / 100, source: input.display, provider: "fallback" },
    };
  }
}

export function clearFxCacheForTests() { rateCache = undefined; }
