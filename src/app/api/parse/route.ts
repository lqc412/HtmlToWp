import { NextRequest, NextResponse } from "next/server";
import { preprocessHTML } from "../../../services/html-preprocessor";
import { callOpenRouter } from "../../../services/openrouter-client";
import { postprocessClassNames } from "../../../services/ir-postprocessor";
import {
  buildSystemPrompt,
  buildUserPrompt,
  type SourcePreset,
} from "../../../services/prompt-builder";
import { IRDocumentSchema } from "../../../validation/ir-schema";
import type { AppError } from "../../../types/ir";

const MAX_HTML_LENGTH = 100_000; // 100KB limit
const VALID_PRESETS: SourcePreset[] = ["v0", "bolt", "tailwind-ui", "generic"];

// Popular models on OpenRouter (users can also input custom model IDs)
export const SUGGESTED_MODELS = [
  { id: "google/gemini-2.0-flash-exp:free", name: "Gemini 2.0 Flash (Free)" },
  { id: "google/gemini-flash-1.5", name: "Gemini 1.5 Flash" },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
  { id: "openai/gpt-4o", name: "GPT-4o" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini" },
  { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B" },
];

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, {
        type: "INVALID_RESPONSE",
        message: "Request body is not valid JSON",
      });
    }
    const html = body.html;
    const apiKey = body.apiKey;
    const model = body.model;
    const sourcePreset = (body.sourcePreset as string) || "generic";

    // Validate required fields
    if (!html || typeof html !== "string") {
      return errorResponse(400, {
        type: "INVALID_RESPONSE",
        message: "Missing or invalid 'html' field",
      });
    }

    if (!apiKey || typeof apiKey !== "string") {
      return errorResponse(400, {
        type: "INVALID_API_KEY",
        message: "Missing or invalid 'apiKey' field",
      });
    }

    if (!model || typeof model !== "string") {
      return errorResponse(400, {
        type: "INVALID_RESPONSE",
        message: "Missing or invalid 'model' field",
      });
    }

    if (!VALID_PRESETS.includes(sourcePreset as SourcePreset)) {
      return errorResponse(400, {
        type: "INVALID_RESPONSE",
        message: `Invalid sourcePreset. Must be one of: ${VALID_PRESETS.join(", ")}`,
      });
    }

    if (html.length > MAX_HTML_LENGTH) {
      return errorResponse(400, {
        type: "TOKEN_OVERFLOW",
        message: `HTML exceeds ${MAX_HTML_LENGTH / 1000}KB limit (${Math.round(html.length / 1000)}KB provided)`,
      });
    }

    // Step 1: Preprocess HTML
    const { html: cleanedHtml, extractedCSS, stats } = preprocessHTML(html);

    // Step 2: Call OpenRouter
    const systemPrompt = buildSystemPrompt(sourcePreset as SourcePreset);
    const userPrompt = buildUserPrompt(cleanedHtml);

    const { json: rawIR } = await callOpenRouter({
      apiKey,
      model,
      systemPrompt,
      userPrompt,
    });

    // Step 3: Validate with Zod
    const parseResult = IRDocumentSchema.safeParse(rawIR);

    if (!parseResult.success) {
      const issues = parseResult.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");

      // Log full error for debugging
      console.error("[Schema Validation Failed]", {
        issues: parseResult.error.issues.slice(0, 10),
        rawIRSample: JSON.stringify(rawIR).slice(0, 500),
      });

      return errorResponse(422, {
        type: "SCHEMA_VIOLATION",
        message: "LLM output failed IR schema validation",
        detail: issues,
      });
    }

    // Inject extracted CSS into IR (bypasses Gemini, deterministic)
    const ir = postprocessClassNames(
      {
        ...parseResult.data,
        customCSS: extractedCSS || undefined,
      },
      html,
      extractedCSS,
    );

    return NextResponse.json({
      ir,
      stats,
    });
  } catch (err: unknown) {
    // Handle classified AppErrors from openrouter-client
    if (isAppError(err)) {
      const status = statusForErrorType(err.type);
      console.error(`[/api/parse] AppError [${err.type}]:`, err.message, err.detail);
      return errorResponse(status, err);
    }

    // Unclassified errors
    console.error("[/api/parse] Unhandled error:", err);
    return errorResponse(500, {
      type: "NETWORK_ERROR",
      message: "Internal server error",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}

function isAppError(err: unknown): err is AppError {
  return (
    typeof err === "object" &&
    err !== null &&
    "type" in err &&
    "message" in err
  );
}

function statusForErrorType(type: AppError["type"]): number {
  switch (type) {
    case "INVALID_API_KEY":
      return 401;
    case "RATE_LIMITED":
      return 429;
    case "TOKEN_OVERFLOW":
      return 413;
    case "INVALID_RESPONSE":
    case "SCHEMA_VIOLATION":
      return 422;
    case "NETWORK_ERROR":
      return 502;
    default:
      return 500;
  }
}

function errorResponse(status: number, error: AppError) {
  return NextResponse.json({ error }, { status });
}
