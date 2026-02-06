/**
 * Generate custom.css from extracted CSS.
 * Always returns a file (header-only when CSS is empty).
 */
export function generateCustomCss(rawCSS: string | undefined): string {
  const header = `/* Custom CSS extracted from AI-generated HTML */\n\n`;
  if (!rawCSS || rawCSS.trim().length === 0) return header;
  return header + rawCSS.trim() + "\n";
}
