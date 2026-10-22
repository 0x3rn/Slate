"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { HorizontalScrollStrip } from "@/components/horizontal-scroll-strip";
import {
  MmNode,
  MmNodeShape,
  MmLayoutMode,
  BgConfig,
  SlideElement,
  SlideElementType,
  VisualSlide,
  OPEN_SOURCE_FONTS,
  DEFAULT_MM_NODES,
  DEFAULT_VISUAL_SLIDES,
  MM_LAYOUT_PREVIEWS,
  MM_THEME_PREVIEWS,
  SLIDE_PRESET_PREVIEWS,
  SVG_BG_PRESETS,
  renderBgDesignSvgNode,
  renderSvgMultilineText,
  stripMarkdownSyntax,
  getNodeAutoSize,
  getNodeBoxSize,
  clampSingleMmNode,
  getSlideElEffectiveBox,
  clampSingleSlideElement,
  applyMindMapLayoutAlgorithm,
  buildSlideSvgContent,
  createSlideFromTemplate,
  parseMarkdownToMmNodes,
  buildMindMapViewportInnerSvg,
} from "@/lib/converters/mindmap-generator";
import {
  ensureEmbeddedGoogleFonts,
  getCachedEmbeddedFontCss,
  generateNativePdfFromSvgs,
  downloadSvgString,
  exportSvgMarkupToPng,
} from "@/lib/pdf-export";
import {
  Network,
  Presentation,
  RefreshCw,
  FileDown,
  Send,
  Play,
  Plus,
  Trash2,
  Undo2,
  Redo2,
  Maximize2,
  RotateCcw,
  Copy,
  ArrowUp,
  ArrowDown,
  Sparkles,
  AlignCenter,
} from "lucide-react";

interface VisualStudioProps {
  markdown: string;
  darkMode: boolean;
  onAiRestructureSlides?: () => Promise<void>;
}

interface MmSnapshot {
  mmNodes: MmNode[];
  mmBgColor: string;
  mmBgConfig: BgConfig;
  mmDocW: number;
  mmDocH: number;
}

interface SlideSnapshot {
  slides: VisualSlide[];
  currentSlideIdx: number;
  slideDocW: number;
  slideDocH: number;
}

const CANVAS_BOUND_PAD = 14;
const QUICK_NODE_COLORS = [
  "#6366f1",
  "#ec4899",
  "#10b981",
  "#f59e0b",
  "#0ea5e9",
  "#8b5cf6",
  "#1e293b",
];

function isHexColorLight(hex: string): boolean {
  const clean = (hex || "#0f172a").replace("#", "");
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 165;
}

function getMindMapStructureBounds(nodes: MmNode[]) {
  if (!nodes.length) return { x: 100, y: 100, w: 400, h: 300, cx: 300, cy: 250 };
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  nodes.forEach((n) => {
    const { w, h } = getNodeBoxSize(n);
    minX = Math.min(minX, n.x - w / 2);
    maxX = Math.max(maxX, n.x + w / 2);
    minY = Math.min(minY, n.y - h / 2);
    maxY = Math.max(maxY, n.y + h / 2);
  });
  const pad = 28;
  return {
    x: Math.round(minX - pad),
    y: Math.round(minY - pad),
    w: Math.round(maxX - minX + pad * 2),
    h: Math.round(maxY - minY + pad * 2),
    cx: Math.round((minX + maxX) / 2),
    cy: Math.round((minY + maxY) / 2),
  };
}

function getSlideStructureBounds(slide: VisualSlide | undefined) {
  if (!slide || !slide.elements.length) {
    return { x: 80, y: 80, w: 400, h: 300, cx: 280, cy: 230, rawW: 400, rawH: 300 };
  }
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  slide.elements.forEach((el) => {
    const eff = getSlideElEffectiveBox(el);
    minX = Math.min(minX, el.x);
    maxX = Math.max(maxX, el.x + eff.w);
    minY = Math.min(minY, el.y);
    maxY = Math.max(maxY, el.y + eff.h);
  });
  const pad = 12;
  return {
    x: Math.round(minX - pad),
    y: Math.round(minY - pad),
    w: Math.round(maxX - minX + pad * 2),
    h: Math.round(maxY - minY + pad * 2),
    cx: Math.round((minX + maxX) / 2),
    cy: Math.round((minY + maxY) / 2),
    rawW: Math.max(1, maxX - minX),
    rawH: Math.max(1, maxY - minY),
  };
}

function NumberStepper({
  value,
  min = 0,
  max = 9999,
  step = 1,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (val: number) => void;
}) {
  return (
    <div className="flex h-7 items-center overflow-hidden rounded-md border border-border bg-background">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, (value || 0) - step))}
        className="flex h-full w-6 shrink-0 items-center justify-center border-r border-border text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        &minus;
      </button>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) =>
          onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))
        }
        className="h-full w-full bg-transparent px-1 text-center font-mono text-xs text-foreground focus:outline-none"
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(max, (value || 0) + step))}
        className="flex h-full w-6 shrink-0 items-center justify-center border-l border-border text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        +
      </button>
    </div>
  );
}

export function VisualStudio({ markdown, darkMode }: VisualStudioProps) {
  const [activeTab, setActiveTab] = useState<"mindmap" | "slides">("mindmap");

  // Mind Map State
  const [mmNodes, setMmNodes] = useState<MmNode[]>(() =>
    JSON.parse(JSON.stringify(DEFAULT_MM_NODES))
  );
  const [selectedMmId, setSelectedMmId] = useState<string | null>("n1");
  const [wholeMmFocused, setWholeMmFocused] = useState<boolean>(false);
  const [mmLayout, setMmLayout] = useState<MmLayoutMode>("mindmap");
  const [mmThemeId, setMmThemeId] = useState<string>(() =>
    darkMode ? "default" : "daylight"
  );
  const [mmDocW, setMmDocW] = useState<number>(1600);
  const [mmDocH, setMmDocH] = useState<number>(900);
  const [mmBgColor, setMmBgColor] = useState<string>(() =>
    darkMode ? "#0f172a" : "#f8fafc"
  );
  const [mmBgConfig, setMmBgConfig] = useState<BgConfig>(() =>
    darkMode
      ? { mode: "design", presetId: "bg01", colors: ["#0b1120", "#1e293b", "#38bdf8"] }
      : { mode: "design", presetId: "bg04", colors: ["#f8fafc", "#cbd5e1", "#e2e8f0"] }
  );
  const [mmCam, setMmCam] = useState<{ x: number; y: number; scale: number }>({
    x: 0,
    y: 0,
    scale: 1,
  });
  const [mmHistory, setMmHistory] = useState<string[]>([]);
  const [mmRedoStack, setMmRedoStack] = useState<string[]>([]);

  useEffect(() => {
    setMmBgConfig((prev) => {
      if (darkMode && prev.presetId === "bg04") {
        return { mode: "design", presetId: "bg01", colors: ["#0b1120", "#1e293b", "#38bdf8"] };
      }
      if (!darkMode && prev.presetId === "bg01") {
        return { mode: "design", presetId: "bg04", colors: ["#f8fafc", "#cbd5e1", "#e2e8f0"] };
      }
      return prev;
    });
    setMmBgColor(darkMode ? "#0f172a" : "#f8fafc");
  }, [darkMode]);

  // Slide Maker State
  const [slides, setSlides] = useState<VisualSlide[]>(() =>
    JSON.parse(JSON.stringify(DEFAULT_VISUAL_SLIDES))
  );
  const [currentSlideIdx, setCurrentSlideIdx] = useState<number>(0);
  const [selectedSlideElId, setSelectedSlideElId] = useState<string | null>("e2");
  const [wholeSlideFocused, setWholeSlideFocused] = useState<boolean>(false);
  const [slideDocW, setSlideDocW] = useState<number>(1600);
  const [slideDocH, setSlideDocH] = useState<number>(900);
  const [slideHistory, setSlideHistory] = useState<string[]>([]);
  const [slideRedoStack, setSlideRedoStack] = useState<string[]>([]);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [presenterOpen, setPresenterOpen] = useState<boolean>(false);

  const mmSvgRef = useRef<SVGSVGElement | null>(null);
  const slideSvgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<
    | { type: "mm-node"; nodeId: string; offsetX: number; offsetY: number }
    | { type: "mm-pan"; startX: number; startY: number }
    | { type: "slide-el"; elId: string; offsetX: number; offsetY: number }
    | null
  >(null);

  useEffect(() => {
    ensureEmbeddedGoogleFonts();
  }, []);

  const selectMmNode = useCallback((id: string | null) => {
    setSelectedMmId(id);
    if (id !== null) setWholeMmFocused(false);
  }, []);

  const selectSlideElement = useCallback((id: string | null) => {
    setSelectedSlideElId(id);
    if (id !== null) setWholeSlideFocused(false);
  }, []);

  const saveMmHistory = useCallback(() => {
    const snap: MmSnapshot = { mmNodes, mmBgColor, mmBgConfig, mmDocW, mmDocH };
    const str = JSON.stringify(snap);
    setMmHistory((prev) => {
      if (prev.length > 0 && prev[prev.length - 1] === str) return prev;
      return [...prev.slice(-49), str];
    });
    setMmRedoStack([]);
  }, [mmNodes, mmBgColor, mmBgConfig, mmDocW, mmDocH]);

  const saveSlideHistory = useCallback(() => {
    const snap: SlideSnapshot = { slides, currentSlideIdx, slideDocW, slideDocH };
    const str = JSON.stringify(snap);
    setSlideHistory((prev) => {
      if (prev.length > 0 && prev[prev.length - 1] === str) return prev;
      return [...prev.slice(-49), str];
    });
    setSlideRedoStack([]);
  }, [slides, currentSlideIdx, slideDocW, slideDocH]);

  const undoAction = useCallback(() => {
    if (activeTab === "mindmap") {
      if (mmHistory.length === 0) return;
      const curStr = JSON.stringify({ mmNodes, mmBgColor, mmBgConfig, mmDocW, mmDocH });
      setMmRedoStack((r) => [...r, curStr]);
      const prevStr = mmHistory[mmHistory.length - 1];
      setMmHistory((h) => h.slice(0, -1));
      const data = JSON.parse(prevStr) as MmSnapshot;
      setMmNodes(data.mmNodes);
      setMmBgColor(data.mmBgColor);
      setMmBgConfig(data.mmBgConfig);
      setMmDocW(data.mmDocW);
      setMmDocH(data.mmDocH);
    } else {
      if (slideHistory.length === 0) return;
      const curStr = JSON.stringify({ slides, currentSlideIdx, slideDocW, slideDocH });
      setSlideRedoStack((r) => [...r, curStr]);
      const prevStr = slideHistory[slideHistory.length - 1];
      setSlideHistory((h) => h.slice(0, -1));
      const data = JSON.parse(prevStr) as SlideSnapshot;
      setSlides(data.slides);
      setCurrentSlideIdx(Math.min(data.currentSlideIdx, data.slides.length - 1));
      setSlideDocW(data.slideDocW);
      setSlideDocH(data.slideDocH);
    }
  }, [
    activeTab,
    mmHistory,
    mmNodes,
    mmBgColor,
    mmBgConfig,
    mmDocW,
    mmDocH,
    slideHistory,
    slides,
    currentSlideIdx,
    slideDocW,
    slideDocH,
  ]);

  const redoAction = useCallback(() => {
    if (activeTab === "mindmap") {
      if (mmRedoStack.length === 0) return;
      const curStr = JSON.stringify({ mmNodes, mmBgColor, mmBgConfig, mmDocW, mmDocH });
      setMmHistory((h) => [...h, curStr]);
      const nextStr = mmRedoStack[mmRedoStack.length - 1];
      setMmRedoStack((r) => r.slice(0, -1));
      const data = JSON.parse(nextStr) as MmSnapshot;
      setMmNodes(data.mmNodes);
      setMmBgColor(data.mmBgColor);
      setMmBgConfig(data.mmBgConfig);
      setMmDocW(data.mmDocW);
      setMmDocH(data.mmDocH);
    } else {
      if (slideRedoStack.length === 0) return;
      const curStr = JSON.stringify({ slides, currentSlideIdx, slideDocW, slideDocH });
      setSlideHistory((h) => [...h, curStr]);
      const nextStr = slideRedoStack[slideRedoStack.length - 1];
      setSlideRedoStack((r) => r.slice(0, -1));
      const data = JSON.parse(nextStr) as SlideSnapshot;
      setSlides(data.slides);
      setCurrentSlideIdx(Math.min(data.currentSlideIdx, data.slides.length - 1));
      setSlideDocW(data.slideDocW);
      setSlideDocH(data.slideDocH);
    }
  }, [
    activeTab,
    mmRedoStack,
    mmNodes,
    mmBgColor,
    mmBgConfig,
    mmDocW,
    mmDocH,
    slideRedoStack,
    slides,
    currentSlideIdx,
    slideDocW,
    slideDocH,
  ]);

  // ArrowUp / ArrowDown Scaling for Single Node/Element OR Whole Mind Map / Whole Slide
  const scaleByArrowKey = useCallback(
    (factor: number): boolean => {
      if (activeTab === "mindmap") {
        const maxW = mmDocW - CANVAS_BOUND_PAD * 2;
        const maxH = mmDocH - CANVAS_BOUND_PAD * 2;

        if (selectedMmId) {
          const node = mmNodes.find((n) => n.id === selectedMmId);
          if (!node) return false;
          const { w, h } = getNodeBoxSize(node);
          let effFactor = factor;
          if (factor > 1) {
            effFactor = Math.min(factor, maxW / Math.max(1, w), maxH / Math.max(1, h));
            if (effFactor <= 1.002) return true;
          }
          saveMmHistory();
          setMmNodes((prev) =>
            prev.map((n) => {
              if (n.id !== selectedMmId) return n;
              const copy: MmNode = {
                ...n,
                customW: Math.max(80, Math.round(w * effFactor)),
                customH: Math.max(36, Math.round(h * effFactor)),
                fontSize: Math.max(
                  10,
                  Math.min(72, Math.round((n.fontSize || 18) * effFactor))
                ),
              };
              clampSingleMmNode(copy, mmDocW, mmDocH);
              return copy;
            })
          );
          return true;
        } else if (wholeMmFocused && mmNodes.length > 0) {
          let minX = Infinity,
            maxX = -Infinity,
            minY = Infinity,
            maxY = -Infinity;
          mmNodes.forEach((n) => {
            const { w, h } = getNodeBoxSize(n);
            minX = Math.min(minX, n.x - w / 2);
            maxX = Math.max(maxX, n.x + w / 2);
            minY = Math.min(minY, n.y - h / 2);
            maxY = Math.max(maxY, n.y + h / 2);
          });
          const spanW = Math.max(1, maxX - minX);
          const spanH = Math.max(1, maxY - minY);
          const cx = (minX + maxX) / 2;
          const cy = (minY + maxY) / 2;

          let effFactor = factor;
          if (factor > 1) {
            effFactor = Math.min(factor, maxW / spanW, maxH / spanH);
            if (effFactor <= 1.002) return true;
          }

          saveMmHistory();
          setMmNodes((prev) => {
            const scaled = prev.map((n) => {
              const { w, h } = getNodeBoxSize(n);
              return {
                ...n,
                x: Math.round(cx + (n.x - cx) * effFactor),
                y: Math.round(cy + (n.y - cy) * effFactor),
                customW: Math.max(70, Math.round(w * effFactor)),
                customH: Math.max(32, Math.round(h * effFactor)),
                fontSize: Math.max(
                  10,
                  Math.min(72, Math.round((n.fontSize || 18) * effFactor))
                ),
              };
            });

            let nMinX = Infinity,
              nMaxX = -Infinity,
              nMinY = Infinity,
              nMaxY = -Infinity;
            scaled.forEach((n) => {
              const { w, h } = getNodeBoxSize(n);
              nMinX = Math.min(nMinX, n.x - w / 2);
              nMaxX = Math.max(nMaxX, n.x + w / 2);
              nMinY = Math.min(nMinY, n.y - h / 2);
              nMaxY = Math.max(nMaxY, n.y + h / 2);
            });
            let shiftX = 0,
              shiftY = 0;
            if (nMinX < CANVAS_BOUND_PAD) shiftX = Math.ceil(CANVAS_BOUND_PAD - nMinX);
            else if (nMaxX > mmDocW - CANVAS_BOUND_PAD)
              shiftX = Math.floor(mmDocW - CANVAS_BOUND_PAD - nMaxX);
            if (nMinY < CANVAS_BOUND_PAD) shiftY = Math.ceil(CANVAS_BOUND_PAD - nMinY);
            else if (nMaxY > mmDocH - CANVAS_BOUND_PAD)
              shiftY = Math.floor(mmDocH - CANVAS_BOUND_PAD - nMaxY);

            return scaled.map((n) => {
              const copy = { ...n, x: n.x + shiftX, y: n.y + shiftY };
              clampSingleMmNode(copy, mmDocW, mmDocH);
              return copy;
            });
          });
          return true;
        }
      } else {
        const slide = slides[currentSlideIdx];
        if (!slide) return false;
        const maxW = slideDocW - CANVAS_BOUND_PAD * 2;
        const maxH = slideDocH - CANVAS_BOUND_PAD * 2;

        if (selectedSlideElId) {
          const el = slide.elements.find((item) => item.id === selectedSlideElId);
          if (!el) return false;
          const eff = getSlideElEffectiveBox(el);
          let effFactor = factor;
          if (factor > 1) {
            effFactor = Math.min(
              factor,
              maxW / Math.max(1, eff.w),
              maxH / Math.max(1, eff.h)
            );
            if (effFactor <= 1.002) return true;
          }
          saveSlideHistory();
          const cx = el.x + eff.w / 2;
          const cy = el.y + eff.h / 2;
          setSlides((prev) =>
            prev.map((sl, idx) => {
              if (idx !== currentSlideIdx) return sl;
              return {
                ...sl,
                elements: sl.elements.map((item) => {
                  if (item.id !== selectedSlideElId) return item;
                  const nw = Math.max(24, Math.round(eff.w * effFactor));
                  const nh = Math.max(24, Math.round(eff.h * effFactor));
                  const copy: SlideElement = {
                    ...item,
                    w: nw,
                    h: nh,
                    x: Math.round(cx - nw / 2),
                    y: Math.round(cy - nh / 2),
                    fontSize: item.fontSize
                      ? Math.max(10, Math.min(160, Math.round(item.fontSize * effFactor)))
                      : 24,
                    rx: item.rx ? Math.round(item.rx * effFactor) : 0,
                  };
                  clampSingleSlideElement(copy, slideDocW, slideDocH);
                  return copy;
                }),
              };
            })
          );
          return true;
        } else if (wholeSlideFocused && slide.elements.length > 0) {
          const b = getSlideStructureBounds(slide);
          let effFactor = factor;
          if (factor > 1) {
            effFactor = Math.min(factor, maxW / b.rawW, maxH / b.rawH);
            if (effFactor <= 1.002) return true;
          }
          saveSlideHistory();
          setSlides((prev) =>
            prev.map((sl, idx) => {
              if (idx !== currentSlideIdx) return sl;
              const scaledEls = sl.elements.map((el) => {
                const eff = getSlideElEffectiveBox(el);
                const elCx = el.x + eff.w / 2;
                const elCy = el.y + eff.h / 2;
                const nw = Math.max(24, Math.round(eff.w * effFactor));
                const nh = Math.max(24, Math.round(eff.h * effFactor));
                return {
                  ...el,
                  w: nw,
                  h: nh,
                  x: Math.round(b.cx + (elCx - b.cx) * effFactor - nw / 2),
                  y: Math.round(b.cy + (elCy - b.cy) * effFactor - nh / 2),
                  fontSize: el.fontSize
                    ? Math.max(10, Math.min(160, Math.round(el.fontSize * effFactor)))
                    : 24,
                  rx: el.rx ? Math.round(el.rx * effFactor) : 0,
                };
              });

              const nb = getSlideStructureBounds({ ...sl, elements: scaledEls });
              let shiftX = 0,
                shiftY = 0;
              const rawMinX = nb.x + 12,
                rawMaxX = nb.x + nb.w - 12;
              const rawMinY = nb.y + 12,
                rawMaxY = nb.y + nb.h - 12;
              if (rawMinX < CANVAS_BOUND_PAD)
                shiftX = Math.ceil(CANVAS_BOUND_PAD - rawMinX);
              else if (rawMaxX > slideDocW - CANVAS_BOUND_PAD)
                shiftX = Math.floor(slideDocW - CANVAS_BOUND_PAD - rawMaxX);
              if (rawMinY < CANVAS_BOUND_PAD)
                shiftY = Math.ceil(CANVAS_BOUND_PAD - rawMinY);
              else if (rawMaxY > slideDocH - CANVAS_BOUND_PAD)
                shiftY = Math.floor(slideDocH - CANVAS_BOUND_PAD - rawMaxY);

              return {
                ...sl,
                elements: scaledEls.map((el) => {
                  const copy = { ...el, x: el.x + shiftX, y: el.y + shiftY };
                  clampSingleSlideElement(copy, slideDocW, slideDocH);
                  return copy;
                }),
              };
            })
          );
          return true;
        }
      }
      return false;
    },
    [
      activeTab,
      mmDocW,
      mmDocH,
      selectedMmId,
      wholeMmFocused,
      mmNodes,
      saveMmHistory,
      slides,
      currentSlideIdx,
      slideDocW,
      slideDocH,
      selectedSlideElId,
      wholeSlideFocused,
      saveSlideHistory,
    ]
  );

  const getSvgPoint = (svg: SVGSVGElement, clientX: number, clientY: number) => {
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    return ctm ? pt.matrixTransform(ctm.inverse()) : { x: clientX, y: clientY };
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const st = dragRef.current;
      if (!st) return;

      if (st.type === "mm-node" && mmSvgRef.current) {
        const pt = getSvgPoint(mmSvgRef.current, e.clientX, e.clientY);
        const nx = Math.round((pt.x - mmCam.x) / mmCam.scale - st.offsetX);
        const ny = Math.round((pt.y - mmCam.y) / mmCam.scale - st.offsetY);
        setMmNodes((prev) =>
          prev.map((n) => {
            if (n.id !== st.nodeId) return n;
            const copy = { ...n, x: nx, y: ny };
            clampSingleMmNode(copy, mmDocW, mmDocH);
            return copy;
          })
        );
      } else if (st.type === "mm-pan" && mmSvgRef.current) {
        const pt = getSvgPoint(mmSvgRef.current, e.clientX, e.clientY);
        setMmCam((c) => ({
          ...c,
          x: Math.round(pt.x - st.startX),
          y: Math.round(pt.y - st.startY),
        }));
      } else if (st.type === "slide-el" && slideSvgRef.current) {
        const pt = getSvgPoint(slideSvgRef.current, e.clientX, e.clientY);
        const nx = Math.round((pt.x - st.offsetX) / 5) * 5;
        const ny = Math.round((pt.y - st.offsetY) / 5) * 5;
        setSlides((prev) =>
          prev.map((sl, idx) => {
            if (idx !== currentSlideIdx) return sl;
            return {
              ...sl,
              elements: sl.elements.map((el) => {
                if (el.id !== st.elId) return el;
                const copy = { ...el, x: nx, y: ny };
                clampSingleSlideElement(copy, slideDocW, slideDocH);
                return copy;
              }),
            };
          })
        );
      }
    };

    const handlePointerUp = () => {
      dragRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [mmCam, mmDocW, mmDocH, currentSlideIdx, slideDocW, slideDocH]);

  // True nullable selectedMmNode so unfocusing works
  const selectedMmNode = selectedMmId
    ? mmNodes.find((n) => n.id === selectedMmId) ?? null
    : null;
  const selectedMmBox = selectedMmNode
    ? getNodeBoxSize(selectedMmNode)
    : { w: 260, h: 60, lines: [] };

  const updateSelectedMmNode = (patch: Partial<MmNode>) => {
    if (!selectedMmNode) return;
    saveMmHistory();
    setMmNodes((prev) =>
      prev.map((n) => {
        if (n.id !== selectedMmNode.id) return n;
        const next = { ...n, ...patch };
        const { autoW, autoH } = getNodeAutoSize(next);
        if (patch.text !== undefined) {
          if (next.customW && next.customW < autoW) next.customW = autoW;
          if (next.customH && next.customH < autoH) next.customH = autoH;
        }
        clampSingleMmNode(next, mmDocW, mmDocH);
        return next;
      })
    );
  };

  const addChildNode = useCallback(() => {
    saveMmHistory();
    const parent = mmNodes.find((n) => n.id === selectedMmId) || mmNodes[0];
    const newId = "n" + Date.now();
    const childrenCount = mmNodes.filter((n) => n.parentId === parent.id).length;
    const dir = parent.x < mmDocW / 2 ? -1 : 1;
    const palette = ["#ec4899", "#10b981", "#f59e0b", "#0ea5e9", "#8b5cf6"];
    const color =
      parent.parentId === null
        ? palette[childrenCount % palette.length]
        : darkMode
        ? "#1e293b"
        : "#cbd5e1";

    const nextNode: MmNode = {
      id: newId,
      parentId: parent.id,
      text: "New Idea",
      x: parent.x + dir * 280,
      y: parent.y + (childrenCount - 0.5) * 95,
      color,
      textColor: parent.parentId === null || darkMode ? "#ffffff" : "#0f172a",
      shape: parent.parentId === null ? "pill" : "rect",
      fontSize: parent.parentId === null ? 20 : 18,
    };
    clampSingleMmNode(nextNode, mmDocW, mmDocH);
    setMmNodes((prev) => [...prev, nextNode]);
    selectMmNode(newId);
  }, [mmNodes, selectedMmId, mmDocW, mmDocH, darkMode, saveMmHistory, selectMmNode]);

  const addSiblingNode = useCallback(() => {
    const cur = mmNodes.find((n) => n.id === selectedMmId);
    if (!cur || !cur.parentId) {
      addChildNode();
      return;
    }
    selectMmNode(cur.parentId);
    addChildNode();
  }, [mmNodes, selectedMmId, addChildNode, selectMmNode]);

  const deleteSelectedNode = useCallback(() => {
    if (!selectedMmId) return;
    const node = mmNodes.find((n) => n.id === selectedMmId);
    if (!node || node.parentId === null) return;
    saveMmHistory();
    const toRemove = new Set<string>([selectedMmId]);
    let added = true;
    while (added) {
      added = false;
      mmNodes.forEach((n) => {
        if (n.parentId && toRemove.has(n.parentId) && !toRemove.has(n.id)) {
          toRemove.add(n.id);
          added = true;
        }
      });
    }
    setMmNodes((prev) => prev.filter((n) => !toRemove.has(n.id)));
    selectMmNode(node.parentId || mmNodes[0]?.id || null);
  }, [mmNodes, selectedMmId, saveMmHistory, selectMmNode]);

  const applyLayoutMode = (mode: MmLayoutMode) => {
    saveMmHistory();
    setMmLayout(mode);
    setMmNodes((prev) => applyMindMapLayoutAlgorithm(prev, mode, mmDocW, mmDocH));
    setMmCam({ x: 0, y: 0, scale: 1 });
  };

  const applyMmThemePreset = (themeId: string) => {
    saveMmHistory();
    setMmThemeId(themeId);
    const t =
      MM_THEME_PREVIEWS.find((item) => item.id === themeId) || MM_THEME_PREVIEWS[0];
    setMmBgColor(t.bg);
    setMmBgConfig((c) => ({ ...c, mode: "solid" }));
    let bIdx = 0;
    const rootId = mmNodes.find((n) => n.parentId === null)?.id;
    setMmNodes((prev) =>
      prev.map((n) => {
        if (n.parentId === null) {
          return { ...n, color: t.root, textColor: "#ffffff", shape: t.shape };
        }
        if (n.parentId === rootId) {
          const c = t.branches[bIdx++ % t.branches.length];
          return { ...n, color: c, textColor: "#ffffff", shape: t.shape };
        }
        return { ...n, color: t.leaf, textColor: t.text };
      })
    );
  };

  const centerMindMapStructure = () => {
    if (!mmNodes.length) return;
    setSelectedMmId(null);
    setWholeMmFocused(true);
    saveMmHistory();
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    mmNodes.forEach((n) => {
      const { w, h } = getNodeBoxSize(n);
      minX = Math.min(minX, n.x - w / 2);
      maxX = Math.max(maxX, n.x + w / 2);
      minY = Math.min(minY, n.y - h / 2);
      maxY = Math.max(maxY, n.y + h / 2);
    });
    const dx = Math.round(mmDocW / 2 - (minX + maxX) / 2);
    const dy = Math.round(mmDocH / 2 - (minY + maxY) / 2);
    setMmNodes((prev) =>
      prev.map((n) => {
        const copy = { ...n, x: n.x + dx, y: n.y + dy };
        clampSingleMmNode(copy, mmDocW, mmDocH);
        return copy;
      })
    );
    setMmCam({ x: 0, y: 0, scale: 1 });
  };

  const handleResizeMmProject = (newW: number, newH: number) => {
    const clampedW = Math.max(300, Math.min(8000, newW || 1600));
    const clampedH = Math.max(300, Math.min(8000, newH || 900));
    saveMmHistory();
    const scale = Math.min(clampedW / mmDocW, clampedH / mmDocH);
    const oldCx = mmDocW / 2;
    const oldCy = mmDocH / 2;
    const newCx = clampedW / 2;
    const newCy = clampedH / 2;

    setMmNodes((prev) =>
      prev.map((n) => {
        const { w, h } = getNodeBoxSize(n);
        const copy: MmNode = {
          ...n,
          x: Math.round(newCx + (n.x - oldCx) * scale),
          y: Math.round(newCy + (n.y - oldCy) * scale),
          customW: Math.max(70, Math.round(w * scale)),
          customH: Math.max(32, Math.round(h * scale)),
          fontSize: Math.max(10, Math.round((n.fontSize || 18) * scale)),
        };
        clampSingleMmNode(copy, clampedW, clampedH);
        return copy;
      })
    );
    setMmDocW(clampedW);
    setMmDocH(clampedH);
  };

  const getCleanMindMapSvg = (forRaster = false): string => {
    const wAttr = forRaster ? String(mmDocW) : "100%";
    const hAttr = forRaster ? String(mmDocH) : "100%";
    const fontCss = getCachedEmbeddedFontCss();
    const bgFill = mmBgConfig.mode === "design" ? mmBgConfig.colors[0] : mmBgColor;
    const bgDesign =
      mmBgConfig.mode === "design"
        ? renderBgDesignSvgNode(mmBgConfig, mmDocW, mmDocH, "mm_exp")
        : "";
    return [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
        mmDocW +
        " " +
        mmDocH +
        '" width="' +
        wAttr +
        '" height="' +
        hAttr +
        '">',
      fontCss ? "<defs>" + fontCss + "</defs>" : "",
      '<rect width="' + mmDocW + '" height="' + mmDocH + '" fill="' + bgFill + '" />',
      bgDesign,
      buildMindMapViewportInnerSvg(mmNodes, mmLayout, mmDocW),
      "</svg>",
    ].join("");
  };

  const sendMindMapToSlide = () => {
    saveSlideHistory();
    const innerMarkup = buildMindMapViewportInnerSvg(mmNodes, mmLayout, mmDocW);
    const padX = Math.round(slideDocW * 0.05);
    const topY = Math.round(slideDocH * 0.12);
    const newSlide: VisualSlide = {
      id: "s" + Date.now(),
      bg: mmBgColor,
      bgConfig: JSON.parse(JSON.stringify(mmBgConfig)),
      elements: [
        {
          id: "el" + Date.now() + "title",
          type: "heading",
          x: padX,
          y: Math.round(slideDocH * 0.05),
          w: Math.round(slideDocW * 0.8),
          h: 60,
          text: "**Mind Map Architecture Overview**",
          fill: "#6366f1",
          stroke: "#ffffff",
          fontSize: Math.round(slideDocH * 0.042),
          rx: 0,
          borderWidth: 0,
        },
        {
          id: "el" + Date.now() + "mm",
          type: "mindmap-embed",
          x: padX,
          y: topY,
          w: slideDocW - padX * 2,
          h: slideDocH - topY - Math.round(slideDocH * 0.05),
          mmBaseW: mmDocW,
          mmBaseH: mmDocH,
          svgInner: innerMarkup,
          text: "Embedded Mind Map",
          fill: "#1e293b",
          stroke: "#ffffff",
          fontSize: 20,
          rx: 16,
          borderWidth: 0,
        },
      ],
    };
    setSlides((prev) => [...prev, newSlide]);
    setCurrentSlideIdx(slides.length);
    selectSlideElement(null);
    setActiveTab("slides");
  };

  // Slide Actions
  const activeSlide = slides[currentSlideIdx] || slides[0];
  const selectedSlideEl = selectedSlideElId
    ? activeSlide?.elements.find((e) => e.id === selectedSlideElId) ?? null
    : null;

  const updateSelectedSlideEl = (patch: Partial<SlideElement>) => {
    if (!selectedSlideEl) return;
    saveSlideHistory();
    setSlides((prev) =>
      prev.map((sl, idx) => {
        if (idx !== currentSlideIdx) return sl;
        return {
          ...sl,
          elements: sl.elements.map((el) => {
            if (el.id !== selectedSlideEl.id) return el;
            const next = { ...el, ...patch };
            clampSingleSlideElement(next, slideDocW, slideDocH);
            return next;
          }),
        };
      })
    );
  };

  const adaptSlideElementsForContrast = (
    elements: SlideElement[],
    isLight: boolean
  ): SlideElement[] => {
    const lightColors = new Set([
      "#ffffff",
      "#f8fafc",
      "#cbd5e1",
      "#e2e8f0",
      "#94a3b8",
      "#fda4af",
      "#ffe4e6",
    ]);
    const darkColors = new Set(["#0f172a", "#1e293b", "#334155", "#475569"]);
    return elements.map((el) => {
      if (el.type === "heading" || el.type === "text") {
        const cur = (el.stroke || "").toLowerCase();
        if (isLight && lightColors.has(cur)) {
          return { ...el, stroke: el.type === "heading" ? "#0f172a" : "#334155" };
        }
        if (!isLight && darkColors.has(cur)) {
          return { ...el, stroke: el.type === "heading" ? "#ffffff" : "#cbd5e1" };
        }
      }
      return el;
    });
  };

  const centerSlideStructure = () => {
    if (!activeSlide || !activeSlide.elements.length) return;
    setSelectedSlideElId(null);
    setWholeSlideFocused(true);
    saveSlideHistory();
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    activeSlide.elements.forEach((el) => {
      minX = Math.min(minX, el.x);
      maxX = Math.max(maxX, el.x + (el.w || 0));
      minY = Math.min(minY, el.y);
      maxY = Math.max(maxY, el.y + (el.h || 0));
    });
    const dx = Math.round(slideDocW / 2 - (minX + maxX) / 2);
    const dy = Math.round(slideDocH / 2 - (minY + maxY) / 2);
    setSlides((prev) =>
      prev.map((sl, idx) =>
        idx === currentSlideIdx
          ? {
              ...sl,
              elements: sl.elements.map((el) => {
                const copy = { ...el, x: el.x + dx, y: el.y + dy };
                clampSingleSlideElement(copy, slideDocW, slideDocH);
                return copy;
              }),
            }
          : sl
      )
    );
  };

  const centerSelectedSlideElement = () => {
    if (!selectedSlideEl) {
      centerSlideStructure();
      return;
    }
    saveSlideHistory();
    updateSelectedSlideEl({
      x: Math.round((slideDocW - (selectedSlideEl.w || 0)) / 2),
      y: Math.round((slideDocH - (selectedSlideEl.h || 0)) / 2),
    });
  };

  const addSlideElement = (type: SlideElementType) => {
    saveSlideHistory();
    const id = "el" + Date.now();
    const defaults: Record<string, Omit<SlideElement, "id">> = {
      heading: { type: "heading", x: 140, y: 140, w: 800, h: 90, text: "**New Slide Heading**", fill: "#6366f1", stroke: "#ffffff", fontSize: 56, rx: 0 },
      text: { type: "text", x: 140, y: 280, w: 700, h: 120, text: "- Key takeaway point one\n- Supporting detail two", fill: "#94a3b8", stroke: "#e2e8f0", fontSize: 30, rx: 0 },
      rect: { type: "rect", x: 550, y: 300, w: 420, h: 260, text: "**Feature Card**\n\nCustomize style in right inspector", fill: "#1e293b", stroke: "#ffffff", fontSize: 26, rx: 20 },
      circle: { type: "circle", x: 680, y: 320, w: 220, h: 220, text: "**99%**\nAccuracy", fill: "#6366f1", stroke: "#ffffff", fontSize: 28, rx: 110 },
      pill: { type: "pill", x: 140, y: 120, w: 260, h: 54, text: "**NEW MILESTONE**", fill: "#10b981", stroke: "#ffffff", fontSize: 18, rx: 27 },
      arrow: { type: "arrow", x: 500, y: 420, w: 320, h: 60, text: "", fill: "#38bdf8", stroke: "#38bdf8", fontSize: 20, rx: 0 },
    };
    const nextEl: SlideElement = { id, ...(defaults[type] || defaults.rect) };
    setSlides((prev) =>
      prev.map((sl, idx) =>
        idx === currentSlideIdx ? { ...sl, elements: [...sl.elements, nextEl] } : sl
      )
    );
    selectSlideElement(id);
  };

  const moveSlideElementZ = (dir: number) => {
    if (!selectedSlideElId) return;
    saveSlideHistory();
    setSlides((prev) =>
      prev.map((sl, idx) => {
        if (idx !== currentSlideIdx) return sl;
        const els = [...sl.elements];
        const i = els.findIndex((e) => e.id === selectedSlideElId);
        if (i === -1) return sl;
        const target = i + dir;
        if (target < 0 || target >= els.length) return sl;
        const [item] = els.splice(i, 1);
        els.splice(target, 0, item);
        return { ...sl, elements: els };
      })
    );
  };

  const deleteSelectedSlideElement = useCallback(() => {
    if (!selectedSlideElId) return;
    saveSlideHistory();
    setSlides((prev) =>
      prev.map((sl, idx) =>
        idx === currentSlideIdx
          ? { ...sl, elements: sl.elements.filter((e) => e.id !== selectedSlideElId) }
          : sl
      )
    );
    selectSlideElement(null);
  }, [selectedSlideElId, currentSlideIdx, saveSlideHistory, selectSlideElement]);

  const handleResizeSlideProject = (newW: number, newH: number) => {
    const clampedW = Math.max(300, Math.min(8000, newW || 1600));
    const clampedH = Math.max(300, Math.min(8000, newH || 900));
    saveSlideHistory();
    const scale = Math.min(clampedW / slideDocW, clampedH / slideDocH);
    const oldCx = slideDocW / 2;
    const oldCy = slideDocH / 2;
    const newCx = clampedW / 2;
    const newCy = clampedH / 2;

    setSlides((prev) =>
      prev.map((s) => ({
        ...s,
        elements: s.elements.map((el) => {
          const cx = el.x + (el.w || 0) / 2;
          const cy = el.y + (el.h || 0) / 2;
          const nw = Math.max(24, Math.round((el.w || 100) * scale));
          const nh = Math.max(24, Math.round((el.h || 60) * scale));
          const copy: SlideElement = {
            ...el,
            w: nw,
            h: nh,
            x: Math.round(newCx + (cx - oldCx) * scale - nw / 2),
            y: Math.round(newCy + (cy - oldCy) * scale - nh / 2),
            fontSize: el.fontSize ? Math.max(10, Math.round(el.fontSize * scale)) : 24,
            rx: el.rx ? Math.round(el.rx * scale) : 0,
          };
          clampSingleSlideElement(copy, clampedW, clampedH);
          return copy;
        }),
      }))
    );
    setSlideDocW(clampedW);
    setSlideDocH(clampedH);
  };

  const getCleanSlideSvg = (slide: VisualSlide, idx = 0, forRaster = false): string => {
    const wAttr = forRaster ? String(slideDocW) : "100%";
    const hAttr = forRaster ? String(slideDocH) : "100%";
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
      slideDocW +
      " " +
      slideDocH +
      '" width="' +
      wAttr +
      '" height="' +
      hAttr +
      '">' +
      buildSlideSvgContent(slide, slideDocW, slideDocH, null, false, "exp_" + idx) +
      "</svg>"
    );
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (presenterOpen) {
        if (e.key === "ArrowRight" || e.key === " ") {
          e.preventDefault();
          setCurrentSlideIdx((i) => Math.min(slides.length - 1, i + 1));
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          setCurrentSlideIdx((i) => Math.max(0, i - 1));
        } else if (e.key === "Escape") {
          e.preventDefault();
          setPresenterOpen(false);
        }
        return;
      }

      const tag = (document.activeElement?.tagName || "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redoAction();
        else undoAction();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redoAction();
        return;
      }

      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        const factor = e.key === "ArrowUp" ? 1.06 : 0.94;
        if (scaleByArrowKey(factor)) {
          e.preventDefault();
          return;
        }
      }

      if (activeTab === "mindmap") {
        if (e.key === "Tab") {
          e.preventDefault();
          addChildNode();
        } else if (e.key === "Enter") {
          e.preventDefault();
          addSiblingNode();
        } else if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          deleteSelectedNode();
        }
      } else {
        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          deleteSelectedSlideElement();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    presenterOpen,
    slides.length,
    activeTab,
    undoAction,
    redoAction,
    scaleByArrowKey,
    addChildNode,
    addSiblingNode,
    deleteSelectedNode,
    deleteSelectedSlideElement,
  ]);

  const activeSlideBgCfg: BgConfig = activeSlide?.bgConfig || {
    mode: "design",
    presetId: "bg16",
    colors: ["#0c1024", "#312e81", "#4f46e5"],
  };

  const mmBounds = getMindMapStructureBounds(mmNodes);
  const slideBounds = getSlideStructureBounds(activeSlide);

  const stageSvgHtml =
    buildSlideSvgContent(
      activeSlide,
      slideDocW,
      slideDocH,
      selectedSlideElId,
      true,
      "stage"
    ) +
    (wholeSlideFocused && activeSlide?.elements.length
      ? '<rect class="group-focus-outline" x="' +
        slideBounds.x +
        '" y="' +
        slideBounds.y +
        '" width="' +
        slideBounds.w +
        '" height="' +
        slideBounds.h +
        '" rx="16" fill="rgba(56, 189, 248, 0.03)" stroke="#38bdf8" stroke-width="2.5" stroke-dasharray="10 6" pointer-events="none" />'
      : "");

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-background text-foreground select-none">
      {/* Minimal Slate Studio Sub-Header */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-card/60 px-4 py-2 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg bg-muted/70 p-0.5">
            <button
              onClick={() => setActiveTab("mindmap")}
              className={
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all " +
                (activeTab === "mindmap"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              <Network className="h-3.5 w-3.5 text-indigo-500" />
              Mind Map
            </button>
            <button
              onClick={() => setActiveTab("slides")}
              className={
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all " +
                (activeTab === "slides"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              <Presentation className="h-3.5 w-3.5 text-amber-500" />
              Slides ({slides.length})
            </button>
          </div>

          <button
            onClick={() => {
              saveMmHistory();
              setMmNodes(parseMarkdownToMmNodes(markdown));
              setMmCam({ x: 0, y: 0, scale: 1 });
            }}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Sync headings & bullets from your Markdown Editor into the Mind Map"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Sync Editor Markdown</span>
          </button>
        </div>

        {activeTab === "mindmap" ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-[11px] text-muted-foreground">
              <span>Size</span>
              <input
                type="number"
                value={mmDocW}
                min={300}
                max={8000}
                step={50}
                onChange={(e) => handleResizeMmProject(Number(e.target.value), mmDocH)}
                className="w-14 bg-transparent text-center font-mono text-xs text-foreground focus:outline-none"
              />
              <span>&times;</span>
              <input
                type="number"
                value={mmDocH}
                min={300}
                max={8000}
                step={50}
                onChange={(e) => handleResizeMmProject(mmDocW, Number(e.target.value))}
                className="w-14 bg-transparent text-center font-mono text-xs text-foreground focus:outline-none"
              />
            </div>
            <button
              onClick={() =>
                downloadSvgString(
                  getCleanMindMapSvg(false),
                  "mindmap-" + mmDocW + "x" + mmDocH + ".svg"
                )
              }
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium hover:bg-accent"
            >
              <FileDown className="h-3 w-3" /> .SVG
            </button>
            <button
              onClick={() =>
                exportSvgMarkupToPng(
                  getCleanMindMapSvg(true),
                  mmDocW,
                  mmDocH,
                  "mindmap-" + mmDocW + "x" + mmDocH + ".png"
                )
              }
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium hover:bg-accent"
            >
              <FileDown className="h-3 w-3" /> .PNG
            </button>
            <button
              onClick={() =>
                generateNativePdfFromSvgs(
                  [getCleanMindMapSvg(true)],
                  mmDocW,
                  mmDocH,
                  "mindmap-" + mmDocW + "x" + mmDocH + ".pdf",
                  mmBgConfig.mode === "design" ? mmBgConfig.colors[0] : mmBgColor
                )
              }
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium hover:bg-accent"
            >
              <FileDown className="h-3 w-3" /> .PDF
            </button>
            <button
              onClick={sendMindMapToSlide}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              <Send className="h-3 w-3" /> Send to Slides
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-[11px] text-muted-foreground">
              <span>Size</span>
              <input
                type="number"
                value={slideDocW}
                min={300}
                max={8000}
                step={50}
                onChange={(e) =>
                  handleResizeSlideProject(Number(e.target.value), slideDocH)
                }
                className="w-14 bg-transparent text-center font-mono text-xs text-foreground focus:outline-none"
              />
              <span>&times;</span>
              <input
                type="number"
                value={slideDocH}
                min={300}
                max={8000}
                step={50}
                onChange={(e) =>
                  handleResizeSlideProject(slideDocW, Number(e.target.value))
                }
                className="w-14 bg-transparent text-center font-mono text-xs text-foreground focus:outline-none"
              />
            </div>
            <button
              onClick={() =>
                downloadSvgString(
                  getCleanSlideSvg(activeSlide, currentSlideIdx, false),
                  "slide-" + (currentSlideIdx + 1) + "-" + slideDocW + "x" + slideDocH + ".svg"
                )
              }
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium hover:bg-accent"
            >
              <FileDown className="h-3 w-3" /> .SVG
            </button>
            <button
              onClick={() =>
                exportSvgMarkupToPng(
                  getCleanSlideSvg(activeSlide, currentSlideIdx, true),
                  slideDocW,
                  slideDocH,
                  "slide-" + (currentSlideIdx + 1) + "-" + slideDocW + "x" + slideDocH + ".png"
                )
              }
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium hover:bg-accent"
            >
              <FileDown className="h-3 w-3" /> .PNG
            </button>
            <button
              disabled={isExportingPdf}
              onClick={async () => {
                setIsExportingPdf(true);
                try {
                  const svgs = slides.map((s, idx) => getCleanSlideSvg(s, idx, true));
                  await generateNativePdfFromSvgs(
                    svgs,
                    slideDocW,
                    slideDocH,
                    "presentation-deck-" + slideDocW + "x" + slideDocH + ".pdf"
                  );
                } finally {
                  setIsExportingPdf(false);
                }
              }}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium hover:bg-accent"
            >
              <FileDown className="h-3 w-3" />{" "}
              {isExportingPdf ? "Building..." : "Deck .PDF"}
            </button>
            <button
              onClick={() => setPresenterOpen(true)}
              className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:opacity-90"
            >
              <Play className="h-3 w-3" /> Present
            </button>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* TAB 1: MIND MAP WORKSPACE                                           */}
      {/* =================================================================== */}
      {activeTab === "mindmap" && (
        <div className="flex flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          {/* Compact Left Sidebar (w-[228px] on Desktop) */}
          <div className="flex shrink-0 flex-col gap-3 border-b border-border bg-card/30 p-3 lg:w-[228px] lg:overflow-y-auto lg:border-b-0 lg:border-r">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Auto-Layout
            </span>
            <HorizontalScrollStrip innerClassName="gap-1.5 pb-1" scrollStep={190}>
              {MM_LAYOUT_PREVIEWS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => applyLayoutMode(item.id)}
                  className={
                    "relative h-[54px] w-[96px] shrink-0 overflow-hidden rounded-md border transition-all " +
                    (mmLayout === item.id
                      ? "border-primary ring-1 ring-primary"
                      : "border-border opacity-80 hover:opacity-100")
                  }
                >
                  <svg
                    viewBox="0 0 160 90"
                    preserveAspectRatio="none"
                    className="h-full w-full"
                    dangerouslySetInnerHTML={{ __html: item.svg }}
                  />
                  <span className="absolute inset-x-0 bottom-0 truncate bg-black/75 px-1 py-0.5 text-[9px] font-medium text-white">
                    {item.label}
                  </span>
                </button>
              ))}
            </HorizontalScrollStrip>

            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Color Theme
            </span>
            <HorizontalScrollStrip innerClassName="gap-1.5 pb-1" scrollStep={190}>
              {MM_THEME_PREVIEWS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => applyMmThemePreset(t.id)}
                  className={
                    "relative h-[54px] w-[96px] shrink-0 overflow-hidden rounded-md border transition-all " +
                    (mmThemeId === t.id
                      ? "border-primary ring-1 ring-primary"
                      : "border-border opacity-80 hover:opacity-100")
                  }
                >
                  <svg viewBox="0 0 160 90" preserveAspectRatio="none" className="h-full w-full">
                    <rect width="160" height="90" fill={t.bg} />
                    <path d="M80 45 L42 26 M80 45 L118 26 M80 45 L42 64 M80 45 L118 64" stroke={t.b1} strokeWidth="2.5" />
                    <rect x="58" y="34" width="44" height="22" rx="11" fill={t.root} />
                    <rect x="18" y="18" width="32" height="16" rx="8" fill={t.b1} />
                    <rect x="110" y="18" width="32" height="16" rx="8" fill={t.b2} />
                    <rect x="18" y="56" width="32" height="16" rx="5" fill={t.leaf} />
                    <rect x="110" y="56" width="32" height="16" rx="5" fill={t.leaf} />
                  </svg>
                  <span className="absolute inset-x-0 bottom-0 truncate bg-black/75 px-1 py-0.5 text-[9px] font-medium text-white">
                    {t.label}
                  </span>
                </button>
              ))}
            </HorizontalScrollStrip>

            <button
              onClick={() => applyLayoutMode(mmLayout)}
              className="inline-flex h-7 w-full items-center justify-center gap-1.5 rounded-md border border-border bg-background text-xs font-medium hover:bg-accent"
            >
              <Sparkles className="h-3 w-3 text-indigo-500" /> Re-Align Nodes
            </button>

            <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Outline ({mmNodes.length})
            </span>
            <div className="flex max-h-52 flex-1 flex-col gap-0.5 overflow-y-auto lg:max-h-none">
              {mmNodes.map((node) => (
                <button
                  key={node.id}
                  onClick={() => selectMmNode(node.id)}
                  className={
                    "flex items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors " +
                    (node.id === selectedMmId
                      ? "bg-accent font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground")
                  }
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: node.color }}
                  />
                  <span className="truncate">
                    {stripMarkdownSyntax(node.text).replace(/\n/g, " ")}
                  </span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <button
                onClick={addChildNode}
                className="inline-flex h-7 items-center justify-center gap-1 rounded-md bg-primary text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                <Plus className="h-3 w-3" /> Child
              </button>
              <button
                onClick={addSiblingNode}
                className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-border bg-background text-xs font-medium hover:bg-accent"
              >
                <Plus className="h-3 w-3" /> Sibling
              </button>
            </div>
          </div>

          {/* Center Mind Map Stage */}
          <div className="flex min-h-[400px] flex-1 flex-col bg-muted/20 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-border bg-card/40 px-3 py-1.5">
              <div className="flex items-center gap-1">
                <button
                  onClick={addChildNode}
                  className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:opacity-90"
                >
                  <Plus className="h-3 w-3" /> Branch
                </button>
                <button
                  onClick={addSiblingNode}
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs font-medium hover:bg-accent"
                >
                  <Plus className="h-3 w-3" /> Sibling
                </button>
                <button
                  onClick={deleteSelectedNode}
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="Delete branch"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={undoAction}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={redoAction}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="Redo (Ctrl+Y)"
                >
                  <Redo2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={centerMindMapStructure}
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium hover:bg-accent"
                >
                  <Maximize2 className="h-3 w-3" /> Center Structure
                </button>
                <button
                  onClick={() => setMmCam({ x: 0, y: 0, scale: 1 })}
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 font-mono text-xs hover:bg-accent"
                >
                  <RotateCcw className="h-3 w-3" /> {Math.round(mmCam.scale * 100)}%
                </button>
              </div>
            </div>

            <div
              className="relative flex flex-1 items-center justify-center overflow-hidden p-3"
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) {
                  setSelectedMmId(null);
                  setWholeMmFocused(false);
                }
              }}
            >
              <svg
                ref={mmSvgRef}
                viewBox={"0 0 " + mmDocW + " " + mmDocH}
                className="h-full w-full cursor-grab rounded-xl border border-border shadow-sm active:cursor-grabbing"
                onPointerDown={(e) => {
                  const onNode = (e.target as Element).closest(".mm-node");
                  if (!onNode && mmSvgRef.current) {
                    const pt = getSvgPoint(mmSvgRef.current, e.clientX, e.clientY);
                    const worldX = (pt.x - mmCam.x) / mmCam.scale;
                    const worldY = (pt.y - mmCam.y) / mmCam.scale;
                    const insideBounds =
                      worldX >= mmBounds.x &&
                      worldX <= mmBounds.x + mmBounds.w &&
                      worldY >= mmBounds.y &&
                      worldY <= mmBounds.y + mmBounds.h;

                    if (insideBounds && !wholeMmFocused) {
                      setSelectedMmId(null);
                      setWholeMmFocused(true);
                    } else {
                      setSelectedMmId(null);
                      setWholeMmFocused(false);
                    }
                    dragRef.current = {
                      type: "mm-pan",
                      startX: pt.x - mmCam.x,
                      startY: pt.y - mmCam.y,
                    };
                  }
                }}
                onWheel={(e) => {
                  e.preventDefault();
                  const factor = e.deltaY < 0 ? 1.1 : 0.9;
                  setMmCam((c) => ({
                    ...c,
                    scale: Math.min(3, Math.max(0.35, c.scale * factor)),
                  }));
                }}
              >
                <rect
                  id="mmBgRect"
                  width={mmDocW}
                  height={mmDocH}
                  fill={mmBgConfig.mode === "design" ? mmBgConfig.colors[0] : mmBgColor}
                />
                {mmBgConfig.mode === "design" && (
                  <g
                    pointerEvents="none"
                    dangerouslySetInnerHTML={{
                      __html: renderBgDesignSvgNode(
                        mmBgConfig,
                        mmDocW,
                        mmDocH,
                        "mm_stage"
                      ),
                    }}
                  />
                )}
                <g
                  transform={
                    "translate(" +
                    mmCam.x +
                    ", " +
                    mmCam.y +
                    ") scale(" +
                    mmCam.scale +
                    ")"
                  }
                >
                  {wholeMmFocused && mmNodes.length > 0 && (
                    <rect
                      className="group-focus-outline"
                      x={mmBounds.x}
                      y={mmBounds.y}
                      width={mmBounds.w}
                      height={mmBounds.h}
                      rx={16}
                      fill="rgba(56, 189, 248, 0.03)"
                      stroke="#38bdf8"
                      strokeWidth={2.5}
                      strokeDasharray="10 6"
                      pointerEvents="none"
                    />
                  )}
                  <g
                    dangerouslySetInnerHTML={{
                      __html:
                        buildMindMapViewportInnerSvg(mmNodes, mmLayout, mmDocW).split(
                          "</g><g>"
                        )[0] + "</g>",
                    }}
                  />
                  {mmNodes.map((node) => {
                    const { w, h } = getNodeBoxSize(node);
                    const isSel = node.id === selectedMmId;
                    const bw = node.borderWidth || 0;
                    const glowCol = bw > 0 ? node.borderColor || node.color : node.color;
                    return (
                      <g
                        key={node.id}
                        transform={"translate(" + node.x + ", " + node.y + ")"}
                        className="mm-node cursor-pointer"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          selectMmNode(node.id);
                          if (!mmSvgRef.current) return;
                          const pt = getSvgPoint(
                            mmSvgRef.current,
                            e.clientX,
                            e.clientY
                          );
                          saveMmHistory();
                          dragRef.current = {
                            type: "mm-node",
                            nodeId: node.id,
                            offsetX: (pt.x - mmCam.x) / mmCam.scale - node.x,
                            offsetY: (pt.y - mmCam.y) / mmCam.scale - node.y,
                          };
                        }}
                      >
                        {node.shape === "ellipse" ? (
                          <ellipse
                            rx={w / 2}
                            ry={h / 2}
                            fill={node.color}
                            stroke={bw > 0 ? node.borderColor || "#ffffff" : "none"}
                            strokeWidth={bw}
                            style={
                              node.glow
                                ? { filter: "drop-shadow(0 0 12px " + glowCol + ")" }
                                : undefined
                            }
                          />
                        ) : (
                          <rect
                            x={-w / 2}
                            y={-h / 2}
                            width={w}
                            height={h}
                            rx={node.shape === "pill" ? h / 2 : 10}
                            fill={node.color}
                            stroke={bw > 0 ? node.borderColor || "#ffffff" : "none"}
                            strokeWidth={bw}
                            style={
                              node.glow
                                ? { filter: "drop-shadow(0 0 12px " + glowCol + ")" }
                                : undefined
                            }
                          />
                        )}
                        {isSel && (
                          <rect
                            x={-w / 2 - 5}
                            y={-h / 2 - 5}
                            width={w + 10}
                            height={h + 10}
                            rx={12}
                            fill="none"
                            stroke="#38bdf8"
                            strokeWidth="2.5"
                            strokeDasharray="6 4"
                          />
                        )}
                        <g
                          dangerouslySetInnerHTML={{
                            __html: renderSvgMultilineText(
                              node.text,
                              0,
                              0,
                              node.fontSize || 18,
                              node.textColor || "#ffffff",
                              "middle",
                              true,
                              node.parentId === null ? "700" : "500",
                              node.fontFamily || "'Inter', system-ui, sans-serif"
                            ),
                          }}
                        />
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>
          </div>

          {/* Compact Right Inspector (w-[258px] on Desktop) */}
          <div className="flex shrink-0 flex-col gap-3 border-t border-border bg-card/30 p-3 lg:w-[258px] lg:overflow-y-auto lg:border-t-0 lg:border-l">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Background
              </span>
              <div className="flex rounded-md bg-muted/70 p-0.5 text-[10px] font-semibold">
                <button
                  onClick={() => setMmBgConfig((c) => ({ ...c, mode: "design" }))}
                  className={
                    "rounded px-2 py-0.5 " +
                    (mmBgConfig.mode === "design"
                      ? "bg-background text-foreground shadow-2xs"
                      : "text-muted-foreground")
                  }
                >
                  Design
                </button>
                <button
                  onClick={() => setMmBgConfig((c) => ({ ...c, mode: "solid" }))}
                  className={
                    "rounded px-2 py-0.5 " +
                    (mmBgConfig.mode === "solid"
                      ? "bg-background text-foreground shadow-2xs"
                      : "text-muted-foreground")
                  }
                >
                  Solid
                </button>
              </div>
            </div>

            {mmBgConfig.mode === "design" ? (
              <>
                <HorizontalScrollStrip innerClassName="gap-1.5 pb-1" scrollStep={190}>
                  {Object.entries(SVG_BG_PRESETS).map(([id, cfg], idx) => (
                    <button
                      key={id}
                      onClick={() => {
                        saveMmHistory();
                        setMmBgConfig({
                          mode: "design",
                          presetId: id,
                          colors: [...cfg.colors] as [string, string, string],
                        });
                      }}
                      className={
                        "relative h-[50px] w-[92px] shrink-0 overflow-hidden rounded-md border transition-all " +
                        (mmBgConfig.presetId === id
                          ? "border-primary ring-1 ring-primary"
                          : "border-border opacity-80 hover:opacity-100")
                      }
                    >
                      <svg
                        viewBox="0 0 1600 900"
                        preserveAspectRatio="none"
                        className="h-full w-full"
                        dangerouslySetInnerHTML={{
                          __html: cfg.render(
                            cfg.colors[0],
                            cfg.colors[1],
                            cfg.colors[2],
                            "mm_th_" + idx
                          ),
                        }}
                      />
                      <span className="absolute inset-x-0 bottom-0 truncate bg-black/75 px-1 py-0.5 text-[8.5px] font-medium text-white">
                        {cfg.name}
                      </span>
                    </button>
                  ))}
                </HorizontalScrollStrip>
                <div className="grid grid-cols-3 gap-1.5">
                  <div>
                    <label className="mb-0.5 block text-[10px] text-muted-foreground">
                      Base BG
                    </label>
                    <input
                      type="color"
                      value={mmBgConfig.colors[0]}
                      onChange={(e) =>
                        setMmBgConfig((c) => ({
                          ...c,
                          mode: "design",
                          colors: [e.target.value, c.colors[1], c.colors[2]],
                        }))
                      }
                      className="h-7 w-full cursor-pointer rounded border border-border bg-background"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] text-muted-foreground">
                      Shape 1
                    </label>
                    <input
                      type="color"
                      value={mmBgConfig.colors[1]}
                      onChange={(e) =>
                        setMmBgConfig((c) => ({
                          ...c,
                          mode: "design",
                          colors: [c.colors[0], e.target.value, c.colors[2]],
                        }))
                      }
                      className="h-7 w-full cursor-pointer rounded border border-border bg-background"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] text-muted-foreground">
                      Shape 2
                    </label>
                    <input
                      type="color"
                      value={mmBgConfig.colors[2]}
                      onChange={(e) =>
                        setMmBgConfig((c) => ({
                          ...c,
                          mode: "design",
                          colors: [c.colors[0], c.colors[1], e.target.value],
                        }))
                      }
                      className="h-7 w-full cursor-pointer rounded border border-border bg-background"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">
                  Solid Canvas Color
                </label>
                <input
                  type="color"
                  value={mmBgColor}
                  onChange={(e) => setMmBgColor(e.target.value)}
                  className="h-8 w-full cursor-pointer rounded border border-border bg-background"
                />
              </div>
            )}

            <hr className="border-border" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Selected Node Properties
            </span>

            {selectedMmNode ? (
              <>
                <div>
                  <label className="mb-1 block text-[11px] text-muted-foreground">
                    Node Text (**bold**, *italic*)
                  </label>
                  <textarea
                    rows={2}
                    value={selectedMmNode.text}
                    onChange={(e) => updateSelectedMmNode({ text: e.target.value })}
                    className="w-full rounded-md border border-border bg-background p-2 text-xs text-foreground focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-muted-foreground">
                    Font Family
                  </label>
                  <select
                    value={selectedMmNode.fontFamily || OPEN_SOURCE_FONTS[0].value}
                    onChange={(e) => updateSelectedMmNode({ fontFamily: e.target.value })}
                    className="h-7 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
                  >
                    {OPEN_SOURCE_FONTS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-muted-foreground">
                      Fill Color
                    </label>
                    <input
                      type="color"
                      value={selectedMmNode.color}
                      onChange={(e) => updateSelectedMmNode({ color: e.target.value })}
                      className="h-7 w-full cursor-pointer rounded border border-border bg-background"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-muted-foreground">
                      Text Color
                    </label>
                    <input
                      type="color"
                      value={selectedMmNode.textColor || "#ffffff"}
                      onChange={(e) => updateSelectedMmNode({ textColor: e.target.value })}
                      className="h-7 w-full cursor-pointer rounded border border-border bg-background"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-muted-foreground">
                      Width (px)
                    </label>
                    <NumberStepper
                      value={selectedMmBox.w}
                      min={80}
                      max={1200}
                      step={10}
                      onChange={(val) => updateSelectedMmNode({ customW: val })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-muted-foreground">
                      Height (px)
                    </label>
                    <NumberStepper
                      value={selectedMmBox.h}
                      min={36}
                      max={800}
                      step={10}
                      onChange={(val) => updateSelectedMmNode({ customH: val })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-muted-foreground">
                      Node Shape
                    </label>
                    <select
                      value={selectedMmNode.shape}
                      onChange={(e) =>
                        updateSelectedMmNode({ shape: e.target.value as MmNodeShape })
                      }
                      className="h-7 w-full rounded-md border border-border bg-background px-2 text-xs"
                    >
                      <option value="pill">Rounded Pill</option>
                      <option value="rect">Sharp Card</option>
                      <option value="ellipse">Oval / Badge</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-muted-foreground">
                      Font Size
                    </label>
                    <NumberStepper
                      value={selectedMmNode.fontSize || 18}
                      min={12}
                      max={64}
                      step={1}
                      onChange={(val) => updateSelectedMmNode({ fontSize: val })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-muted-foreground">
                      Border Size
                    </label>
                    <NumberStepper
                      value={selectedMmNode.borderWidth || 0}
                      min={0}
                      max={20}
                      step={1}
                      onChange={(val) => updateSelectedMmNode({ borderWidth: val })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-muted-foreground">
                      Border Color
                    </label>
                    <input
                      type="color"
                      value={selectedMmNode.borderColor || "#ffffff"}
                      onChange={(e) =>
                        updateSelectedMmNode({ borderColor: e.target.value })
                      }
                      className="h-7 w-full cursor-pointer rounded border border-border bg-background"
                    />
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedMmNode.glow)}
                    onChange={(e) => updateSelectedMmNode({ glow: e.target.checked })}
                  />
                  Enable Glow Effect
                </label>
                <div>
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Quick Color Presets
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_NODE_COLORS.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => updateSelectedMmNode({ color: hex })}
                        className="h-5 w-5 rounded-md border border-border transition-transform hover:scale-110"
                        style={{ backgroundColor: hex }}
                        title={hex}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                {wholeMmFocused
                  ? "Whole Mind Map focused — use ↑ / ↓ arrow keys to scale all nodes together."
                  : "Click any node to edit its text, size, colors, border, and glow."}
              </p>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: SLIDE MAKER WORKSPACE                                        */}
      {/* =================================================================== */}
      {activeTab === "slides" && (
        <div className="flex flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          {/* Compact Left Sidebar (w-[228px] on Desktop) */}
          <div className="flex shrink-0 flex-col gap-3 border-b border-border bg-card/30 p-3 lg:w-[228px] lg:overflow-y-auto lg:border-b-0 lg:border-r">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Add Slide Preset
            </span>
            <HorizontalScrollStrip innerClassName="gap-1.5 pb-1" scrollStep={190}>
              {SLIDE_PRESET_PREVIEWS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    saveSlideHistory();
                    const created = createSlideFromTemplate(item.id);
                    setSlides((prev) => [...prev, created]);
                    setCurrentSlideIdx(slides.length);
                    selectSlideElement(created.elements[0]?.id || null);
                  }}
                  className="relative h-[54px] w-[96px] shrink-0 overflow-hidden rounded-md border border-border opacity-85 transition-all hover:border-primary hover:opacity-100"
                >
                  <svg
                    viewBox="0 0 160 90"
                    preserveAspectRatio="none"
                    className="h-full w-full"
                    dangerouslySetInnerHTML={{ __html: item.svg }}
                  />
                  <span className="absolute inset-x-0 bottom-0 truncate bg-black/75 px-1 py-0.5 text-[9px] font-medium text-white">
                    + {item.label}
                  </span>
                </button>
              ))}
            </HorizontalScrollStrip>

            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Slides ({slides.length})
            </span>
            <div className="flex max-h-60 flex-1 flex-col gap-2 overflow-y-auto lg:max-h-none">
              {slides.map((s, idx) => (
                <div
                  key={s.id}
                  onClick={() => {
                    setCurrentSlideIdx(idx);
                    selectSlideElement(s.elements[0]?.id || null);
                  }}
                  className={
                    "cursor-pointer rounded-lg border p-1.5 transition-all " +
                    (idx === currentSlideIdx
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border bg-background/50 hover:bg-accent/40")
                  }
                >
                  <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      Slide {idx + 1}
                    </span>
                    <span className="font-mono">
                      {slideDocW}&times;{slideDocH}
                    </span>
                  </div>
                  <div className="aspect-video w-full overflow-hidden rounded bg-black">
                    <svg
                      viewBox={"0 0 " + slideDocW + " " + slideDocH}
                      className="h-full w-full"
                      dangerouslySetInnerHTML={{
                        __html: buildSlideSvgContent(
                          s,
                          slideDocW,
                          slideDocH,
                          null,
                          false,
                          "thumb_" + idx
                        ),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-1">
              <button
                onClick={() => {
                  saveSlideHistory();
                  const copy: VisualSlide = JSON.parse(JSON.stringify(activeSlide));
                  copy.id = "s" + Date.now();
                  copy.elements.forEach((e, i) => (e.id = "el" + Date.now() + i));
                  const next = [...slides];
                  next.splice(currentSlideIdx + 1, 0, copy);
                  setSlides(next);
                  setCurrentSlideIdx(currentSlideIdx + 1);
                }}
                className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-border bg-background text-xs font-medium hover:bg-accent"
              >
                <Copy className="h-3 w-3" /> Duplicate
              </button>
              <button
                onClick={() => {
                  if (slides.length <= 1) return;
                  saveSlideHistory();
                  setSlides((prev) => prev.filter((_, i) => i !== currentSlideIdx));
                  setCurrentSlideIdx(Math.max(0, currentSlideIdx - 1));
                }}
                className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-border bg-background text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
            </div>
          </div>

          {/* Center Slide Canvas */}
          <div className="flex min-h-[400px] flex-1 flex-col bg-muted/20 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-border bg-card/40 px-3 py-1.5">
              <div className="flex flex-wrap items-center gap-1">
                {(
                  [
                    { t: "heading", l: "+ Heading" },
                    { t: "text", l: "+ Text" },
                    { t: "rect", l: "+ Card" },
                    { t: "circle", l: "+ Circle" },
                    { t: "pill", l: "+ Pill" },
                    { t: "arrow", l: "+ Arrow" },
                  ] as { t: SlideElementType; l: string }[]
                ).map((b) => (
                  <button
                    key={b.t}
                    onClick={() => addSlideElement(b.t)}
                    className="inline-flex h-7 items-center rounded-md border border-border bg-background px-2 text-xs font-medium hover:bg-accent"
                  >
                    {b.l}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={undoAction}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="Undo"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={redoAction}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="Redo"
                >
                  <Redo2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={centerSlideStructure}
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium hover:bg-accent"
                  title="Center All Slide Items"
                >
                  <Maximize2 className="h-3 w-3" /> Center All
                </button>
                <button
                  onClick={centerSelectedSlideElement}
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2 text-xs font-medium hover:bg-accent"
                  title="Center Selected Item"
                >
                  <AlignCenter className="h-3 w-3" /> Center Item
                </button>
                <button
                  onClick={() => moveSlideElementZ(1)}
                  className="inline-flex h-7 items-center gap-0.5 rounded-md border border-border bg-background px-2 text-xs font-medium hover:bg-accent"
                  title="Bring Forward"
                >
                  <ArrowUp className="h-3 w-3" /> Front
                </button>
                <button
                  onClick={() => moveSlideElementZ(-1)}
                  className="inline-flex h-7 items-center gap-0.5 rounded-md border border-border bg-background px-2 text-xs font-medium hover:bg-accent"
                  title="Send Backward"
                >
                  <ArrowDown className="h-3 w-3" /> Back
                </button>
                <button
                  onClick={deleteSelectedSlideElement}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="Delete Selected Element"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div
              className="flex flex-1 items-center justify-center overflow-hidden p-4"
              onPointerDown={(e) => {
                if (e.target === e.currentTarget) {
                  setSelectedSlideElId(null);
                  setWholeSlideFocused(false);
                }
              }}
            >
              <div
                className="w-full max-w-[920px] overflow-hidden rounded-xl border border-border shadow-xl"
                style={{ aspectRatio: slideDocW + " / " + slideDocH }}
              >
                <svg
                  ref={slideSvgRef}
                  viewBox={"0 0 " + slideDocW + " " + slideDocH}
                  className="block h-full w-full"
                  onPointerDown={(e) => {
                    const g = (e.target as Element).closest(".slide-el");
                    if (g && slideSvgRef.current) {
                      const id = g.getAttribute("data-id");
                      if (!id) return;
                      selectSlideElement(id);
                      const el = activeSlide.elements.find((item) => item.id === id);
                      if (!el) return;
                      const pt = getSvgPoint(
                        slideSvgRef.current,
                        e.clientX,
                        e.clientY
                      );
                      saveSlideHistory();
                      dragRef.current = {
                        type: "slide-el",
                        elId: id,
                        offsetX: pt.x - el.x,
                        offsetY: pt.y - el.y,
                      };
                    } else if (slideSvgRef.current) {
                      const pt = getSvgPoint(
                        slideSvgRef.current,
                        e.clientX,
                        e.clientY
                      );
                      const insideBounds =
                        pt.x >= slideBounds.x &&
                        pt.x <= slideBounds.x + slideBounds.w &&
                        pt.y >= slideBounds.y &&
                        pt.y <= slideBounds.y + slideBounds.h;

                      if (
                        insideBounds &&
                        !wholeSlideFocused &&
                        activeSlide.elements.length > 0
                      ) {
                        setSelectedSlideElId(null);
                        setWholeSlideFocused(true);
                      } else {
                        setSelectedSlideElId(null);
                        setWholeSlideFocused(false);
                      }
                    }
                  }}
                  dangerouslySetInnerHTML={{ __html: stageSvgHtml }}
                />
              </div>
            </div>
          </div>

          {/* Compact Right Slide Inspector (w-[258px] on Desktop) */}
          <div className="flex shrink-0 flex-col gap-3 border-t border-border bg-card/30 p-3 lg:w-[258px] lg:overflow-y-auto lg:border-t-0 lg:border-l">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Background
              </span>
              <div className="flex rounded-md bg-muted/70 p-0.5 text-[10px] font-semibold">
                <button
                  onClick={() =>
                    setSlides((prev) =>
                      prev.map((sl, i) =>
                        i === currentSlideIdx
                          ? { ...sl, bgConfig: { ...activeSlideBgCfg, mode: "design" } }
                          : sl
                      )
                    )
                  }
                  className={
                    "rounded px-2 py-0.5 " +
                    (activeSlideBgCfg.mode === "design"
                      ? "bg-background text-foreground shadow-2xs"
                      : "text-muted-foreground")
                  }
                >
                  Design
                </button>
                <button
                  onClick={() =>
                    setSlides((prev) =>
                      prev.map((sl, i) =>
                        i === currentSlideIdx
                          ? { ...sl, bgConfig: { ...activeSlideBgCfg, mode: "solid" } }
                          : sl
                      )
                    )
                  }
                  className={
                    "rounded px-2 py-0.5 " +
                    (activeSlideBgCfg.mode === "solid"
                      ? "bg-background text-foreground shadow-2xs"
                      : "text-muted-foreground")
                  }
                >
                  Solid / Grad
                </button>
              </div>
            </div>

            {activeSlideBgCfg.mode === "design" ? (
              <>
                <HorizontalScrollStrip innerClassName="gap-1.5 pb-1" scrollStep={190}>
                  {Object.entries(SVG_BG_PRESETS).map(([id, cfg], idx) => (
                    <button
                      key={id}
                      onClick={() => {
                        saveSlideHistory();
                        const isLight = isHexColorLight(cfg.colors[0]);
                        setSlides((prev) =>
                          prev.map((sl, i) =>
                            i === currentSlideIdx
                              ? {
                                  ...sl,
                                  elements: adaptSlideElementsForContrast(
                                    sl.elements,
                                    isLight ),
                                  bgConfig: {
                                    mode: "design",
                                    presetId: id,
                                    colors: [...cfg.colors] as [string, string, string],
                                  },
                                }
                              : sl
                          )
                        );
                      }}
                      className={
                        "relative h-[50px] w-[92px] shrink-0 overflow-hidden rounded-md border transition-all " +
                        (activeSlideBgCfg.presetId === id
                          ? "border-primary ring-1 ring-primary"
                          : "border-border opacity-80 hover:opacity-100")
                      }
                    >
                      <svg
                        viewBox="0 0 1600 900"
                        preserveAspectRatio="none"
                        className="h-full w-full"
                        dangerouslySetInnerHTML={{
                          __html: cfg.render(
                            cfg.colors[0],
                            cfg.colors[1],
                            cfg.colors[2],
                            "sl_th_" + idx
                          ),
                        }}
                      />
                      <span className="absolute inset-x-0 bottom-0 truncate bg-black/75 px-1 py-0.5 text-[8.5px] font-medium text-white">
                        {cfg.name}
                      </span>
                    </button>
                  ))}
                </HorizontalScrollStrip>
                <div className="grid grid-cols-3 gap-1.5">
                  <div>
                    <label className="mb-0.5 block text-[10px] text-muted-foreground">
                      Base BG
                    </label>
                    <input
                      type="color"
                      value={activeSlideBgCfg.colors[0]}
                      onChange={(e) => {
                        const hex = e.target.value;
                        const isLight = isHexColorLight(hex);
                        setSlides((prev) =>
                          prev.map((sl, i) =>
                            i === currentSlideIdx
                              ? {
                                  ...sl,
                                  elements: adaptSlideElementsForContrast(
                                    sl.elements,
                                    isLight
                                  ),
                                  bgConfig: {
                                    ...activeSlideBgCfg,
                                    mode: "design",
                                    colors: [
                                      hex,
                                      activeSlideBgCfg.colors[1],
                                      activeSlideBgCfg.colors[2],
                                    ],
                                  },
                                }
                              : sl
                          )
                        );
                      }}
                      className="h-7 w-full cursor-pointer rounded border border-border bg-background"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] text-muted-foreground">
                      Shape 1
                    </label>
                    <input
                      type="color"
                      value={activeSlideBgCfg.colors[1]}
                      onChange={(e) => {
                        const hex = e.target.value;
                        setSlides((prev) =>
                          prev.map((sl, i) =>
                            i === currentSlideIdx
                              ? {
                                  ...sl,
                                  bgConfig: {
                                    ...activeSlideBgCfg,
                                    mode: "design",
                                    colors: [
                                      activeSlideBgCfg.colors[0],
                                      hex,
                                      activeSlideBgCfg.colors[2],
                                    ],
                                  },
                                }
                              : sl
                          )
                        );
                      }}
                      className="h-7 w-full cursor-pointer rounded border border-border bg-background"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] text-muted-foreground">
                      Shape 2
                    </label>
                    <input
                      type="color"
                      value={activeSlideBgCfg.colors[2]}
                      onChange={(e) => {
                        const hex = e.target.value;
                        setSlides((prev) =>
                          prev.map((sl, i) =>
                            i === currentSlideIdx
                              ? {
                                  ...sl,
                                  bgConfig: {
                                    ...activeSlideBgCfg,
                                    mode: "design",
                                    colors: [
                                      activeSlideBgCfg.colors[0],
                                      activeSlideBgCfg.colors[1],
                                      hex,
                                    ],
                                  },
                                }
                              : sl
                          )
                        );
                      }}
                      className="h-7 w-full cursor-pointer rounded border border-border bg-background"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <div>
                  <label className="mb-1 block text-[11px] text-muted-foreground">
                    Solid Slide Color
                  </label>
                  <input
                    type="color"
                    value={activeSlide.bg.startsWith("#") ? activeSlide.bg : "#0f172a"}
                    onChange={(e) => {
                      const hex = e.target.value;
                      const isLight = isHexColorLight(hex);
                      setSlides((prev) =>
                        prev.map((sl, i) =>
                          i === currentSlideIdx
                            ? {
                                ...sl,
                                bg: hex,
                                elements: adaptSlideElementsForContrast(
                                  sl.elements,
                                  isLight
                                ),
                                bgConfig: { ...activeSlideBgCfg, mode: "solid" },
                              }
                            : sl
                        )
                      );
                    }}
                    className="h-7 w-full cursor-pointer rounded border border-border bg-background"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-muted-foreground">
                    Classic Gradients
                  </label>
                  <select
                    value={activeSlide.bg}
                    onChange={(e) => {
                      const val = e.target.value;
                      const isLight =
                        val === "#ffffff" || val === "#f8fafc" || val === "grad-arctic";
                      saveSlideHistory();
                      setSlides((prev) =>
                        prev.map((sl, i) =>
                          i === currentSlideIdx
                            ? {
                                ...sl,
                                bg: val,
                                elements: adaptSlideElementsForContrast(
                                  sl.elements,
                                  isLight
                                ),
                                bgConfig: { ...activeSlideBgCfg, mode: "solid" },
                              }
                            : sl
                        )
                      );
                    }}
                    className="h-7 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
                  >
                    <option value="#0f172a">Midnight Slate (Dark)</option>
                    <option value="grad-indigo">Royal Indigo Gradient</option>
                    <option value="grad-emerald">Emerald Cyber Gradient</option>
                    <option value="grad-sunset">Sunset Coral &amp; Violet</option>
                    <option value="grad-ocean">Deep Pacific Cyan</option>
                    <option value="grad-crimson">Velvet Crimson Night</option>
                    <option value="grad-gold">Obsidian &amp; Luxury Gold</option>
                    <option value="grad-aurora">Northern Aurora Mesh</option>
                    <option value="grad-arctic">Arctic Frost (Light)</option>
                    <option value="#f8fafc">Alabaster Paper (Light)</option>
                    <option value="#ffffff">Clean Daylight (White)</option>
                    <option value="#18181b">Carbon Matte</option>
                  </select>
                </div>
              </div>
            )}

            <hr className="border-border" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Selected Element Inspector
            </span>

            {selectedSlideEl ? (
              <>
                <div>
                  <label className="mb-1 block text-[11px] text-muted-foreground">
                    Text (# H1, **bold**, *italic*)
                  </label>
                  <textarea
                    rows={2}
                    value={selectedSlideEl.text}
                    onChange={(e) => updateSelectedSlideEl({ text: e.target.value })}
                    className="w-full rounded-md border border-border bg-background p-2 text-xs text-foreground focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-muted-foreground">
                    Font Family
                  </label>
                  <select
                    value={selectedSlideEl.fontFamily || OPEN_SOURCE_FONTS[0].value}
                    onChange={(e) => updateSelectedSlideEl({ fontFamily: e.target.value })}
                    className="h-7 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
                  >
                    {OPEN_SOURCE_FONTS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-muted-foreground">
                      Fill / Color
                    </label>
                    <input
                      type="color"
                      value={selectedSlideEl.fill || "#6366f1"}
                      onChange={(e) => updateSelectedSlideEl({ fill: e.target.value })}
                      className="h-7 w-full cursor-pointer rounded border border-border bg-background"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-muted-foreground">
                      Text Color
                    </label>
                    <input
                      type="color"
                      value={selectedSlideEl.stroke || "#ffffff"}
                      onChange={(e) => updateSelectedSlideEl({ stroke: e.target.value })}
                      className="h-7 w-full cursor-pointer rounded border border-border bg-background"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-muted-foreground">
                      Width (px)
                    </label>
                    <NumberStepper
                      value={selectedSlideEl.w}
                      min={24}
                      max={2000}
                      step={10}
                      onChange={(val) => updateSelectedSlideEl({ w: val })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-muted-foreground">
                      Height (px)
                    </label>
                    <NumberStepper
                      value={selectedSlideEl.h}
                      min={24}
                      max={2000}
                      step={10}
                      onChange={(val) => updateSelectedSlideEl({ h: val })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-muted-foreground">
                      Font Size
                    </label>
                    <NumberStepper
                      value={selectedSlideEl.fontSize}
                      min={12}
                      max={140}
                      step={2}
                      onChange={(val) => updateSelectedSlideEl({ fontSize: val })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-muted-foreground">
                      Corner Radius
                    </label>
                    <NumberStepper
                      value={selectedSlideEl.rx ?? 16}
                      min={0}
                      max={200}
                      step={2}
                      onChange={(val) => updateSelectedSlideEl({ rx: val })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-muted-foreground">
                      Border Size
                    </label>
                    <NumberStepper
                      value={selectedSlideEl.borderWidth || 0}
                      min={0}
                      max={30}
                      step={1}
                      onChange={(val) => updateSelectedSlideEl({ borderWidth: val })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-muted-foreground">
                      Border Color
                    </label>
                    <input
                      type="color"
                      value={selectedSlideEl.borderColor || "#ffffff"}
                      onChange={(e) =>
                        updateSelectedSlideEl({ borderColor: e.target.value })
                      }
                      className="h-7 w-full cursor-pointer rounded border border-border bg-background"
                    />
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedSlideEl.glow)}
                    onChange={(e) => updateSelectedSlideEl({ glow: e.target.checked })}
                  />
                  Enable Glow Effect
                </label>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                {wholeSlideFocused
                  ? "Whole Slide focused — use ↑ / ↓ arrow keys to scale all items together."
                  : "Click any element on the slide stage to customize its text, font, colors, border, and size."}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Floating Scale Hint Pill (Matches Visualize Studio) */}
      {(selectedMmId || wholeMmFocused || selectedSlideElId || wholeSlideFocused) && (
        <div className="pointer-events-none fixed bottom-3 left-1/2 z-40 hidden -translate-x-1/2 items-center gap-2 rounded-full border border-sky-500/40 bg-card/95 px-3.5 py-1 text-[11px] font-medium text-foreground shadow-lg backdrop-blur-md md:inline-flex">
          {activeTab === "mindmap" ? (
            selectedMmId ? (
              <>
                <span>Node Selected</span>
                <span className="text-muted-foreground">&bull;</span>
                <span>
                  Press{" "}
                  <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px] text-sky-500">
                    &uarr;
                  </kbd>{" "}
                  <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px] text-sky-500">
                    &darr;
                  </kbd>{" "}
                  arrows to resize
                </span>
                <span className="text-muted-foreground">&bull;</span>
                <span className="text-muted-foreground">
                  Click empty space to focus whole map
                </span>
              </>
            ) : (
              <>
                <span className="font-semibold text-sky-500">
                  Whole Mind Map Focused
                </span>
                <span className="text-muted-foreground">&bull;</span>
                <span>
                  Press{" "}
                  <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px] text-sky-500">
                    &uarr;
                  </kbd>{" "}
                  <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px] text-sky-500">
                    &darr;
                  </kbd>{" "}
                  arrows to scale all
                </span>
                <span className="text-muted-foreground">&bull;</span>
                <span className="text-muted-foreground">
                  Click outside outline to clear
                </span>
              </>
            )
          ) : selectedSlideElId ? (
            <>
              <span>Component Selected</span>
              <span className="text-muted-foreground">&bull;</span>
              <span>
                Press{" "}
                <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px] text-sky-500">
                  &uarr;
                </kbd>{" "}
                <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px] text-sky-500">
                  &darr;
                </kbd>{" "}
                arrows to resize
              </span>
              <span className="text-muted-foreground">&bull;</span>
              <span className="text-muted-foreground">
                Click inside slide to focus all
              </span>
            </>
          ) : (
            <>
              <span className="font-semibold text-sky-500">
                Whole Slide Focused
              </span>
              <span className="text-muted-foreground">&bull;</span>
              <span>
                Press{" "}
                <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px] text-sky-500">
                  &uarr;
                </kbd>{" "}
                <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px] text-sky-500">
                  &darr;
                </kbd>{" "}
                arrows to scale all
              </span>
              <span className="text-muted-foreground">&bull;</span>
              <span className="text-muted-foreground">
                Click outside outline to clear
              </span>
            </>
          )}
        </div>
      )}

      {/* Fullscreen Presenter Modal */}
      {presenterOpen && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black">
          <div className="flex h-full w-full items-center justify-center p-4">
            <svg
              viewBox={"0 0 " + slideDocW + " " + slideDocH}
              className="max-h-full max-w-full"
              dangerouslySetInnerHTML={{
                __html: buildSlideSvgContent(
                  activeSlide,
                  slideDocW,
                  slideDocH,
                  null,
                  false,
                  "pres"
                ),
              }}
            />
          </div>
          <div className="fixed bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card/90 px-4 py-1.5 shadow-lg backdrop-blur-md">
            <button
              onClick={() => setCurrentSlideIdx((i) => Math.max(0, i - 1))}
              className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent"
            >
              Prev
            </button>
            <span className="px-2 font-mono text-xs font-semibold">
              {currentSlideIdx + 1} / {slides.length}
            </span>
            <button
              onClick={() =>
                setCurrentSlideIdx((i) => Math.min(slides.length - 1, i + 1))
              }
              className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-accent"
            >
              Next
            </button>
            <button
              onClick={() => setPresenterOpen(false)}
              className="rounded-md bg-destructive px-2.5 py-1 text-xs font-medium text-white"
            >
              Exit (Esc)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
