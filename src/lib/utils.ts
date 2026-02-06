/**
 * Escape HTML special characters to prevent XSS in generated markup.
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Escape a string for use in HTML attribute values.
 */
export function escapeAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Convert a human-readable name to a URL/directory-safe slug.
 * "My AI Theme" → "my-ai-theme"
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Split array into N consecutive chunks (not round-robin).
 * E.g. [a,b,c,d,e] with 2 buckets → [[a,b,c], [d,e]]
 * Used for splitting section children into columns.
 */
export function chunkArray<T>(arr: T[], buckets: number): T[][] {
  const result: T[][] = [];
  const chunkSize = Math.ceil(arr.length / buckets);
  for (let i = 0; i < buckets; i++) {
    result.push(arr.slice(i * chunkSize, (i + 1) * chunkSize));
  }
  return result.filter(chunk => chunk.length > 0);
}

/**
 * Map IR font size tokens to WordPress font size preset slugs.
 */
export function mapFontSize(
  size?: "sm" | "md" | "lg" | "xl",
): string | undefined {
  if (!size) return undefined;
  const map: Record<string, string> = {
    sm: "small",
    md: "medium",
    lg: "large",
    xl: "x-large",
  };
  return map[size];
}

/**
 * Map IR border radius tokens to CSS values.
 */
export function mapBorderRadius(
  radius?: "none" | "sm" | "md" | "lg" | "full",
): string {
  const map: Record<string, string> = {
    none: "0",
    sm: "4px",
    md: "8px",
    lg: "16px",
    full: "9999px",
  };
  return map[radius || "md"];
}

/**
 * Strip markdown code fences from LLM JSON output.
 * Some LLMs wrap JSON in ```json ... ``` even in JSON mode.
 */
export function sanitizeJSON(raw: string): string {
  return raw
    .replace(/^```json?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .trim();
}
