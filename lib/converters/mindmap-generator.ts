import { markdownToHtmlSnippet, sanitizePreviewHtml } from "./document-converters";

export interface MindmapNode {
  id: string;
  label: string;
  level: number;
  children: MindmapNode[];
}

export type SlideLayoutType = "cover" | "code" | "table" | "split" | "standard";

export interface SlideItem {
  index: number;
  title: string;
  subtitle?: string;
  layout: SlideLayoutType;
  markdown: string;
  html: string;
  speakerNotes: string;
}

export type SlideThemeId =
  | "obsidian"
  | "executive"
  | "aurora"
  | "terminal"
  | "editorial"
  | "swiss";

export function parseMarkdownToMindmap(markdown: string): MindmapNode {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const root: MindmapNode = { id: "root", label: "Document Map", level: 0, children: [] };
  const stack: MindmapNode[] = [root];
  let counter = 1;
  let inCode = false;

  const clean = (s: string) =>
    s.replace(/\*\*(.+?)\*\*/g, "$1").replace(/_(.+?)_/g, "$1").replace(/\x60([^\x60]+)\x60/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim().slice(0, 44);

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("\x60\x60\x60")) { inCode = !inCode; continue; }
    if (inCode || !line) continue;

    const hm = line.match(/^(#{1,4})\s+(.*)/);
    if (hm) {
      const level = hm[1].length;
      const label = clean(hm[2]);
      if (!label) continue;
      if (level === 1 && root.label === "Document Map" && root.children.length === 0) {
        root.label = label;
        continue;
      }
      const node: MindmapNode = { id: "n-" + counter++, label, level, children: [] };
      while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();
      stack[stack.length - 1].children.push(node);
      stack.push(node);
      continue;
    }

    const bm = raw.match(/^(\s*)[-*+]\s+(.*)/);
    if (bm) {
      const label = clean(bm[2]);
      if (!label) continue;
      const level = Math.min(5, stack[stack.length - 1].level + 1);
      const node: MindmapNode = { id: "n-" + counter++, label, level, children: [] };
      while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();
      stack[stack.length - 1].children.push(node);
    }
  }
  return root;
}

interface LayoutNode {
  node: MindmapNode;
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
  children: LayoutNode[];
}

export function renderMindmapToSvg(markdown: string, darkMode = false): string {
  const tree = parseMarkdownToMindmap(markdown);
  const COLORS = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];
  let leafIdx = 0;
  let maxRight = 400;
  let maxBottom = 240;

  function layout(node: MindmapNode, depth: number): LayoutNode {
    const w = Math.max(120, Math.min(260, node.label.length * 7.4 + 28));
    const h = 36;
    const x = 32 + depth * 260;
    if (x + w + 40 > maxRight) maxRight = x + w + 40;

    if (node.children.length === 0) {
      const y = 36 + leafIdx++ * 50;
      if (y + h + 36 > maxBottom) maxBottom = y + h + 36;
      return { node, x, y, w, h, depth, children: [] };
    }
    const kids = node.children.map((c) => layout(c, depth + 1));
    const y = (kids[0].y + kids[kids.length - 1].y) / 2;
    if (y + h + 36 > maxBottom) maxBottom = y + h + 36;
    return { node, x, y, w, h, depth, children: kids };
  }

  const rootLayout = layout(tree, 0);
  const svgW = Math.max(640, Math.ceil(maxRight));
  const svgH = Math.max(300, Math.ceil(maxBottom));

  const links: string[] = [];
  const boxes: string[] = [];
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function walk(n: LayoutNode) {
    const color = COLORS[n.depth % COLORS.length];
    for (const ch of n.children) {
      const x1 = n.x + n.w;
      const y1 = n.y + n.h / 2;
      const x2 = ch.x;
      const y2 = ch.y + ch.h / 2;
      const cx = (x1 + x2) / 2;
      const chCol = COLORS[ch.depth % COLORS.length];
      links.push(
        '<path d="M' + x1 + " " + y1 + " C" + cx + " " + y1 + ", " + cx + " " + y2 + ", " + x2 + " " + y2 +
        '" fill="none" stroke="' + chCol + '" stroke-width="2.2" stroke-opacity="0.75" />'
      );
      walk(ch);
    }
    const fill = n.depth === 0 ? color : darkMode ? "#18181b" : "#ffffff";
    const textCol = n.depth === 0 ? "#ffffff" : darkMode ? "#f4f4f5" : "#0f172a";
    boxes.push(
      '<g transform="translate(' + n.x + "," + n.y + ')">' +
        '<rect width="' + n.w + '" height="' + n.h + '" rx="8" fill="' + fill + '" stroke="' + color + '" stroke-width="2" />' +
        '<text x="' + (n.w / 2).toFixed(1) + '" y="22" text-anchor="middle" fill="' + textCol +
        '" font-family="system-ui, sans-serif" font-size="12" font-weight="600">' + esc(n.node.label) + "</text>" +
      "</g>"
    );
  }

  walk(rootLayout);
  const bg = darkMode ? "#09090b" : "#f8fafc";
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + svgW + " " + svgH + '" width="100%" height="auto" style="max-width:' + svgW + 'px;height:auto;display:block;">',
    '  <rect width="100%" height="100%" fill="' + bg + '" rx="12" />',
    "  " + links.join("\n  "),
    "  " + boxes.join("\n  "),
    "</svg>",
  ].join("\n");
}

/**
 * Smart Deterministic Slide Pagination Engine:
 * 1. Splits on explicit '---' horizontal rules
 * 2. Splits on # H1, ## H2, and ### H3 headings so subsections get dedicated slides
 * 3. Auto-paginates any slide that exceeds the visual height budget (e.g., > 6 list items
 *    or mixing code blocks + tables on one slide) so content never overflows!
 */
export function parseMarkdownToSlides(markdown: string): SlideItem[] {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [
      {
        index: 0,
        title: "Empty Presentation",
        layout: "cover",
        markdown: "# Empty Presentation",
        html: "<h1>Empty Presentation</h1>",
        speakerNotes: "",
      },
    ];
  }

  // Step 1: Split into logical sections by --- OR by # / ## / ### headings (outside code fences)
  const lines = normalized.split("\n");
  const logicalSections: string[][] = [];
  let current: string[] = [];
  let inCode = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("\x60\x60\x60")) {
      inCode = !inCode;
      current.push(line);
      continue;
    }

    if (!inCode) {
      if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        if (current.join("\n").trim()) logicalSections.push(current);
        current = [];
        continue;
      }
      if (/^#{1,3}\s+/.test(trimmed) && current.join("\n").trim().length > 0) {
        logicalSections.push(current);
        current = [line];
        continue;
      }
    }
    current.push(line);
  }
  if (current.join("\n").trim()) logicalSections.push(current);

  // Step 2: Enforce visual height budget per slide (max 6 bullets or ~420 chars of prose)
  const finalChunks: string[] = [];

  for (const secLines of logicalSections) {
    const headingLine = secLines[0]?.match(/^#{1,3}\s+(.*)/) ? secLines[0] : "";
    const bodyLines = headingLine ? secLines.slice(1) : secLines;

    let bucket: string[] = [];
    let bulletCount = 0;
    let charCount = 0;
    let hasHeavyBlock = false; // code block or table
    let inFence = false;
    let partNum = 1;

    const flushBucket = () => {
      const content = bucket.join("\n").trim();
      if (!content && !headingLine) return;
      const headerPrefix = headingLine
        ? partNum === 1
          ? headingLine
          : headingLine + " (" + partNum + ")"
        : "";
      finalChunks.push((headerPrefix ? headerPrefix + "\n\n" + content : content).trim());
      partNum++;
      bucket = [];
      bulletCount = 0;
      charCount = 0;
      hasHeavyBlock = false;
    };

    for (let i = 0; i < bodyLines.length; i++) {
      const l = bodyLines[i];
      const t = l.trim();

      if (t.startsWith("\x60\x60\x60")) {
        if (!inFence && bucket.length > 0 && (hasHeavyBlock || bulletCount >= 3 || charCount > 260)) {
          flushBucket();
        }
        inFence = !inFence;
        hasHeavyBlock = true;
        bucket.push(l);
        continue;
      }

      if (inFence) {
        bucket.push(l);
        continue;
      }

      const isTableLine = t.startsWith("|") && t.endsWith("|");
      if (isTableLine && !hasHeavyBlock && (bulletCount >= 3 || charCount > 240)) {
        flushBucket();
        hasHeavyBlock = true;
      } else if (isTableLine) {
        hasHeavyBlock = true;
      }

      const isBullet = /^[-*+]\s+|^\d+\.\s+/.test(t);
      if (isBullet) bulletCount++;
      charCount += t.length;

      if ((bulletCount > 6 || (charCount > 480 && !isTableLine)) && bucket.length > 0) {
        flushBucket();
        if (isBullet) bulletCount = 1;
        charCount = t.length;
      }

      bucket.push(l);
    }

    if (bucket.join("\n").trim() || partNum === 1) {
      flushBucket();
    }
  }

  return finalChunks.map((chunk, idx) => {
    const parts = chunk.split(/\nNote:\s*/i);
    const bodyMd = parts[0].trim();
    const speakerNotes = parts.slice(1).join("\n").trim();
    const titleMatch = bodyMd.match(/^(#{1,3})\s+(.*)/m);
    const headingLevel = titleMatch ? titleMatch[1].length : 2;
    const title = titleMatch ? titleMatch[2].trim() : "Slide " + (idx + 1);

    const hasCode = bodyMd.includes("\x60\x60\x60");
    const hasTable = /^\|.*\|$/m.test(bodyMd);
    const nonHeaderLines = bodyMd
      .split("\n")
      .filter((l) => l.trim() && !/^#{1,3}\s+/.test(l.trim()));

    const layout: SlideLayoutType =
      idx === 0 && headingLevel === 1 && nonHeaderLines.length <= 3 && !hasCode && !hasTable
        ? "cover"
        : hasCode
        ? "code"
        : hasTable
        ? "table"
        : "standard";

    return {
      index: idx,
      title,
      layout,
      markdown: bodyMd,
      html: sanitizePreviewHtml(markdownToHtmlSnippet(bodyMd)),
      speakerNotes,
    };
  });
}

export function exportSlidesToStandaloneHtml(
  slides: SlideItem[],
  title = "Slate Presentation",
  theme: SlideThemeId = "obsidian"
): string {
  const themeStyles: Record<SlideThemeId, string> = {
    obsidian: "background: radial-gradient(circle at top right, #1e1b4b, #09090b 70%); color: #f8fafc;",
    executive: "background: #f8fafc; color: #0f172a;",
    aurora: "background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f766e 100%); color: #f8fafc;",
    terminal: "background: #050807; color: #10b981; font-family: monospace;",
    editorial: "background: #faf7f2; color: #1c1917; font-family: Georgia, serif;",
    swiss: "background: #ffffff; color: #000000;",
  };

  const sections = slides
    .map(
      (s, i) =>
        '<section class="slide">' +
          '<div class="slide-inner">' + s.html + "</div>" +
          '<footer class="slide-footer"><span>' + title + "</span><span>" + (i + 1) + " / " + slides.length + "</span></footer>" +
        "</section>"
    )
    .join("\n");

  return [
    "<!DOCTYPE html>",
    '<html lang="en"><head><meta charset="utf-8"/><title>' + title + "</title>",
    "<style>",
    "*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,sans-serif;" + themeStyles[theme] + "}",
    ".slide{min-height:100vh;display:flex;flex-direction:column;justify-content:space-between;padding:4rem 8vw;border-bottom:1px solid rgba(128,128,128,0.2);page-break-after:always}",
    ".slide-inner{max-width:960px;width:100%;margin:auto;font-size:1.35rem;line-height:1.6}",
    "h1{font-size:2.75rem;margin-top:0}h2{font-size:2rem;margin-top:0}h3{font-size:1.5rem;margin-top:0}",
    "pre{background:rgba(0,0,0,0.35);padding:1.2rem;border-radius:10px;overflow-x:auto;font-size:0.95rem}",
    "table{width:100%;border-collapse:collapse;font-size:1rem}th,td{border:1px solid rgba(128,128,128,0.3);padding:0.6rem 0.85rem;text-align:left}",
    ".slide-footer{display:flex;justify-content:space-between;font-size:0.85rem;opacity:0.6;margin-top:2rem}",
    "</style></head><body>",
    sections,
    "</body></html>",
  ].join("\n");
}
