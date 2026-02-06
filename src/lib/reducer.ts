/**
 * State machine for the converter UI.
 * idle → analyzing → analyzed → generating → done
 * Any state can transition to error; CLEAR_ERROR restores last valid state.
 */

import type {
  IRDocument,
  PreprocessStats,
  AppError,
  AnalysisSummary,
} from "../types/ir";

export type Status =
  | "idle"
  | "analyzing"
  | "analyzed"
  | "generating"
  | "done"
  | "error";

export interface AppState {
  status: Status;
  ir: IRDocument | null;
  stats: PreprocessStats | null;
  zipBlob: Blob | null;
  error: AppError | null;
}

export type Action =
  | { type: "START_ANALYSIS" }
  | { type: "ANALYSIS_SUCCESS"; payload: { ir: IRDocument; stats: PreprocessStats } }
  | { type: "ANALYSIS_ERROR"; payload: AppError }
  | { type: "START_GENERATION" }
  | { type: "GENERATION_DONE"; payload: Blob }
  | { type: "GENERATION_ERROR"; payload: AppError }
  | { type: "CLEAR_ERROR" }
  | { type: "RESET" };

export const initialState: AppState = {
  status: "idle",
  ir: null,
  stats: null,
  zipBlob: null,
  error: null,
};

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "START_ANALYSIS":
      return { ...initialState, status: "analyzing" };
    case "ANALYSIS_SUCCESS":
      return {
        ...state,
        status: "analyzed",
        ir: action.payload.ir,
        stats: action.payload.stats,
        error: null,
      };
    case "ANALYSIS_ERROR":
      return { ...state, status: "error", error: action.payload };
    case "START_GENERATION":
      return { ...state, status: "generating", error: null };
    case "GENERATION_DONE":
      return { ...state, status: "done", zipBlob: action.payload };
    case "GENERATION_ERROR":
      return { ...state, status: "error", error: action.payload };
    case "CLEAR_ERROR":
      // Restore last valid state: analyzed if IR exists, idle otherwise
      if (state.ir) {
        return { ...state, status: "analyzed", error: null };
      }
      return initialState;
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

/**
 * Extract a human-friendly summary from an IRDocument.
 */
export function extractSummary(ir: IRDocument): AnalysisSummary {
  let motionDowngrades = 0;
  let externalImages = 0;
  let classNameCount = 0;

  function walkNodes(nodes: IRDocument["sections"][number]["children"]) {
    for (const node of nodes) {
      if (node.motionIntent && node.motionIntent !== "static") {
        motionDowngrades++;
      }
      if (node.type === "image" && node.attributes.src?.startsWith("http")) {
        externalImages++;
      }
      if (node.className) {
        classNameCount++;
      }
      if (node.children) {
        walkNodes(node.children);
      }
    }
  }

  const allSections = [
    ...(ir.header ? [ir.header] : []),
    ...ir.sections,
    ...(ir.footer ? [ir.footer] : []),
  ];

  for (const section of allSections) {
    if (section.motionIntent && section.motionIntent !== "static") {
      motionDowngrades++;
    }
    if (section.className) {
      classNameCount++;
    }
    walkNodes(section.children);
  }

  return {
    sectionCount: ir.sections.length,
    hasHeader: !!ir.header,
    hasFooter: !!ir.footer,
    designTokens: ir.designTokens,
    motionDowngrades,
    externalImages,
    hasCustomCSS: !!(ir.customCSS && ir.customCSS.trim().length > 0),
    classNameCount,
  };
}
