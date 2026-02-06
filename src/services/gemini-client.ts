/**
 * Gemini API client — designed for both server-side (API Route)
 * and client-side (browser direct call) use.
 *
 * Uses @google/generative-ai SDK which works in both environments.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { sanitizeJSON } from "../lib/utils";
import type { AppError } from "../types/ir";

const MODEL_NAME = "gemini-1.5-flash-8b";
const TEMPERATURE = 0.1;
const MAX_OUTPUT_TOKENS = 8192;
const REQUEST_TIMEOUT_MS = 30_000;

interface GeminiCallOptions {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
}

interface GeminiResult {
  json: unknown;
}

/**
 * Call Gemini API and return parsed JSON.
 * Includes one automatic retry on transient failures.
 */
export async function callGemini(
  options: GeminiCallOptions,
): Promise<GeminiResult> {
  const { apiKey, systemPrompt, userPrompt } = options;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      temperature: TEMPERATURE,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      responseMimeType: "application/json",
    },
    systemInstruction: systemPrompt,
  });

  let lastError: unknown;

  // Retry once on transient failure
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      }, { timeout: REQUEST_TIMEOUT_MS });
      const rawText = result.response.text();

      if (!rawText || rawText.trim().length === 0) {
        throw createAppError(
          "INVALID_RESPONSE",
          "Gemini returned an empty response",
        );
      }

      const cleaned = sanitizeJSON(rawText);

      try {
        const parsed = JSON.parse(cleaned);
        return { json: parsed };
      } catch {
        throw createAppError(
          "INVALID_RESPONSE",
          "Gemini output is not valid JSON",
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

/**
 * Classify SDK/network errors into AppError types.
 */
function classifyError(err: unknown): AppError {
  if (isAppError(err)) return err;

  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();

  if (lower.includes("api key") || lower.includes("api_key_invalid") || lower.includes("401")) {
    return createAppError(
      "INVALID_API_KEY",
      "Invalid Gemini API key",
      message,
    );
  }

  if (lower.includes("429") || lower.includes("rate") || lower.includes("quota")) {
    return createAppError(
      "RATE_LIMITED",
      "Gemini API rate limit exceeded. Please wait and try again.",
      message,
    );
  }

  if (lower.includes("token") || lower.includes("too long") || lower.includes("content too large")) {
    return createAppError(
      "TOKEN_OVERFLOW",
      "HTML is too large for the model's context window",
      message,
    );
  }

  if (lower.includes("timeout") || lower.includes("abort") || lower.includes("timed out")) {
    return createAppError(
      "NETWORK_ERROR",
      "Gemini API request timed out (30s). The HTML may be too complex — try a simpler page.",
      message,
    );
  }

  if (lower.includes("fetch") || lower.includes("network") || lower.includes("econnrefused")) {
    return createAppError(
      "NETWORK_ERROR",
      "Failed to connect to Gemini API",
      message,
    );
  }

  return createAppError(
    "NETWORK_ERROR",
    "Unexpected error calling Gemini API",
    message,
  );
}
