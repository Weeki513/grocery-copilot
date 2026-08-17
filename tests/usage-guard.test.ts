import { afterEach, describe, expect, it } from "vitest";
import { AiBudgetLimitError, acquireChatLease, chatProtectionConfig, resetUsageGuardForTests, withModelCallBudget } from "@/server/ai/usage-guard";

const guardEnvKeys = ["CHAT_RATE_LIMIT_PER_MINUTE", "CHAT_DAILY_REQUEST_LIMIT", "CHAT_MAX_CONCURRENT_REQUESTS", "OPENAI_MAX_CALLS_PER_DAY", "CHAT_MAX_MESSAGE_CHARS", "CHAT_MAX_BODY_BYTES", "OPENAI_MAX_OUTPUT_TOKENS", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"];

function request(ip = "203.0.113.10") {
  return new Request("https://demo.example/api/chat", { headers: { "x-forwarded-for": ip } });
}

describe("AI usage protection", () => {
  afterEach(() => {
    resetUsageGuardForTests();
    guardEnvKeys.forEach((key) => delete process.env[key]);
  });

  it("limits requests by IP and session within a minute", async () => {
    process.env.CHAT_RATE_LIMIT_PER_MINUTE = "2";
    process.env.CHAT_MAX_CONCURRENT_REQUESTS = "10";
    expect((await acquireChatLease(request(), "session-a")).allowed).toBe(true);
    expect((await acquireChatLease(request(), "session-a")).allowed).toBe(true);
    const blocked = await acquireChatLease(request(), "session-a");
    expect(blocked).toMatchObject({ allowed: false, reason: "rate_limit" });
  });

  it("enforces the daily request cap across different clients", async () => {
    process.env.CHAT_DAILY_REQUEST_LIMIT = "1";
    const first = await acquireChatLease(request("203.0.113.11"), "session-a");
    expect(first.allowed).toBe(true);
    const second = await acquireChatLease(request("203.0.113.12"), "session-b");
    expect(second).toMatchObject({ allowed: false, reason: "daily_limit" });
    if (first.allowed) first.release();
  });

  it("caps concurrent requests and releases the slot", async () => {
    process.env.CHAT_MAX_CONCURRENT_REQUESTS = "1";
    const first = await acquireChatLease(request(), "session-a");
    expect(first.allowed).toBe(true);
    expect(await acquireChatLease(request("203.0.113.12"), "session-b")).toMatchObject({ allowed: false, reason: "concurrency_limit" });
    if (first.allowed) first.release();
    expect((await acquireChatLease(request("203.0.113.12"), "session-b")).allowed).toBe(true);
  });

  it("stops model calls at the configured daily cap", async () => {
    process.env.OPENAI_MAX_CALLS_PER_DAY = "2";
    expect(chatProtectionConfig().maxModelCallsPerDay).toBe(2);
    await withModelCallBudget(async () => "first");
    await withModelCallBudget(async () => "second");
    await expect(withModelCallBudget(async () => "third")).rejects.toBeInstanceOf(AiBudgetLimitError);
  });
});
