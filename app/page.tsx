"use client";

import { HorizontalScrollStrip } from "@/components/horizontal-scroll-strip";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { marked } from "marked";
import { useTheme } from "next-themes";
import { AIToolbar } from "@/components/ai-toolbar";
import { ThemeToggle } from "@/components/theme-toggle";
import { RichTextEditor } from "@/components/rich-text-editor";
import { DataStudio } from "@/components/data-studio";
import { ImageStudio } from "@/components/image-studio";
import { VisualStudio } from "@/components/visual-studio";
import type { AIAction } from "@/app/actions/ai";
import {
  htmlToMarkdown,
  markdownToStandaloneHtml,
  markdownToPlainText,
  markdownToLatex,
  latexToMarkdown,
  markdownToAsciiDoc,
  asciiDocToMarkdown,
  markdownToJira,
  markdownToMediaWiki,
  markdownToWordBlob,
  splitMarkdownByHeadings,
  transformText,
  sanitizePreviewHtml,
  DocumentExportTheme,
  TextTransformMode,
} from "@/lib/converters/document-converters";
import {
  extractTablesFromMarkdown,
  tableToDelimited,
  tableToJson,
} from "@/lib/converters/data-converters";
import {
  renderMindmapToSvg,
  parseMarkdownToSlides,
  exportSlidesToStandaloneHtml,
} from "@/lib/converters/mindmap-generator";
import {
  downloadBlob,
  downloadTextFile,
  downloadZipArchive,
  ZipEntry,
} from "@/lib/zip-archive";
import {
  FileDown,
  GripVertical,
  PanelLeftClose,
  PanelLeftOpen,
  Copy,
  Trash2,
  FolderArchive,
  FileText,
  Table2,
  Image as ImageIcon,
  Presentation,
  Wand2,
  Check,
  Undo2,
  X,
} from "lucide-react";

marked.setOptions({
  gfm: true,
  breaks: true,
});

const CODE_FENCE = "\x60\x60\x60";

const DEFAULT_MARKDOWN = [
  "# Welcome to Slate Conversion Suite",
  "",
  "A full-stack **Document, Data, Vector SVG & Visual Conversion Suite** with deterministic engines and DeepSeek AI.",
  "",
  "---",
  "",
  "## 4 Integrated Studios",
  "",
  "- **Document Studio** — Bidirectional Markdown <-> Rich Text, HTML, LaTeX, Word (.doc), AsciiDoc, Jira, PDF & Chapter .zip Splitter",
  "- **Data & Table Studio** — Convert between Markdown Tables, CSV, TSV, JSON, YAML, SQL, HTML & XML",
  "- **Image & Vector Studio** — True algorithmic JPG/PNG/WebP -> SVG contour vectorizer, SVG -> React .TSX, Favicon .zip Kit",
  "- **Slides & Mindmap Studio** — Turn Markdown into interactive slide decks and hierarchical SVG mindmaps",
  "",
  "---",
  "",
  "### Code Spotlight",
  "",
  CODE_FENCE + "typescript",
  "function convertSuite(input: string): string {",
  '  return "Deterministic + AI Powered: " + input;',
  "}",
  CODE_FENCE,
  "",
  "---",
  "",
  "### Conversion Capabilities",
  "",
  "| Studio | Primary Input | Output Formats |",
  "| :--- | :--- | :--- |",
  "| Document | Markdown / Rich Text | MD, PDF, DOC, HTML, TEX, ZIP |",
  "| Data | CSV / JSON / MD Table | CSV, TSV, JSON, YAML, SQL, XML |",
  "| Vector | JPG / PNG / WebP / SVG | SVG, TSX, PNG, WebP, ICO, ASCII |",
  "| Visual | Markdown Headings | Interactive Slides, Mindmap SVG |",
].join("\n");

type ActiveStudio = "document" | "data" | "image" | "visual";

interface ConvertedModal {
  title: string;
  code: string;
  ext: string;
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [studio, setStudio] = useState<ActiveStudio>("document");
  const [markdown, setMarkdown] = useState(DEFAULT_MARKDOWN);
  const [history, setHistory] = useState<string[]>([]);
  const [convertedView, setConvertedView] = useState<ConvertedModal | null>(null);
  const [splitRatio, setSplitRatio] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"text-to-markdown" | "markdown-to-text">("markdown-to-text");
  const [pdfTheme, setPdfTheme] = useState<DocumentExportTheme>("modern");
  const [docExportW, setDocExportW] = useState<number>(1240);
  const [docExportH, setDocExportH] = useState<number>(1754);
  const [aiOutput, setAiOutput] = useState<string | null>(null);
  const [editorVersion, setEditorVersion] = useState(0);
  const [mobileActivePane, setMobileActivePane] = useState<"editor" | "preview">("editor");
  const [copiedRichText, setCopiedRichText] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("slate-markdown");
    if (saved !== null) {
      const raw = saved.trim().startsWith("<!DOCTYPE html>")
        ? htmlToMarkdown(saved)
        : saved;
      const cleaned = raw.replace(/^(?:Slate Document\s*)+/i, "").trim();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMarkdown(cleaned || DEFAULT_MARKDOWN);
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem("slate-markdown", markdown);
    }
  }, [markdown, mounted]);

  const pushHistoryAndSet = useCallback((nextMd: string) => {
    setMarkdown((prev) => {
      if (prev !== nextMd) {
        setHistory((h) => [...h.slice(-14), prev]);
      }
      return nextMd;
    });
    setEditorVersion((v) => v + 1);
  }, []);

  const handleUndo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const last = h[h.length - 1];
      setMarkdown(last);
      setEditorVersion((v) => v + 1);
      return h.slice(0, -1);
    });
  }, []);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  // Safely render Markdown to HTML without allowing <style> tags to hijack the page body
  const renderedHtml = useMemo(() => {
    try {
      const raw = marked.parse(markdown) as string;
      return sanitizePreviewHtml(raw);
    } catch {
      return "<p>Invalid Markdown</p>";
    }
  }, [markdown]);

  // Resizable Split Panes
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pointerRatio = (x / rect.width) * 100;
      const newSplitRatio = activeTab === "text-to-markdown" ? 100 - pointerRatio : pointerRatio;
      setSplitRatio(Math.max(20, Math.min(80, newSplitRatio)));
    };
    const handleMouseUp = () => setIsResizing(false);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, activeTab]);

  // AI Actions
  const handleAIAction = useCallback(
    async (action: AIAction, targetLanguage?: string) => {
      const { aiAction } = await import("@/app/actions/ai");
      const result = await aiAction(markdown, action, targetLanguage);
      setAiOutput(result);
      pushHistoryAndSet(result);
    },
    [markdown, pushHistoryAndSet]
  );

  // Deterministic Document Conversions
  const handleDocConversion = (mode: string) => {
    switch (mode) {
      case "md-to-html":
        setConvertedView({
          title: "Standalone HTML5 Document",
          code: markdownToStandaloneHtml(markdown, "Slate Document", pdfTheme),
          ext: "html",
        });
        return;
      case "md-to-latex":
        setConvertedView({
          title: "LaTeX (.tex) Document",
          code: markdownToLatex(markdown, "Slate Document"),
          ext: "tex",
        });
        return;
      case "md-to-asciidoc":
        setConvertedView({
          title: "AsciiDoc (.adoc) Document",
          code: markdownToAsciiDoc(markdown),
          ext: "adoc",
        });
        return;
      case "md-to-jira":
        setConvertedView({
          title: "Jira Issue Markup",
          code: markdownToJira(markdown),
          ext: "txt",
        });
        return;
      case "md-to-mediawiki":
        setConvertedView({
          title: "MediaWiki Markup",
          code: markdownToMediaWiki(markdown),
          ext: "wiki",
        });
        return;
      case "html-to-md":
        pushHistoryAndSet(htmlToMarkdown(markdown));
        return;
      case "latex-to-md":
        pushHistoryAndSet(latexToMarkdown(markdown));
        return;
      case "asciidoc-to-md":
        pushHistoryAndSet(asciiDocToMarkdown(markdown));
        return;
      default:
        pushHistoryAndSet(transformText(markdown, mode as TextTransformMode));
        return;
    }
  };

  // Exports
  const handlePdfExport = useCallback(() => {
    const el = previewRef.current;
    if (!el) return;
    import("@/lib/pdf-export").then((mod) => {
      mod.exportToPdf(el, pdfTheme, docExportW, docExportH);
    });
  }, [pdfTheme, docExportW, docExportH]);

  const handleDocPngExport = useCallback(() => {
    const el = previewRef.current;
    if (!el) return;
    import("@/lib/pdf-export").then((mod) => {
      mod.exportDocumentToPng(el, pdfTheme, docExportW, docExportH);
    });
  }, [pdfTheme, docExportW, docExportH]);

  const handleCopyRichText = async () => {
    try {
      const htmlBlob = new Blob([renderedHtml], { type: "text/html" });
      const textBlob = new Blob([markdownToPlainText(markdown)], { type: "text/plain" });
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": htmlBlob,
          "text/plain": textBlob,
        }),
      ]);
      setCopiedRichText(true);
      setTimeout(() => setCopiedRichText(false), 2000);
    } catch {
      navigator.clipboard.writeText(markdownToPlainText(markdown));
    }
  };

  const handleDownloadProjectBundleZip = () => {
    const slides = parseMarkdownToSlides(markdown);
    const tables = extractTablesFromMarkdown(markdown);
    const chapters = splitMarkdownByHeadings(markdown);

    const entries: ZipEntry[] = [
      { name: "document.md", data: markdown },
      { name: "index.html", data: markdownToStandaloneHtml(markdown, "Slate Export", pdfTheme) },
      { name: "document.tex", data: markdownToLatex(markdown, "Slate Export") },
      { name: "document.adoc", data: markdownToAsciiDoc(markdown) },
      { name: "plain-text.txt", data: markdownToPlainText(markdown) },
      { name: "presentation-slides.html", data: exportSlidesToStandaloneHtml(slides, "Slate Presentation") },
      { name: "mindmap.svg", data: renderMindmapToSvg(markdown, resolvedTheme === "dark") },
      ...chapters.map((ch) => ({ name: ch.filename, data: ch.content })),
      ...tables.flatMap((t, idx) => [
        { name: "tables/table-" + (idx + 1) + ".csv", data: tableToDelimited(t, ",") },
        { name: "tables/table-" + (idx + 1) + ".json", data: tableToJson(t) },
      ]),
    ];

    downloadZipArchive(entries, "slate-complete-bundle.zip");
  };

  const handleReset = useCallback(() => {
    if (confirm("Reset the editor to default content?")) {
      localStorage.removeItem("slate-markdown");
      setMarkdown(DEFAULT_MARKDOWN);
      setHistory([]);
      setEditorVersion((v) => v + 1);
    }
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* Header */}
      <header className="relative flex h-12 shrink-0 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/slate-logo.svg" alt="Slate" className="h-5 w-5 dark:invert" />
            <span className="text-[13px] font-semibold tracking-tight text-foreground">
              Slate
            </span>
          </div>
          <span className="hidden sm:inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
            Full Conversion Suite
          </span>
        </div>

        {/* Studio Switcher */}
        <div className="flex items-center rounded-lg bg-muted/60 p-0.5 lg:absolute lg:left-1/2 lg:top-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2">
          {(
            [
              { id: "document", label: "Document", icon: FileText },
              { id: "data", label: "Data & Tables", icon: Table2 },
              { id: "image", label: "Image & SVG", icon: ImageIcon },
              { id: "visual", label: "Slides & Mindmap", icon: Presentation },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setStudio(item.id)}
                className={
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all " +
                  (studio === item.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden md:inline">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5">
          {history.length > 0 && (
            <button
              onClick={handleUndo}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-background px-2 text-xs font-medium text-foreground hover:bg-accent"
              title="Undo last conversion / AI change"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Undo</span>
            </button>
          )}

          {studio === "document" && (
            <button
              onClick={() => setPreviewCollapsed(!previewCollapsed)}
              className="hidden md:inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              title={previewCollapsed ? "Show preview" : "Hide preview"}
            >
              {previewCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          )}

          <button
            onClick={handleReset}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="Reset Editor"
          >
            <Trash2 className="h-4 w-4" />
          </button>

          <button
            onClick={handleDownloadProjectBundleZip}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            title="Download Complete Project Bundle (.zip)"
          >
            <FolderArchive className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Bundle (.zip)</span>
          </button>

          <ThemeToggle />
        </div>
      </header>

      {/* Non-Destructive Converted Code Drawer/Modal */}
      {convertedView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold text-foreground">
                {convertedView.title}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(convertedView.code)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium hover:bg-accent"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy Code
                </button>
                <button
                  onClick={() =>
                    downloadTextFile(
                      convertedView.code,
                      "slate-export." + convertedView.ext
                    )
                  }
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90"
                >
                  <FileDown className="h-3.5 w-3.5" /> Download .{convertedView.ext}
                </button>
                <button
                  onClick={() => {
                    pushHistoryAndSet(convertedView.code);
                    setConvertedView(null);
                  }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-muted px-2.5 text-xs font-medium hover:bg-accent"
                  title="Replace editor content (can be undone with Undo button)"
                >
                  Replace Editor
                </button>
                <button
                  onClick={() => setConvertedView(null)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <textarea
              readOnly
              value={convertedView.code}
              className="min-h-[380px] flex-1 resize-none bg-muted/20 p-4 font-mono text-xs leading-relaxed text-foreground focus:outline-none"
              spellCheck={false}
            />
          </div>
        </div>
      )}

      {/* Studio 2: Data & Tables */}
      {studio === "data" && (
        <DataStudio
          onSendToEditor={(mdTable) => {
            pushHistoryAndSet(markdown.trim() + "\n\n" + mdTable + "\n");
            setStudio("document");
          }}
        />
      )}

      {/* Studio 3: Image & True SVG Vectorizer */}
      {studio === "image" && (
        <ImageStudio
          onInsertMarkdown={(snippet) => {
            pushHistoryAndSet(markdown.trim() + "\n\n" + snippet + "\n");
            setStudio("document");
          }}
        />
      )}

      {/* Studio 4: Interactive Slides & Mindmap SVG */}
      {studio === "visual" && (
        <VisualStudio
          markdown={markdown}
          darkMode={resolvedTheme === "dark"}
          onAiRestructureSlides={async () => {
            await handleAIAction("to-slides");
          }}
        />
      )}

      {/* Studio 1: Document & Markup Studio */}
      {studio === "document" && (
        <>
          <div className="flex shrink-0 flex-col items-center justify-center gap-2 border-b border-border bg-card/40 px-4 py-2 backdrop-blur-sm">
            {/* Centered Toolbar 1: Mode Switcher + Instant Convert */}
            <HorizontalScrollStrip
              className="w-fit max-w-full rounded-xl border border-border bg-card/95 p-1 shadow-xs"
              innerClassName="gap-2 whitespace-nowrap justify-start sm:justify-center"
              scrollStep={200}
            >
              <div className="flex shrink-0 items-center rounded-lg bg-muted/60 p-0.5">
                <button
                  onClick={() => {
                    setActiveTab("text-to-markdown");
                    setEditorVersion((v) => v + 1);
                  }}
                  className={
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-all " +
                    (activeTab === "text-to-markdown"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  Text &rarr; Markdown
                </button>
                <button
                  onClick={() => setActiveTab("markdown-to-text")}
                  className={
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-all " +
                    (activeTab === "markdown-to-text"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  Markdown &rarr; Text / Preview
                </button>
              </div>

              <div className="h-4 w-px shrink-0 bg-border" />

              <div className="flex shrink-0 items-center gap-1.5 pr-1">
                <Wand2 className="h-3.5 w-3.5 text-muted-foreground" />
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      handleDocConversion(e.target.value);
                      e.target.value = "";
                    }
                  }}
                  className="h-7 w-[168px] rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none"
                >
                  <option value="" disabled>
                    Instant Convert / Clean
                  </option>
                  <optgroup label="Export / Inspect Markup (Non-Destructive)">
                    <option value="md-to-html">Markdown &rarr; Standalone HTML</option>
                    <option value="md-to-latex">Markdown &rarr; LaTeX (.tex)</option>
                    <option value="md-to-asciidoc">Markdown &rarr; AsciiDoc</option>
                    <option value="md-to-jira">Markdown &rarr; Jira Markup</option>
                    <option value="md-to-mediawiki">Markdown &rarr; MediaWiki</option>
                  </optgroup>
                  <optgroup label="Import Markup to Markdown">
                    <option value="html-to-md">HTML &rarr; Clean Markdown</option>
                    <option value="latex-to-md">LaTeX (.tex) &rarr; Markdown</option>
                    <option value="asciidoc-to-md">AsciiDoc &rarr; Markdown</option>
                  </optgroup>
                  <optgroup label="Text Cleaners & Case">
                    <option value="unwrap-pdf">Heal Broken PDF Line-Wraps</option>
                    <option value="strip-markdown">Strip Markdown to Plain Text</option>
                    <option value="normalize-quotes">Normalize Smart Quotes</option>
                    <option value="title-case">Title Case</option>
                    <option value="sentence-case">Sentence case</option>
                    <option value="upper-case">UPPERCASE</option>
                    <option value="lower-case">lowercase</option>
                    <option value="snake-case">snake_case</option>
                    <option value="kebab-case">kebab-case / slugify</option>
                    <option value="sort-lines">Sort Lines A-Z</option>
                    <option value="dedupe-lines">Remove Duplicate Lines</option>
                  </optgroup>
                </select>
              </div>
            </HorizontalScrollStrip>

            {/* Centered Toolbar 2: Export Actions */}
            <HorizontalScrollStrip
              className="w-fit max-w-full rounded-xl border border-border bg-card/95 p-1 shadow-xs"
              innerClassName="gap-1.5 whitespace-nowrap justify-start sm:justify-center"
              scrollStep={200}
            >
              <button
                onClick={handleCopyRichText}
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs font-medium hover:bg-accent"
                title="Copy formatted Rich Text for Google Docs, Word, Notion, or Gmail"
              >
                {copiedRichText ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                <span>{copiedRichText ? "Copied!" : "Copy Rich Text"}</span>
              </button>

              <button
                onClick={() => downloadTextFile(markdown, "document.md", "text/markdown")}
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium hover:bg-accent"
              >
                <FileDown className="h-3 w-3" /> .MD
              </button>

              <button
                onClick={() =>
                  downloadBlob(markdownToWordBlob(markdown, "Slate Document"), "document.doc")
                }
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium hover:bg-accent"
              >
                <FileDown className="h-3 w-3" /> .DOC
              </button>

              <button
                onClick={() =>
                  downloadTextFile(
                    markdownToStandaloneHtml(markdown, "Slate Document", pdfTheme),
                    "document.html",
                    "text/html"
                  )
                }
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium hover:bg-accent"
              >
                <FileDown className="h-3 w-3" /> .HTML
              </button>

              <button
                onClick={() =>
                  downloadTextFile(markdownToLatex(markdown, "Slate Document"), "document.tex")
                }
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium hover:bg-accent"
              >
                <FileDown className="h-3 w-3" /> .TEX
              </button>

              <div
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 text-[11px] text-muted-foreground"
                title="Controlled Export Dimensions (px)"
              >
                <span>Size</span>
                <input
                  type="number"
                  min={300}
                  max={8000}
                  step={50}
                  value={docExportW}
                  onChange={(e) => setDocExportW(Number(e.target.value) || 1240)}
                  className="w-12 bg-transparent text-center font-mono text-xs text-foreground focus:outline-none"
                />
                <span>&times;</span>
                <input
                  type="number"
                  min={300}
                  max={8000}
                  step={50}
                  value={docExportH}
                  onChange={(e) => setDocExportH(Number(e.target.value) || 1754)}
                  className="w-12 bg-transparent text-center font-mono text-xs text-foreground focus:outline-none"
                />
              </div>

              <button
                onClick={handleDocPngExport}
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium hover:bg-accent"
                title="Download Controlled-Size .PNG"
              >
                <FileDown className="h-3 w-3" /> .PNG
              </button>

              <div className="flex shrink-0 items-center rounded-md border border-border bg-background">
                <select
                  value={pdfTheme}
                  onChange={(e) => setPdfTheme(e.target.value as DocumentExportTheme)}
                  className="h-7 bg-transparent px-1.5 text-xs focus:outline-none"
                  title="PDF Export Theme"
                >
                  <option value="modern">Modern PDF</option>
                  <option value="github">GitHub PDF</option>
                  <option value="academic">Academic PDF</option>
                  <option value="minimal">Minimal PDF</option>
                </select>
                <button
                  onClick={handlePdfExport}
                  className="inline-flex h-7 items-center gap-1 border-l border-border px-2 text-xs font-medium hover:bg-accent"
                  title="Download Native Controlled-Size .PDF (No Print Dialog)"
                >
                  <FileDown className="h-3 w-3" /> .PDF
                </button>
              </div>
            </HorizontalScrollStrip>
          </div>

          <div className="flex shrink-0 items-center justify-center border-b border-border bg-card/30 px-4 py-1.5 backdrop-blur-sm">
            <AIToolbar onAction={handleAIAction} selectedText={markdown} />
          </div>

          <div
            ref={containerRef}
            className={
              "relative flex flex-1 overflow-hidden " +
              (activeTab === "text-to-markdown" ? "flex-row-reverse" : "flex-row")
            }
          >
            <div
              className={
                "flex-col overflow-hidden bg-[var(--editor-bg)] w-full md:w-[var(--desktop-width)] " +
                ((activeTab === "markdown-to-text" && mobileActivePane === "editor") ||
                (activeTab === "text-to-markdown" && mobileActivePane === "preview")
                  ? "flex"
                  : "hidden md:flex")
              }
              style={
                {
                  "--desktop-width": previewCollapsed ? "100%" : splitRatio + "%",
                } as React.CSSProperties
              }
            >
              <div className="flex shrink-0 items-center border-b border-[var(--editor-border)] px-4 py-2">
                <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/60">
                  {activeTab === "text-to-markdown" ? "Generated Markdown" : "Markdown Source"}
                </span>
                <div className="ml-auto flex items-center gap-3">
                  <span className="font-mono text-[11px] text-muted-foreground/60">
                    {markdown.split(/\s+/).filter(Boolean).length} words
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(markdown)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="h-3 w-3" /> Copy MD
                  </button>
                </div>
              </div>
              <textarea
                ref={editorRef}
                value={markdown}
                onChange={(e) => {
                  setMarkdown(e.target.value);
                  setAiOutput(null);
                }}
                className="flex-1 resize-none border-0 bg-transparent p-4 font-mono text-[14px] leading-relaxed text-foreground focus:outline-none"
                placeholder="Write or paste Markdown, HTML, or LaTeX..."
                spellCheck={false}
              />
            </div>

            {!previewCollapsed && (
              <div
                className={"resize-handle z-10 hidden md:block " + (isResizing ? "resizing" : "")}
                onMouseDown={handleMouseDown}
              >
                <div className="flex h-full items-center justify-center">
                  <GripVertical className="h-3 w-3 text-muted-foreground/40" />
                </div>
              </div>
            )}

            {!previewCollapsed && (
              <div
                className={
                  "flex-col overflow-hidden bg-background w-full md:w-[var(--desktop-width)] " +
                  ((activeTab === "text-to-markdown" && mobileActivePane === "editor") ||
                  (activeTab === "markdown-to-text" && mobileActivePane === "preview")
                    ? "flex"
                    : "hidden md:flex")
                }
                style={{ "--desktop-width": 100 - splitRatio + "%" } as React.CSSProperties}
              >
                <div className="flex shrink-0 items-center border-b border-border px-4 py-2">
                  <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/60">
                    {activeTab === "text-to-markdown" ? "Rich Text Editor" : "Live Preview"}
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    {aiOutput && (
                      <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-500">
                        AI Enhanced
                      </span>
                    )}
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(markdownToPlainText(markdown))
                      }
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-3 w-3" /> Copy Plain Text
                    </button>
                  </div>
                </div>

                {activeTab === "text-to-markdown" ? (
                  <RichTextEditor
                    content={renderedHtml}
                    forceSyncVersion={editorVersion}
                    onUpdate={(html) => {
                      const md = htmlToMarkdown(html);
                      setMarkdown(md);
                      setAiOutput(null);
                    }}
                  />
                ) : (
                  <div
                    ref={previewRef}
                    id="pdf-content"
                    className="prose-custom prose-preview flex-1 overflow-y-auto p-6"
                    dangerouslySetInnerHTML={{ __html: renderedHtml }}
                  />
                )}
              </div>
            )}
          </div>

          <div className="flex h-12 shrink-0 items-center justify-center border-t border-border bg-card/80 md:hidden">
            <div className="flex rounded-lg bg-muted/60 p-1">
              <button
                onClick={() => setMobileActivePane("editor")}
                className={
                  "rounded-md px-5 py-1 text-xs font-medium " +
                  (mobileActivePane === "editor"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground")
                }
              >
                Editor
              </button>
              <button
                onClick={() => setMobileActivePane("preview")}
                className={
                  "rounded-md px-5 py-1 text-xs font-medium " +
                  (mobileActivePane === "preview"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground")
                }
              >
                Preview
              </button>
            </div>
          </div>
        </>
      )}

      <footer className="hidden h-7 shrink-0 items-center justify-between border-t border-border bg-card/60 px-4 text-[10px] text-muted-foreground/60 md:flex">
        <div className="flex items-center gap-4">
          <span>{markdown.length.toLocaleString()} chars</span>
          <span>{markdown.split(/\s+/).filter(Boolean).length.toLocaleString()} words</span>
          <span>
            ~{Math.max(1, Math.ceil(markdown.split(/\s+/).filter(Boolean).length / 200))} min read
          </span>
        </div>
        <span>Slate Conversion Suite &bull; Deterministic + DeepSeek AI</span>
      </footer>
    </div>
  );
}
