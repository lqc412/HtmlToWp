/**
 * Entry point: IRDocument → WordPress Block Theme .zip Blob.
 *
 * Orchestrates block-renderer + file generators, then packages
 * everything with JSZip.
 */

import JSZip from "jszip";
import type { IRDocument } from "../types/ir";
import { slugify } from "../lib/utils";
import { renderTemplate, renderSection } from "./block-renderer";
import { generateThemeJson } from "./files/theme-json";
import { generateStyleCss } from "./files/style-css";
import { generateFunctionsPhp } from "./files/functions-php";
import { generateCustomCss } from "./files/custom-css";

export async function generateThemeZip(ir: IRDocument): Promise<Blob> {
  const tokens = ir.designTokens;
  const slug = slugify(ir.metadata.title || "ai-theme");

  const zip = new JSZip();
  const root = zip.folder(slug)!;

  // style.css (required)
  root.file("style.css", generateStyleCss(ir));

  // theme.json
  root.file("theme.json", generateThemeJson(ir));

  // functions.php
  root.file("functions.php", generateFunctionsPhp(ir));

  // assets/css/custom.css (always generated)
  const customCss = generateCustomCss(ir.customCSS);
  root.file("assets/css/custom.css", customCss);

  // templates/index.html
  const templates = root.folder("templates")!;
  const indexHtml = renderTemplate(
    ir.sections,
    tokens,
    !!ir.header,
    !!ir.footer,
  );
  templates.file("index.html", indexHtml);

  // parts/header.html (if header section exists)
  if (ir.header) {
    const parts = root.folder("parts")!;
    parts.file("header.html", renderSection(ir.header, tokens));
  }

  // parts/footer.html (if footer section exists)
  if (ir.footer) {
    const parts = root.folder("parts")!;
    parts.file("footer.html", renderSection(ir.footer, tokens));
  }

  return zip.generateAsync({ type: "blob" });
}
