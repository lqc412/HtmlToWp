import { z } from "zod";

// ========== Enums & Primitives ==========

const MotionIntentSchema = z.enum([
  "static",
  "fade-in",
  "slide-up",
  "parallax",
  "hover-reveal",
  "complex",
]);

const LayoutTypeSchema = z.enum([
  "full-width",
  "constrained",
  "grid",
  "columns",
]);

const NodeTypeSchema = z.enum([
  "heading",
  "paragraph",
  "image",
  "button",
  "list",
  "spacer",
  "group",
  "navigation",
]);

const HeadingLevelSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

// ========== Sub-schemas ==========

const LayoutDescriptorSchema = z.object({
  type: LayoutTypeSchema,
  columns: z.number().optional(),
  gap: z.enum(["sm", "md", "lg"]).optional(),
  contentWidth: z.string().optional(),
  verticalAlign: z.enum(["top", "center", "bottom"]).optional(),
});

// Use .passthrough() to tolerate extra fields from LLM output
const NodeAttributesSchema = z
  .object({
    level: HeadingLevelSchema.optional(),
    src: z.string().optional(),
    alt: z.string().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    href: z.string().optional(),
    variant: z.enum(["primary", "secondary", "outline"]).optional(),
    ordered: z.boolean().optional(),
    items: z.array(z.string()).optional(),
    links: z
      .array(z.object({ text: z.string(), href: z.string() }))
      .optional(),
    fontSize: z.enum(["sm", "md", "lg", "xl"]).optional(),
    textAlign: z.enum(["left", "center", "right"]).optional(),
    backgroundColor: z.string().optional(),
    textColor: z.string().optional(),
    padding: z.enum(["sm", "md", "lg", "xl"]).optional(),
  })
  .passthrough();

const StyleRecordSchema = z.record(z.string(), z.string()).optional();

// ========== Recursive Node Schema ==========

const IRNodeSchema: z.ZodType<{
  type: string;
  content?: string;
  attributes?: Record<string, unknown>;
  children?: unknown[];
  motionIntent?: string;
  style?: Record<string, string>;
  className?: string;
}> = z.lazy(() =>
  z.object({
    type: NodeTypeSchema,
    content: z.string().optional(),
    attributes: NodeAttributesSchema.optional().default({}),
    children: z.array(IRNodeSchema).optional(),
    motionIntent: MotionIntentSchema.optional(),
    style: StyleRecordSchema,
    className: z.string().optional(),
  }),
);

// ========== Section Schema ==========

const BackgroundSchema = z.object({
  type: z.enum(["color", "image", "gradient"]),
  value: z.string(),
});

const IRSectionSchema = z.object({
  sectionIntent: z.string(), // intentionally loose — not restricted to enum
  layout: LayoutDescriptorSchema,
  children: z.array(IRNodeSchema),
  motionIntent: MotionIntentSchema.optional(),
  background: BackgroundSchema.optional(),
  style: StyleRecordSchema,
  className: z.string().optional(),
});

// ========== Design Tokens ==========

const DesignTokensSchema = z.object({
  colors: z.object({
    primary: z.string(),
    secondary: z.string(),
    background: z.string(),
    foreground: z.string(),
    accent: z.string().optional(),
    muted: z.string().optional(),
  }),
  fonts: z.object({
    heading: z.string().optional(),
    body: z.string().optional(),
  }),
  borderRadius: z.enum(["none", "sm", "md", "lg", "full"]).optional(),
});

// ========== Top-level Document ==========

export const IRDocumentSchema = z.object({
  version: z.literal("1.0"),
  metadata: z.object({
    title: z.string(),
    description: z.string().optional(),
    sourceUrl: z.string().optional(),
  }),
  designTokens: DesignTokensSchema,
  header: IRSectionSchema.optional(),
  sections: z.array(IRSectionSchema).min(1),
  footer: IRSectionSchema.optional(),
});

// Export sub-schemas for testing / reuse
export {
  IRNodeSchema,
  IRSectionSchema,
  DesignTokensSchema,
  NodeAttributesSchema,
  LayoutDescriptorSchema,
  MotionIntentSchema,
};
