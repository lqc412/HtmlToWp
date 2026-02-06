/**
 * IR → WordPress Block Markup renderer.
 *
 * Each IRNode maps to one or more WordPress block comments + HTML.
 * The JSON attributes in block comments MUST match the HTML structure
 * exactly — the WP parser is strict about this.
 *
 * KEY RULE: Inline styles in HTML must be generated FROM the block JSON
 * style object, matching WP's exact format. Never add extra inline
 * styles that aren't in the block JSON — WP will reject them.
 * Non-WP CSS goes through className + custom.css.
 */

import { escapeHtml, escapeAttr, chunkArray, mapFontSize } from "../lib/utils";
import type {
  IRNode,
  IRSection,
  DesignTokens,
  NodeAttributes,
} from "../types/ir";

// ── Spacing maps ──

const PADDING_MAP: Record<string, string> = {
  sm: "10px",
  md: "20px",
  lg: "40px",
  xl: "60px",
};

const GAP_MAP: Record<string, string> = {
  sm: "10px",
  md: "20px",
  lg: "40px",
};

// ── Block markup helpers ──

function block(
  name: string,
  attrs: Record<string, unknown>,
  inner: string,
): string {
  const cleaned = cleanObj(attrs);
  const json =
    Object.keys(cleaned).length > 0 ? ` ${JSON.stringify(cleaned)}` : "";
  return `<!-- wp:${name}${json} -->\n${inner}\n<!-- /wp:${name} -->`;
}

function selfClosingBlock(
  name: string,
  attrs: Record<string, unknown>,
): string {
  const cleaned = cleanObj(attrs);
  const json =
    Object.keys(cleaned).length > 0 ? ` ${JSON.stringify(cleaned)}` : "";
  return `<!-- wp:${name}${json} /-->`;
}

/**
 * Generate inline style string from WP block style object.
 * MUST match WordPress's exact output format for block validation.
 */
function wpInlineStyle(blockStyle: Record<string, unknown> | undefined): string {
  if (!blockStyle) return "";
  const styles: string[] = [];

  // Typography
  const typo = blockStyle.typography as Record<string, string> | undefined;
  if (typo?.fontSize) styles.push(`font-size:${typo.fontSize}`);
  if (typo?.lineHeight) styles.push(`line-height:${typo.lineHeight}`);
  if (typo?.letterSpacing) styles.push(`letter-spacing:${typo.letterSpacing}`);
  if (typo?.textTransform) styles.push(`text-transform:${typo.textTransform}`);

  // Color
  const color = blockStyle.color as Record<string, string> | undefined;
  if (color?.text) styles.push(`color:${color.text}`);
  if (color?.background) styles.push(`background-color:${color.background}`);
  if (color?.gradient) styles.push(`background:${color.gradient}`);

  // Spacing - padding
  const spacing = blockStyle.spacing as Record<string, unknown> | undefined;
  if (spacing?.padding) {
    const p = spacing.padding;
    if (typeof p === "object" && p !== null) {
      const pad = p as Record<string, string>;
      if (pad.top) styles.push(`padding-top:${pad.top}`);
      if (pad.right) styles.push(`padding-right:${pad.right}`);
      if (pad.bottom) styles.push(`padding-bottom:${pad.bottom}`);
      if (pad.left) styles.push(`padding-left:${pad.left}`);
    }
  }

  // Spacing - margin
  if (spacing?.margin) {
    const m = spacing.margin;
    if (typeof m === "object" && m !== null) {
      const mar = m as Record<string, string>;
      if (mar.top) styles.push(`margin-top:${mar.top}`);
      if (mar.right) styles.push(`margin-right:${mar.right}`);
      if (mar.bottom) styles.push(`margin-bottom:${mar.bottom}`);
      if (mar.left) styles.push(`margin-left:${mar.left}`);
    }
  }

  // Spacing - blockGap (used by wp:columns and wp:group with grid/flex)
  if (spacing?.blockGap) {
    const bg = spacing.blockGap;
    if (typeof bg === "string") {
      styles.push(`gap:${bg}`);
    } else if (typeof bg === "object" && bg !== null) {
      const gap = bg as Record<string, string>;
      if (gap.top && gap.left) styles.push(`gap:${gap.top} ${gap.left}`);
      else if (gap.top) styles.push(`gap:${gap.top}`);
      else if (gap.left) styles.push(`gap:${gap.left}`);
    }
  }

  // Border
  const border = blockStyle.border as Record<string, string> | undefined;
  if (border?.radius) styles.push(`border-radius:${border.radius}`);

  if (styles.length === 0) return "";
  return ` style="${styles.join(";")}"`;
}

/** Recursively strip undefined/null/empty values from an object. */
function cleanObj(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "object" && !Array.isArray(value)) {
      const nested = cleanObj(value as Record<string, unknown>);
      if (Object.keys(nested).length > 0) result[key] = nested;
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ── className helper ──

/** Add original CSS class names to WP block attributes and HTML classes. */
function applyClassName(
  className: string | undefined,
  blockAttrs: Record<string, unknown>,
  cssClasses: string[],
): void {
  if (!className) return;
  blockAttrs.className = className;
  cssClasses.push(...className.split(" ").filter(Boolean));
}

function layoutClassFromType(type: string | undefined): string | undefined {
  switch (type) {
    case "constrained":
      return "is-layout-constrained";
    case "grid":
      return "is-layout-grid";
    case "flex":
      return "is-layout-flex";
    case "default":
      return "is-layout-flow";
    default:
      return undefined;
  }
}

// ── Build WP block style from IR attributes ──

interface StyleResult {
  blockStyle: Record<string, unknown>;
  classes: string[];
}

/**
 * Build WP-compatible block style object from IR attributes and style record.
 * ONLY puts WP-compatible properties in blockStyle.
 * Non-WP CSS is left to className + custom.css.
 */
function buildBlockStyle(attrs: NodeAttributes, irStyle?: Record<string, string>): StyleResult {
  const blockStyle: Record<string, unknown> = {};
  const classes: string[] = [];

  // Color from attributes
  if (attrs.textColor) {
    blockStyle.color = { ...(blockStyle.color as object), text: attrs.textColor };
    classes.push("has-text-color");
  }
  if (attrs.backgroundColor) {
    blockStyle.color = { ...(blockStyle.color as object), background: attrs.backgroundColor };
    classes.push("has-background");
  }

  // Padding from attributes (enum → expanded object)
  if (attrs.padding) {
    const val = PADDING_MAP[attrs.padding];
    if (val) {
      blockStyle.spacing = { padding: { top: val, right: val, bottom: val, left: val } };
    }
  }

  // Map WP-compatible properties from irStyle
  if (irStyle) {
    if (irStyle["font-size"]) {
      blockStyle.typography = { ...(blockStyle.typography as object), fontSize: irStyle["font-size"] };
    }
    if (irStyle["line-height"]) {
      blockStyle.typography = { ...(blockStyle.typography as object), lineHeight: irStyle["line-height"] };
    }
    if (irStyle["letter-spacing"]) {
      blockStyle.typography = { ...(blockStyle.typography as object), letterSpacing: irStyle["letter-spacing"] };
    }
    if (irStyle["text-transform"]) {
      blockStyle.typography = { ...(blockStyle.typography as object), textTransform: irStyle["text-transform"] };
    }
    if (irStyle["background-color"] && !attrs.backgroundColor) {
      blockStyle.color = { ...(blockStyle.color as object), background: irStyle["background-color"] };
      classes.push("has-background");
    }
    if (irStyle["color"] && !attrs.textColor) {
      blockStyle.color = { ...(blockStyle.color as object), text: irStyle["color"] };
      classes.push("has-text-color");
    }
  }

  return { blockStyle, classes };
}

// ── Node renderers ──

function renderHeading(node: IRNode, tokens: DesignTokens): string {
  const { attributes, content = "", style: irStyle, className } = node;
  const level = attributes.level || 2;
  const tag = `h${level}`;

  const blockAttrs: Record<string, unknown> = { level };
  const cssClasses = ["wp-block-heading"];

  if (attributes.textAlign) {
    blockAttrs.textAlign = attributes.textAlign;
    cssClasses.push(`has-text-align-${attributes.textAlign}`);
  }

  const fontSize = mapFontSize(attributes.fontSize);
  if (fontSize) {
    blockAttrs.fontSize = fontSize;
    cssClasses.push(`has-${fontSize}-font-size`);
  }

  // Use WP font family preset if heading font is defined
  if (tokens.fonts.heading) {
    blockAttrs.fontFamily = "heading";
    cssClasses.push("has-heading-font-family");
  }

  const { blockStyle, classes } = buildBlockStyle(attributes, irStyle);
  if (Object.keys(blockStyle).length > 0) blockAttrs.style = blockStyle;
  cssClasses.push(...classes);
  applyClassName(className, blockAttrs, cssClasses);

  const classAttr = cssClasses.length > 0 ? ` class="${cssClasses.join(" ")}"` : "";
  const styleAttr = wpInlineStyle(blockAttrs.style as Record<string, unknown>);

  return block(
    "heading",
    blockAttrs,
    `<${tag}${classAttr}${styleAttr}>${escapeHtml(content)}</${tag}>`,
  );
}

function renderParagraph(node: IRNode, tokens: DesignTokens): string {
  const { attributes, content = "", style: irStyle, className } = node;

  const blockAttrs: Record<string, unknown> = {};
  const cssClasses: string[] = [];

  if (attributes.textAlign) {
    blockAttrs.align = attributes.textAlign;
    cssClasses.push(`has-text-align-${attributes.textAlign}`);
  }

  const fontSize = mapFontSize(attributes.fontSize);
  if (fontSize) {
    blockAttrs.fontSize = fontSize;
    cssClasses.push(`has-${fontSize}-font-size`);
  }

  // Use WP font family preset if body font is defined
  if (tokens.fonts.body) {
    blockAttrs.fontFamily = "body";
    cssClasses.push("has-body-font-family");
  }

  const { blockStyle, classes } = buildBlockStyle(attributes, irStyle);
  if (Object.keys(blockStyle).length > 0) blockAttrs.style = blockStyle;
  cssClasses.push(...classes);
  applyClassName(className, blockAttrs, cssClasses);

  const classAttr = cssClasses.length > 0 ? ` class="${cssClasses.join(" ")}"` : "";
  const styleAttr = wpInlineStyle(blockAttrs.style as Record<string, unknown>);

  return block(
    "paragraph",
    blockAttrs,
    `<p${classAttr}${styleAttr}>${escapeHtml(content)}</p>`,
  );
}

function renderImage(node: IRNode): string {
  const { attributes, className } = node;
  const src = attributes.src || "";
  const alt = attributes.alt || "";

  const blockAttrs: Record<string, unknown> = {
    sizeSlug: "full",
    linkDestination: "none",
  };
  const cssClasses = ["wp-block-image", "size-full"];

  if (attributes.width) blockAttrs.width = attributes.width;
  if (attributes.height) blockAttrs.height = attributes.height;
  applyClassName(className, blockAttrs, cssClasses);

  const imgAttrs = [
    `src="${escapeAttr(src)}"`,
    `alt="${escapeAttr(alt)}"`,
  ];
  if (attributes.width) imgAttrs.push(`width="${attributes.width}"`);
  if (attributes.height) imgAttrs.push(`height="${attributes.height}"`);

  return block(
    "image",
    blockAttrs,
    `<figure class="${cssClasses.join(" ")}"><img ${imgAttrs.join(" ")}/></figure>`,
  );
}

function renderButton(node: IRNode, _tokens: DesignTokens): string {
  const { attributes, content = "", className } = node;
  const href = attributes.href || "#";
  const variant = attributes.variant || "primary";

  const btnAttrs: Record<string, unknown> = {};
  const btnClasses = ["wp-block-button__link", "wp-element-button"];

  // Use WP preset CSS vars → user changes color in Site Editor → all buttons update
  if (variant === "primary") {
    btnAttrs.backgroundColor = "primary";
    btnAttrs.textColor = "background";
    btnClasses.push("has-primary-background-color", "has-background-color-color", "has-text-color", "has-background");
  } else if (variant === "secondary") {
    btnAttrs.backgroundColor = "secondary";
    btnAttrs.textColor = "background";
    btnClasses.push("has-secondary-background-color", "has-background-color-color", "has-text-color", "has-background");
  } else if (variant === "outline") {
    btnAttrs.textColor = "primary";
    btnAttrs.style = {
      border: { width: "2px", style: "solid" },
    };
    btnClasses.push("has-primary-color", "has-text-color", "is-style-outline");
  }

  applyClassName(className, btnAttrs, btnClasses);

  const styleAttr = wpInlineStyle(btnAttrs.style as Record<string, unknown>);

  // wp:button MUST be wrapped in wp:buttons
  const innerButton = block(
    "button",
    btnAttrs,
    `<div class="wp-block-button"><a class="${btnClasses.join(" ")}" href="${escapeAttr(href)}"${styleAttr}>${escapeHtml(content)}</a></div>`,
  );

  const buttonsClasses = ["wp-block-buttons", "is-layout-flex"];

  return block(
    "buttons",
    {},
    `<div class="${buttonsClasses.join(" ")}">\n${innerButton}\n</div>`,
  );
}

function renderList(node: IRNode): string {
  const { attributes, className } = node;
  const ordered = attributes.ordered || false;
  const items = attributes.items || [];
  const tag = ordered ? "ol" : "ul";

  const blockAttrs: Record<string, unknown> = {};
  const cssClasses = ["wp-block-list"];
  if (ordered) blockAttrs.ordered = true;
  applyClassName(className, blockAttrs, cssClasses);

  const listItems = items
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("\n");

  return block(
    "list",
    blockAttrs,
    `<${tag} class="${cssClasses.join(" ")}">\n${listItems}\n</${tag}>`,
  );
}

function renderSpacer(node: IRNode): string {
  const height = PADDING_MAP[node.attributes.padding || "md"] || "40px";
  return block(
    "spacer",
    { height },
    `<div style="height:${height}" aria-hidden="true" class="wp-block-spacer"></div>`,
  );
}

function renderGroup(node: IRNode, tokens: DesignTokens): string {
  const { children = [], attributes, style: irStyle, className } = node;

  // Detect grid/flex layout from irStyle
  const display = irStyle?.["display"];
  let layoutAttr: Record<string, unknown> = { type: "constrained" };
  if (display === "grid") {
    layoutAttr = { type: "grid", minimumColumnWidth: "280px" };
  } else if (display === "flex") {
    layoutAttr = { type: "flex", flexWrap: "nowrap" };
  }

  const blockAttrs: Record<string, unknown> = { layout: layoutAttr };
  const cssClasses = ["wp-block-group"];
  const layoutClass = layoutClassFromType(layoutAttr.type as string | undefined);
  if (layoutClass) cssClasses.push(layoutClass);

  const { blockStyle, classes } = buildBlockStyle(attributes, irStyle);

  // Map gap from irStyle to WP spacing.blockGap
  if (irStyle?.["gap"]) {
    blockStyle.spacing = {
      ...(blockStyle.spacing as object),
      blockGap: irStyle["gap"],
    };
  }

  if (Object.keys(blockStyle).length > 0) blockAttrs.style = blockStyle;
  cssClasses.push(...classes);
  applyClassName(className, blockAttrs, cssClasses);

  const classAttr = ` class="${cssClasses.join(" ")}"`;
  const styleAttr = wpInlineStyle(blockAttrs.style as Record<string, unknown>);

  const inner = children.map((c) => renderNode(c, tokens)).join("\n\n");

  return block(
    "group",
    blockAttrs,
    `<div${classAttr}${styleAttr}>\n${inner}\n</div>`,
  );
}

/**
 * Navigation is downgraded to text links in a flex group for MVP.
 * Real wp:navigation block requires saved menu entities.
 */
function renderNavigation(node: IRNode, _tokens: DesignTokens): string {
  const { className } = node;
  const links = node.attributes.links || [];

  const blockAttrs: Record<string, unknown> = {
    layout: { type: "flex", flexWrap: "nowrap" },
  };
  const cssClasses = ["wp-block-group"];
  const layoutClass = layoutClassFromType("flex");
  if (layoutClass) cssClasses.push(layoutClass);
  applyClassName(className, blockAttrs, cssClasses);

  const linkBlocks = links
    .map((link) => {
      const inner = `<p><a href="${escapeAttr(link.href)}">${escapeHtml(link.text)}</a></p>`;
      return block("paragraph", {}, inner);
    })
    .join("\n\n");

  return block(
    "group",
    blockAttrs,
    `<div class="${cssClasses.join(" ")}">\n${linkBlocks}\n</div>`,
  );
}

// ── Main node renderer ──

export function renderNode(node: IRNode, tokens: DesignTokens): string {
  switch (node.type) {
    case "heading":
      return renderHeading(node, tokens);
    case "paragraph":
      return renderParagraph(node, tokens);
    case "image":
      return renderImage(node);
    case "button":
      return renderButton(node, tokens);
    case "list":
      return renderList(node);
    case "spacer":
      return renderSpacer(node);
    case "group":
      return renderGroup(node, tokens);
    case "navigation":
      return renderNavigation(node, tokens);
    default:
      return `<!-- Unsupported node type: ${(node as IRNode).type} -->`;
  }
}

// ── Section renderer ──

function renderChildrenForLayout(
  section: IRSection,
  tokens: DesignTokens,
): string {
  const { layout, children } = section;

  if (layout.type === "columns") {
    const numCols = layout.columns || 2;
    const columns = chunkArray(children, numCols);
    const gap = layout.gap ? GAP_MAP[layout.gap] : undefined;

    const colAttrs: Record<string, unknown> = {};
    if (gap) {
      colAttrs.style = { spacing: { blockGap: { top: gap, left: gap } } };
    }

    const columnBlocks = columns
      .map((colChildren) => {
        const inner = colChildren
          .map((c) => renderNode(c, tokens))
          .join("\n\n");
        return block(
          "column",
          {},
          `<div class="wp-block-column is-layout-flow">\n${inner}\n</div>`,
        );
      })
      .join("\n\n");

    const colStyleAttr = wpInlineStyle(colAttrs.style as Record<string, unknown>);
    const colsCssClasses = ["wp-block-columns", "is-layout-flex"];

    return block(
      "columns",
      colAttrs,
      `<div class="${colsCssClasses.join(" ")}"${colStyleAttr}>\n${columnBlocks}\n</div>`,
    );
  }

  if (layout.type === "grid") {
    const gridAttrs: Record<string, unknown> = {
      layout: { type: "grid", minimumColumnWidth: "300px" },
    };
    const inner = children.map((c) => renderNode(c, tokens)).join("\n\n");
    const gridClasses = ["wp-block-group", "is-layout-grid"];
    return block(
      "group",
      gridAttrs,
      `<div class="${gridClasses.join(" ")}">\n${inner}\n</div>`,
    );
  }

  // full-width or constrained: just render children sequentially
  return children.map((c) => renderNode(c, tokens)).join("\n\n");
}

export function renderSection(
  section: IRSection,
  tokens: DesignTokens,
): string {
  const innerContent = renderChildrenForLayout(section, tokens);
  const { background, layout, className } = section;

  // Background image → wp:cover
  if (background?.type === "image") {
    const coverAttrs: Record<string, unknown> = {
      url: background.value,
      dimRatio: 50,
      layout: {
        type: layout.type === "full-width" ? "default" : "constrained",
      },
    };
    const coverClasses = ["wp-block-cover"];
    applyClassName(className, coverAttrs, coverClasses);

    return block(
      "cover",
      coverAttrs,
      [
        `<div class="${coverClasses.join(" ")}">`,
        `<span aria-hidden="true" class="wp-block-cover__background has-background-dim"></span>`,
        `<img class="wp-block-cover__image-background" alt="" src="${escapeAttr(background.value)}" data-object-fit="cover"/>`,
        `<div class="wp-block-cover__inner-container">`,
        innerContent,
        `</div>`,
        `</div>`,
      ].join("\n"),
    );
  }

  // Color or gradient background → wp:group with background style
  const groupAttrs: Record<string, unknown> = {
    layout: {
      type: layout.type === "full-width" ? "default" : "constrained",
    },
  };

  const cssClasses = ["wp-block-group"];
  const layoutClass = layoutClassFromType(
    (groupAttrs.layout as Record<string, unknown>).type as string | undefined,
  );
  if (layoutClass) cssClasses.push(layoutClass);
  const groupStyle: Record<string, unknown> = {};

  if (background?.type === "color") {
    groupStyle.color = { background: background.value };
    cssClasses.push("has-background");
  } else if (background?.type === "gradient") {
    groupStyle.color = { gradient: background.value };
    cssClasses.push("has-background");
  }

  // Section-level padding from gap
  if (section.layout.gap) {
    const gapVal = GAP_MAP[section.layout.gap];
    if (gapVal) {
      groupStyle.spacing = { padding: { top: gapVal, bottom: gapVal } };
    }
  }

  if (Object.keys(groupStyle).length > 0) {
    groupAttrs.style = groupStyle;
  }
  applyClassName(className, groupAttrs, cssClasses);

  const classAttr = ` class="${cssClasses.join(" ")}"`;
  const styleAttr = wpInlineStyle(groupAttrs.style as Record<string, unknown>);

  return block(
    "group",
    groupAttrs,
    `<div${classAttr}${styleAttr}>\n${innerContent}\n</div>`,
  );
}

// ── Template assembly ──

/**
 * Render the full index.html template content.
 * References header/footer as template parts if they exist.
 */
export function renderTemplate(
  sections: IRSection[],
  tokens: DesignTokens,
  hasHeader: boolean,
  hasFooter: boolean,
): string {
  const parts: string[] = [];

  if (hasHeader) {
    parts.push(
      selfClosingBlock("template-part", {
        slug: "header",
        area: "header",
      }),
    );
  }

  for (const section of sections) {
    parts.push(renderSection(section, tokens));
  }

  if (hasFooter) {
    parts.push(
      selfClosingBlock("template-part", {
        slug: "footer",
        area: "footer",
      }),
    );
  }

  return parts.join("\n\n");
}
