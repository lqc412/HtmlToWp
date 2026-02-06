"use client";

import type { AnalysisSummary, PreprocessStats } from "../types/ir";

interface AnalysisSummaryCardProps {
  summary: AnalysisSummary;
  stats: PreprocessStats;
  onGenerate: () => void;
  generating: boolean;
}

export function AnalysisSummaryCard({
  summary,
  stats,
  onGenerate,
  generating,
}: AnalysisSummaryCardProps) {
  const { designTokens } = summary;

  return (
    <div className="border border-gray-200 rounded-lg p-5 space-y-4 bg-white">
      <h2 className="text-lg font-semibold text-gray-900">Analysis Result</h2>

      {/* Preprocess stats */}
      <p className="text-sm text-gray-500">
        HTML cleaned: {stats.tokenSavings} ({stats.scriptsRemoved} scripts
        removed, {stats.svgsSimplified} SVGs simplified)
      </p>

      {/* Structure */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Stat label="Sections" value={summary.sectionCount} />
        <Stat label="Header" value={summary.hasHeader ? "Yes" : "No"} />
        <Stat label="Footer" value={summary.hasFooter ? "Yes" : "No"} />
        <Stat label="External Images" value={summary.externalImages} />
        {summary.motionDowngrades > 0 && (
          <Stat label="Motion Downgrades" value={summary.motionDowngrades} />
        )}
        {summary.hasCustomCSS && (
          <Stat label="Custom CSS" value="Included" />
        )}
        {summary.classNameCount > 0 && (
          <Stat label="CSS Class Mappings" value={summary.classNameCount} />
        )}
      </div>

      {/* Design Tokens */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-700">Design Tokens</h3>

        {/* Colors */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(designTokens.colors).map(([name, color]) =>
            color ? (
              <div key={name} className="flex items-center gap-1.5 text-xs">
                <span
                  className="w-4 h-4 rounded border border-gray-300 inline-block"
                  style={{ backgroundColor: color }}
                />
                <span className="text-gray-600">{name}</span>
              </div>
            ) : null,
          )}
        </div>

        {/* Fonts */}
        {(designTokens.fonts.heading || designTokens.fonts.body) && (
          <div className="text-xs text-gray-600">
            {designTokens.fonts.heading && (
              <span>Heading: {designTokens.fonts.heading}</span>
            )}
            {designTokens.fonts.heading && designTokens.fonts.body && (
              <span className="mx-2">|</span>
            )}
            {designTokens.fonts.body && (
              <span>Body: {designTokens.fonts.body}</span>
            )}
          </div>
        )}
      </div>

      {/* Generate button */}
      <button
        onClick={onGenerate}
        disabled={generating}
        className="w-full py-2.5 px-4 bg-green-600 text-white font-medium rounded-md
                   hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors text-sm flex items-center justify-center gap-2"
      >
        {generating && <Spinner />}
        {generating ? "Generating..." : "Generate & Download .zip"}
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <span className="text-gray-500">{label}: </span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
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
