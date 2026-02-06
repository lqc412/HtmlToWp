"use client";

import { useReducer, useCallback } from "react";
import { reducer, initialState, extractSummary } from "../lib/reducer";
import type { AppError, IRDocument, PreprocessStats } from "../types/ir";
import type { SourcePreset } from "../services/prompt-builder";
import { ConverterForm } from "../components/converter-form";
import { AnalysisSummaryCard } from "../components/analysis-summary";
import { ErrorDisplay } from "../components/error-display";

export default function Home() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const handleAnalyze = useCallback(
    async (data: {
      html: string;
      apiKey: string;
      model: string;
      sourcePreset: SourcePreset;
    }) => {
      dispatch({ type: "START_ANALYSIS" });

      try {
        const res = await fetch("/api/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        let json: Record<string, unknown>;
        try {
          json = await res.json();
        } catch {
          dispatch({
            type: "ANALYSIS_ERROR",
            payload: {
              type: "NETWORK_ERROR",
              message: `Server returned non-JSON response (HTTP ${res.status})`,
            },
          });
          return;
        }

        if (!res.ok) {
          dispatch({
            type: "ANALYSIS_ERROR",
            payload: json.error as AppError,
          });
          return;
        }

        dispatch({
          type: "ANALYSIS_SUCCESS",
          payload: {
            ir: json.ir as IRDocument,
            stats: json.stats as PreprocessStats,
          },
        });
      } catch {
        dispatch({
          type: "ANALYSIS_ERROR",
          payload: {
            type: "NETWORK_ERROR",
            message: "Failed to reach the server. Check your connection.",
          },
        });
      }
    },
    [],
  );

  const handleGenerate = useCallback(async () => {
    if (!state.ir) return;
    dispatch({ type: "START_GENERATION" });

    try {
      const { generateThemeZip } = await import(
        "../generator/theme-generator"
      );
      const blob = await generateThemeZip(state.ir);
      dispatch({ type: "GENERATION_DONE", payload: blob });

      // Trigger download
      const { saveAs } = await import("file-saver");
      const title = state.ir.metadata.title || "ai-theme";
      saveAs(blob, `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.zip`);
    } catch {
      dispatch({
        type: "GENERATION_ERROR",
        payload: {
          type: "NETWORK_ERROR",
          message: "Theme generation failed. Please try again.",
        },
      });
    }
  }, [state.ir]);

  const handleDismissError = useCallback(() => {
    dispatch({ type: "CLEAR_ERROR" });
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">
            AI &rarr; WordPress Theme Converter
          </h1>
          <p className="text-sm text-gray-500">
            Paste AI-generated HTML and get an installable WordPress Block Theme
          </p>
        </div>

        {/* Form */}
        <ConverterForm onSubmit={handleAnalyze} status={state.status} />

        {/* Error */}
        {state.error && (
          <ErrorDisplay error={state.error} onDismiss={handleDismissError} />
        )}

        {/* Analysis Summary */}
        {state.ir && state.stats && state.status !== "error" && (
          <AnalysisSummaryCard
            summary={extractSummary(state.ir)}
            stats={state.stats}
            onGenerate={handleGenerate}
            generating={state.status === "generating"}
          />
        )}

        {/* Done */}
        {state.status === "done" && (
          <div className="border border-green-200 rounded-lg p-4 bg-green-50 text-center">
            <p className="text-sm font-medium text-green-800">
              Theme downloaded! Upload the .zip to WordPress via Appearance
              &rarr; Themes &rarr; Add New &rarr; Upload Theme.
            </p>
            <button
              onClick={() => dispatch({ type: "RESET" })}
              className="mt-3 text-sm text-green-600 hover:text-green-700 underline"
            >
              Convert another
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
