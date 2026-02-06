"use client";

import type { AppError } from "../types/ir";

interface ErrorDisplayProps {
  error: AppError;
  onDismiss: () => void;
}

const ERROR_TITLES: Record<string, string> = {
  INVALID_API_KEY: "Invalid API Key",
  RATE_LIMITED: "Rate Limited",
  TOKEN_OVERFLOW: "Input Too Large",
  INVALID_RESPONSE: "Invalid AI Response",
  SCHEMA_VIOLATION: "Schema Validation Failed",
  NETWORK_ERROR: "Network Error",
};

const ERROR_HINTS: Record<string, string> = {
  INVALID_API_KEY:
    "Verify your key at openrouter.ai/keys and ensure it's active.",
  RATE_LIMITED:
    "Wait a minute and try again, or check your OpenRouter API quota/credits.",
  TOKEN_OVERFLOW:
    "Try pasting a smaller HTML page, or remove non-essential sections before pasting.",
  INVALID_RESPONSE:
    "The AI returned unexpected output. Try again — results may vary.",
  SCHEMA_VIOLATION:
    "The AI output didn't match the expected format. Try again or use a simpler HTML page.",
  NETWORK_ERROR:
    "Check your internet connection and try again.",
};

export function ErrorDisplay({ error, onDismiss }: ErrorDisplayProps) {
  const hint = ERROR_HINTS[error.type];

  return (
    <div className="border border-red-200 rounded-lg p-4 bg-red-50">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-red-800">
            {ERROR_TITLES[error.type] || error.type}
          </h3>
          <p className="text-sm text-red-700">{error.message}</p>
          {hint && (
            <p className="text-xs text-red-600 mt-1">{hint}</p>
          )}
          {error.detail && (
            <details className="mt-2">
              <summary className="text-xs text-red-500 cursor-pointer">
                Details
              </summary>
              <pre className="mt-1 text-xs text-red-600 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                {error.detail}
              </pre>
            </details>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="text-red-400 hover:text-red-600 ml-4 text-lg leading-none"
          aria-label="Dismiss error"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
