/**
 * Generate style.css — the required WordPress theme declaration header.
 * This file contains only the comment header; all actual styling
 * is handled by theme.json and block inline styles.
 */

import type { IRDocument } from "../../types/ir";
import { slugify } from "../../lib/utils";

export function generateStyleCss(ir: IRDocument): string {
  const title = ir.metadata.title || "AI Generated Theme";
  const slug = slugify(title);
  const description =
    ir.metadata.description ||
    "WordPress Block Theme generated from AI HTML by AI Theme Converter.";

  return `/*
Theme Name: ${title}
Theme URI: https://github.com/ai-theme-converter
Author: AI Theme Converter
Author URI: https://github.com/ai-theme-converter
Description: ${description}
Version: 1.0.0
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 7.4
License: GPL-2.0-or-later
License URI: https://www.gnu.org/licenses/gpl-2.0.html
Text Domain: ${slug}
*/
`;
}
