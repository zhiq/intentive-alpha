import { logger } from "@/observability/logger";
import { MarketEvent } from "@/observability/events";
import { MockAiProvider } from "./mock";
import { ClaudeAiProvider } from "./claude";
import type { AiProvider } from "./types";

export type { AiProvider, UserContext } from "./types";

// Provider selection:
//   AI_PROVIDER=mock        -> always mock
//   AI_PROVIDER=claude      -> claude (requires a key)
//   (unset) + key present   -> claude
//   (unset) + no key        -> mock (the alpha default)
function resolveApiKey(): string | undefined {
  return process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || undefined;
}

let cached: AiProvider | undefined;

export function getAiProvider(): AiProvider {
  if (cached) return cached;

  const forced = process.env.AI_PROVIDER?.toLowerCase();
  const apiKey = resolveApiKey();
  const model = process.env.AI_MODEL || "claude-sonnet-4-6";

  if (forced === "mock") {
    cached = new MockAiProvider();
  } else if (forced === "claude") {
    if (!apiKey) {
      logger.event(MarketEvent.AI_FALLBACK_USED, {
        reason: "forced_claude_no_key",
      });
      cached = new MockAiProvider();
    } else {
      cached = new ClaudeAiProvider(apiKey, model);
    }
  } else if (apiKey) {
    cached = new ClaudeAiProvider(apiKey, model);
  } else {
    cached = new MockAiProvider();
  }

  logger.info("ai.provider_selected", { provider: cached.name });
  return cached;
}

/** Current provider name without forcing instantiation side effects. */
export function getAiProviderName(): "mock" | "claude" {
  return getAiProvider().name;
}

/**
 * Run an AI operation with automatic fallback to the deterministic mock provider
 * if the active (Claude) provider throws — e.g. network failure or invalid
 * output. This keeps the market resilient: the app always returns a usable,
 * validated result. The fallback is logged for observability.
 */
export async function withAiFallback<T>(
  op: string,
  run: (provider: AiProvider) => Promise<T>,
): Promise<T> {
  const provider = getAiProvider();
  try {
    return await run(provider);
  } catch (err) {
    if (provider.name === "mock") throw err;
    logger.event(MarketEvent.AI_FALLBACK_USED, {
      op,
      reason: err instanceof Error ? err.message : "unknown",
    });
    return run(new MockAiProvider());
  }
}

/** For tests: reset the cached provider so env changes take effect. */
export function __resetAiProviderCache(): void {
  cached = undefined;
}
