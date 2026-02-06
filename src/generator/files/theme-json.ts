/**
 * Generate theme.json from IRDocument design tokens.
 * Uses WordPress theme.json v2 schema (compatible with WP 6.0+).
 */

import type { IRDocument } from "../../types/ir";

export function generateThemeJson(ir: IRDocument): string {
  const { colors, fonts, borderRadius } = ir.designTokens;

  const palette = [
    { slug: "primary", color: colors.primary, name: "Primary" },
    { slug: "secondary", color: colors.secondary, name: "Secondary" },
    { slug: "background", color: colors.background, name: "Background" },
    { slug: "foreground", color: colors.foreground, name: "Foreground" },
  ];
  if (colors.accent) {
    palette.push({ slug: "accent", color: colors.accent, name: "Accent" });
  }
  if (colors.muted) {
    palette.push({ slug: "muted", color: colors.muted, name: "Muted" });
  }

  const fontFamilies: Array<{
    fontFamily: string;
    slug: string;
    name: string;
  }> = [];
  if (fonts.heading) {
    fontFamilies.push({
      fontFamily: `${fonts.heading}, sans-serif`,
      slug: "heading",
      name: "Heading",
    });
  }
  if (fonts.body) {
    fontFamilies.push({
      fontFamily: `${fonts.body}, sans-serif`,
      slug: "body",
      name: "Body",
    });
  }

  const themeJson: Record<string, unknown> = {
    $schema: "https://schemas.wp.org/trunk/theme.json",
    version: 2,
    settings: {
      color: {
        palette,
        defaultPalette: false,
      },
      typography: {
        fontFamilies: fontFamilies.length > 0 ? fontFamilies : undefined,
        fontSizes: [
          { slug: "small", size: "14px", name: "Small" },
          { slug: "medium", size: "18px", name: "Medium" },
          { slug: "large", size: "24px", name: "Large" },
          { slug: "x-large", size: "36px", name: "Extra Large" },
          { slug: "xx-large", size: "48px", name: "2X Large" },
          { slug: "huge", size: "64px", name: "Huge" },
          { slug: "gigantic", size: "96px", name: "Gigantic" },
          { slug: "display", size: "140px", name: "Display" },
        ],
      },
      layout: {
        contentSize: "1200px",
        wideSize: "1920px",
      },
      spacing: {
        units: ["px", "em", "rem", "%"],
      },
      appearanceTools: true,
    },
    styles: {
      color: {
        background: colors.background,
        text: colors.foreground,
      },
      typography: fonts.body
        ? { fontFamily: `var(--wp--preset--font-family--body)` }
        : undefined,
      elements: {
        heading: fonts.heading
          ? {
              typography: {
                fontFamily: `var(--wp--preset--font-family--heading)`,
              },
            }
          : undefined,
        button: {
          color: {
            background: `var(--wp--preset--color--primary)`,
            text: "#ffffff",
          },
          ...(borderRadius
            ? {
                border: {
                  radius: borderRadiusToCSS(borderRadius),
                },
              }
            : {}),
        },
        link: {
          color: {
            text: `var(--wp--preset--color--primary)`,
          },
        },
      },
    },
    templateParts: buildTemplateParts(ir),
  };

  return JSON.stringify(themeJson, null, 2);
}

function borderRadiusToCSS(
  radius: "none" | "sm" | "md" | "lg" | "full",
): string {
  const map: Record<string, string> = {
    none: "0",
    sm: "4px",
    md: "8px",
    lg: "16px",
    full: "9999px",
  };
  return map[radius] || "8px";
}

function buildTemplateParts(
  ir: IRDocument,
): Array<{ name: string; title: string; area: string }> {
  const parts: Array<{ name: string; title: string; area: string }> = [];
  if (ir.header) {
    parts.push({ name: "header", title: "Header", area: "header" });
  }
  if (ir.footer) {
    parts.push({ name: "footer", title: "Footer", area: "footer" });
  }
  return parts.length > 0 ? parts : [{ name: "header", title: "Header", area: "header" }];
}
