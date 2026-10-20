"use client";

import { useState, useMemo, useEffect } from "react";
import {
  renderMindmapToSvg,
  parseMarkdownToSlides,
  exportSlidesToStandaloneHtml,
  SlideThemeId,
} from "@/lib/converters/mindmap-generator";
import { downloadTextFile } from "@/lib/zip-archive";
import {
  Presentation,
  Network,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Copy,
  Sparkles,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";

interface VisualStudioProps {
  markdown: string;
  darkMode: boolean;
  onAiRestructureSlides?: () => Promise<void>;
}

const SLIDE_THEMES: {
  id: SlideThemeId;
  label: string;
  stageClass: string;
  accentClass: string;
  footerClass: string;
}[] = [
  {
    id: "obsidian",
    label: "Obsidian Pitch",
    stageClass:
      "bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-slate-100 border-indigo-500/30 [&_h1]:text-white [&_h2]:text-white [&_h3]:text-indigo-200 [&_strong]:text-white [&_code]:bg-indigo-950/80 [&_code]:text-indigo-200 [&_pre]:bg-black/50 [&_pre]:border-indigo-500/20 [&_th]:bg-white/10 [&_td]:border-white/15 [&_th]:border-white/15",
    accentClass: "bg-indigo-500",
    footerClass: "text-slate-400 border-white/10",
  },
  {
    id: "executive",
    label: "Executive Clean",
    stageClass:
      "bg-white text-slate-800 border-slate-200 [&_h1]:text-slate-950 [&_h2]:text-slate-900 [&_h3]:text-blue-700 [&_strong]:text-slate-950 [&_code]:bg-slate-100 [&_code]:text-rose-600 [&_pre]:bg-slate-900 [&_pre]:text-slate-100 [&_th]:bg-slate-100 [&_td]:border-slate-200 [&_th]:border-slate-200",
    accentClass: "bg-blue-600",
    footerClass: "text-slate-400 border-slate-200",
  },
  {
    id: "aurora",
    label: "Keynote Aurora",
    stageClass:
      "bg-gradient-to-tr from-slate-950 via-purple-950 to-teal-900 text-white border-teal-400/30 [&_h1]:text-white [&_h2]:text-teal-200 [&_h3]:text-purple-200 [&_strong]:text-teal-300 [&_code]:bg-black/40 [&_code]:text-teal-200 [&_pre]:bg-black/50 [&_th]:bg-white/10 [&_td]:border-white/15 [&_th]:border-white/15",
    accentClass: "bg-teal-400",
    footerClass: "text-teal-200/70 border-white/10",
  },
  {
    id: "terminal",
    label: "Dev Terminal",
    stageClass:
      "bg-zinc-950 text-emerald-400 font-mono border-emerald-500/40 [&_h1]:text-emerald-300 [&_h2]:text-emerald-300 [&_h3]:text-emerald-400 [&_strong]:text-white [&_code]:bg-emerald-950/60 [&_code]:text-emerald-200 [&_pre]:bg-black/80 [&_pre]:border-emerald-500/30 [&_th]:bg-emerald-950/40 [&_td]:border-emerald-500/20 [&_th]:border-emerald-500/20",
    accentClass: "bg-emerald-500",
    footerClass: "text-emerald-500/60 border-emerald-500/20",
  },
  {
    id: "editorial",
    label: "Editorial Warm",
    stageClass:
      "bg-[#faf6f0] text-stone-800 font-serif border-stone-300 [&_h1]:text-stone-950 [&_h2]:text-stone-900 [&_h3]:text-amber-800 [&_strong]:text-stone-950 [&_code]:bg-stone-200/70 [&_code]:text-amber-900 [&_pre]:bg-stone-900 [&_pre]:text-stone-100 [&_th]:bg-stone-200/60 [&_td]:border-stone-300 [&_th]:border-stone-300",
    accentClass: "bg-amber-700",
    footerClass: "text-stone-500 border-stone-300",
  },
  {
    id: "swiss",
    label: "Swiss Grid",
    stageClass:
      "bg-white text-black border-2 border-black [&_h1]:text-black [&_h2]:text-black [&_h3]:text-black [&_strong]:underline [&_code]:bg-zinc-100 [&_code]:text-black [&_pre]:bg-zinc-950 [&_pre]:text-white [&_th]:bg-black [&_th]:text-white [&_td]:border-black [&_th]:border-black",
    accentClass: "bg-red-600",
    footerClass: "text-zinc-600 border-black",
  },
];

export function VisualStudio({
  markdown,
  darkMode,
  onAiRestructureSlides,
}: VisualStudioProps) {
  const [mode, setMode] = useState<"slides" | "mindmap">("slides");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideTheme, setSlideTheme] = useState<SlideThemeId>("obsidian");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [mindmapZoom, setMindmapZoom] = useState(1);

  const slides = useMemo(() => parseMarkdownToSlides(markdown), [markdown]);
  const mindmapSvg = useMemo(
    () => renderMindmapToSvg(markdown, darkMode),
    [markdown, darkMode]
  );

  const safeSlideIdx = Math.min(currentSlide, Math.max(0, slides.length - 1));
  const activeSlide = slides[safeSlideIdx];
  const activeTheme =
    SLIDE_THEMES.find((t) => t.id === slideTheme) || SLIDE_THEMES[0];

  useEffect(() => {
    if (mode !== "slides") return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        setCurrentSlide((s) => Math.min(slides.length - 1, s + 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        setCurrentSlide((s) => Math.max(0, s - 1));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [mode, slides.length]);

  const handleAiFormat = async () => {
    if (!onAiRestructureSlides) return;
    setAiLoading(true);
    setAiError(null);
    try {
      await onAiRestructureSlides();
      setCurrentSlide(0);
    } catch {
      setAiError("Could not restructure slides. Please try again.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Top Studio Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card/60 px-4 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-muted/60 p-0.5">
            <button
              onClick={() => setMode("slides")}
              className={
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all " +
                (mode === "slides"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              <Presentation className="h-3.5 w-3.5 text-amber-500" />
              Slide Deck ({slides.length} slides)
            </button>
            <button
              onClick={() => setMode("mindmap")}
              className={
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all " +
                (mode === "mindmap"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              <Network className="h-3.5 w-3.5 text-indigo-500" />
              Mindmap SVG Tree
            </button>
          </div>

          {mode === "slides" && (
            <>
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-medium text-muted-foreground">
                  Preset:
                </span>
                <select
                  value={slideTheme}
                  onChange={(e) => setSlideTheme(e.target.value as SlideThemeId)}
                  className="h-7 rounded-md border border-border bg-background px-2 text-xs font-medium"
                >
                  {SLIDE_THEMES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {onAiRestructureSlides && (
                <button
                  onClick={handleAiFormat}
                  disabled={aiLoading}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2.5 text-xs font-medium text-indigo-500 hover:bg-indigo-500/20 disabled:opacity-50"
                  title="Use AI to smartly summarize and restructure your document into presentation slides"
                >
                  {aiLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  <span>AI Smart Slide Layout</span>
                </button>
              )}

              {aiError && (
                <span
                  role="status"
                  aria-live="polite"
                  className="text-[11px] text-destructive"
                >
                  {aiError}
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {mode === "slides" ? (
            <button
              onClick={() =>
                downloadTextFile(
                  exportSlidesToStandaloneHtml(slides, "Slate Presentation", slideTheme),
                  "slate-slides.html",
                  "text/html"
                )
              }
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              <FileDown className="h-3.5 w-3.5" />
              Download Slide Deck (.html)
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setMindmapZoom((z) => Math.max(0.5, z - 0.2))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background hover:bg-accent"
                title="Zoom Out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="w-12 text-center font-mono text-xs">
                {Math.round(mindmapZoom * 100)}%
              </span>
              <button
                onClick={() => setMindmapZoom((z) => Math.min(2.2, z + 0.2))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background hover:bg-accent"
                title="Zoom In"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setMindmapZoom(1)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background hover:bg-accent"
                title="Reset Zoom"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(mindmapSvg)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium hover:bg-accent"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy SVG
              </button>
              <button
                onClick={() =>
                  downloadTextFile(mindmapSvg, "slate-mindmap.svg", "image/svg+xml")
                }
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                <FileDown className="h-3.5 w-3.5" />
                Download (.svg)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Studio Body */}
      {mode === "slides" ? (
        <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-12">
          {/* Left Filmstrip Sidebar */}
          <div className="hidden flex-col gap-2 overflow-y-auto border-r border-border bg-card/30 p-3 md:flex md:col-span-3 lg:col-span-2">
            <span className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Slides (Auto-Paginated)
            </span>
            {slides.map((s, idx) => (
              <button
                key={s.index}
                onClick={() => setCurrentSlide(idx)}
                className={
                  "flex flex-col gap-1 rounded-lg border p-2.5 text-left transition-all " +
                  (idx === safeSlideIdx
                    ? "border-primary bg-primary/10 shadow-xs"
                    : "border-border bg-background/60 hover:bg-accent")
                }
              >
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="font-mono font-semibold">#{idx + 1}</span>
                  <span className="rounded bg-muted px-1.5 py-0.2 uppercase">
                    {s.layout}
                  </span>
                </div>
                <p className="truncate text-xs font-semibold text-foreground">
                  {s.title}
                </p>
              </button>
            ))}
          </div>

          {/* Right 16:9 Contained Presentation Stage */}
          <div className="flex flex-col items-center justify-between overflow-y-auto bg-muted/30 p-4 md:col-span-9 md:p-8 lg:col-span-10">
            <div className="my-auto flex w-full max-w-4xl flex-col items-center">
              {/* Strict 16:9 Slide Container — Content is strictly contained inside */}
              <div
                className={
                  "relative flex aspect-[16/10] w-full flex-col justify-between overflow-hidden rounded-2xl border shadow-xl transition-colors duration-200 " +
                  activeTheme.stageClass
                }
              >
                {/* Top Accent Bar */}
                <div className={"h-1.5 w-full shrink-0 " + activeTheme.accentClass} />

                {/* Contained Slide Content Body */}
                <div
                  className={
                    "flex-1 overflow-y-auto px-8 py-6 md:px-14 md:py-10 " +
                    (activeSlide?.layout === "cover"
                      ? "flex flex-col items-center justify-center text-center [&_h1]:text-4xl md:[&_h1]:text-5xl"
                      : "[&_h1]:text-2xl md:[&_h1]:text-3xl [&_h2]:text-xl md:[&_h2]:text-2xl [&_h3]:text-lg [&_p]:my-2 [&_ul]:my-2 [&_li]:my-1 [&_pre]:my-3 [&_pre]:p-3 [&_pre]:text-xs [&_table]:my-3 [&_table]:w-full [&_th]:p-2 [&_td]:p-2 [&_table]:text-xs")
                  }
                  dangerouslySetInnerHTML={{ __html: activeSlide?.html || "" }}
                />

                {/* Contained Slide Footer */}
                <div
                  className={
                    "flex shrink-0 items-center justify-between border-t px-8 py-3 text-xs " +
                    activeTheme.footerClass
                  }
                >
                  <span className="truncate font-medium">{activeSlide?.title}</span>
                  <span className="font-mono">
                    {safeSlideIdx + 1} / {slides.length}
                  </span>
                </div>
              </div>

              {activeSlide?.speakerNotes && (
                <div className="mt-3 w-full rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
                  <strong className="text-foreground">Speaker Notes: </strong>
                  {activeSlide.speakerNotes}
                </div>
              )}
            </div>

            {/* Bottom Controls */}
            <div className="mt-4 flex shrink-0 items-center gap-3">
              <button
                onClick={() => setCurrentSlide((s) => Math.max(0, s - 1))}
                disabled={safeSlideIdx === 0}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3.5 text-xs font-medium hover:bg-accent disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              <span className="font-mono text-xs text-muted-foreground">
                Slide {safeSlideIdx + 1} of {slides.length} (Use &larr; / &rarr; keys)
              </span>
              <button
                onClick={() =>
                  setCurrentSlide((s) => Math.min(slides.length - 1, s + 1))
                }
                disabled={safeSlideIdx >= slides.length - 1}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-3.5 text-xs font-medium hover:bg-accent disabled:opacity-40"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-auto bg-muted/20 p-3 md:p-6">
          <div
            className="m-auto w-full max-w-5xl origin-top-left rounded-xl border border-border bg-card p-3 shadow-sm transition-transform md:p-5 [&>svg]:h-auto [&>svg]:w-full"
            style={
              mindmapZoom === 1
                ? undefined
                : { width: Math.round(mindmapZoom * 100) + "%", maxWidth: "none" }
            }
            dangerouslySetInnerHTML={{ __html: mindmapSvg }}
          />
        </div>
      )}
    </div>
  );
}
