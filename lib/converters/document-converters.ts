import { marked } from "marked";
import TurndownService from "turndown";

export type DocumentExportTheme = "modern" | "github" | "academic" | "minimal";

export type TextTransformMode =
  | "unwrap-pdf"
  | "strip-markdown"
  | "title-case"
  | "sentence-case"
  | "upper-case"
  | "lower-case"
  | "camel-case"
  | "snake-case"
  | "kebab-case"
  | "slugify"
  | "normalize-quotes"
  | "sort-lines"
  | "dedupe-lines";

function createConfiguredTurndown(): TurndownService {
  const service = new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "_",
  });

  service.addRule("tableSection", {
    filter: ["thead", "tbody", "tfoot"],
    replacement: (content) => content,
  });

  service.addRule("tableRow", {
    filter: "tr",
    replacement: (_content, node) => {
      const cells = Array.from(node.childNodes).filter(
        (n) => n.nodeName === "TH" || n.nodeName === "TD"
      );
      if (cells.length === 0) return "";
      const rowValues = cells.map((c) =>
        (c.textContent || "").replace(/\s+/g, " ").trim().replace(/\|/g, "\\|")
      );
      const line = "| " + rowValues.join(" | ") + " |\n";
      const isHeaderRow =
        node.parentNode?.nodeName === "THEAD" ||
        cells.every((c) => c.nodeName === "TH");
      if (isHeaderRow) {
        return line + "| " + cells.map(() => "---").join(" | ") + " |\n";
      }
      return line;
    },
  });

  service.addRule("tableCell", {
    filter: ["th", "td"],
    replacement: (content) => content,
  });

  service.addRule("table", {
    filter: "table",
    replacement: (content) => "\n\n" + content.trim() + "\n\n",
  });

  return service;
}

const turndownSingleton = createConfiguredTurndown();

export function htmlToMarkdown(html: string): string {
  if (!html || !html.trim()) return "";
  const cleaned = html
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/<head\b[^<]*(?:(?!<\/head>)<[^<]*)*<\/head>/gi, "")
    .replace(/<title\b[^<]*(?:(?!<\/title>)<[^<]*)*<\/title>/gi, "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
  return turndownSingleton.turndown(cleaned).trim();
}

export function markdownToHtmlSnippet(markdown: string): string {
  if (!markdown.trim()) return "";
  return marked.parse(markdown, { gfm: true, breaks: true }) as string;
}

export function getThemeStylesheet(theme: DocumentExportTheme): string {
  const base = [
    "*, *::before, *::after { box-sizing: border-box; }",
    "body { margin: 0; padding: 2.5rem 2rem; max-width: 840px; margin-inline: auto; -webkit-font-smoothing: antialiased; }",
    "pre { overflow-x: auto; padding: 1rem 1.25rem; border-radius: 8px; }",
    "code { font-family: 'SFMono-Regular', Consolas, Menlo, monospace; font-size: 0.88em; }",
    "table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }",
    "th, td { padding: 0.6rem 0.85rem; border: 1px solid #d1d5db; text-align: left; }",
    "th { background: #f3f4f6; font-weight: 600; }",
    "blockquote { margin: 1.25rem 0; padding: 0.75rem 1.25rem; border-left: 4px solid #6366f1; background: #f8fafc; }",
    "img { max-width: 100%; height: auto; border-radius: 8px; }",
    "hr { border: 0; border-top: 1px solid #e5e7eb; margin: 2rem 0; }",
  ].join("\n");

  if (theme === "academic") {
    return base + "\nbody { font-family: Georgia, 'Times New Roman', serif; line-height: 1.85; color: #111827; font-size: 17px; }\nh1, h2, h3 { border-bottom: 1px solid #e5e7eb; padding-bottom: 0.25rem; }";
  }
  if (theme === "github") {
    return base + "\nbody { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; line-height: 1.6; color: #1f2328; font-size: 16px; }\nh1, h2 { border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }\npre, code { background: #f6f8fa; }";
  }
  if (theme === "minimal") {
    return base + "\nbody { font-family: system-ui, sans-serif; line-height: 1.75; color: #18181b; font-size: 15px; max-width: 700px; }";
  }
  return base + "\nbody { font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.75; color: #0f172a; font-size: 16px; }\ncode { background: #f1f5f9; color: #be123c; padding: 0.15em 0.35em; border-radius: 4px; }\npre { background: #0f172a; color: #f8fafc; }\npre code { background: transparent; color: inherit; padding: 0; }";
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function markdownToStandaloneHtml(
  markdown: string,
  title = "Slate Document",
  theme: DocumentExportTheme = "modern"
): string {
  return [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    "  <title>" + escapeHtml(title) + "</title>",
    "  <style>" + getThemeStylesheet(theme) + "</style>",
    "</head>",
    "<body>",
    markdownToHtmlSnippet(markdown),
    "</body>",
    "</html>",
  ].join("\n");
}

export function markdownToPlainText(markdown: string): string {
  if (!markdown.trim()) return "";
  const fence = "\x60\x60\x60";
  const fenceRegex = new RegExp(fence + "[\\s\\S]*?" + fence, "g");
  return markdown
    .replace(fenceRegex, (match) => match.split("\n").slice(1, -1).join("\n"))
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, (_, alt) => (alt ? "[Image: " + alt + "]" : ""))
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    .replace(/\x60([^\x60]+)\x60/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^(?:-{3,}|\*{3,}|_{3,})$/gm, "----------------------------------------")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function unwrapPdfText(text: string): string {
  if (!text.trim()) return "";
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const result: string[] = [];
  let buffer = "";

  const isStructural = (t: string): boolean =>
    !t ||
    /^#{1,6}\s/.test(t) ||
    /^[-*+•]\s/.test(t) ||
    /^\d+[.)]\s/.test(t) ||
    /^>\s/.test(t) ||
    /^\|/.test(t) ||
    /^\x60\x60\x60/.test(t);

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      if (buffer) { result.push(buffer); buffer = ""; }
      result.push("");
      continue;
    }
    if (isStructural(trimmed)) {
      if (buffer) { result.push(buffer); buffer = ""; }
      result.push(trimmed);
      continue;
    }
    if (!buffer) {
      buffer = trimmed;
    } else if (buffer.endsWith("-") && /^[a-z]/.test(trimmed)) {
      buffer = buffer.slice(0, -1) + trimmed;
    } else {
      buffer += " " + trimmed;
    }
    if (/[.!?:]$/.test(trimmed) && i + 1 < lines.length && isStructural(lines[i + 1].trim())) {
      result.push(buffer);
      buffer = "";
    }
  }
  if (buffer) result.push(buffer);
  return result.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function escapeLatex(text: string): string {
  return text
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

function formatInlineLatex(text: string): string {
  const mathPlaceholders: string[] = [];
  const withPlaceholders = text.replace(/\$([^$]+)\$/g, (m) => {
    mathPlaceholders.push(m);
    return "@@MATH_" + (mathPlaceholders.length - 1) + "@@";
  });
  let escaped = escapeLatex(withPlaceholders);
  escaped = escaped
    .replace(/\*\*(.+?)\*\*/g, "\\textbf{$1}")
    .replace(/\\_(.+?)\\_/g, "\\textit{$1}")
    .replace(/\*(.+?)\*/g, "\\textit{$1}")
    .replace(/\x60([^\x60]+)\x60/g, "\\texttt{$1}")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "\\href{$2}{$1}");
  return escaped.replace(/@@MATH_(\d+)@@/g, (_, idx) => mathPlaceholders[Number(idx)]);
}

export function markdownToLatex(markdown: string, title = "Slate Document"): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [
    "\\documentclass[11pt,a4paper]{article}",
    "\\usepackage[utf8]{inputenc}",
    "\\usepackage[T1]{fontenc}",
    "\\usepackage{hyperref,graphicx,amsmath,amssymb,booktabs,listings,geometry}",
    "\\geometry{margin=1in}",
    "\\title{" + escapeLatex(title) + "}",
    "\\date{\\today}",
    "\\begin{document}",
    "\\maketitle",
    "",
  ];
  let inCode = false;
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) { out.push("\\end{itemize}"); inUl = false; }
    if (inOl) { out.push("\\end{enumerate}"); inOl = false; }
  };

  for (const line of lines) {
    if (line.trim().startsWith("\x60\x60\x60")) {
      closeLists();
      out.push(inCode ? "\\end{lstlisting}" : "\\begin{lstlisting}");
      inCode = !inCode;
      continue;
    }
    if (inCode) { out.push(line); continue; }

    const h1 = line.match(/^#\s+(.*)/);
    if (h1) { closeLists(); out.push("\\section{" + formatInlineLatex(h1[1]) + "}"); continue; }
    const h2 = line.match(/^##\s+(.*)/);
    if (h2) { closeLists(); out.push("\\subsection{" + formatInlineLatex(h2[1]) + "}"); continue; }
    const h3 = line.match(/^###\s+(.*)/);
    if (h3) { closeLists(); out.push("\\subsubsection{" + formatInlineLatex(h3[1]) + "}"); continue; }

    const ul = line.match(/^\s*[-*+]\s+(.*)/);
    if (ul) {
      if (inOl) { out.push("\\end{enumerate}"); inOl = false; }
      if (!inUl) { out.push("\\begin{itemize}"); inUl = true; }
      out.push("  \\item " + formatInlineLatex(ul[1]));
      continue;
    }
    const ol = line.match(/^\s*\d+\.\s+(.*)/);
    if (ol) {
      if (inUl) { out.push("\\end{itemize}"); inUl = false; }
      if (!inOl) { out.push("\\begin{enumerate}"); inOl = true; }
      out.push("  \\item " + formatInlineLatex(ol[1]));
      continue;
    }
    closeLists();
    if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      out.push("\\bigskip\\hrule\\bigskip");
    } else if (line.startsWith(">")) {
      out.push("\\begin{quote}" + formatInlineLatex(line.replace(/^>\s*/, "")) + "\\end{quote}");
    } else {
      out.push(line.trim() ? formatInlineLatex(line) : "");
    }
  }
  closeLists();
  if (inCode) out.push("\\end{lstlisting}");
  out.push("", "\\end{document}");
  return out.join("\n");
}

export function latexToMarkdown(latex: string): string {
  let content = latex.replace(/\r\n/g, "\n");
  const bodyMatch = content.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
  if (bodyMatch) content = bodyMatch[1];
  const fence = "\x60\x60\x60";
  return content
    .replace(/\\maketitle/g, "")
    .replace(/\\section\*?\{([^}]+)\}/g, "# $1")
    .replace(/\\subsection\*?\{([^}]+)\}/g, "## $1")
    .replace(/\\subsubsection\*?\{([^}]+)\}/g, "### $1")
    .replace(/\\textbf\{([^}]+)\}/g, "**$1**")
    .replace(/\\(?:textit|emph)\{([^}]+)\}/g, "_$1_")
    .replace(/\\texttt\{([^}]+)\}/g, "\x60$1\x60")
    .replace(/\\href\{([^}]+)\}\{([^}]+)\}/g, "[$2]($1)")
    .replace(/\\begin\{quote\}([\s\S]*?)\\end\{quote\}/g, (_, q) => "> " + q.trim())
    .replace(/\\begin\{(?:lstlisting|verbatim)\}([\s\S]*?)\\end\{(?:lstlisting|verbatim)\}/g, (_, c) => fence + "\n" + c.trim() + "\n" + fence)
    .replace(/\\(?:begin|end)\{(?:itemize|enumerate)\}/g, "")
    .replace(/^\s*\\item\s+/gm, "- ")
    .replace(/\\bigskip\\hrule\\bigskip/g, "---")
    .replace(/\\([&%$#_{}])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function markdownToAsciiDoc(markdown: string): string {
  const fence = "\x60\x60\x60";
  const fenceRe = new RegExp(fence + "(\\w*)\\n([\\s\\S]*?)" + fence, "g");
  return markdown
    .replace(/^####\s+(.*)/gm, "==== $1")
    .replace(/^###\s+(.*)/gm, "=== $1")
    .replace(/^##\s+(.*)/gm, "== $1")
    .replace(/^#\s+(.*)/gm, "= $1")
    .replace(fenceRe, (_, lang, code) => (lang ? "[source," + lang + "]\n" : "") + "----\n" + code.trimEnd() + "\n----")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "link:$2[$1]");
}

export function asciiDocToMarkdown(adoc: string): string {
  const fence = "\x60\x60\x60";
  return adoc
    .replace(/^====\s+(.*)/gm, "#### $1")
    .replace(/^===\s+(.*)/gm, "### $1")
    .replace(/^==\s+(.*)/gm, "## $1")
    .replace(/^=\s+(.*)/gm, "# $1")
    .replace(/(?:\[source,?([^\]]*)\]\n)?----\n([\s\S]*?)\n----/g, (_, lang, code) => fence + (lang || "").trim() + "\n" + code + "\n" + fence)
    .replace(/link:([^\[]+)\[([^\]]*)\]/g, "[$2]($1)");
}

export function markdownToJira(markdown: string): string {
  const fence = "\x60\x60\x60";
  const fenceRe = new RegExp(fence + "(\\w*)\\n([\\s\\S]*?)" + fence, "g");
  return markdown
    .replace(/^###\s+(.*)/gm, "h3. $1")
    .replace(/^##\s+(.*)/gm, "h2. $1")
    .replace(/^#\s+(.*)/gm, "h1. $1")
    .replace(fenceRe, (_, lang, code) => "{code" + (lang ? ":" + lang : "") + "}\n" + code.trimEnd() + "\n{code}")
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    .replace(/\x60([^\x60]+)\x60/g, "{{$1}}")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "[$1|$2]");
}

export function markdownToMediaWiki(markdown: string): string {
  const fence = "\x60\x60\x60";
  const fenceRe = new RegExp(fence + "(\\w*)\\n([\\s\\S]*?)" + fence, "g");
  return markdown
    .replace(/^###\s+(.*)/gm, "=== $1 ===")
    .replace(/^##\s+(.*)/gm, "== $1 ==")
    .replace(/^#\s+(.*)/gm, "= $1 =")
    .replace(fenceRe, (_, lang, code) => "<syntaxhighlight" + (lang ? ' lang="' + lang + '"' : "") + ">\n" + code.trimEnd() + "\n</syntaxhighlight>")
    .replace(/\*\*(.+?)\*\*/g, "'''$1'''")
    .replace(/_(.+?)_/g, "''$1''")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "[$2 $1]");
}

export function markdownToWordBlob(markdown: string, title = "Slate Document"): Blob {
  const htmlBody = markdownToHtmlSnippet(markdown);
  const wordDoc = [
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">',
    '<head><meta charset="utf-8"><title>' + escapeHtml(title) + "</title>",
    "<style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.5;color:#111827}table{border-collapse:collapse;width:100%}th,td{border:1pt solid #cbd5e1;padding:6pt}</style>",
    "</head><body>" + htmlBody + "</body></html>",
  ].join("\n");
  return new Blob(["\ufeff", wordDoc], { type: "application/msword;charset=utf-8" });
}

export function splitMarkdownByHeadings(markdown: string): { filename: string; content: string }[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const sections: { title: string; lines: string[] }[] = [];
  let current = { title: "00-overview", lines: [] as string[] };

  for (const line of lines) {
    const match = line.match(/^#{1,2}\s+(.*)/);
    if (match) {
      if (current.lines.join("\n").trim()) sections.push(current);
      current = { title: match[1].trim(), lines: [line] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.join("\n").trim()) sections.push(current);

  return sections.map((sec, idx) => {
    const num = String(idx + 1).padStart(2, "0");
    const slug = sec.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "section";
    return { filename: "chapters/" + num + "-" + slug + ".md", content: sec.lines.join("\n").trim() + "\n" };
  });
}

export function transformText(text: string, mode: TextTransformMode): string {
  switch (mode) {
    case "unwrap-pdf": return unwrapPdfText(text);
    case "strip-markdown": return markdownToPlainText(text);
    case "upper-case": return text.toUpperCase();
    case "lower-case": return text.toLowerCase();
    case "title-case": return text.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    case "sentence-case": return text.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, (c) => c.toUpperCase());
    case "camel-case": return text.trim().replace(/[^a-zA-Z0-9]+(.)/g, (_, chr: string) => chr.toUpperCase()).replace(/^[A-Z]/, (c) => c.toLowerCase());
    case "snake-case": return text.trim().replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
    case "kebab-case":
    case "slugify": return text.trim().replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase();
    case "normalize-quotes": return text.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\u2014/g, "--").replace(/\u2013/g, "-");
    case "sort-lines": return text.split("\n").sort((a, b) => a.localeCompare(b)).join("\n");
    case "dedupe-lines": return Array.from(new Set(text.split("\n"))).join("\n");
    default: return text;
  }
}


/**
 * Prevents raw <style>, <script>, <html>, <head>, or <body> tags inside the editor
 * from leaking into the live Next.js DOM and altering the application layout.
 */
export function sanitizePreviewHtml(rawHtml: string): string {
  if (!rawHtml) return "";
  return rawHtml
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<head\b[^<]*(?:(?!<\/head>)<[^<]*)*<\/head>/gi, "")
    .replace(/<\/?(?:html|body|meta|title)[^>]*>/gi, "");
}
