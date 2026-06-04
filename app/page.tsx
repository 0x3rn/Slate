"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { marked } from "marked";
import { useTheme } from "next-themes";
import { AIToolbar } from "@/components/ai-toolbar";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  FileDown,
  GripVertical,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

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
  const [markdown, setMarkdown] = useState(DEFAULT_MARKDOWN);
  const [splitRatio, setSplitRatio] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [aiOutput, setAiOutput] = useState<string | null>(null);
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
      const ratio = Math.max(20, Math.min(80, (x / rect.width) * 100));
      setSplitRatio(ratio);
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
  }, [isResizing]);

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

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPreviewCollapsed(!previewCollapsed)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-accent-foreground"
            title={previewCollapsed ? "Show preview" : "Hide preview"}
          >
            {previewCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={handlePdfExport}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-accent-foreground"
            title="Export to PDF (⌘P)"
          >
            <FileDown className="h-3.5 w-3.5" />
            <span>PDF</span>
          </button>
          <div className="mx-1 h-5 w-px bg-border" />
          <ThemeToggle />
        </div>
      </header>

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
        className="relative flex flex-1 overflow-hidden"
      >
        {/* Editor Pane */}
        <div
          className="flex flex-col overflow-hidden bg-[var(--editor-bg)]"
          style={{
            width: previewCollapsed
              ? "100%"
              : `${splitRatio}%`,
          }}
        >
          <div className="flex shrink-0 items-center border-b border-[var(--editor-border)] px-4 py-2">
            <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/50">
              Markdown
            </span>
            <span className="ml-auto text-[11px] text-muted-foreground/50 font-mono">
              {markdown.split(/\s+/).filter(Boolean).length} words
            </span>
          </div>
          <textarea
            ref={editorRef}
            value={markdown}
            onChange={(e) => {
              setMarkdown(e.target.value);
              setAiOutput(null);
            }}
            className="flex-1 resize-none border-0 bg-transparent p-4 font-mono text-[14px] leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-0"
            placeholder="Start writing Markdown..."
            spellCheck={false}
          />
        </div>

        {/* Resize Handle */}
        {!previewCollapsed && (
          <div
            className={`resize-handle z-10 ${isResizing ? "resizing" : ""}`}
            onMouseDown={handleMouseDown}
          >
            <div className="flex h-full items-center justify-center">
              <GripVertical className="h-3 w-3 text-muted-foreground/0 transition-colors hover:text-muted-foreground/40" />
            </div>
          </div>
        )}

        {/* Preview Pane */}
        {!previewCollapsed && (
          <div
            className="flex flex-col overflow-hidden bg-background"
            style={{ width: `${100 - splitRatio}%` }}
          >
            <div className="flex shrink-0 items-center border-b border-border px-4 py-2">
              <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/50">
                Preview
              </span>
              <div className="ml-auto flex items-center gap-2">
                {aiOutput && (
                  <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-500">
                    AI Enhanced
                  </span>
                )}
              </div>
            </div>
            <div
              ref={previewRef}
              id="pdf-content"
              className="prose-custom prose-preview flex-1 overflow-y-auto p-6"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          </div>
        )}
      </div>

      {/* ---- Status Bar ---- */}
      <footer className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-card/60 px-4 backdrop-blur-sm">
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
