// ========== Semantic Layer (for humans + prompt tuning) ==========
// LLM labels what a section "looks like", but the renderer does not depend on this field.
export type SectionIntent =
  | "hero"
  | "features"
  | "content"
  | "gallery"
  | "pricing"
  | "testimonial"
  | "cta"
  | "faq"
  | "footer"
  | "header"
  | "generic";

// ========== Motion Intent Layer ==========
// "Migrate intent, not code" — animations are preserved as intent labels,
// not as actual animation code. MVP downgrades all to static.
export type MotionIntent =
  | "static"
  | "fade-in"
  | "slide-up"
  | "parallax"
  | "hover-reveal"
  | "complex";

// ========== Structure Layer (consumed by the renderer) ==========
export type LayoutType = "full-width" | "constrained" | "grid" | "columns";

export interface LayoutDescriptor {
  type: LayoutType;
  columns?: number;
  gap?: "sm" | "md" | "lg";
  contentWidth?: string;
  verticalAlign?: "top" | "center" | "bottom";
}

// ========== Content Nodes (recursive tree) ==========
export type NodeType =
  | "heading"
  | "paragraph"
  | "image"
  | "button"
  | "list"
  | "spacer"
  | "group"
  | "navigation";

export interface NodeAttributes {
  // heading
  level?: 1 | 2 | 3 | 4 | 5 | 6;

  // image
  src?: string;
  alt?: string;
  width?: number;
  height?: number;

  // button
  href?: string;
  variant?: "primary" | "secondary" | "outline";

  // list
  ordered?: boolean;
  items?: string[];

  // navigation
  links?: Array<{ text: string; href: string }>;

  // common style tokens
  fontSize?: "sm" | "md" | "lg" | "xl";
  textAlign?: "left" | "center" | "right";
  backgroundColor?: string;
  textColor?: string;
  padding?: "sm" | "md" | "lg" | "xl";
}

export interface IRNode {
  type: NodeType;
  content?: string;
  attributes: NodeAttributes;
  children?: IRNode[];
  motionIntent?: MotionIntent;
  style?: Record<string, string>;
  className?: string;
}

// ========== Section (a visual region of the page) ==========
export interface IRSection {
  sectionIntent: string; // intentionally loose — mislabeling does not affect rendering
  layout: LayoutDescriptor;
  children: IRNode[];
  motionIntent?: MotionIntent;
  background?: {
    type: "color" | "image" | "gradient";
    value: string;
  };
  style?: Record<string, string>;
  className?: string;
}

// ========== Design Tokens (maps to theme.json) ==========
export interface DesignTokens {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    foreground: string;
    accent?: string;
    muted?: string;
  };
  fonts: {
    heading?: string;
    body?: string;
  };
  borderRadius?: "none" | "sm" | "md" | "lg" | "full";
}

// ========== Top-level document structure ==========
export interface IRDocument {
  version: "1.0";
  metadata: {
    title: string;
    description?: string;
    sourceUrl?: string;
  };
  designTokens: DesignTokens;
  header?: IRSection;
  sections: IRSection[];
  footer?: IRSection;
  customCSS?: string;
}

// ========== App-level types ==========
export interface PreprocessStats {
  originalLength: number;
  cleanedLength: number;
  tokenSavings: string;
  svgsSimplified: number;
  scriptsRemoved: number;
}

export interface AnalysisSummary {
  sectionCount: number;
  hasHeader: boolean;
  hasFooter: boolean;
  designTokens: DesignTokens;
  motionDowngrades: number;
  externalImages: number;
  hasCustomCSS: boolean;
  classNameCount: number;
}

export type AppErrorType =
  | "INVALID_API_KEY"
  | "RATE_LIMITED"
  | "TOKEN_OVERFLOW"
  | "INVALID_RESPONSE"
  | "SCHEMA_VIOLATION"
  | "NETWORK_ERROR";

export interface AppError {
  type: AppErrorType;
  message: string;
  detail?: string;
}
