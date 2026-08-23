const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60 * 1_000;

type WindowCounter = { startedAt: number; count: number };
type DailyCounter = { key: string; startedAt: number; chatRequests: number; modelCalls: number };

export type ChatProtectionConfig = {
  requestsPerMinute: number;
  dailyChatRequests: number;
  maxConcurrentRequests: number;
  maxModelCallsPerDay: number;
  maxMessageChars: number;
  maxBodyBytes: number;
  maxOutputTokens: number;
};

export class AiBudgetLimitError extends Error {
  constructor() {
    super("The configured AI usage protection limit has been reached.");
    this.name = "AiBudgetLimitError";
  }
}

export class AiProtectionUnavailableError extends Error {
  constructor() {
    super("Shared AI usage protection is not available.");
    this.name = "AiProtectionUnavailableError";
  }
}

function positiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function chatProtectionConfig(): ChatProtectionConfig {
  return {
    requestsPerMinute: positiveInt(process.env.CHAT_RATE_LIMIT_PER_MINUTE, 5),
    dailyChatRequests: positiveInt(process.env.CHAT_DAILY_REQUEST_LIMIT, 50),
    maxConcurrentRequests: positiveInt(process.env.CHAT_MAX_CONCURRENT_REQUESTS, 2),
    maxModelCallsPerDay: positiveInt(process.env.OPENAI_MAX_CALLS_PER_DAY, 120),
    maxMessageChars: positiveInt(process.env.CHAT_MAX_MESSAGE_CHARS, 600),
    maxBodyBytes: positiveInt(process.env.CHAT_MAX_BODY_BYTES, 50_000),
    maxOutputTokens: positiveInt(process.env.OPENAI_MAX_OUTPUT_TOKENS, 1_600),
  };
}

const minuteCounters = new Map<string, WindowCounter>();
let activeRequests = 0;
let daily: DailyCounter = { key: "", startedAt: 0, chatRequests: 0, modelCalls: 0 };
let sharedStoreWarningLogged = false;

function dayKey(now: number) {
  return new Date(now).toISOString().slice(0, 10);
}

function refreshDaily(now = Date.now()) {
  const key = dayKey(now);
  if (daily.key !== key || now - daily.startedAt >= DAY_MS) {
    daily = { key, startedAt: now, chatRequests: 0, modelCalls: 0 };
    minuteCounters.clear();
  }
}

function incrementWindow(key: string, now: number) {
  const current = minuteCounters.get(key);
  if (!current || now - current.startedAt >= MINUTE_MS) {
    minuteCounters.set(key, { startedAt: now, count: 1 });
    return;
  }
  current.count += 1;
}

function windowCount(key: string, now: number) {
  const current = minuteCounters.get(key);
  if (!current || now - current.startedAt >= MINUTE_MS) return 0;
  return current.count;
}

function clientAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function sharedStoreCredentials() {
  const url = (process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL)?.trim();
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN)?.trim();
  return url && token ? { url: url.replace(/\/+$/, ""), token } : undefined;
}

function keyPart(value: string) { return encodeURIComponent(value.slice(0, 120)); }

async function sharedIncrement(key: string, ttlSeconds: number) {
  const credentials = sharedStoreCredentials();
  if (!credentials) return undefined;
  try {
    const response = await fetch(`${credentials.url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${credentials.token}`, "Content-Type": "application/json" },
      body: JSON.stringify([["INCR", key], ["EXPIRE", key, ttlSeconds]]),
    });
    if (!response.ok) throw new Error(`Shared limiter returned HTTP ${response.status}`);
    const result = await response.json() as Array<{ result?: unknown; error?: string }>;
    if (result[0]?.error) throw new Error(result[0].error);
    const count = Number(result[0]?.result);
    if (!Number.isFinite(count)) throw new Error("Shared limiter returned an invalid counter.");
    return count;
  } catch (error) {
    if (!sharedStoreWarningLogged) {
      sharedStoreWarningLogged = true;
      console.warn("[usage-guard] shared limiter unavailable; using process-local fallback", error instanceof Error ? error.message : String(error));
    }
    return undefined;
  }
}

function sharedMinuteKey(scope: string, value: string, now: number) {
  return `grocery-copilot:minute:${Math.floor(now / MINUTE_MS)}:${scope}:${keyPart(value)}`;
}

function sharedDayKey(scope: string, now: number) {
  return `grocery-copilot:day:${dayKey(now)}:${scope}`;
}

export type ChatLease =
  | { allowed: true; release: () => void }
  | { allowed: false; reason: "rate_limit" | "daily_limit" | "concurrency_limit" | "protection_unconfigured" | "protection_unavailable"; retryAfterSeconds: number };

export async function acquireChatLease(request: Request, sessionId: string): Promise<ChatLease> {
  const now = Date.now();
  const config = chatProtectionConfig();
  refreshDaily(now);
  const requiresSharedProtection = process.env.VERCEL === "1";
  if (requiresSharedProtection && !sharedStoreCredentials()) {
    return { allowed: false, reason: "protection_unconfigured", retryAfterSeconds: 60 };
  }
  if (daily.chatRequests >= config.dailyChatRequests) {
    return { allowed: false, reason: "daily_limit", retryAfterSeconds: Math.max(60, Math.ceil((DAY_MS - (now - daily.startedAt)) / 1_000)) };
  }
  if (activeRequests >= config.maxConcurrentRequests) {
    return { allowed: false, reason: "concurrency_limit", retryAfterSeconds: 10 };
  }

  const keys = [`ip:${clientAddress(request)}`, `session:${sessionId}`];
  const limitedKey = keys.find((key) => windowCount(key, now) >= config.requestsPerMinute);
  if (limitedKey) {
    const startedAt = minuteCounters.get(limitedKey)?.startedAt || now;
    return { allowed: false, reason: "rate_limit", retryAfterSeconds: Math.max(1, Math.ceil((MINUTE_MS - (now - startedAt)) / 1_000)) };
  }

  const sharedCounts = await Promise.all([
    sharedIncrement(sharedMinuteKey("ip", clientAddress(request), now), 120),
    sharedIncrement(sharedMinuteKey("session", sessionId, now), 120),
    sharedIncrement(sharedDayKey("chat-requests", now), 2 * 24 * 60 * 60),
  ]);
  if (requiresSharedProtection && sharedCounts.some((count) => count === undefined)) {
    return { allowed: false, reason: "protection_unavailable", retryAfterSeconds: 30 };
  }
  const sharedMinuteLimit = sharedCounts.slice(0, 2).some((count) => count !== undefined && count > config.requestsPerMinute);
  const sharedDailyLimit = sharedCounts[2] !== undefined && sharedCounts[2] > config.dailyChatRequests;
  if (sharedDailyLimit) return { allowed: false, reason: "daily_limit", retryAfterSeconds: Math.max(60, Math.ceil((DAY_MS - (now - daily.startedAt)) / 1_000)) };
  if (sharedMinuteLimit) return { allowed: false, reason: "rate_limit", retryAfterSeconds: 60 };

  keys.forEach((key) => incrementWindow(key, now));
  daily.chatRequests += 1;
  activeRequests += 1;
  let released = false;
  return {
    allowed: true,
    release: () => {
      if (released) return;
      released = true;
      activeRequests = Math.max(0, activeRequests - 1);
    },
  };
}

export async function withModelCallBudget<T>(operation: () => Promise<T>): Promise<T> {
  refreshDaily();
  const config = chatProtectionConfig();
  if (daily.modelCalls >= config.maxModelCallsPerDay) throw new AiBudgetLimitError();
  const sharedCount = await sharedIncrement(sharedDayKey("model-calls", Date.now()), 2 * 24 * 60 * 60);
  if (process.env.VERCEL === "1" && sharedCount === undefined) throw new AiProtectionUnavailableError();
  if (sharedCount !== undefined && sharedCount > config.maxModelCallsPerDay) throw new AiBudgetLimitError();
  daily.modelCalls += 1;
  return operation();
}

export function resetUsageGuardForTests() {
  minuteCounters.clear();
  activeRequests = 0;
  sharedStoreWarningLogged = false;
  daily = { key: "", startedAt: 0, chatRequests: 0, modelCalls: 0 };
}
