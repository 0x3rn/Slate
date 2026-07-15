"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { marked } from "marked";
import { useTheme } from "next-themes";
import { AIToolbar } from "@/components/ai-toolbar";
import { ThemeToggle } from "@/components/theme-toggle";
import { RichTextEditor } from "@/components/rich-text-editor";
import TurndownService from 'turndown';
import {
  FileDown,
  GripVertical,
  PanelLeftClose,
  PanelLeftOpen,
  Copy,
  Trash2,
} from "lucide-react";

const turndownService = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '_',
});

// Configure marked for safe rendering
marked.setOptions({
  gfm: true,
  breaks: true,
});

const DEFAULT_MARKDOWN = `# Welcome to Slate

A beautiful, AI-powered **Markdown editor** with live preview.

---

## Features

- **Split-Screen Editing** — Write raw Markdown on the left, see a styled preview on the right
- **AI-Powered** — Improve your writing, fix grammar, or summarize text with a single click
- **Dark & Light Mode** — Looks great in any lighting
- **Export to PDF** — Download your notes as a PDF
- **Resizable Panes** — Drag to resize the editor and preview

---

## Try It Out

> "The best way to predict the future is to invent it." — Alan Kay

### Code blocks

Here's a \`TypeScript\` example:

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}! Welcome to Slate.\`;
}

console.log(greet("Writer"));
\`\`\`

### Tables

| Feature | Status |
|---------|--------|
| Markdown Rendering | ✅ |
| AI Writing Assistant | ✅ |
| PDF Export | ✅ |

---

Start typing or paste your own Markdown to get started! 🚀
`;

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [markdown, setMarkdown] = useState(DEFAULT_MARKDOWN);
  const [splitRatio, setSplitRatio] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"text-to-markdown" | "markdown-to-text">("text-to-markdown");
  const [aiOutput, setAiOutput] = useState<string | null>(null);
  const [editorVersion, setEditorVersion] = useState(0);
  const [mobileActivePane, setMobileActivePane] = useState<"editor" | "preview">("editor");

  useEffect(() => {
    const saved = localStorage.getItem("slate-markdown");
    if (saved !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMarkdown(saved);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem("slate-markdown", markdown);
    }
  }, [markdown, mounted]);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  // Render markdown to HTML
  const renderedHtml = useMemo(() => {
    try {
      return marked.parse(markdown) as string;
    } catch {
      return "<p>Invalid Markdown</p>";
    }
  }, [markdown]);

  // ---- Resizable Panes ----
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
    },
    []
  );

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

    const handleMouseUp = () => {
      setIsResizing(false);
    };

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

  // ---- AI Actions ----
  const handleAIAction = useCallback(
    async (action: "summarize" | "improve" | "fix-grammar") => {
      const textToProcess = markdown;

      try {
        const { summarizeText, improveWriting, fixGrammar } = await import(
          "@/app/actions/ai"
        );

        let result: string;
        switch (action) {
          case "summarize":
            result = await summarizeText(textToProcess);
            break;
          case "improve":
            result = await improveWriting(textToProcess);
            break;
          case "fix-grammar":
            result = await fixGrammar(textToProcess);
            break;
        }

        setAiOutput(result);
        setMarkdown(result);
        setEditorVersion(v => v + 1);
      } catch (error) {
        console.error("AI action failed:", error);
      }
    },
    [markdown]
  );

  // ---- PDF Export ----
  const handlePdfExport = useCallback(() => {
    const el = previewRef.current;
    if (!el) return;

    import("@/lib/pdf-export").then((mod) => {
      mod.exportToPdf(el);
    });
  }, []);

  // ---- MD Export ----
  const handleMdExport = useCallback(() => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "document.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [markdown]);

  const handleReset = useCallback(() => {
    if (confirm("Are you sure you want to reset the editor to the default content? This will clear your saved work.")) {
      localStorage.removeItem("slate-markdown");
      setMarkdown(DEFAULT_MARKDOWN);
      setEditorVersion(v => v + 1);
    }
  }, []);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === "p") {
        e.preventDefault();
        handlePdfExport();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handlePdfExport]);

  // We removed handlePreviewInput because RichTextEditor handles onUpdate internally

  if (!mounted) return null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {/* ---- Header ---- */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/slate-logo.svg"
              alt="Slate"
              className="h-5 w-5"
            />
            <span className="text-[13px] font-semibold tracking-tight text-foreground">
              Slate
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground/60 select-none">
            AI-Powered
          </span>
        </div>

        <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center rounded-lg bg-muted/50 p-0.5">
          <button
            onClick={() => {
              setActiveTab("text-to-markdown");
              setEditorVersion(v => v + 1);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeTab === "text-to-markdown"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Text to Markdown
          </button>
          <button
            onClick={() => setActiveTab("markdown-to-text")}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeTab === "markdown-to-text"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Markdown to Text
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPreviewCollapsed(!previewCollapsed)}
            className="hidden md:inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-accent-foreground"
            title={previewCollapsed ? "Show preview" : "Hide preview"}
          >
            {previewCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
          
          <button
            onClick={handleReset}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-all duration-150 hover:bg-destructive/10 hover:text-destructive"
            title="Reset Editor"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <div className="mx-1 h-5 w-px bg-border" />

          {activeTab === "text-to-markdown" ? (
            <button
              onClick={handleMdExport}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-accent-foreground"
              title="Download .md file"
            >
              <FileDown className="h-4 w-4" />
              <span className="hidden md:inline">Download .md file</span>
            </button>
          ) : (
            <button
              onClick={handlePdfExport}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] font-medium text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-accent-foreground"
              title="Export to PDF (⌘P)"
            >
              <FileDown className="h-4 w-4" />
              <span className="hidden md:inline">Download PDF</span>
            </button>
          )}
          <div className="mx-1 h-5 w-px bg-border" />
          <ThemeToggle />
        </div>
      </header>

      {/* ---- Mobile Mode Toggle ---- */}
      <div className="flex md:hidden w-full shrink-0 items-center justify-center border-b border-border bg-card/60 px-4 py-2 backdrop-blur-sm">
        <div className="flex w-full items-center rounded-lg bg-muted/50 p-0.5">
          <button
            onClick={() => {
              setActiveTab("text-to-markdown");
              setEditorVersion(v => v + 1);
            }}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeTab === "text-to-markdown"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Text to Markdown
          </button>
          <button
            onClick={() => setActiveTab("markdown-to-text")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
              activeTab === "markdown-to-text"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Markdown to Text
          </button>
        </div>
      </div>

      {/* ---- AI Toolbar ---- */}
      <div className="flex shrink-0 items-center justify-center border-b border-border bg-card/40 px-4 py-2 backdrop-blur-sm">
        <AIToolbar
          onAction={handleAIAction}
          selectedText={markdown}
        />
      </div>

      {/* ---- Editor + Preview ---- */}
      <div
        ref={containerRef}
        className={`relative flex flex-1 overflow-hidden ${
          activeTab === "text-to-markdown" ? "flex-row-reverse" : "flex-row"
        }`}
      >
        {/* Editor Pane (Textarea) */}
        <div
          className={`flex-col overflow-hidden bg-[var(--editor-bg)] w-full md:w-[var(--desktop-width)] ${
            (activeTab === "markdown-to-text" && mobileActivePane === "editor") ||
            (activeTab === "text-to-markdown" && mobileActivePane === "preview")
              ? "flex"
              : "hidden md:flex"
          }`}
          style={{
            "--desktop-width": previewCollapsed ? "100%" : `${splitRatio}%`,
          } as React.CSSProperties}
        >
          <div className="flex shrink-0 items-center border-b border-[var(--editor-border)] px-4 py-2">
            <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/50">
              {activeTab === "text-to-markdown" ? "Markdown Preview" : "Markdown"}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground/50 font-mono">
                {markdown.split(/\s+/).filter(Boolean).length} words
              </span>
              {activeTab === "text-to-markdown" && (
                <button
                  onClick={() => navigator.clipboard.writeText(markdown)}
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors ml-2"
                >
                  <Copy className="h-3 w-3" />
                  Copy markdown
                </button>
              )}
            </div>
          </div>
          <textarea
            ref={editorRef}
            value={markdown}
            readOnly={activeTab === "text-to-markdown"}
            onChange={(e) => {
              setMarkdown(e.target.value);
              setAiOutput(null);
            }}
            className={`flex-1 resize-none border-0 bg-transparent p-4 font-mono text-[14px] leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-0 ${
              activeTab === "text-to-markdown" ? "opacity-70 cursor-default select-all" : ""
            }`}
            placeholder="Start writing Markdown..."
            spellCheck={false}
          />
        </div>

        {/* Resize Handle */}
        {!previewCollapsed && (
          <div
            className={`resize-handle z-10 hidden md:block ${isResizing ? "resizing" : ""}`}
            onMouseDown={handleMouseDown}
          >
            <div className="flex h-full items-center justify-center">
              <GripVertical className="h-3 w-3 text-muted-foreground/0 transition-colors hover:text-muted-foreground/40" />
            </div>
          </div>
        )}

        {/* Preview Pane (HTML rendering) */}
        {!previewCollapsed && (
          <div
            className={`flex-col overflow-hidden bg-background w-full md:w-[var(--desktop-width)] ${
              (activeTab === "text-to-markdown" && mobileActivePane === "editor") ||
              (activeTab === "markdown-to-text" && mobileActivePane === "preview")
                ? "flex"
                : "hidden md:flex"
            }`}
            style={{ "--desktop-width": `${100 - splitRatio}%` } as React.CSSProperties}
          >
            <div className="flex shrink-0 items-center border-b border-border px-4 py-2">
              <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/50">
                {activeTab === "text-to-markdown" ? "Text" : "Preview"}
              </span>
              <div className="ml-auto flex items-center gap-2">
                {aiOutput && (
                  <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-500">
                    AI Enhanced
                  </span>
                )}
                {activeTab === "markdown-to-text" && (
                  <button
                    onClick={() => {
                      if (previewRef.current) {
                        navigator.clipboard.writeText(previewRef.current.innerText);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Copy className="h-3 w-3" />
                    Copy text
                  </button>
                )}
              </div>
            </div>
            
            {/* If text-to-markdown, we render the Rich Text Editor */}
            {activeTab === "text-to-markdown" ? (
              <RichTextEditor
                content={renderedHtml}
                forceSyncVersion={editorVersion}
                onUpdate={(html) => {
                  const md = turndownService.turndown(html);
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

      {/* ---- Mobile Tab Bar ---- */}
      <div className="md:hidden flex h-14 shrink-0 items-center justify-center border-t border-border bg-card/80 backdrop-blur-md relative z-50">
        <div className="flex bg-muted/50 p-1 rounded-lg">
          <button
            onClick={() => setMobileActivePane("editor")}
            className={`px-6 py-2 text-sm font-medium rounded-md transition-all ${
              mobileActivePane === "editor"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Editor
          </button>
          <button
            onClick={() => setMobileActivePane("preview")}
            className={`px-6 py-2 text-sm font-medium rounded-md transition-all ${
              mobileActivePane === "preview"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Preview
          </button>
        </div>
      </div>

      {/* ---- Status Bar ---- */}
      <footer className="hidden md:flex h-7 shrink-0 items-center justify-between border-t border-border bg-card/60 px-4 backdrop-blur-sm">
        <span className="text-[10px] text-muted-foreground/50">
          {markdown.length.toLocaleString()} characters
        </span>
        <span className="text-[10px] text-muted-foreground/50">
          &copy; 2026 Slate
        </span>
      </footer>
    </div>
  );
}
