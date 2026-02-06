/**
 * Generate functions.php — theme feature registration.
 * Minimal for block themes; most configuration lives in theme.json.
 */

import type { IRDocument } from "../../types/ir";
import { slugify } from "../../lib/utils";

export function generateFunctionsPhp(ir: IRDocument): string {
  const slug = slugify(ir.metadata.title || "ai-theme");
  const prefix = slug.replace(/-/g, "_");
  const googleFontsUrl = buildGoogleFontsUrl(ir.designTokens.fonts);

  let php = `<?php
/**
 * Theme functions and definitions.
 *
 * @package ${slug}
 */

if ( ! defined( 'ABSPATH' ) ) {
\texit;
}

function ${prefix}_setup() {
\tadd_theme_support( 'wp-block-styles' );
\tadd_theme_support( 'editor-styles' );
}
add_action( 'after_setup_theme', '${prefix}_setup' );
`;

  // Enqueue Google Fonts + custom CSS on frontend + editor
  php += `
function ${prefix}_enqueue_styles() {`;
  if (googleFontsUrl) {
    php += `
\twp_enqueue_style( '${slug}-google-fonts', '${googleFontsUrl}', array(), null );`;
  }
  php += `
\twp_enqueue_style( '${slug}-custom', get_template_directory_uri() . '/assets/css/custom.css', array(), '1.0.0' );
}
add_action( 'wp_enqueue_scripts', '${prefix}_enqueue_styles' );

function ${prefix}_enqueue_editor_assets() {`;
  if (googleFontsUrl) {
    php += `
\twp_enqueue_style( '${slug}-google-fonts', '${googleFontsUrl}', array(), null );`;
  }
  php += `
\twp_enqueue_style( '${slug}-custom', get_template_directory_uri() . '/assets/css/custom.css', array(), '1.0.0' );
}
add_action( 'enqueue_block_editor_assets', '${prefix}_enqueue_editor_assets' );
`;

  return php;
}

/**
 * Build a Google Fonts URL from the IR font tokens.
 * Returns null if no fonts are specified.
 */
function buildGoogleFontsUrl(
  fonts: { heading?: string; body?: string },
): string | null {
  const families: string[] = [];
  const seen = new Set<string>();

  for (const font of [fonts.heading, fonts.body]) {
    if (!font || seen.has(font)) continue;
    seen.add(font);
    // Google Fonts URL format: family=Font+Name:wght@400;700
    const encoded = font.replace(/ /g, "+");
    families.push(`family=${encoded}:wght@400;500;600;700`);
  }

  if (families.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${families.join("&")}&display=swap`;
}
