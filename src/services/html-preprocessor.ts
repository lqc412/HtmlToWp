import * as cheerio from "cheerio";
import type { Element as CheerioElement } from "domhandler";
import type { PreprocessStats } from "../types/ir";

function hasAttribs(node: unknown): node is CheerioElement {
  return typeof node === "object" && node !== null && "attribs" in node;
}

/**
 * Preprocess raw HTML before sending to LLM.
 * Goals: reduce token count, strip non-semantic noise, simplify SVGs.
 */
export function preprocessHTML(rawHtml: string): {
  html: string;
  extractedCSS: string;
  stats: PreprocessStats;
} {
  const originalLength = rawHtml.length;
  let scriptsRemoved = 0;
  let svgsSimplified = 0;

  const $ = cheerio.load(rawHtml, { xmlMode: false });

  // 1. Remove <script> and <noscript> tags
  $("script, noscript").each(() => {
    scriptsRemoved++;
  });
  $("script, noscript").remove();

  // 2. Extract <style> contents for custom.css, keep tags in HTML for LLM
  const styleContents: string[] = [];
  $("style").each(function () {
    styleContents.push($(this).html() || "");
  });
  const extractedCSS = styleContents.join("\n\n");

  // 3. Remove HTML comments
  $("*")
    .contents()
    .filter(function () {
      return this.type === "comment";
    })
    .remove();

  // 4. Remove data-* attributes and framework-specific attributes
  $("*").each(function () {
    if (!hasAttribs(this)) return;
    const el = $(this);
    const attribs = this.attribs;
    for (const attr of Object.keys(attribs)) {
      if (
        attr.startsWith("data-") ||
        // React/Next.js internals
        attr.startsWith("suppresshydrationwarning") ||
        // Angular
        attr.startsWith("ng-") ||
        attr.startsWith("_ng") ||
        // Vue
        attr.startsWith("v-") ||
        attr.startsWith(":") ||
        attr.startsWith("@")
      ) {
        el.removeAttr(attr);
      }
    }
  });

  // 5. Simplify SVGs: keep viewBox+path, strip noise
  $("svg").each(function () {
    svgsSimplified++;
    const svg = $(this);
    const viewBox = svg.attr("viewBox") || "0 0 24 24";

    // Extract all <path> d attributes
    const paths: string[] = [];
    svg.find("path").each(function () {
      const d = $(this).attr("d");
      if (d) paths.push(d);
    });

    // Replace entire SVG with simplified version
    if (paths.length > 0) {
      const simplifiedPaths = paths
        .map((d) => `<path d="${d}" fill="currentColor"/>`)
        .join("");
      svg.empty();
      svg.html(simplifiedPaths);

      // Strip all attributes except viewBox, width, height, class
      const keepAttrs = ["viewBox", "width", "height", "class"];
      const allAttrs = hasAttribs(this) ? Object.keys(this.attribs) : [];
      for (const attr of allAttrs) {
        if (!keepAttrs.includes(attr)) {
          svg.removeAttr(attr);
        }
      }
      svg.attr("viewBox", viewBox);
    }
  });

  // 6. Remove empty attributes (class="", style="")
  $("*").each(function () {
    if (!hasAttribs(this)) return;
    const attribs = this.attribs;
    for (const [attr, val] of Object.entries(attribs)) {
      if (val === "" && attr !== "alt") {
        $(this).removeAttr(attr);
      }
    }
  });

  // 7. Collapse whitespace in the output
  let html = $.html();
  html = html
    .replace(/\n\s*\n/g, "\n")
    .replace(/\s{2,}/g, " ")
    .trim();

  const cleanedLength = html.length;
  const savings =
    originalLength > 0
      ? Math.round(((originalLength - cleanedLength) / originalLength) * 100)
      : 0;

  return {
    html,
    extractedCSS,
    stats: {
      originalLength,
      cleanedLength,
      tokenSavings: `${savings}% reduced`,
      svgsSimplified,
      scriptsRemoved,
    },
  };
}
