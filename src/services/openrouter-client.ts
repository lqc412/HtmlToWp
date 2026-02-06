/**
 * OpenRouter API client — designed for both server-side (API Route)
 * and client-side (browser direct call) use.
 *
 * Uses fetch API which works in both environments.
 * Supports multiple models via OpenRouter.
 */

import { sanitizeJSON } from "../lib/utils";
import type { AppError } from "../types/ir";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const TEMPERATURE = 0.1;
const MAX_OUTPUT_TOKENS = 8192;
const REQUEST_TIMEOUT_MS = 60_000; // 60s for OpenRouter (longer than Gemini)

export interface OpenRouterCallOptions {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
}

interface OpenRouterResult {
  json: unknown;
}

/**
 * Call OpenRouter API and return parsed JSON.
 * Includes one automatic retry on transient failures.
 */
export async function callOpenRouter(
  options: OpenRouterCallOptions,
): Promise<OpenRouterResult> {
  const { apiKey, model, systemPrompt, userPrompt } = options;

  let lastError: unknown;

  // Retry once on transient failure
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://ai-to-wp-theme.vercel.app",
          "X-Title": "AI to WordPress Theme Converter",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: TEMPERATURE,
          max_tokens: MAX_OUTPUT_TOKENS,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle HTTP errors
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw createHTTPError(response.status, errorData);
      }

      const data = await response.json();

      // Extract content from OpenRouter response
      const rawText = data.choices?.[0]?.message?.content;

      if (!rawText || typeof rawText !== "string" || rawText.trim().length === 0) {
        throw createAppError(
          "INVALID_RESPONSE",
          "OpenRouter returned an empty response",
        );
      }

      const cleaned = sanitizeJSON(rawText);

      try {
        const parsed = JSON.parse(cleaned);
        return { json: parsed };
      } catch {
        throw createAppError(
          "INVALID_RESPONSE",
          "OpenRouter output is not valid JSON",
          cleaned.slice(0, 200),
        );
      }
    } catch (err: unknown) {
      lastError = err;

      // Don't retry on classified app errors (non-transient)
      if (isAppError(err)) {
        if (
          err.type === "INVALID_API_KEY" ||
          err.type === "INVALID_RESPONSE"
        ) {
          throw err;
        }
      }

      // Classify SDK errors
      const classified = classifyError(err);
      if (
        classified.type === "INVALID_API_KEY" ||
        classified.type === "INVALID_RESPONSE"
      ) {
        throw classified;
      }

      // Transient errors: retry on first attempt
      if (attempt === 0) {
        continue;
      }

      throw classified;
    }
  }

  // Should not reach here, but just in case
  throw classifyError(lastError);
}

function isAppError(err: unknown): err is AppError {
  return (
    typeof err === "object" &&
    err !== null &&
    "type" in err &&
    "message" in err
  );
}

function createAppError(
  type: AppError["type"],
  message: string,
  detail?: string,
): AppError {
  return { type, message, detail };
}

function createHTTPError(status: number, errorData: Record<string, unknown>): AppError {
  const errObj = errorData.error as Record<string, unknown> | undefined;
  const errorMessage = errObj?.message || errorData.message || "Unknown error";
  const errorCode = errObj?.code || errorData.code;

  if (status === 401 || status === 403) {
    return createAppError(
      "INVALID_API_KEY",
      "Invalid OpenRouter API key",
      String(errorMessage),
    );
  }

  if (status === 429) {
    return createAppError(
      "RATE_LIMITED",
      "OpenRouter API rate limit exceeded. Please wait and try again.",
      String(errorMessage),
    );
  }

  if (status === 413 || errorCode === "context_length_exceeded") {
    return createAppError(
      "TOKEN_OVERFLOW",
      "HTML is too large for the model's context window",
      String(errorMessage),
    );
  }

  return createAppError(
    "NETWORK_ERROR",
    `OpenRouter API error (HTTP ${status})`,
    String(errorMessage),
  );
}

/**
 * Classify network/fetch errors into AppError types.
 */
function classifyError(err: unknown): AppError {
  if (isAppError(err)) return err;

  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (lower.includes("abort")) {
    return createAppError(
      "NETWORK_ERROR",
      `OpenRouter API request timed out (${REQUEST_TIMEOUT_MS / 1000}s). The HTML may be too complex — try a simpler page.`,
      message,
    );
  }

  if (lower.includes("fetch") || lower.includes("network") || lower.includes("econnrefused")) {
    return createAppError(
      "NETWORK_ERROR",
      "Failed to connect to OpenRouter API",
      message,
    );
  }

  return createAppError(
    "NETWORK_ERROR",
    "Unexpected error calling OpenRouter API",
    message,
  );
}
