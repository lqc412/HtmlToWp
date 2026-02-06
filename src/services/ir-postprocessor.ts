import * as cheerio from "cheerio";
import type { Element as DomElement } from "domhandler";
import type { IRDocument, IRNode, IRSection } from "../types/ir";

type LeafType = "heading" | "paragraph" | "image" | "button" | "list";

interface LeafElement {
  id: number;
  type: LeafType;
  key: string;
  classes: string[];
}

interface ContainerElement {
  id: number;
  classes: string[];
  leafKeys: string[];
  leafKeySet: Set<string>;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function extractCssClasses(css: string): Set<string> {
  const classes = new Set<string>();
  const regex = /\.([A-Za-z_][\w-]*)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(css))) {
    classes.add(match[1]);
  }
  return classes;
}

function mergeClassName(
  existing: string | undefined,
  additions: string[],
): string | undefined {
  if (additions.length === 0) return existing;
  const merged = new Set<string>();
  if (existing) {
    for (const cls of existing.split(/\s+/)) {
      if (cls) merged.add(cls);
    }
  }
  for (const cls of additions) merged.add(cls);
  return merged.size > 0 ? Array.from(merged).join(" ") : undefined;
}

function getClassList(
  raw: string | undefined,
  cssClasses: Set<string>,
): string[] {
  if (!raw) return [];
  return raw
    .split(/\s+/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0 && cssClasses.has(c));
}

function buildLeafKey(tag: string, text: string, extra?: string): string | null {
  const normText = normalizeText(text);
  if (tag.startsWith("h")) {
    if (!normText) return null;
    return `${tag}|${normText}`;
  }
  if (tag === "p") {
    if (!normText) return null;
    return `p|${normText}`;
  }
  if (tag === "img") {
    if (!extra) return null;
    return `img|${extra}`;
  }
  if (tag === "button" || tag === "a") {
    if (!normText) return null;
    const href = extra || "";
    return `btn|${normText}|${href}`;
  }
  if (tag === "ul" || tag === "ol") {
    if (!extra) return null;
    return `list|${tag}|${extra}`;
  }
  return null;
}

function collectHtmlLeafKeys(
  $: cheerio.CheerioAPI,
  root: DomElement,
): string[] {
  const keys = new Set<string>();
  const selector = "h1,h2,h3,h4,h5,h6,p,img,button,a,ul,ol";
  $(root)
    .find(selector)
    .each((_, el) => {
      const tag = el.tagName?.toLowerCase() || "";
      if (!tag) return;
      if (tag === "img") {
        const src = $(el).attr("src") || "";
        const key = buildLeafKey(tag, "", src);
        if (key) keys.add(key);
        return;
      }
      if (tag === "ul" || tag === "ol") {
        const items = $(el)
          .find("li")
          .map((__, li) => normalizeText($(li).text()))
          .get()
          .filter(Boolean);
        const key = buildLeafKey(tag, "", items.join("|"));
        if (key) keys.add(key);
        return;
      }
      const text = $(el).text() || "";
      const href = tag === "a" ? $(el).attr("href") || "" : "";
      const key = buildLeafKey(tag, text, href);
      if (key) keys.add(key);
    });
  return Array.from(keys);
}

function collectIrLeafKeys(node: IRNode | IRSection): string[] {
  const keys: string[] = [];
  const pushKey = (key: string | null) => {
    if (key) keys.push(key);
  };

  const walkNode = (n: IRNode) => {
    switch (n.type) {
      case "heading": {
        const text = n.content || "";
        const level = n.attributes.level || 2;
        pushKey(buildLeafKey(`h${level}`, text));
        break;
      }
      case "paragraph": {
        pushKey(buildLeafKey("p", n.content || ""));
        break;
      }
      case "image": {
        pushKey(buildLeafKey("img", "", n.attributes.src || ""));
        break;
      }
      case "button": {
        const text = n.content || "";
        const href = n.attributes.href || "";
        pushKey(buildLeafKey("button", text, href));
        break;
      }
      case "list": {
        const items = n.attributes.items || [];
        pushKey(buildLeafKey(n.attributes.ordered ? "ol" : "ul", "", items.join("|")));
        break;
      }
      default:
        break;
    }
    if (n.children) n.children.forEach(walkNode);
  };

  if ("children" in node) {
    node.children.forEach(walkNode);
  }

  return Array.from(new Set(keys));
}

function addClassesToNode(node: IRNode, classes: string[]): void {
  node.className = mergeClassName(node.className, classes);
}

function addClassesToSection(section: IRSection, classes: string[]): void {
  section.className = mergeClassName(section.className, classes);
}

export function postprocessClassNames(
  ir: IRDocument,
  rawHtml: string,
  extractedCSS: string,
): IRDocument {
  if (!rawHtml || !extractedCSS) return ir;

  const cssClasses = extractCssClasses(extractedCSS);
  if (cssClasses.size === 0) return ir;

  const $ = cheerio.load(rawHtml, { xmlMode: false });
  let idCounter = 0;

  const leafByKey = new Map<string, LeafElement[]>();
  const leafByType = new Map<LeafType, LeafElement[]>();
  const usedLeafIds = new Set<number>();

  const leafSelector = "h1,h2,h3,h4,h5,h6,p,img,button,a,ul,ol";
  $(leafSelector).each((_, el) => {
    const tag = el.tagName?.toLowerCase() || "";
    if (!tag) return;

    let type: LeafType | null = null;
    let key: string | null = null;
    let classes: string[] = [];

    if (tag.startsWith("h")) {
      type = "heading";
      key = buildLeafKey(tag, $(el).text() || "");
    } else if (tag === "p") {
      type = "paragraph";
      key = buildLeafKey("p", $(el).text() || "");
    } else if (tag === "img") {
      type = "image";
      key = buildLeafKey("img", "", $(el).attr("src") || "");
    } else if (tag === "button" || tag === "a") {
      type = "button";
      const href = tag === "a" ? $(el).attr("href") || "" : "";
      key = buildLeafKey(tag, $(el).text() || "", href);
    } else if (tag === "ul" || tag === "ol") {
      type = "list";
      const items = $(el)
        .find("li")
        .map((__, li) => normalizeText($(li).text()))
        .get()
        .filter(Boolean);
      key = buildLeafKey(tag, "", items.join("|"));
    }

    if (!type || !key) return;
    classes = getClassList($(el).attr("class"), cssClasses);

    const leaf: LeafElement = {
      id: idCounter++,
      type,
      key,
      classes,
    };

    if (!leafByKey.has(key)) leafByKey.set(key, []);
    leafByKey.get(key)!.push(leaf);

    if (!leafByType.has(type)) leafByType.set(type, []);
    leafByType.get(type)!.push(leaf);
  });

  const containers: ContainerElement[] = [];
  const usedContainerIds = new Set<number>();
  const containerSelector = "div,section,article,nav,header,footer,aside,main";
  $(containerSelector).each((_, el) => {
    const classes = getClassList($(el).attr("class"), cssClasses);
    if (classes.length === 0) return;
    const leafKeys = collectHtmlLeafKeys($, el);
    if (leafKeys.length === 0) return;
    containers.push({
      id: idCounter++,
      classes,
      leafKeys,
      leafKeySet: new Set(leafKeys),
    });
  });

  const findLeafMatch = (key: string, type: LeafType): LeafElement | null => {
    const byKey = leafByKey.get(key) || [];
    for (const leaf of byKey) {
      if (!usedLeafIds.has(leaf.id)) return leaf;
    }
    const byType = leafByType.get(type) || [];
    for (const leaf of byType) {
      if (!usedLeafIds.has(leaf.id)) return leaf;
    }
    return null;
  };

  const findContainerMatch = (leafKeys: string[]): ContainerElement | null => {
    if (leafKeys.length === 0) return null;
    const leafKeySet = new Set(leafKeys);
    const minOverlap =
      leafKeys.length <= 3 ? 1 : Math.ceil(leafKeys.length * 0.3);

    let best: {
      container: ContainerElement;
      overlap: number;
      ratio: number;
      size: number;
    } | null = null;

    for (const container of containers) {
      if (usedContainerIds.has(container.id)) continue;
      let overlap = 0;
      for (const key of container.leafKeySet) {
        if (leafKeySet.has(key)) overlap++;
      }
      if (overlap < minOverlap) continue;
      const ratio = overlap / container.leafKeys.length;
      if (
        !best ||
        overlap > best.overlap ||
        (overlap === best.overlap && ratio > best.ratio) ||
        (overlap === best.overlap && ratio === best.ratio && container.leafKeys.length < best.size)
      ) {
        best = {
          container,
          overlap,
          ratio,
          size: container.leafKeys.length,
        };
      }
    }

    if (!best) return null;
    return best.container;
  };

  const applyLeafClasses = (node: IRNode) => {
    switch (node.type) {
      case "heading": {
        const level = node.attributes.level || 2;
        const key = buildLeafKey(`h${level}`, node.content || "");
        if (!key) return;
        const match = findLeafMatch(key, "heading");
        if (match && match.classes.length > 0) {
          addClassesToNode(node, match.classes);
          usedLeafIds.add(match.id);
        }
        break;
      }
      case "paragraph": {
        const key = buildLeafKey("p", node.content || "");
        if (!key) return;
        const match = findLeafMatch(key, "paragraph");
        if (match && match.classes.length > 0) {
          addClassesToNode(node, match.classes);
          usedLeafIds.add(match.id);
        }
        break;
      }
      case "image": {
        const key = buildLeafKey("img", "", node.attributes.src || "");
        if (!key) return;
        const match = findLeafMatch(key, "image");
        if (match && match.classes.length > 0) {
          addClassesToNode(node, match.classes);
          usedLeafIds.add(match.id);
        }
        break;
      }
      case "button": {
        const text = node.content || "";
        const href = node.attributes.href || "";
        const key = buildLeafKey("button", text, href);
        if (!key) return;
        const match = findLeafMatch(key, "button");
        if (match && match.classes.length > 0) {
          addClassesToNode(node, match.classes);
          usedLeafIds.add(match.id);
        }
        break;
      }
      case "list": {
        const items = node.attributes.items || [];
        const key = buildLeafKey(
          node.attributes.ordered ? "ol" : "ul",
          "",
          items.join("|"),
        );
        if (!key) return;
        const match = findLeafMatch(key, "list");
        if (match && match.classes.length > 0) {
          addClassesToNode(node, match.classes);
          usedLeafIds.add(match.id);
        }
        break;
      }
      default:
        break;
    }
  };

  const applyContainerClasses = (
    target: IRNode | IRSection,
    applyFn: (classes: string[]) => void,
  ) => {
    const leafKeys = collectIrLeafKeys(target);
    if (leafKeys.length === 0) return;
    const match = findContainerMatch(leafKeys);
    if (match && match.classes.length > 0) {
      applyFn(match.classes);
      usedContainerIds.add(match.id);
    }
  };

  const walkNode = (node: IRNode) => {
    applyLeafClasses(node);
    if (node.type === "group") {
      applyContainerClasses(node, (classes) => addClassesToNode(node, classes));
    }
    if (node.children) node.children.forEach(walkNode);
  };

  const walkSection = (section: IRSection) => {
    applyContainerClasses(section, (classes) => addClassesToSection(section, classes));
    section.children.forEach(walkNode);
  };

  if (ir.header) walkSection(ir.header);
  ir.sections.forEach(walkSection);
  if (ir.footer) walkSection(ir.footer);

  return ir;
}
