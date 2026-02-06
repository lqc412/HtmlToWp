"use client";

import { useState } from "react";
import type { SourcePreset } from "../services/prompt-builder";
import type { Status } from "../lib/reducer";

interface ConverterFormProps {
  onSubmit: (data: {
    html: string;
    apiKey: string;
    model: string;
    sourcePreset: SourcePreset;
  }) => void;
  status: Status;
}

const PRESET_OPTIONS: { value: SourcePreset; label: string }[] = [
  { value: "generic", label: "Generic HTML" },
  { value: "v0", label: "v0.dev" },
  { value: "bolt", label: "Bolt.new" },
  { value: "tailwind-ui", label: "Tailwind UI" },
];

const MODEL_OPTIONS = [
  { id: "google/gemini-2.0-flash-exp:free", name: "Gemini 2.0 Flash (Free)" },
  { id: "google/gemini-flash-1.5", name: "Gemini 1.5 Flash" },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
  { id: "openai/gpt-4o", name: "GPT-4o" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini" },
  { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B" },
];

const MAX_HTML_LENGTH = 100_000;

export function ConverterForm({ onSubmit, status }: ConverterFormProps) {
  const isDisabled = status === "analyzing" || status === "generating";
  const [htmlLength, setHtmlLength] = useState(0);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    onSubmit({
      html: fd.get("html") as string,
      apiKey: fd.get("apiKey") as string,
      model: fd.get("model") as string,
      sourcePreset: fd.get("sourcePreset") as SourcePreset,
    });
  }

  const sizeKB = (htmlLength / 1000).toFixed(1);
  const isOverLimit = htmlLength > MAX_HTML_LENGTH;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* API Key */}
      <div>
        <label
          htmlFor="apiKey"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          OpenRouter API Key
        </label>
        <input
          id="apiKey"
          name="apiKey"
          type="password"
          required
          placeholder="sk-or-v1-..."
          disabled={isDisabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                     disabled:bg-gray-100 text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">
          Get your API key from{" "}
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 underline"
          >
            openrouter.ai/keys
          </a>
        </p>
      </div>

      {/* Model Selection */}
      <div>
        <label
          htmlFor="model"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Model
        </label>
        <select
          id="model"
          name="model"
          defaultValue="anthropic/claude-3.5-sonnet"
          disabled={isDisabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                     disabled:bg-gray-100 text-sm bg-white"
        >
          {MODEL_OPTIONS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500">
          Browse all models at{" "}
          <a
            href="https://openrouter.ai/models"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-700 underline"
          >
            openrouter.ai/models
          </a>
        </p>
      </div>

      {/* Source Preset */}
      <div>
        <label
          htmlFor="sourcePreset"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Source
        </label>
        <select
          id="sourcePreset"
          name="sourcePreset"
          defaultValue="generic"
          disabled={isDisabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                     disabled:bg-gray-100 text-sm bg-white"
        >
          {PRESET_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* HTML Textarea */}
      <div>
        <div className="flex items-baseline justify-between mb-1">
          <label
            htmlFor="html"
            className="text-sm font-medium text-gray-700"
          >
            HTML
          </label>
          {htmlLength > 0 && (
            <span
              className={`text-xs ${isOverLimit ? "text-red-500 font-medium" : "text-gray-400"}`}
            >
              {sizeKB}KB / {MAX_HTML_LENGTH / 1000}KB
            </span>
          )}
        </div>
        <textarea
          id="html"
          name="html"
          required
          rows={12}
          placeholder="Paste your AI-generated HTML here..."
          disabled={isDisabled}
          onChange={(e) => setHtmlLength(e.target.value.length)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                     disabled:bg-gray-100 text-sm font-mono resize-y"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isDisabled || isOverLimit}
        className="w-full py-2.5 px-4 bg-blue-600 text-white font-medium rounded-md
                   hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors text-sm flex items-center justify-center gap-2"
      >
        {status === "analyzing" && <Spinner />}
        {status === "analyzing" ? "Analyzing..." : "Analyze HTML"}
      </button>
    </form>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
