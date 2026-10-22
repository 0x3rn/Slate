import { markdownToHtmlSnippet, sanitizePreviewHtml } from "./document-converters";
import { getCachedEmbeddedFontCss } from "../pdf-export";

export type MmNodeShape = "pill" | "rect" | "ellipse";
export type MmLayoutMode =
  | "mindmap"
  | "radial"
  | "timeline"
  | "fishbone"
  | "right"
  | "left"
  | "org"
  | "bottom-up";

export interface MmNode {
  id: string;
  parentId: string | null;
  text: string;
  x: number;
  y: number;
  color: string;
  textColor: string;
  shape: MmNodeShape;
  fontSize: number;
  customW?: number;
  customH?: number;
  fontFamily?: string;
  borderWidth?: number;
  borderColor?: string;
  glow?: boolean;
}

export interface BgConfig {
  mode: "design" | "solid";
  presetId: string;
  colors: [string, string, string];
  solid?: string;
}

export type SlideElementType =
  | "heading"
  | "text"
  | "rect"
  | "circle"
  | "pill"
  | "arrow"
  | "mindmap-embed";

export interface SlideElement {
  id: string;
  type: SlideElementType;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  fill: string;
  stroke: string;
  fontSize: number;
  rx?: number;
  borderWidth?: number;
  borderColor?: string;
  glow?: boolean;
  fontFamily?: string;
  mmBaseW?: number;
  mmBaseH?: number;
  svgInner?: string;
}

export interface VisualSlide {
  id: string;
  bg: string;
  bgConfig?: BgConfig;
  elements: SlideElement[];
}

export const OPEN_SOURCE_FONTS: { value: string; label: string }[] = [
  { value: "'Inter', system-ui, sans-serif", label: "Inter (Clean Sans)" },
  { value: "'Plus Jakarta Sans', system-ui, sans-serif", label: "Plus Jakarta Sans (Modern Tech)" },
  { value: "'Poppins', sans-serif", label: "Poppins (Geometric Sans)" },
  { value: "'Montserrat', sans-serif", label: "Montserrat (Bold Display)" },
  { value: "'Space Grotesk', sans-serif", label: "Space Grotesk (Sci-Fi / Web3)" },
  { value: "'Syne', sans-serif", label: "Syne (Art-House Wide)" },
  { value: "'Oswald', Impact, sans-serif", label: "Oswald (Tall Condensed)" },
  { value: "'Playfair Display', Georgia, serif", label: "Playfair Display (Luxury Serif)" },
  { value: "'Merriweather', Georgia, serif", label: "Merriweather (Editorial Serif)" },
  { value: "'Lora', Georgia, serif", label: "Lora (Calligraphic Serif)" },
  { value: "'JetBrains Mono', monospace", label: "JetBrains Mono (Code / Tech)" },
  { value: "'Caveat', cursive", label: "Caveat (Handwritten Script)" },
];

export const DEFAULT_MM_NODES: MmNode[] = [
  { id: "n1", parentId: null, text: "**Mind Map Maker**\n*Click any node to edit*", x: 800, y: 450, color: "#6366f1", textColor: "#ffffff", shape: "pill", fontSize: 26, customW: 320, customH: 96 },
  { id: "n2", parentId: "n1", text: "**Right Panel: Styling**", x: 1065, y: 255, color: "#ec4899", textColor: "#ffffff", shape: "pill", fontSize: 20, customW: 265, customH: 60 },
  { id: "n3", parentId: "n2", text: "Pick **Font Family**, size,\nand node shape on right", x: 1395, y: 175, color: "#1e293b", textColor: "#f8fafc", shape: "rect", fontSize: 18, customW: 285, customH: 80 },
  { id: "n4", parentId: "n2", text: "Resize **Width × Height**,\nborders, or **bold** text", x: 1395, y: 335, color: "#1e293b", textColor: "#f8fafc", shape: "rect", fontSize: 18, customW: 285, customH: 80 },
  { id: "n8", parentId: "n1", text: "**Left Panel: Layouts**", x: 535, y: 255, color: "#f59e0b", textColor: "#ffffff", shape: "pill", fontSize: 20, customW: 265, customH: 60 },
  { id: "n9", parentId: "n8", text: "Switch *Radial*, *Timeline*,\nor *Tree* layouts on left", x: 205, y: 175, color: "#1e293b", textColor: "#f8fafc", shape: "rect", fontSize: 18, customW: 285, customH: 80 },
  { id: "n10", parentId: "n8", text: "Apply one-click color\npresets from top-left", x: 205, y: 335, color: "#1e293b", textColor: "#f8fafc", shape: "rect", fontSize: 18, customW: 285, customH: 80 },
  { id: "n5", parentId: "n1", text: "**Top-Right: Exports**", x: 1065, y: 645, color: "#10b981", textColor: "#ffffff", shape: "pill", fontSize: 20, customW: 265, customH: 60 },
  { id: "n6", parentId: "n5", text: "Set **Width × Height** and\nexport \x60SVG\x60, \x60PNG\x60, \x60PDF\x60", x: 1395, y: 565, color: "#1e293b", textColor: "#f8fafc", shape: "rect", fontSize: 18, customW: 285, customH: 80 },
  { id: "n7", parentId: "n5", text: "Click **Send to Slide Deck**\nto use map in a slide", x: 1395, y: 725, color: "#1e293b", textColor: "#f8fafc", shape: "rect", fontSize: 18, customW: 285, customH: 80 },
  { id: "n11", parentId: "n1", text: "**Left Panel: Outline**", x: 535, y: 645, color: "#0ea5e9", textColor: "#ffffff", shape: "pill", fontSize: 20, customW: 265, customH: 60 },
  { id: "n12", parentId: "n11", text: "Browse nodes in order\nor add child branches", x: 205, y: 565, color: "#1e293b", textColor: "#f8fafc", shape: "rect", fontSize: 18, customW: 285, customH: 80 },
  { id: "n13", parentId: "n11", text: "Use **Center Structure**\nif nodes move off-place", x: 205, y: 725, color: "#1e293b", textColor: "#f8fafc", shape: "rect", fontSize: 18, customW: 285, customH: 80 },
];

export const DEFAULT_VISUAL_SLIDES: VisualSlide[] = [
  {
    id: "s1",
    bg: "grad-indigo",
    bgConfig: { mode: "design", presetId: "bg16", colors: ["#0c1024", "#312e81", "#4f46e5"] },
    elements: [
      { id: "e1", type: "pill", x: 110, y: 165, w: 240, h: 48, text: "**GETTING STARTED**", fill: "#4f46e5", stroke: "#ffffff", fontSize: 16, rx: 24, borderWidth: 0 },
      { id: "e2", type: "heading", x: 110, y: 250, w: 920, h: 170, text: "**How to Use the**\nSlide Maker", fill: "#6366f1", stroke: "#ffffff", fontSize: 68, rx: 0, borderWidth: 0 },
      { id: "e3", type: "text", x: 110, y: 475, w: 890, h: 160, text: "Click any item on the slide to edit or drag it into place.\n- Use the **left panel** to add slide layout presets or reorder slides\n- Use the **top toolbar** to insert text, cards, circles, badges, and arrows\n- Set custom dimensions at the **top right** and export to **SVG**, **PNG**, or **PDF**", fill: "#94a3b8", stroke: "#cbd5e1", fontSize: 25, rx: 0, borderWidth: 0 },
      { id: "e4", type: "rect", x: 1070, y: 200, w: 420, h: 480, text: "**Right Panel Controls**\n\n- **Background Theme** at top-right\n- **Font Family** per selected item\n- **Markdown** for **bold** & *italics*\n- **Width, Height & Radius** controls\n- **Border Size** & optional glow", fill: "#1e293b", stroke: "#f8fafc", fontSize: 23, rx: 24, borderWidth: 0 },
    ],
  },
  {
    id: "s2",
    bg: "#0f172a",
    bgConfig: { mode: "design", presetId: "bg19", colors: ["#0f172a", "#1e293b", "#6366f1"] },
    elements: [
      { id: "e21", type: "heading", x: 100, y: 80, w: 1100, h: 80, text: "**Layout & Presentation Controls**", fill: "#6366f1", stroke: "#ffffff", fontSize: 50, rx: 0, borderWidth: 0 },
      { id: "e22", type: "rect", x: 100, y: 220, w: 430, h: 520, text: "**1. Left Panel: Slide Presets**\n\nPick a preset from the\n**top-left strip** to add\nready-made grids, roadmaps,\nfunnels, or two-column slides.", fill: "#1e293b", stroke: "#38bdf8", fontSize: 25, rx: 22, borderWidth: 0 },
      { id: "e23", type: "rect", x: 585, y: 220, w: 430, h: 520, text: "**2. Top Bar: Align & Layer**\n\nUse **Center All** or **Center Item**\nif something moves out of place.\nUse **Front**, **Back**, and **Undo**\nto manage overlapping items.", fill: "#1e293b", stroke: "#a855f7", fontSize: 25, rx: 22, borderWidth: 0 },
      { id: "e24", type: "rect", x: 1070, y: 220, w: 430, h: 520, text: "**3. Top-Right: Present & Export**\n\nClick **Present** for fullscreen\nslideshow mode with arrow keys,\nor download your deck as a\nmulti-page **PDF**.", fill: "#1e293b", stroke: "#10b981", fontSize: 25, rx: 22, borderWidth: 0 },
    ],
  },
];

export const MM_LAYOUT_PREVIEWS: { id: MmLayoutMode; label: string; svg: string }[] = [
  { id: "mindmap", label: "Balanced L&R", svg: '<rect width="160" height="90" fill="#0f172a"/><path d="M80 45 L42 24 M80 45 L42 66 M80 45 L118 24 M80 45 L118 66" stroke="#6366f1" stroke-width="2.5"/><rect x="60" y="35" width="40" height="20" rx="10" fill="#6366f1"/><rect x="18" y="16" width="32" height="14" rx="7" fill="#f59e0b"/><rect x="18" y="60" width="32" height="14" rx="7" fill="#0ea5e9"/><rect x="110" y="16" width="32" height="14" rx="7" fill="#ec4899"/><rect x="110" y="60" width="32" height="14" rx="7" fill="#10b981"/>' },
  { id: "radial", label: "Radial Orbit", svg: '<rect width="160" height="90" fill="#0f172a"/><circle cx="80" cy="45" r="28" fill="none" stroke="#1e293b" stroke-width="1.5" stroke-dasharray="3 3"/><path d="M80 45 L50 22 M80 45 L110 22 M80 45 L50 68 M80 45 L110 68 M80 45 L32 45 M80 45 L128 45" stroke="#6366f1" stroke-width="2"/><circle cx="80" cy="45" r="12" fill="#6366f1"/><circle cx="50" cy="22" r="7" fill="#ec4899"/><circle cx="110" cy="22" r="7" fill="#10b981"/><circle cx="50" cy="68" r="7" fill="#f59e0b"/><circle cx="110" cy="68" r="7" fill="#0ea5e9"/><circle cx="32" cy="45" r="6" fill="#8b5cf6"/><circle cx="128" cy="45" r="6" fill="#38bdf8"/>' },
  { id: "timeline", label: "Timeline", svg: '<rect width="160" height="90" fill="#0f172a"/><line x1="20" y1="45" x2="142" y2="45" stroke="#6366f1" stroke-width="2.5"/><line x1="58" y1="45" x2="58" y2="20" stroke="#ec4899" stroke-width="2"/><line x1="96" y1="45" x2="96" y2="70" stroke="#10b981" stroke-width="2"/><line x1="134" y1="45" x2="134" y2="20" stroke="#f59e0b" stroke-width="2"/><rect x="12" y="36" width="26" height="18" rx="9" fill="#6366f1"/><rect x="44" y="12" width="28" height="12" rx="4" fill="#1e293b" stroke="#ec4899" stroke-width="1.5"/><rect x="82" y="64" width="28" height="12" rx="4" fill="#1e293b" stroke="#10b981" stroke-width="1.5"/><rect x="120" y="12" width="28" height="12" rx="4" fill="#1e293b" stroke="#f59e0b" stroke-width="1.5"/>' },
  { id: "fishbone", label: "Fishbone", svg: '<rect width="160" height="90" fill="#0f172a"/><line x1="18" y1="45" x2="130" y2="45" stroke="#6366f1" stroke-width="2.5"/><line x1="45" y1="18" x2="68" y2="45" stroke="#ec4899" stroke-width="2"/><line x1="88" y1="18" x2="110" y2="45" stroke="#10b981" stroke-width="2"/><line x1="45" y1="72" x2="68" y2="45" stroke="#f59e0b" stroke-width="2"/><line x1="88" y1="72" x2="110" y2="45" stroke="#0ea5e9" stroke-width="2"/><rect x="120" y="34" width="28" height="22" rx="11" fill="#6366f1"/><rect x="30" y="10" width="26" height="12" rx="4" fill="#ec4899"/><rect x="74" y="10" width="26" height="12" rx="4" fill="#10b981"/><rect x="30" y="68" width="26" height="12" rx="4" fill="#f59e0b"/><rect x="74" y="68" width="26" height="12" rx="4" fill="#0ea5e9"/>' },
  { id: "right", label: "Right Tree", svg: '<rect width="160" height="90" fill="#0f172a"/><path d="M32 45 L78 24 M32 45 L78 66 M78 24 L128 16 M78 24 L128 34 M78 66 L128 56 M78 66 L128 74" stroke="#6366f1" stroke-width="2"/><rect x="14" y="35" width="32" height="20" rx="10" fill="#6366f1"/><rect x="64" y="17" width="28" height="14" rx="7" fill="#ec4899"/><rect x="64" y="59" width="28" height="14" rx="7" fill="#10b981"/><rect x="114" y="10" width="30" height="10" rx="3" fill="#334155"/><rect x="114" y="28" width="30" height="10" rx="3" fill="#334155"/><rect x="114" y="50" width="30" height="10" rx="3" fill="#334155"/><rect x="114" y="68" width="30" height="10" rx="3" fill="#334155"/>' },
  { id: "left", label: "Left Tree", svg: '<rect width="160" height="90" fill="#0f172a"/><path d="M128 45 L82 24 M128 45 L82 66 M82 24 L32 16 M82 24 L32 34 M82 66 L32 56 M82 66 L32 74" stroke="#6366f1" stroke-width="2"/><rect x="114" y="35" width="32" height="20" rx="10" fill="#6366f1"/><rect x="68" y="17" width="28" height="14" rx="7" fill="#f59e0b"/><rect x="68" y="59" width="28" height="14" rx="7" fill="#0ea5e9"/><rect x="16" y="10" width="30" height="10" rx="3" fill="#334155"/><rect x="16" y="28" width="30" height="10" rx="3" fill="#334155"/><rect x="16" y="50" width="30" height="10" rx="3" fill="#334155"/><rect x="16" y="68" width="30" height="10" rx="3" fill="#334155"/>' },
  { id: "org", label: "Top-Down Org", svg: '<rect width="160" height="90" fill="#0f172a"/><path d="M80 18 L34 44 M80 18 L80 44 M80 18 L126 44 M34 44 L34 70 M80 44 L80 70 M126 44 L126 70" stroke="#6366f1" stroke-width="2"/><rect x="60" y="8" width="40" height="16" rx="8" fill="#6366f1"/><rect x="18" y="38" width="32" height="13" rx="6" fill="#ec4899"/><rect x="64" y="38" width="32" height="13" rx="6" fill="#10b981"/><rect x="110" y="38" width="32" height="13" rx="6" fill="#0ea5e9"/><rect x="18" y="64" width="32" height="12" rx="3" fill="#334155"/><rect x="64" y="64" width="32" height="12" rx="3" fill="#334155"/><rect x="110" y="64" width="32" height="12" rx="3" fill="#334155"/>' },
  { id: "bottom-up", label: "Bottom-Up Tree", svg: '<rect width="160" height="90" fill="#0f172a"/><path d="M80 72 L34 46 M80 72 L80 46 M80 72 L126 46 M34 46 L34 20 M80 46 L80 20 M126 46 L126 20" stroke="#6366f1" stroke-width="2"/><rect x="60" y="66" width="40" height="16" rx="8" fill="#6366f1"/><rect x="18" y="39" width="32" height="13" rx="6" fill="#f59e0b"/><rect x="64" y="39" width="32" height="13" rx="6" fill="#10b981"/><rect x="110" y="39" width="32" height="13" rx="6" fill="#ec4899"/><rect x="18" y="14" width="32" height="12" rx="3" fill="#334155"/><rect x="64" y="14" width="32" height="12" rx="3" fill="#334155"/><rect x="110" y="14" width="32" height="12" rx="3" fill="#334155"/>' },
];

export const MM_THEME_PREVIEWS: {
  id: string;
  label: string;
  bg: string;
  root: string;
  b1: string;
  b2: string;
  leaf: string;
  text: string;
  shape: MmNodeShape;
  branches: string[];
}[] = [
  { id: "default", label: "Default Dark", bg: "#0f172a", root: "#6366f1", b1: "#ec4899", b2: "#10b981", leaf: "#1e293b", text: "#ffffff", shape: "pill", branches: ["#ec4899", "#10b981", "#f59e0b", "#0ea5e9", "#8b5cf6"] },
  { id: "cyber", label: "Cyberpunk Neon", bg: "#090d16", root: "#f43f5e", b1: "#06b6d4", b2: "#a855f7", leaf: "#111827", text: "#ffffff", shape: "rect", branches: ["#06b6d4", "#a855f7", "#eab308", "#10b981", "#ec4899"] },
  { id: "ocean", label: "Deep Ocean", bg: "#081c24", root: "#0284c7", b1: "#06b6d4", b2: "#14b8a6", leaf: "#0f2936", text: "#f0f9ff", shape: "pill", branches: ["#06b6d4", "#14b8a6", "#38bdf8", "#0ea5e9", "#6366f1"] },
  { id: "sunset", label: "Sunset Coral", bg: "#18101c", root: "#ea580c", b1: "#f43f5e", b2: "#f59e0b", leaf: "#27172c", text: "#ffffff", shape: "pill", branches: ["#f43f5e", "#f59e0b", "#d946ef", "#ec4899", "#fb923c"] },
  { id: "emerald", label: "Emerald Forest", bg: "#061a14", root: "#10b981", b1: "#059669", b2: "#84cc16", leaf: "#0d2b22", text: "#ecfdf5", shape: "rect", branches: ["#059669", "#14b8a6", "#84cc16", "#34d399", "#0ea5e9"] },
  { id: "mono", label: "Monochrome", bg: "#09090b", root: "#52525b", b1: "#3f3f46", b2: "#27272a", leaf: "#18181b", text: "#fafafa", shape: "rect", branches: ["#3f3f46", "#27272a", "#3f3f46", "#27272a"] },
  { id: "daylight", label: "Clean Daylight", bg: "#f8fafc", root: "#4f46e5", b1: "#0284c7", b2: "#059669", leaf: "#cbd5e1", text: "#0f172a", shape: "pill", branches: ["#0284c7", "#059669", "#d97706", "#db2777", "#7c3aed"] },
];

export const SLIDE_PRESET_PREVIEWS: { id: string; label: string; svg: string }[] = [
  { id: "title", label: "Keynote Title", svg: '<rect width="160" height="90" fill="#1e1b4b"/><rect x="16" y="20" width="32" height="8" rx="4" fill="#6366f1"/><rect x="16" y="34" width="96" height="14" rx="3" fill="#ffffff"/><rect x="16" y="54" width="70" height="8" rx="2" fill="#94a3b8"/>' },
  { id: "kpi", label: "4-KPI Metrics", svg: '<rect width="160" height="90" fill="#0c4a6e"/><rect x="12" y="10" width="70" height="8" rx="2" fill="#ffffff"/><rect x="12" y="24" width="31" height="28" rx="4" fill="#0f172a"/><rect x="47" y="24" width="31" height="28" rx="4" fill="#0f172a"/><rect x="82" y="24" width="31" height="28" rx="4" fill="#0f172a"/><rect x="117" y="24" width="31" height="28" rx="4" fill="#0f172a"/><rect x="12" y="58" width="136" height="20" rx="4" fill="#090d16"/>' },
  { id: "roadmap", label: "4-Step Roadmap", svg: '<rect width="160" height="90" fill="#0f172a"/><rect x="12" y="12" width="75" height="8" rx="2" fill="#ffffff"/><rect x="10" y="28" width="30" height="44" rx="4" fill="#1e293b"/><rect x="46" y="28" width="30" height="44" rx="4" fill="#1e293b"/><rect x="82" y="28" width="30" height="44" rx="4" fill="#1e293b"/><rect x="118" y="28" width="30" height="44" rx="4" fill="#1e293b"/>' },
  { id: "grid4", label: "2×2 SWOT Grid", svg: '<rect width="160" height="90" fill="#111827"/><rect x="12" y="16" width="64" height="28" rx="4" fill="#1e293b"/><rect x="84" y="16" width="64" height="28" rx="4" fill="#1e293b"/><rect x="12" y="50" width="64" height="28" rx="4" fill="#1e293b"/><rect x="84" y="50" width="64" height="28" rx="4" fill="#1e293b"/>' },
  { id: "funnel", label: "3-Stage Funnel", svg: '<rect width="160" height="90" fill="#181028"/><rect x="18" y="18" width="124" height="16" rx="8" fill="#6366f1"/><rect x="34" y="40" width="92" height="16" rx="8" fill="#ec4899"/><rect x="52" y="62" width="56" height="16" rx="8" fill="#f59e0b"/>' },
  { id: "quote", label: "Executive Quote", svg: '<rect width="160" height="90" fill="#1c1917"/><rect x="60" y="14" width="40" height="8" rx="4" fill="#d97706"/><rect x="18" y="28" width="124" height="46" rx="6" fill="#09090b"/>' },
  { id: "hero-split", label: "Hero + Circle", svg: '<rect width="160" height="90" fill="#3b0a1e"/><rect x="14" y="20" width="68" height="14" rx="3" fill="#ffffff"/><rect x="14" y="42" width="62" height="26" rx="3" fill="#fda4af" fill-opacity="0.4"/><circle cx="118" cy="45" r="26" fill="#be123c"/>' },
  { id: "cards", label: "3 Pillar Cards", svg: '<rect width="160" height="90" fill="#0f172a"/><rect x="12" y="12" width="70" height="8" rx="2" fill="#ffffff"/><rect x="12" y="26" width="42" height="50" rx="5" fill="#1e293b"/><rect x="59" y="26" width="42" height="50" rx="5" fill="#1e293b"/><rect x="106" y="26" width="42" height="50" rx="5" fill="#1e293b"/>' },
  { id: "split", label: "2-Column Split", svg: '<rect width="160" height="90" fill="#064e3b"/><rect x="12" y="12" width="70" height="8" rx="2" fill="#ffffff"/><rect x="12" y="26" width="64" height="50" rx="5" fill="#0f172a"/><rect x="84" y="26" width="64" height="50" rx="5" fill="#0f172a"/>' },
  { id: "blank", label: "Blank Canvas", svg: '<rect width="160" height="90" fill="#0f172a"/><rect x="12" y="12" width="136" height="66" rx="4" fill="none" stroke="#334155" stroke-dasharray="4 4"/>' },
];

export interface SvgBgPreset {
  name: string;
  group: "Mind Map Designs" | "Slide Designs";
  colors: [string, string, string];
  render: (c0: string, c1: string, c2: string, uid: string) => string;
}

export const SVG_BG_PRESETS: Record<string, SvgBgPreset> = {
  bg01: {
    name: "01. Midnight Blueprint Grid", group: "Mind Map Designs", colors: ["#0b1120", "#1e293b", "#38bdf8"],
    render: (c0, c1, c2, uid) => '<defs><pattern id="p01_' + uid + '" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M 80 0 L 0 0 0 80" fill="none" stroke="' + c1 + '" stroke-width="1.5"/><path d="M 40 0 L 40 80 M 0 40 L 80 40" fill="none" stroke="' + c1 + '" stroke-width="0.7" stroke-dasharray="4 4"/></pattern><radialGradient id="g01_' + uid + '" cx="50%" cy="50%" r="60%"><stop offset="0%" stop-color="' + c2 + '" stop-opacity="0.14"/><stop offset="100%" stop-color="' + c0 + '" stop-opacity="0"/></radialGradient></defs><rect width="1600" height="900" fill="' + c0 + '"/><rect width="1600" height="900" fill="url(#p01_' + uid + ')"/><rect width="1600" height="900" fill="url(#g01_' + uid + ')"/>',
  },
  bg02: {
    name: "02. Concentric Radar Target", group: "Mind Map Designs", colors: ["#090d16", "#1e293b", "#334155"],
    render: (c0, c1, c2) => '<rect width="1600" height="900" fill="' + c0 + '"/><g fill="none"><line x1="0" y1="450" x2="1600" y2="450" stroke="' + c1 + '" stroke-width="1"/><line x1="800" y1="0" x2="800" y2="900" stroke="' + c1 + '" stroke-width="1"/><circle cx="800" cy="450" r="150" stroke="' + c2 + '" stroke-width="1.5"/><circle cx="800" cy="450" r="300" stroke="' + c1 + '" stroke-width="1.5" stroke-dasharray="8 8"/><circle cx="800" cy="450" r="460" stroke="' + c2 + '" stroke-width="1.5"/><circle cx="800" cy="450" r="640" stroke="' + c1 + '" stroke-width="1.5" stroke-dasharray="12 10"/><circle cx="800" cy="450" r="820" stroke="' + c2 + '" stroke-width="1.5"/></g>',
  },
  bg03: {
    name: "03. Obsidian Topographic Contours", group: "Mind Map Designs", colors: ["#0c1220", "#1e293b", "#334155"],
    render: (c0, c1, c2) => '<rect width="1600" height="900" fill="' + c0 + '"/><g fill="none" stroke-width="2"><path stroke="' + c1 + '" d="M-100 200 C 200 180, 350 80, 450 -50"/><path stroke="' + c2 + '" d="M-100 320 C 260 290, 440 150, 580 -50"/><path stroke="' + c1 + '" d="M-100 450 C 330 400, 540 220, 720 -50"/><path stroke="' + c1 + '" d="M1700 700 C 1400 720, 1250 820, 1150 950"/><path stroke="' + c2 + '" d="M1700 580 C 1340 610, 1160 750, 1020 950"/><path stroke="' + c1 + '" d="M1700 450 C 1270 500, 1060 680, 880 950"/></g>',
  },
  bg04: {
    name: "04. Alabaster Dot-Matrix Paper", group: "Mind Map Designs", colors: ["#f8fafc", "#cbd5e1", "#e2e8f0"],
    render: (c0, c1, c2, uid) => '<defs><pattern id="p04_' + uid + '" width="32" height="32" patternUnits="userSpaceOnUse"><circle cx="16" cy="16" r="1.8" fill="' + c1 + '"/></pattern></defs><rect width="1600" height="900" fill="' + c0 + '"/><rect width="1600" height="900" fill="url(#p04_' + uid + ')"/><rect x="32" y="32" width="1536" height="836" fill="none" stroke="' + c2 + '" stroke-width="2"/>',
  },
  bg05: {
    name: "05. Deep Space Constellation Mesh", group: "Mind Map Designs", colors: ["#080b14", "#312e81", "#6366f1"],
    render: (c0, c1, c2) => '<rect width="1600" height="900" fill="' + c0 + '"/><g stroke="' + c1 + '" stroke-width="1.4" fill="' + c2 + '"><polyline points="60,80 180,140 290,70 180,250 60,80" fill="none"/><polyline points="180,140 340,210 290,70" fill="none"/><circle cx="60" cy="80" r="4"/><circle cx="180" cy="140" r="4.5"/><circle cx="290" cy="70" r="3.5"/><circle cx="180" cy="250" r="4"/><circle cx="340" cy="210" r="3.5"/><polyline points="1540,820 1420,760 1310,830 1420,650 1540,820" fill="none"/><polyline points="1420,760 1260,690 1310,830" fill="none"/><circle cx="1540" cy="820" r="4"/><circle cx="1420" cy="760" r="4.5"/><circle cx="1310" cy="830" r="3.5"/><circle cx="1420" cy="650" r="4"/><circle cx="1260" cy="690" r="3.5"/></g>',
  },
  bg06: {
    name: "06. Hexagonal Carbon Honeycomb", group: "Mind Map Designs", colors: ["#0b1118", "#16222f", "#0ea5e9"],
    render: (c0, c1, c2, uid) => '<defs><pattern id="p06_' + uid + '" width="56" height="96" patternUnits="userSpaceOnUse"><path d="M28 0 L56 16 L56 48 L28 64 L0 48 L0 16 Z M28 96 L28 64 M0 48 L-28 64 M56 48 L84 64" fill="none" stroke="' + c1 + '" stroke-width="1.5"/></pattern><radialGradient id="g06_' + uid + '" cx="50%" cy="50%" r="55%"><stop offset="0%" stop-color="' + c2 + '" stop-opacity="0.10"/><stop offset="100%" stop-color="' + c0 + '" stop-opacity="0"/></radialGradient></defs><rect width="1600" height="900" fill="' + c0 + '"/><rect width="1600" height="900" fill="url(#p06_' + uid + ')"/><rect width="1600" height="900" fill="url(#g06_' + uid + ')"/>',
  },
  bg07: {
    name: "07. Dual Horizon Perspective Grid", group: "Mind Map Designs", colors: ["#0d091a", "#2e1065", "#4c1d95"],
    render: (c0, c1, c2) => '<rect width="1600" height="900" fill="' + c0 + '"/><g stroke="' + c1 + '" stroke-width="1.3" fill="none"><line x1="0" y1="700" x2="1600" y2="700" stroke="' + c2 + '"/><line x1="0" y1="750" x2="1600" y2="750"/><line x1="0" y1="815" x2="1600" y2="815"/><line x1="800" y1="520" x2="0" y2="900"/><line x1="800" y1="520" x2="400" y2="900"/><line x1="800" y1="520" x2="800" y2="900"/><line x1="800" y1="520" x2="1200" y2="900"/><line x1="800" y1="520" x2="1600" y2="900"/><line x1="0" y1="200" x2="1600" y2="200" stroke="' + c2 + '"/><line x1="0" y1="150" x2="1600" y2="150"/><line x1="0" y1="85" x2="1600" y2="85"/><line x1="800" y1="380" x2="0" y2="0"/><line x1="800" y1="380" x2="400" y2="0"/><line x1="800" y1="380" x2="800" y2="0"/><line x1="800" y1="380" x2="1200" y2="0"/><line x1="800" y1="380" x2="1600" y2="0"/></g>',
  },
  bg08: {
    name: "08. Ambient Corner Bokeh Orbs", group: "Mind Map Designs", colors: ["#090d16", "#4f46e5", "#0ea5e9"],
    render: (c0, c1, c2) => '<rect width="1600" height="900" fill="' + c0 + '"/><circle cx="120" cy="120" r="340" fill="' + c1 + '" fill-opacity="0.14"/><circle cx="120" cy="120" r="200" fill="' + c1 + '" fill-opacity="0.12"/><circle cx="1480" cy="780" r="380" fill="' + c2 + '" fill-opacity="0.14"/><circle cx="1480" cy="780" r="220" fill="' + c2 + '" fill-opacity="0.12"/><circle cx="1450" cy="140" r="240" fill="' + c1 + '" fill-opacity="0.09"/>',
  },
  bg09: {
    name: "09. Architectural Graph Sheet", group: "Mind Map Designs", colors: ["#ffffff", "#f1f5f9", "#e2e8f0"],
    render: (c0, c1, c2, uid) => '<defs><pattern id="p09s_' + uid + '" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="' + c1 + '" stroke-width="1"/></pattern><pattern id="p09m_' + uid + '" width="100" height="100" patternUnits="userSpaceOnUse"><rect width="100" height="100" fill="url(#p09s_' + uid + ')"/><path d="M 100 0 L 0 0 0 100" fill="none" stroke="' + c2 + '" stroke-width="1.6"/></pattern></defs><rect width="1600" height="900" fill="' + c0 + '"/><rect width="1600" height="900" fill="url(#p09m_' + uid + ')"/>',
  },
  bg10: {
    name: "10. Emerald Circuit Board Traces", group: "Mind Map Designs", colors: ["#061411", "#064e3b", "#10b981"],
    render: (c0, c1, c2) => '<rect width="1600" height="900" fill="' + c0 + '"/><g stroke="' + c1 + '" stroke-width="2.5" fill="none" stroke-linecap="round"><path d="M 0 120 L 180 120 L 240 180 L 380 180"/><path d="M 0 220 L 120 220 L 190 290 L 190 420"/><path d="M 1600 780 L 1420 780 L 1360 720 L 1220 720"/><path d="M 1600 680 L 1480 680 L 1410 610 L 1410 480"/><circle cx="380" cy="180" r="6" fill="' + c2 + '"/><circle cx="190" cy="420" r="6" fill="' + c2 + '"/><circle cx="1220" cy="720" r="6" fill="' + c2 + '"/><circle cx="1410" cy="480" r="6" fill="' + c2 + '"/></g>',
  },
  bg11: {
    name: "11. Radial Starburst Vignette", group: "Mind Map Designs", colors: ["#110c1d", "#1e1633", "#2e1065"],
    render: (c0, c1, c2) => '<rect width="1600" height="900" fill="' + c0 + '"/><g stroke="' + c1 + '" stroke-width="2"><line x1="800" y1="450" x2="0" y2="0"/><line x1="800" y1="450" x2="400" y2="0" stroke="' + c2 + '"/><line x1="800" y1="450" x2="800" y2="0"/><line x1="800" y1="450" x2="1200" y2="0" stroke="' + c2 + '"/><line x1="800" y1="450" x2="1600" y2="0"/><line x1="800" y1="450" x2="0" y2="900"/><line x1="800" y1="450" x2="400" y2="900" stroke="' + c2 + '"/><line x1="800" y1="450" x2="800" y2="900"/><line x1="800" y1="450" x2="1200" y2="900" stroke="' + c2 + '"/><line x1="800" y1="450" x2="1600" y2="900"/></g><circle cx="800" cy="450" r="320" fill="' + c0 + '"/>',
  },
  bg12: {
    name: "12. Isometric Diamond Lattice", group: "Mind Map Designs", colors: ["#0f172a", "#1e293b", "#334155"],
    render: (c0, c1, c2, uid) => '<defs><pattern id="p12_' + uid + '" width="80" height="46" patternUnits="userSpaceOnUse"><path d="M 40 0 L 80 23 L 40 46 L 0 23 Z" fill="none" stroke="' + c1 + '" stroke-width="1.3"/><circle cx="40" cy="0" r="1.5" fill="' + c2 + '"/></pattern></defs><rect width="1600" height="900" fill="' + c0 + '"/><rect width="1600" height="900" fill="url(#p12_' + uid + ')"/>',
  },
  bg13: {
    name: "13. Warm Sand Contour Waves", group: "Mind Map Designs", colors: ["#faf7f2", "#f3ede2", "#efe6d5"],
    render: (c0, c1, c2) => '<rect width="1600" height="900" fill="' + c0 + '"/><path d="M0 0 L1600 0 L1600 140 C 1200 220, 900 40, 450 130 C 200 180, 80 110, 0 150 Z" fill="' + c1 + '"/><path d="M0 900 L1600 900 L1600 750 C 1300 680, 950 840, 500 740 C 250 690, 100 790, 0 740 Z" fill="' + c2 + '"/>',
  },
  bg14: {
    name: "14. Technical HUD Frame", group: "Mind Map Designs", colors: ["#080c14", "#1e293b", "#38bdf8"],
    render: (c0, c1, c2) => '<rect width="1600" height="900" fill="' + c0 + '"/><rect x="36" y="36" width="1528" height="828" fill="none" stroke="' + c1 + '" stroke-width="1.5"/><g stroke="' + c2 + '" stroke-width="3" fill="none"><path d="M 36 96 L 36 36 L 96 36"/><path d="M 1504 36 L 1564 36 L 1564 96"/><path d="M 36 804 L 36 864 L 96 864"/><path d="M 1504 864 L 1564 864 L 1564 804"/></g>',
  },
  bg15: {
    name: "15. Deep Ocean Eccentric Ripples", group: "Mind Map Designs", colors: ["#06161e", "#0e3a4c", "#0284c7"],
    render: (c0, c1, c2) => '<rect width="1600" height="900" fill="' + c0 + '"/><g fill="none" stroke-width="1.8"><circle cx="80" cy="80" r="160" stroke="' + c2 + '" stroke-opacity="0.5"/><circle cx="80" cy="80" r="280" stroke="' + c1 + '"/><circle cx="80" cy="80" r="400" stroke="' + c1 + '"/><circle cx="1520" cy="820" r="180" stroke="' + c2 + '" stroke-opacity="0.5"/><circle cx="1520" cy="820" r="310" stroke="' + c1 + '"/><circle cx="1520" cy="820" r="440" stroke="' + c1 + '"/></g>',
  },
  bg16: {
    name: "16. Flowing Indigo Silk Waves", group: "Slide Designs", colors: ["#0c1024", "#312e81", "#4f46e5"],
    render: (c0, c1, c2) => '<rect width="1600" height="900" fill="' + c0 + '"/><path d="M0 680 C 420 560, 820 820, 1600 600 L 1600 900 L 0 900 Z" fill="' + c1 + '" fill-opacity="0.65"/><path d="M0 760 C 550 640, 1050 860, 1600 700 L 1600 900 L 0 900 Z" fill="' + c2 + '" fill-opacity="0.55"/><path d="M950 0 C 1150 220, 1380 120, 1600 320 L 1600 0 Z" fill="' + c2 + '" fill-opacity="0.28"/>',
  },
  bg17: {
    name: "17. Obsidian & Luxury Gold Facets", group: "Slide Designs", colors: ["#0b0b0e", "#16151d", "#ca8a04"],
    render: (c0, c1, c2) => '<rect width="1600" height="900" fill="' + c0 + '"/><polygon points="0,0 420,0 180,260" fill="' + c1 + '" stroke="' + c2 + '" stroke-opacity="0.45" stroke-width="1.5"/><polygon points="420,0 640,0 180,260" fill="' + c1 + '" fill-opacity="0.7" stroke="' + c2 + '" stroke-opacity="0.25" stroke-width="1"/><polygon points="0,0 180,260 0,480" fill="' + c1 + '" fill-opacity="0.85" stroke="' + c2 + '" stroke-opacity="0.3" stroke-width="1"/><polygon points="1600,900 1120,900 1380,620" fill="' + c1 + '" stroke="' + c2 + '" stroke-opacity="0.45" stroke-width="1.5"/><polygon points="1600,900 1380,620 1600,420" fill="' + c1 + '" fill-opacity="0.75" stroke="' + c2 + '" stroke-opacity="0.3" stroke-width="1"/>',
  },
  bg18: {
    name: "18. Daylight Soft Geometric Shapes", group: "Slide Designs", colors: ["#f8fafc", "#e0e7ff", "#bae6fd"],
    render: (c0, c1, c2) => '<rect width="1600" height="900" fill="' + c0 + '"/><circle cx="1480" cy="120" r="260" fill="' + c1 + '"/><circle cx="1320" cy="240" r="140" fill="' + c2 + '" fill-opacity="0.75"/><path d="M 0 650 Q 240 680 320 900 L 0 900 Z" fill="' + c2 + '" fill-opacity="0.65"/>',
  },
  bg19: {
    name: "19. Dynamic Diagonal Glass Slashes", group: "Slide Designs", colors: ["#0f172a", "#1e293b", "#6366f1"],
    render: (c0, c1, c2) => '<rect width="1600" height="900" fill="' + c0 + '"/><polygon points="1050,0 1280,0 920,900 690,900" fill="' + c1 + '" fill-opacity="0.65"/><polygon points="1310,0 1460,0 1100,900 950,900" fill="' + c2 + '" fill-opacity="0.14"/><polygon points="1490,0 1600,0 1600,650 1240,900 1130,900" fill="' + c2 + '" fill-opacity="0.22"/>',
  },
  bg20: {
    name: "20. Sunset Layered Horizons", group: "Slide Designs", colors: ["#160f24", "#3b1d4e", "#f59e0b"],
    render: (c0, c1, c2) => '<rect width="1600" height="900" fill="' + c0 + '"/><circle cx="1280" cy="240" r="150" fill="' + c2 + '" fill-opacity="0.18"/><path d="M0 640 Q 400 540 850 660 T 1600 590 L 1600 900 L 0 900 Z" fill="' + c1 + '" fill-opacity="0.5"/><path d="M0 730 Q 520 650 1020 750 T 1600 700 L 1600 900 L 0 900 Z" fill="' + c1 + '" fill-opacity="0.8"/><path d="M0 810 Q 650 750 1180 830 T 1600 790 L 1600 900 L 0 900 Z" fill="' + c2 + '" fill-opacity="0.22"/>',
  },
  bg21: {
    name: "21. Swiss Editorial Grid Frame", group: "Slide Designs", colors: ["#f4f4f0", "#18181b", "#ef4444"],
    render: (c0, c1, c2) => '<rect width="1600" height="900" fill="' + c0 + '"/><rect x="48" y="48" width="1504" height="804" fill="none" stroke="' + c1 + '" stroke-width="2"/><line x1="48" y1="120" x2="1552" y2="120" stroke="' + c1 + '" stroke-width="1.5"/><rect x="48" y="48" width="180" height="72" fill="' + c1 + '"/><rect x="1480" y="48" width="72" height="72" fill="' + c2 + '"/>',
  },
  bg22: {
    name: "22. Emerald Angular Shards", group: "Slide Designs", colors: ["#051310", "#064e3b", "#10b981"],
    render: (c0, c1, c2) => '<rect width="1600" height="900" fill="' + c0 + '"/><polygon points="1180,0 1600,0 1600,420" fill="' + c1 + '" fill-opacity="0.55"/><polygon points="1350,0 1600,0 1600,250" fill="' + c2 + '" fill-opacity="0.22"/><polygon points="0,520 0,900 380,900" fill="' + c1 + '" fill-opacity="0.55"/><polygon points="0,700 0,900 200,900" fill="' + c2 + '" fill-opacity="0.22"/>',
  },
  bg23: {
    name: "23. Velvet Crimson Sweeping Arcs", group: "Slide Designs", colors: ["#14070c", "#4c0519", "#e11d48"],
    render: (c0, c1, c2) => '<rect width="1600" height="900" fill="' + c0 + '"/><path d="M 1600 0 L 1600 900 L 900 900 A 750 750 0 0 1 1600 0 Z" fill="' + c1 + '" fill-opacity="0.6"/><path d="M 0 0 L 550 0 A 600 600 0 0 1 0 550 Z" fill="' + c2 + '" fill-opacity="0.22"/>',
  },
  bg24: {
    name: "24. Asymmetric Split Keynote Stage", group: "Slide Designs", colors: ["#0f172a", "#1e1b4b", "#4f46e5"],
    render: (c0, c1, c2) => '<rect width="1600" height="900" fill="' + c0 + '"/><polygon points="1120,0 1600,0 1600,900 960,900" fill="' + c1 + '"/><polygon points="1160,0 1210,0 1010,900 960,900" fill="' + c2 + '"/>',
  },
  bg25: {
    name: "25. Arctic Crystalline Low-Poly", group: "Slide Designs", colors: ["#f0f9ff", "#e0f2fe", "#7dd3fc"],
    render: (c0, c1, c2) => '<rect width="1600" height="900" fill="' + c0 + '"/><polygon points="1150,0 1600,0 1380,280" fill="' + c1 + '"/><polygon points="1600,0 1600,460 1380,280" fill="' + c2 + '" fill-opacity="0.45"/><polygon points="0,900 0,520 260,720" fill="' + c1 + '"/><polygon points="0,900 440,900 260,720" fill="' + c2 + '" fill-opacity="0.45"/>',
  },
  bg26: {
    name: "26. Neon Corner Quarter-Arches", group: "Slide Designs", colors: ["#0b0816", "#6366f1", "#ec4899"],
    render: (c0, c1, c2) => '<rect width="1600" height="900" fill="' + c0 + '"/><g fill="none" stroke-width="18"><path d="M 0 280 A 280 280 0 0 0 280 0" stroke="' + c1 + '" stroke-opacity="0.4"/><path d="M 0 200 A 200 200 0 0 0 200 0" stroke="' + c2 + '" stroke-opacity="0.45"/><path d="M 0 120 A 120 120 0 0 0 120 0" stroke="' + c1 + '" stroke-opacity="0.6"/><path d="M 1600 620 A 280 280 0 0 0 1320 900" stroke="' + c1 + '" stroke-opacity="0.4"/><path d="M 1600 700 A 200 200 0 0 0 1400 900" stroke="' + c2 + '" stroke-opacity="0.45"/><path d="M 1600 780 A 120 120 0 0 0 1480 900" stroke="' + c1 + '" stroke-opacity="0.6"/></g>',
  },
  bg27: {
    name: "27. Geometric Wave Crest Corners", group: "Slide Designs", colors: ["#0a1222", "#1e3a5f", "#38bdf8"],
    render: (c0, c1, c2) => '<rect width="1600" height="900" fill="' + c0 + '"/><g fill="none" stroke-width="2"><circle cx="0" cy="900" r="140" stroke="' + c2 + '" stroke-opacity="0.5"/><circle cx="0" cy="900" r="220" stroke="' + c1 + '"/><circle cx="0" cy="900" r="300" stroke="' + c1 + '"/><circle cx="0" cy="900" r="380" stroke="' + c1 + '"/><circle cx="1600" cy="0" r="140" stroke="' + c2 + '" stroke-opacity="0.5"/><circle cx="1600" cy="0" r="220" stroke="' + c1 + '"/><circle cx="1600" cy="0" r="300" stroke="' + c1 + '"/><circle cx="1600" cy="0" r="380" stroke="' + c1 + '"/></g>',
  },
  bg28: {
    name: "28. Corporate Navy & Cyan Header Wave", group: "Slide Designs", colors: ["#ffffff", "#0f172a", "#0ea5e9"],
    render: (c0, c1, c2) => '<rect width="1600" height="900" fill="' + c0 + '"/><path d="M 0 0 L 1600 0 L 1600 90 C 1150 20, 650 140, 0 55 Z" fill="' + c2 + '" fill-opacity="0.25"/><path d="M 0 0 L 1600 0 L 1600 45 C 1100 0, 550 95, 0 35 Z" fill="' + c1 + '"/><rect x="0" y="884" width="1600" height="16" fill="' + c1 + '"/>',
  },
  bg29: {
    name: "29. Prism Intersecting Light Beams", group: "Slide Designs", colors: ["#090a10", "#4f46e5", "#06b6d4"],
    render: (c0, c1, c2) => '<rect width="1600" height="900" fill="' + c0 + '"/><polygon points="0,150 0,0 450,0 1600,720 1600,900 1200,900" fill="' + c1 + '" fill-opacity="0.12"/><polygon points="1600,120 1600,0 1150,0 0,740 0,900 400,900" fill="' + c2 + '" fill-opacity="0.11"/>',
  },
  bg30: {
    name: "30. Isometric 3D Corner Blocks", group: "Slide Designs", colors: ["#0f172a", "#334155", "#1e293b"],
    render: (c0, c1, c2) => '<rect width="1600" height="900" fill="' + c0 + '"/><g transform="translate(1320, 660)"><polygon points="100,0 200,58 100,116 0,58" fill="' + c1 + '"/><polygon points="0,58 100,116 100,232 0,174" fill="' + c2 + '"/><polygon points="100,116 200,58 200,174 100,232" fill="#090d16" fill-opacity="0.6"/></g><g transform="translate(80, 40)"><polygon points="80,0 160,46 80,92 0,46" fill="' + c1 + '"/><polygon points="0,46 80,92 80,184 0,138" fill="' + c2 + '"/><polygon points="80,92 160,46 160,138 80,184" fill="#090d16" fill-opacity="0.6"/></g>',
  },
};

export function renderBgDesignSvgNode(
  cfg: BgConfig,
  w: number,
  h: number,
  uid: string
): string {
  const preset = SVG_BG_PRESETS[cfg.presetId] || SVG_BG_PRESETS.bg01;
  const [c0, c1, c2] = cfg.colors || preset.colors;
  return (
    '<svg x="0" y="0" width="' +
    w +
    '" height="' +
    h +
    '" viewBox="0 0 1600 900" preserveAspectRatio="none" pointer-events="none">' +
    preset.render(c0, c1, c2, uid) +
    "</svg>"
  );
}

export function stripMarkdownSyntax(str: string): string {
  return (str || "")
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/^[-*]\s+/gm, "• ")
    .replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\x60([^\x60]+)\x60/g, "$1");
}

export interface InlineSegment {
  text: string;
  weight: string;
  style: string;
  deco: string;
  code: boolean;
}

export function parseMarkdownInlineTokens(
  rawLine: string,
  baseWeight: string
): { segments: InlineSegment[]; scale: number } {
  let line = rawLine;
  let scale = 1;
  let lineWeight = baseWeight;

  if (line.startsWith("### ")) {
    line = line.slice(4);
    scale = 1.12;
    lineWeight = "800";
  } else if (line.startsWith("## ")) {
    line = line.slice(3);
    scale = 1.24;
    lineWeight = "800";
  } else if (line.startsWith("# ")) {
    line = line.slice(2);
    scale = 1.36;
    lineWeight = "800";
  } else if (line.startsWith("- ") || line.startsWith("* ")) {
    line = "• " + line.slice(2);
  }

  const tokenRegex =
    /(\*{3}[^*]+\*{3}|\*{2}[^*]+\*{2}|__[^_]+__|\*[^*]+\*|_[^_]+_|~~[^~]+~~|\x60[^\x60]+\x60)/g;
  const parts = line.split(tokenRegex).filter(Boolean);
  const segments: InlineSegment[] = parts.map((part) => {
    if (part.startsWith("***") && part.endsWith("***")) {
      return { text: part.slice(3, -3), weight: "800", style: "italic", deco: "none", code: false };
    }
    if (
      (part.startsWith("**") && part.endsWith("**")) ||
      (part.startsWith("__") && part.endsWith("__"))
    ) {
      return { text: part.slice(2, -2), weight: "800", style: "normal", deco: "none", code: false };
    }
    if (
      (part.startsWith("*") && part.endsWith("*")) ||
      (part.startsWith("_") && part.endsWith("_"))
    ) {
      return { text: part.slice(1, -1), weight: lineWeight, style: "italic", deco: "none", code: false };
    }
    if (part.startsWith("~~") && part.endsWith("~~")) {
      return { text: part.slice(2, -2), weight: lineWeight, style: "normal", deco: "line-through", code: false };
    }
    if (part.startsWith("\x60") && part.endsWith("\x60")) {
      return { text: part.slice(1, -1), weight: "600", style: "normal", deco: "none", code: true };
    }
    return { text: part, weight: lineWeight, style: "normal", deco: "none", code: false };
  });

  return {
    segments: segments.length
      ? segments
      : [{ text: "", weight: lineWeight, style: "normal", deco: "none", code: false }],
    scale,
  };
}

export function getNodeAutoSize(node: MmNode): {
  autoW: number;
  autoH: number;
  lines: string[];
} {
  const rawLines = (node.text || "Node").split("\n");
  const cleanLines = rawLines.map((l) => stripMarkdownSyntax(l));
  const maxChars = Math.max(...cleanLines.map((l) => l.length), 4);
  const fs = node.fontSize || 18;
  const autoW = Math.max(140, Math.round(maxChars * (fs * 0.58) + 44));
  const autoH = Math.max(52, Math.round(rawLines.length * (fs * 1.35) + 28));
  return { autoW, autoH, lines: rawLines };
}

export function getNodeBoxSize(node: MmNode): {
  w: number;
  h: number;
  lines: string[];
} {
  const { autoW, autoH, lines } = getNodeAutoSize(node);
  const w = node.customW ? Math.max(80, node.customW) : autoW;
  const h = node.customH ? Math.max(36, node.customH) : autoH;
  return { w, h, lines };
}

const CANVAS_BOUND_PAD = 14;

export function clampSingleMmNode(node: MmNode, docW = 1600, docH = 900): void {
  const maxAllowedW = Math.max(80, docW - CANVAS_BOUND_PAD * 2);
  const maxAllowedH = Math.max(36, docH - CANVAS_BOUND_PAD * 2);

  const rawLines = (node.text || "Node").split("\n");
  const cleanLines = rawLines.map((l) => stripMarkdownSyntax(l));
  const maxChars = Math.max(...cleanLines.map((l) => l.length), 4);
  const maxFsByW = Math.floor((maxAllowedW - 44) / (maxChars * 0.58));
  const maxFsByH = Math.floor((maxAllowedH - 28) / (rawLines.length * 1.35));
  const maxAllowedFs = Math.max(10, Math.min(72, maxFsByW, maxFsByH));
  if ((node.fontSize || 18) > maxAllowedFs) {
    node.fontSize = maxAllowedFs;
  }

  if (node.customW) node.customW = Math.min(node.customW, maxAllowedW);
  if (node.customH) node.customH = Math.min(node.customH, maxAllowedH);

  let { w, h } = getNodeBoxSize(node);
  if (w > maxAllowedW) {
    node.customW = maxAllowedW;
    w = maxAllowedW;
  }
  if (h > maxAllowedH) {
    node.customH = maxAllowedH;
    h = maxAllowedH;
  }

  const halfW = w / 2;
  const halfH = h / 2;
  const minX = Math.round(CANVAS_BOUND_PAD + halfW);
  const maxX = Math.round(docW - CANVAS_BOUND_PAD - halfW);
  const minY = Math.round(CANVAS_BOUND_PAD + halfH);
  const maxY = Math.round(docH - CANVAS_BOUND_PAD - halfH);

  node.x = minX <= maxX ? Math.max(minX, Math.min(maxX, Math.round(node.x))) : Math.round(docW / 2);
  node.y = minY <= maxY ? Math.max(minY, Math.min(maxY, Math.round(node.y))) : Math.round(docH / 2);
}

export function getSlideElEffectiveBox(el: SlideElement): { w: number; h: number } {
  if (el.type === "circle") {
    const d = Math.min(el.w || 100, el.h || 100);
    return { w: d, h: d };
  }
  if (el.type === "heading" || el.type === "text") {
    const lines = (el.text || "").split("\n").map((l) => stripMarkdownSyntax(l));
    const maxChars = Math.max(...lines.map((l) => l.length), 2);
    const fs = el.fontSize || 28;
    const textW = Math.round(maxChars * fs * 0.56);
    const textH = Math.round(lines.length * fs * 1.34);
    return {
      w: Math.max(el.w || 100, textW),
      h: Math.max(el.h || 50, textH),
    };
  }
  return { w: el.w || 100, h: el.h || 60 };
}

export function clampSingleSlideElement(
  el: SlideElement,
  docW = 1600,
  docH = 900
): void {
  const maxAllowedW = Math.max(40, docW - CANVAS_BOUND_PAD * 2);
  const maxAllowedH = Math.max(40, docH - CANVAS_BOUND_PAD * 2);

  const lines = (el.text || "").split("\n").map((l) => stripMarkdownSyntax(l));
  const maxChars = Math.max(...lines.map((l) => l.length), 1);
  if (el.fontSize) {
    const maxFsW = Math.floor((maxAllowedW - 16) / Math.max(1, maxChars * 0.54));
    const maxFsH = Math.floor((maxAllowedH - 12) / Math.max(1, lines.length * 1.32));
    el.fontSize = Math.max(10, Math.min(el.fontSize, maxFsW, maxFsH, 160));
  }

  el.w = Math.max(24, Math.min(Math.round(el.w || 100), maxAllowedW));
  el.h = Math.max(24, Math.min(Math.round(el.h || 60), maxAllowedH));

  if (el.type === "circle") {
    const d = Math.min(el.w, el.h, maxAllowedW, maxAllowedH);
    el.w = d;
    el.h = d;
  }

  const eff = getSlideElEffectiveBox(el);
  el.w = Math.min(eff.w, maxAllowedW);
  el.h = Math.min(eff.h, maxAllowedH);

  const minX = CANVAS_BOUND_PAD;
  const maxX = Math.max(CANVAS_BOUND_PAD, Math.round(docW - CANVAS_BOUND_PAD - el.w));
  const minY = CANVAS_BOUND_PAD;
  const maxY = Math.max(CANVAS_BOUND_PAD, Math.round(docH - CANVAS_BOUND_PAD - el.h));

  el.x = Math.max(minX, Math.min(maxX, Math.round(el.x)));
  el.y = Math.max(minY, Math.min(maxY, Math.round(el.y)));
}

export function applyMindMapLayoutAlgorithm(
  nodesInput: MmNode[],
  mode: MmLayoutMode,
  W = 1600,
  H = 900
): MmNode[] {
  const mmNodes: MmNode[] = JSON.parse(JSON.stringify(nodesInput));
  const root = mmNodes.find((n) => n.parentId === null);
  if (!root) return mmNodes;

  const cx = Math.round(W / 2);
  const cy = Math.round(H / 2);
  const isCompactTree = mode === "right" || mode === "left";

  mmNodes.forEach((n) => {
    if (n.parentId === null) {
      n.customW = isCompactTree ? 280 : 310;
      n.customH = isCompactTree ? 84 : 92;
    } else if (n.parentId === root.id) {
      n.customW = 255;
      n.customH = 58;
    } else {
      n.customW = isCompactTree ? 275 : 280;
      n.customH = isCompactTree ? 68 : 76;
    }
  });

  const lvl1 = mmNodes.filter((n) => n.parentId === root.id);

  function getSubtreeLeaves(nodeId: string): number {
    const children = mmNodes.filter((n) => n.parentId === nodeId);
    if (children.length === 0) return 1;
    return children.reduce((sum, c) => sum + getSubtreeLeaves(c.id), 0);
  }

  function layoutHorizontalTree(
    nodeId: string,
    x: number,
    yStart: number,
    yEnd: number,
    dirX: number,
    stepX: number
  ) {
    const node = mmNodes.find((n) => n.id === nodeId);
    if (!node) return;
    node.x = Math.round(x);
    node.y = Math.round((yStart + yEnd) / 2);
    const children = mmNodes.filter((n) => n.parentId === nodeId);
    if (children.length === 0) return;
    const totalLeaves = getSubtreeLeaves(nodeId);
    let curY = yStart;
    children.forEach((c) => {
      const leaves = getSubtreeLeaves(c.id);
      const span = ((yEnd - yStart) * leaves) / totalLeaves;
      layoutHorizontalTree(c.id, x + dirX * stepX, curY, curY + span, dirX, stepX);
      curY += span;
    });
  }

  if (mode === "right") {
    layoutHorizontalTree(root.id, Math.round(W * 0.16), Math.round(H * 0.06), Math.round(H * 0.94), 1, Math.round(W * 0.34));
  } else if (mode === "left") {
    layoutHorizontalTree(root.id, Math.round(W * 0.84), Math.round(H * 0.06), Math.round(H * 0.94), -1, Math.round(W * 0.34));
  } else if (mode === "org" || mode === "bottom-up") {
    const dirY = mode === "org" ? 1 : -1;
    root.x = cx;
    root.y = mode === "org" ? Math.round(H * 0.13) : Math.round(H * 0.87);
    const marginX = Math.round(W * 0.14);
    const usableW = W - marginX * 2;
    const colStep = lvl1.length > 1 ? usableW / (lvl1.length - 1) : 0;

    lvl1.forEach((b, i) => {
      b.x = lvl1.length > 1 ? Math.round(marginX + i * colStep) : cx;
      b.y = Math.round(root.y + dirY * (H * 0.24));
      const leaves = mmNodes.filter((n) => n.parentId === b.id);
      leaves.forEach((leaf, j) => {
        leaf.x = b.x;
        leaf.y = Math.round(b.y + dirY * (H * 0.23 + j * (H * 0.2)));
        const subLeaves = mmNodes.filter((n) => n.parentId === leaf.id);
        subLeaves.forEach((sub, k) => {
          sub.x = leaf.x;
          sub.y = Math.round(leaf.y + dirY * ((k + 1) * (H * 0.16)));
        });
      });
    });
  } else if (mode === "radial") {
    root.x = cx;
    root.y = cy;
    const count = lvl1.length || 1;
    const quadAngles = [-0.62, -2.52, 0.62, 2.52];

    lvl1.forEach((b, i) => {
      const angle = count === 4 ? quadAngles[i] : (2 * Math.PI * i) / count - Math.PI / 4;
      b.x = Math.round(cx + Math.cos(angle) * (W * 0.21));
      b.y = Math.round(cy + Math.sin(angle) * (H * 0.21));

      const leaves = mmNodes.filter((n) => n.parentId === b.id);
      const dirX = Math.cos(angle) >= 0 ? 1 : -1;
      const dirY = Math.sin(angle) >= 0 ? 1 : -1;

      leaves.forEach((leaf, j) => {
        if (count === 4 && leaves.length === 2) {
          leaf.x = Math.round(cx + dirX * (j === 0 ? W * 0.34 : W * 0.39));
          leaf.y = Math.round(cy + dirY * (j === 0 ? H * 0.35 : H * 0.16));
        } else {
          const spread = 0.52;
          const subAngle = angle + (j - (leaves.length - 1) / 2) * (spread / Math.max(1, leaves.length - 1));
          leaf.x = Math.round(cx + Math.cos(subAngle) * (W * 0.38));
          leaf.y = Math.round(cy + Math.sin(subAngle) * (H * 0.36));
        }
      });
    });
  } else if (mode === "timeline") {
    root.x = Math.round(W * 0.12);
    root.y = cy;
    const startX = Math.round(W * 0.32);
    const endX = Math.round(W * 0.88);
    const stepX = lvl1.length > 1 ? (endX - startX) / (lvl1.length - 1) : 300;

    lvl1.forEach((b, i) => {
      b.x = Math.round(startX + i * stepX);
      b.y = cy;
      const dirY = i % 2 === 0 ? -1 : 1;
      const leaves = mmNodes.filter((n) => n.parentId === b.id);
      leaves.forEach((leaf, j) => {
        leaf.x = b.x;
        leaf.y = Math.round(cy + dirY * (H * 0.2 + j * (H * 0.15)));
      });
    });
  } else if (mode === "fishbone") {
    root.x = Math.round(W * 0.87);
    root.y = cy;
    const cols = Math.ceil(lvl1.length / 2) || 1;
    const startRibX = Math.round(W * 0.62);
    const colSpacing = Math.min(Math.round(W * 0.33), Math.round((W * 0.5) / Math.max(1, cols - 1)));

    lvl1.forEach((b, i) => {
      const isTop = i % 2 === 0;
      const col = Math.floor(i / 2);
      b.x = Math.round(startRibX - col * colSpacing);
      b.y = isTop ? Math.round(H * 0.15) : Math.round(H * 0.85);
      const dirY = isTop ? 1 : -1;
      const leaves = mmNodes.filter((n) => n.parentId === b.id);
      leaves.forEach((leaf, j) => {
        leaf.x = Math.round(b.x - W * 0.08 + j * (W * 0.03));
        leaf.y = Math.round(b.y + dirY * ((j + 1) * (H * 0.135)));
      });
    });
  } else {
    root.x = cx;
    root.y = cy;
    const rightGroup = lvl1.filter((_, i) => i % 2 === 0);
    const leftGroup = lvl1.filter((_, i) => i % 2 === 1);

    const placeBalancedSide = (group: MmNode[], dirX: number) => {
      const total = group.reduce((s, c) => s + getSubtreeLeaves(c.id), 0) || 1;
      let curY = Math.round(H * 0.1);
      const availH = Math.round(H * 0.8);
      group.forEach((c) => {
        const leaves = getSubtreeLeaves(c.id);
        const span = (availH * leaves) / total;
        layoutHorizontalTree(c.id, cx + dirX * Math.round(W * 0.165), curY, curY + span, dirX, Math.round(W * 0.205));
        curY += span;
      });
    };
    placeBalancedSide(rightGroup, 1);
    placeBalancedSide(leftGroup, -1);
  }

  mmNodes.forEach((n) => clampSingleMmNode(n, W, H));
  return mmNodes;
}

export function renderSvgMultilineText(
  text: string,
  x: number,
  y: number,
  fontSize: number,
  color: string,
  anchor = "middle",
  centerVertically = true,
  weight = "600",
  fontFamily = "'Inter', system-ui, sans-serif"
): string {
  const lines = (text || "").split("\n");
  const lh = fontSize * 1.34;
  const startY = centerVertically
    ? y - ((lines.length - 1) * lh) / 2 + fontSize * 0.35
    : y;
  const safeFont = (fontFamily || "'Inter', system-ui, sans-serif").replace(/"/g, "'");

  const tspans = lines
    .map((line, i) => {
      const parsed = parseMarkdownInlineTokens(line, weight);
      const lineFs = Math.round(fontSize * parsed.scale);
      const inner = parsed.segments
        .map((seg) => {
          const escaped = seg.text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
          const isPlain =
            seg.weight === weight &&
            seg.style === "normal" &&
            seg.deco === "none" &&
            !seg.code;
          if (isPlain) return escaped;
          const wAttr = seg.weight !== weight ? ' font-weight="' + seg.weight + '"' : "";
          const sAttr = seg.style !== "normal" ? ' font-style="' + seg.style + '"' : "";
          const dAttr = seg.deco !== "none" ? ' text-decoration="' + seg.deco + '"' : "";
          const fAttr = seg.code ? " font-family=\"'JetBrains Mono', monospace\"" : "";
          return "<tspan" + wAttr + sAttr + dAttr + fAttr + ">" + escaped + "</tspan>";
        })
        .join("");
      return (
        '<tspan x="' +
        x +
        '" y="' +
        (startY + i * lh).toFixed(1) +
        '" font-size="' +
        lineFs +
        '">' +
        inner +
        "</tspan>"
      );
    })
    .join("");

  return (
    '<text xml:space="preserve" text-rendering="geometricPrecision" fill="' +
    color +
    '" font-size="' +
    fontSize +
    '" font-weight="' +
    weight +
    '" font-family="' +
    safeFont +
    '" style="font-family:' +
    safeFont +
    ';" text-anchor="' +
    anchor +
    '">' +
    tspans +
    "</text>"
  );
}

export function buildSlideSvgContent(
  slide: VisualSlide,
  slideDocW = 1600,
  slideDocH = 900,
  selectedSlideElId: string | null = null,
  isInteractive = false,
  uid = "stage"
): string {
  const sfx = uid;
  const fontCss = getCachedEmbeddedFontCss();
  const defs = [
    "<defs>",
    fontCss,
    '<linearGradient id="grad-indigo-' + sfx + '" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#0f172a"/><stop offset="50%" stop-color="#1e1b4b"/><stop offset="100%" stop-color="#311042"/></linearGradient>',
    '<linearGradient id="grad-emerald-' + sfx + '" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#090d16"/><stop offset="100%" stop-color="#064e3b"/></linearGradient>',
    '<linearGradient id="grad-sunset-' + sfx + '" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#181028"/><stop offset="55%" stop-color="#4c1d4b"/><stop offset="100%" stop-color="#9a3412"/></linearGradient>',
    '<linearGradient id="grad-ocean-' + sfx + '" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#041019"/><stop offset="50%" stop-color="#0c4a6e"/><stop offset="100%" stop-color="#0f766e"/></linearGradient>',
    '<linearGradient id="grad-crimson-' + sfx + '" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#090508"/><stop offset="100%" stop-color="#4c0519"/></linearGradient>',
    '<linearGradient id="grad-gold-' + sfx + '" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#09090b"/><stop offset="60%" stop-color="#1c1917"/><stop offset="100%" stop-color="#422006"/></linearGradient>',
    '<linearGradient id="grad-aurora-' + sfx + '" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#090d16"/><stop offset="50%" stop-color="#1e1b4b"/><stop offset="100%" stop-color="#065f46"/></linearGradient>',
    '<linearGradient id="grad-arctic-' + sfx + '" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f8fafc"/><stop offset="100%" stop-color="#e0f2fe"/></linearGradient>',
    "</defs>",
  ].join("");

  const cfg: BgConfig = slide.bgConfig || {
    mode: "design",
    presetId: "bg16",
    colors: ["#0c1024", "#312e81", "#4f46e5"],
  };

  let html = "";
  if (cfg.mode === "design") {
    html =
      defs +
      '<rect class="slide-bg" width="' +
      slideDocW +
      '" height="' +
      slideDocH +
      '" fill="' +
      cfg.colors[0] +
      '" />' +
      renderBgDesignSvgNode(cfg, slideDocW, slideDocH, sfx);
  } else {
    const bgFill = slide.bg.startsWith("grad-")
      ? "url(#" + slide.bg + "-" + sfx + ")"
      : slide.bg;
    html =
      defs +
      '<rect class="slide-bg" width="' +
      slideDocW +
      '" height="' +
      slideDocH +
      '" fill="' +
      bgFill +
      '" />';
  }

  slide.elements.forEach((el) => {
    const isSel = isInteractive && el.id === selectedSlideElId;
    const selAttr = isSel ? ' stroke-dasharray="6 4"' : "";
    html +=
      '<g class="slide-el' +
      (isSel ? " selected" : "") +
      '" data-id="' +
      el.id +
      '" transform="translate(' +
      el.x +
      ", " +
      el.y +
      ')" style="cursor:move;">';

    const bw = el.borderWidth || 0;
    const bCol = el.borderColor || "#ffffff";
    const strokeAttr =
      bw > 0 ? 'stroke="' + bCol + '" stroke-width="' + bw + '"' : 'stroke="none"';
    const glowCol = bw > 0 ? bCol : el.fill || "#6366f1";
    const glowAttr = el.glow
      ? 'style="filter: drop-shadow(0 0 14px ' + glowCol + ');"'
      : "";

    if (el.type === "rect" || el.type === "pill") {
      const rx = el.type === "pill" ? el.h / 2 : (el.rx ?? 16);
      html +=
        '<rect width="' +
        el.w +
        '" height="' +
        el.h +
        '" rx="' +
        rx +
        '" fill="' +
        el.fill +
        '" ' +
        strokeAttr +
        " " +
        glowAttr +
        " />";
      html += renderSvgMultilineText(
        el.text,
        el.w / 2,
        el.h / 2,
        el.fontSize,
        el.stroke,
        "middle",
        true,
        "600",
        el.fontFamily
      );
    } else if (el.type === "circle") {
      const r = Math.min(el.w, el.h) / 2;
      html +=
        '<circle cx="' +
        r +
        '" cy="' +
        r +
        '" r="' +
        r +
        '" fill="' +
        el.fill +
        '" ' +
        strokeAttr +
        " " +
        glowAttr +
        " />";
      html += renderSvgMultilineText(
        el.text,
        r,
        r,
        el.fontSize,
        el.stroke,
        "middle",
        true,
        "600",
        el.fontFamily
      );
    } else if (el.type === "arrow") {
      const midY = el.h / 2;
      html +=
        "<g " +
        glowAttr +
        '><path d="M 0 ' +
        midY +
        " L " +
        (el.w - 30) +
        " " +
        midY +
        '" stroke="' +
        el.fill +
        '" stroke-width="8" stroke-linecap="round" />';
      html +=
        '<polygon points="' +
        el.w +
        "," +
        midY +
        " " +
        (el.w - 38) +
        "," +
        (midY - 22) +
        " " +
        (el.w - 38) +
        "," +
        (midY + 22) +
        '" fill="' +
        el.fill +
        '" /></g>';
    } else if (el.type === "mindmap-embed") {
      html +=
        '<rect width="' +
        el.w +
        '" height="' +
        el.h +
        '" rx="18" fill="#090d16" fill-opacity="0.45" ' +
        strokeAttr +
        " " +
        glowAttr +
        " />";
      const scaleX = el.w / (el.mmBaseW || 1600);
      const scaleY = el.h / (el.mmBaseH || 900);
      html +=
        '<g transform="scale(' +
        scaleX +
        ", " +
        scaleY +
        ')">' +
        (el.svgInner || "") +
        "</g>";
    } else {
      const weight = el.type === "heading" ? "800" : "500";
      html +=
        '<rect width="' + el.w + '" height="' + el.h + '" fill="transparent"' + selAttr + " />";
      html += renderSvgMultilineText(
        el.text,
        0,
        el.fontSize,
        el.fontSize,
        el.stroke,
        "start",
        false,
        weight,
        el.fontFamily
      );
    }

    if (isSel) {
      html +=
        '<rect x="-4" y="-4" width="' +
        (el.w + 8) +
        '" height="' +
        (el.h + 8) +
        '" rx="6" fill="none" stroke="#38bdf8" stroke-width="2" stroke-dasharray="6 4" pointer-events="none" />';
    }

    html += "</g>";
  });

  return html;
}

export function createSlideFromTemplate(tpl: string): VisualSlide {
  const id = "s" + Date.now() + Math.random().toString(36).slice(2, 5);
  const templates: Record<string, VisualSlide> = {
    title: {
      id,
      bg: "grad-indigo",
      bgConfig: { mode: "design", presetId: "bg16", colors: ["#0c1024", "#312e81", "#4f46e5"] },
      elements: [
        { id: id + "1", type: "pill", x: 140, y: 220, w: 240, h: 50, text: "**OVERVIEW**", fill: "#6366f1", stroke: "#ffffff", fontSize: 17, rx: 25, borderWidth: 0 },
        { id: id + "2", type: "heading", x: 140, y: 305, w: 1200, h: 160, text: "**Presentation Title**", fill: "#ffffff", stroke: "#ffffff", fontSize: 72, rx: 0, borderWidth: 0 },
        { id: id + "3", type: "text", x: 140, y: 475, w: 900, h: 90, text: "Add a subtitle, project summary, or speaker name here", fill: "#94a3b8", stroke: "#cbd5e1", fontSize: 30, rx: 0, borderWidth: 0 },
      ],
    },
    cards: {
      id,
      bg: "#0f172a",
      bgConfig: { mode: "design", presetId: "bg19", colors: ["#0f172a", "#1e293b", "#6366f1"] },
      elements: [
        { id: id + "1", type: "heading", x: 100, y: 90, w: 1100, h: 80, text: "**Three Main Points**", fill: "#ffffff", stroke: "#ffffff", fontSize: 52, rx: 0, borderWidth: 0 },
        { id: id + "2", type: "rect", x: 100, y: 230, w: 430, h: 500, text: "**01. First Point**\n\nClick this card to edit\nthe title and details.", fill: "#1e293b", stroke: "#38bdf8", fontSize: 27, rx: 20, borderWidth: 0 },
        { id: id + "3", type: "rect", x: 585, y: 230, w: 430, h: 500, text: "**02. Second Point**\n\nClick this card to edit\nthe title and details.", fill: "#1e293b", stroke: "#a855f7", fontSize: 27, rx: 20, borderWidth: 0 },
        { id: id + "4", type: "rect", x: 1070, y: 230, w: 430, h: 500, text: "**03. Third Point**\n\nClick this card to edit\nthe title and details.", fill: "#1e293b", stroke: "#10b981", fontSize: 27, rx: 20, borderWidth: 0 },
      ],
    },
    split: {
      id,
      bg: "grad-emerald",
      bgConfig: { mode: "design", presetId: "bg22", colors: ["#051310", "#064e3b", "#10b981"] },
      elements: [
        { id: id + "1", type: "heading", x: 100, y: 90, w: 1100, h: 80, text: "**Side-by-Side Comparison**", fill: "#ffffff", stroke: "#ffffff", fontSize: 52, rx: 0, borderWidth: 0 },
        { id: id + "2", type: "rect", x: 100, y: 220, w: 660, h: 540, text: "**Option A**\n\n- First key point\n- Second key point", fill: "#0f172a", stroke: "#34d399", fontSize: 28, rx: 24, borderWidth: 0 },
        { id: id + "3", type: "rect", x: 840, y: 220, w: 660, h: 540, text: "**Option B**\n\n- First key point\n- Second key point", fill: "#0f172a", stroke: "#38bdf8", fontSize: 28, rx: 24, borderWidth: 0 },
      ],
    },
    kpi: {
      id,
      bg: "grad-ocean",
      bgConfig: { mode: "design", presetId: "bg27", colors: ["#0a1222", "#1e3a5f", "#38bdf8"] },
      elements: [
        { id: id + "1", type: "heading", x: 100, y: 80, w: 1200, h: 70, text: "**Key Metrics Summary**", fill: "#ffffff", stroke: "#ffffff", fontSize: 52, rx: 0, borderWidth: 0 },
        { id: id + "2", type: "rect", x: 100, y: 210, w: 320, h: 280, text: "**$1.2M**\n\nTotal Revenue\n*(+24% YoY)*", fill: "#0f172a", stroke: "#38bdf8", fontSize: 32, rx: 22, borderWidth: 0 },
        { id: id + "3", type: "rect", x: 460, y: 210, w: 320, h: 280, text: "**94%**\n\nCustomer\nRetention Rate", fill: "#0f172a", stroke: "#34d399", fontSize: 32, rx: 22, borderWidth: 0 },
        { id: id + "4", type: "rect", x: 820, y: 210, w: 320, h: 280, text: "**48k**\n\nMonthly Active\nUsers", fill: "#0f172a", stroke: "#a855f7", fontSize: 32, rx: 22, borderWidth: 0 },
        { id: id + "5", type: "rect", x: 1180, y: 210, w: 320, h: 280, text: "**3.2x**\n\nReturn on\nAd Spend", fill: "#0f172a", stroke: "#f59e0b", fontSize: 32, rx: 22, borderWidth: 0 },
        { id: id + "6", type: "rect", x: 100, y: 540, w: 1400, h: 230, text: "**Summary Note**\n\nUse this bottom card to highlight the main takeaway from the numbers above.", fill: "#090d16", stroke: "#f8fafc", fontSize: 27, rx: 20, borderWidth: 0 },
      ],
    },
    roadmap: {
      id,
      bg: "#0f172a",
      bgConfig: { mode: "design", presetId: "bg24", colors: ["#0f172a", "#1e1b4b", "#4f46e5"] },
      elements: [
        { id: id + "1", type: "heading", x: 100, y: 90, w: 1200, h: 70, text: "**Project Timeline & Milestones**", fill: "#ffffff", stroke: "#ffffff", fontSize: 52, rx: 0, borderWidth: 0 },
        { id: id + "2", type: "rect", x: 90, y: 290, w: 300, h: 360, text: "**Step 1 • Planning**\n\n- Define scope\n- Set goals", fill: "#1e293b", stroke: "#ffffff", fontSize: 24, rx: 20, borderWidth: 0 },
        { id: id + "a1", type: "arrow", x: 400, y: 440, w: 60, h: 50, text: "", fill: "#6366f1", stroke: "#6366f1", fontSize: 20, rx: 0, borderWidth: 0 },
        { id: id + "3", type: "rect", x: 470, y: 290, w: 300, h: 360, text: "**Step 2 • Design**\n\n- Wireframes\n- Review cycle", fill: "#1e293b", stroke: "#ffffff", fontSize: 24, rx: 20, borderWidth: 0 },
        { id: id + "a2", type: "arrow", x: 780, y: 440, w: 60, h: 50, text: "", fill: "#ec4899", stroke: "#ec4899", fontSize: 20, rx: 0, borderWidth: 0 },
        { id: id + "4", type: "rect", x: 850, y: 290, w: 300, h: 360, text: "**Step 3 • Build**\n\n- Core features\n- QA testing", fill: "#1e293b", stroke: "#ffffff", fontSize: 24, rx: 20, borderWidth: 0 },
        { id: id + "a3", type: "arrow", x: 1160, y: 440, w: 60, h: 50, text: "", fill: "#10b981", stroke: "#10b981", fontSize: 20, rx: 0, borderWidth: 0 },
        { id: id + "5", type: "rect", x: 1230, y: 290, w: 280, h: 360, text: "**Step 4 • Launch**\n\n- Release\n- Feedback", fill: "#1e293b", stroke: "#ffffff", fontSize: 24, rx: 20, borderWidth: 0 },
      ],
    },
    grid4: {
      id,
      bg: "grad-aurora",
      bgConfig: { mode: "design", presetId: "bg29", colors: ["#090a10", "#4f46e5", "#06b6d4"] },
      elements: [
        { id: id + "1", type: "heading", x: 100, y: 70, w: 1200, h: 70, text: "**2×2 Matrix / SWOT Analysis**", fill: "#ffffff", stroke: "#ffffff", fontSize: 50, rx: 0, borderWidth: 0 },
        { id: id + "2", type: "rect", x: 100, y: 180, w: 680, h: 310, text: "**STRENGTHS**\n\n- Core advantage one\n- Core advantage two", fill: "#1e293b", stroke: "#10b981", fontSize: 26, rx: 20, borderWidth: 0 },
        { id: id + "3", type: "rect", x: 820, y: 180, w: 680, h: 310, text: "**OPPORTUNITIES**\n\n- Growth area one\n- Growth area two", fill: "#1e293b", stroke: "#38bdf8", fontSize: 26, rx: 20, borderWidth: 0 },
        { id: id + "4", type: "rect", x: 100, y: 520, w: 680, h: 310, text: "**WEAKNESSES**\n\n- Current limitation one\n- Current limitation two", fill: "#1e293b", stroke: "#f59e0b", fontSize: 26, rx: 20, borderWidth: 0 },
        { id: id + "5", type: "rect", x: 820, y: 520, w: 680, h: 310, text: "**RISKS & THREATS**\n\n- External risk one\n- External risk two", fill: "#1e293b", stroke: "#f43f5e", fontSize: 26, rx: 20, borderWidth: 0 },
      ],
    },
    funnel: {
      id,
      bg: "grad-sunset",
      bgConfig: { mode: "design", presetId: "bg20", colors: ["#160f24", "#3b1d4e", "#f59e0b"] },
      elements: [
        { id: id + "1", type: "heading", x: 100, y: 80, w: 1200, h: 70, text: "**Conversion Funnel Breakdown**", fill: "#ffffff", stroke: "#ffffff", fontSize: 52, rx: 0, borderWidth: 0 },
        { id: id + "2", type: "pill", x: 200, y: 220, w: 1200, h: 150, text: "**Stage 1 • Reach & Awareness** (100,000 Visitors)", fill: "#6366f1", stroke: "#ffffff", fontSize: 30, rx: 75, borderWidth: 0 },
        { id: id + "3", type: "pill", x: 350, y: 420, w: 900, h: 150, text: "**Stage 2 • Signups & Trials** (25,000 Users)", fill: "#ec4899", stroke: "#ffffff", fontSize: 28, rx: 75, borderWidth: 0 },
        { id: id + "4", type: "pill", x: 500, y: 620, w: 600, h: 150, text: "**Stage 3 • Paid Customers** (6,200)", fill: "#f59e0b", stroke: "#ffffff", fontSize: 26, rx: 75, borderWidth: 0 },
      ],
    },
    quote: {
      id,
      bg: "grad-gold",
      bgConfig: { mode: "design", presetId: "bg17", colors: ["#0b0b0e", "#16151d", "#ca8a04"] },
      elements: [
        { id: id + "1", type: "pill", x: 670, y: 180, w: 260, h: 50, text: "**KEYNOTE QUOTE**", fill: "#d97706", stroke: "#ffffff", fontSize: 17, rx: 25, borderWidth: 0 },
        { id: id + "2", type: "rect", x: 160, y: 270, w: 1280, h: 420, text: '*"Good design is making something intelligible and memorable.\nGreat design is making something memorable and meaningful."*\n\n**— Dieter Rams**', fill: "#18181b", stroke: "#ffffff", fontSize: 36, rx: 28, borderWidth: 0 },
      ],
    },
    "hero-split": {
      id,
      bg: "grad-crimson",
      bgConfig: { mode: "design", presetId: "bg23", colors: ["#14070c", "#4c0519", "#e11d48"] },
      elements: [
        { id: id + "1", type: "pill", x: 110, y: 150, w: 250, h: 48, text: "**FEATURE OVERVIEW**", fill: "#e11d48", stroke: "#ffffff", fontSize: 17, rx: 24, borderWidth: 0 },
        { id: id + "2", type: "heading", x: 110, y: 240, w: 740, h: 160, text: "**Main Topic or**\nProduct Highlight", fill: "#ffffff", stroke: "#ffffff", fontSize: 64, rx: 0, borderWidth: 0 },
        { id: id + "3", type: "text", x: 110, y: 450, w: 720, h: 220, text: "- First supporting detail or benefit\n- Second supporting detail or benefit\n- Third supporting detail or benefit\n- Fourth supporting detail or benefit", fill: "#fda4af", stroke: "#ffe4e6", fontSize: 28, rx: 0, borderWidth: 0 },
        { id: id + "4", type: "circle", x: 960, y: 190, w: 500, h: 500, text: "**Key**\nHighlight", fill: "#be123c", stroke: "#ffffff", fontSize: 52, rx: 250, borderWidth: 0 },
      ],
    },
    blank: {
      id,
      bg: "#0f172a",
      bgConfig: { mode: "design", presetId: "bg16", colors: ["#0c1024", "#312e81", "#4f46e5"] },
      elements: [],
    },
  };
  return templates[tpl] || templates.blank;
}

/**
 * Converts Markdown headings & bullets into Visualize Studio MmNode[] tree
 */
export function parseMarkdownToMmNodes(markdown: string): MmNode[] {
  const lines = (markdown || "").replace(/\r\n/g, "\n").split("\n");
  const newNodes: MmNode[] = [];
  const rootId = "n1";
  let rootTitle = "**Document Overview**";
  const firstH1 = lines.find((l) => /^#\s+/.test(l.trim()));
  if (firstH1) {
    rootTitle = "**" + firstH1.replace(/^#\s+/, "").trim() + "**";
  }

  newNodes.push({
    id: rootId,
    parentId: null,
    text: rootTitle,
    x: 800,
    y: 450,
    color: "#6366f1",
    textColor: "#ffffff",
    shape: "pill",
    fontSize: 24,
    customW: 310,
    customH: 88,
  });

  const palette = ["#ec4899", "#10b981", "#f59e0b", "#0ea5e9", "#8b5cf6"];
  let currentBranchId = rootId;
  let branchIdx = 0;
  let counter = 2;
  let inCode = false;

  for (const rawLine of lines) {
    const raw = rawLine.trim();
    if (raw.startsWith("\x60\x60\x60")) {
      inCode = !inCode;
      continue;
    }
    if (inCode || !raw || raw === "---") continue;

    const hMatch = raw.match(/^(#{2,3})\s+(.*)/);
    if (hMatch) {
      const bId = "n" + counter++;
      const col = palette[branchIdx % palette.length];
      branchIdx++;
      newNodes.push({
        id: bId,
        parentId: rootId,
        text: "**" + hMatch[2].trim().slice(0, 42) + "**",
        x: 800,
        y: 450,
        color: col,
        textColor: "#ffffff",
        shape: "pill",
        fontSize: 19,
        customW: 260,
        customH: 60,
      });
      currentBranchId = bId;
      continue;
    }

    const bMatch = raw.match(/^[-*+]\s+(.*)/);
    if (bMatch && newNodes.length < 28) {
      const lId = "n" + counter++;
      newNodes.push({
        id: lId,
        parentId: currentBranchId,
        text: bMatch[1].trim().slice(0, 56),
        x: 800,
        y: 450,
        color: "#1e293b",
        textColor: "#f8fafc",
        shape: "rect",
        fontSize: 17,
        customW: 280,
        customH: 74,
      });
    }
  }

  return applyMindMapLayoutAlgorithm(
    newNodes.length > 1 ? newNodes : DEFAULT_MM_NODES,
    "mindmap",
    1600,
    900
  );
}

/**
 * Builds the inner SVG markup (<g id="mmLinksLayer"> + <g id="mmNodesLayer">)
 * for embedding into slides or standalone Mind Map SVG/PNG/PDF exports.
 */
export function buildMindMapViewportInnerSvg(
  mmNodes: MmNode[],
  layout: MmLayoutMode = "mindmap",
  mmDocW = 1600
): string {
  const rootNode = mmNodes.find((n) => n.parentId === null);
  const topBranches = rootNode ? mmNodes.filter((n) => n.parentId === rootNode.id) : [];
  const links: string[] = [];

  if (layout === "fishbone" && rootNode) {
    const spineStartX = Math.round(mmDocW * 0.1);
    links.push(
      '<path d="M ' +
        spineStartX +
        " " +
        rootNode.y +
        " L " +
        rootNode.x +
        " " +
        rootNode.y +
        '" fill="none" stroke="' +
        rootNode.color +
        '" stroke-width="4" stroke-linecap="round" opacity="0.85" />'
    );
  }

  mmNodes.forEach((node) => {
    if (!node.parentId) return;
    const parent = mmNodes.find((n) => n.id === node.parentId);
    if (!parent) return;

    let d = "";
    if (layout === "timeline") {
      if (node.parentId === rootNode?.id) {
        const bIdx = topBranches.findIndex((b) => b.id === node.id);
        const prevNode = bIdx > 0 ? topBranches[bIdx - 1] : rootNode!;
        d = "M " + prevNode.x + " " + prevNode.y + " L " + node.x + " " + node.y;
      } else {
        const siblings = mmNodes.filter((n) => n.parentId === node.parentId);
        const sIdx = siblings.findIndex((s) => s.id === node.id);
        const fromNode = sIdx > 0 ? siblings[sIdx - 1] : parent;
        d = "M " + fromNode.x + " " + fromNode.y + " L " + node.x + " " + node.y;
      }
    } else if (layout === "org" || layout === "bottom-up") {
      if (node.parentId === rootNode?.id) {
        const midY = Math.round((parent.y + node.y) / 2);
        d =
          "M " +
          parent.x +
          " " +
          parent.y +
          " C " +
          parent.x +
          " " +
          midY +
          ", " +
          node.x +
          " " +
          midY +
          ", " +
          node.x +
          " " +
          node.y;
      } else {
        const siblings = mmNodes.filter((n) => n.parentId === node.parentId);
        const sIdx = siblings.findIndex((s) => s.id === node.id);
        const fromNode = sIdx > 0 ? siblings[sIdx - 1] : parent;
        d = "M " + fromNode.x + " " + fromNode.y + " L " + node.x + " " + node.y;
      }
    } else if (layout === "fishbone" && rootNode) {
      if (node.parentId === rootNode.id) {
        const spineX = node.x + Math.round(mmDocW * 0.14);
        d = "M " + node.x + " " + node.y + " L " + spineX + " " + rootNode.y;
      } else {
        const ribTargetX =
          parent.x +
          Math.round(
            ((node.y - parent.y) / (rootNode.y - parent.y || 1)) * (mmDocW * 0.14)
          );
        d = "M " + node.x + " " + node.y + " L " + ribTargetX + " " + node.y;
      }
    } else if (layout === "radial") {
      const cx = Math.round((parent.x + node.x) / 2);
      d =
        "M " +
        parent.x +
        " " +
        parent.y +
        " Q " +
        cx +
        " " +
        parent.y +
        " " +
        node.x +
        " " +
        node.y;
    } else {
      const midX = Math.round((parent.x + node.x) / 2);
      d =
        "M " +
        parent.x +
        " " +
        parent.y +
        " C " +
        midX +
        " " +
        parent.y +
        ", " +
        midX +
        " " +
        node.y +
        ", " +
        node.x +
        " " +
        node.y;
    }

    const strokeCol = node.color === "#1e293b" ? parent.color : node.color;
    const sw = node.parentId === rootNode?.id ? "4" : "2.5";
    links.push(
      '<path d="' +
        d +
        '" fill="none" stroke="' +
        strokeCol +
        '" stroke-width="' +
        sw +
        '" stroke-linecap="round" opacity="0.85" />'
    );
  });

  const nodesSvg = mmNodes.map((node) => {
    const { w, h } = getNodeBoxSize(node);
    const bw = node.borderWidth || 0;
    const strokeAttr =
      bw > 0
        ? 'stroke="' + (node.borderColor || "#ffffff") + '" stroke-width="' + bw + '"'
        : 'stroke="none"';
    const glowCol = bw > 0 ? node.borderColor || node.color : node.color;
    const glowStyle = node.glow
      ? 'style="filter: drop-shadow(0 0 12px ' + glowCol + ');"'
      : "";

    const shapeMarkup =
      node.shape === "ellipse"
        ? '<ellipse rx="' +
          w / 2 +
          '" ry="' +
          h / 2 +
          '" fill="' +
          node.color +
          '" ' +
          strokeAttr +
          " " +
          glowStyle +
          " />"
        : '<rect x="' +
          -w / 2 +
          '" y="' +
          -h / 2 +
          '" width="' +
          w +
          '" height="' +
          h +
          '" rx="' +
          (node.shape === "pill" ? h / 2 : 10) +
          '" fill="' +
          node.color +
          '" ' +
          strokeAttr +
          " " +
          glowStyle +
          " />";

    const textMarkup = renderSvgMultilineText(
      node.text,
      0,
      0,
      node.fontSize || 18,
      node.textColor || "#ffffff",
      "middle",
      true,
      node.parentId === null ? "700" : "500",
      node.fontFamily || "'Inter', system-ui, sans-serif"
    );

    return (
      '<g transform="translate(' +
      node.x +
      ", " +
      node.y +
      ')">' +
      shapeMarkup +
      textMarkup +
      "</g>"
    );
  });

  return "<g>" + links.join("") + "</g><g>" + nodesSvg.join("") + "</g>";
}

// ---------------------------------------------------------------------------
// Backward-compatible exports used by app/page.tsx Bundle (.zip)
// ---------------------------------------------------------------------------
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

export function renderMindmapToSvg(markdown: string, darkMode = true): string {
  const nodes = parseMarkdownToMmNodes(markdown);
  const cfg: BgConfig = darkMode
    ? { mode: "design", presetId: "bg01", colors: ["#0b1120", "#1e293b", "#38bdf8"] }
    : { mode: "design", presetId: "bg04", colors: ["#f8fafc", "#cbd5e1", "#e2e8f0"] };
  const fontCss = getCachedEmbeddedFontCss();
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900">',
    fontCss ? "<defs>" + fontCss + "</defs>" : "",
    '<rect width="1600" height="900" fill="' + cfg.colors[0] + '" />',
    renderBgDesignSvgNode(cfg, 1600, 900, "zip_mm"),
    buildMindMapViewportInnerSvg(nodes, "mindmap", 1600),
    "</svg>",
  ].join("");
}

export function parseMarkdownToSlides(markdown: string): SlideItem[] {
  const chunks = (markdown || "")
    .replace(/\r\n/g, "\n")
    .split(/\n---\n/)
    .filter((c) => c.trim().length > 0);
  if (chunks.length === 0) {
    return [
      {
        index: 0,
        title: "Presentation",
        layout: "cover",
        markdown: "# Presentation",
        html: "<h1>Presentation</h1>",
        speakerNotes: "",
      },
    ];
  }
  return chunks.map((chunk, idx) => {
    const titleMatch = chunk.match(/^#{1,3}\s+(.*)/m);
    const title = titleMatch ? titleMatch[1].trim() : "Slide " + (idx + 1);
    return {
      index: idx,
      title,
      layout: idx === 0 ? "cover" : "standard",
      markdown: chunk.trim(),
      html: sanitizePreviewHtml(markdownToHtmlSnippet(chunk.trim())),
      speakerNotes: "",
    };
  });
}

export function exportSlidesToStandaloneHtml(
  slides: SlideItem[],
  title = "Slate Presentation"
): string {
  const sections = slides
    .map(
      (s, i) =>
        '<section class="slide"><div class="slide-inner">' +
        s.html +
        '</div><footer class="slide-footer"><span>' +
        title +
        "</span><span>" +
        (i + 1) +
        " / " +
        slides.length +
        "</span></footer></section>"
    )
    .join("\n");
  return (
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>' +
    title +
    "</title><style>*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;background:#0f172a;color:#f8fafc}.slide{min-height:100vh;display:flex;flex-direction:column;justify-content:space-between;padding:4rem 8vw;border-bottom:1px solid #334155}.slide-inner{max-width:960px;width:100%;margin:auto;font-size:1.35rem;line-height:1.6}.slide-footer{display:flex;justify-content:space-between;font-size:0.85rem;opacity:0.6}</style></head><body>" +
    sections +
    "</body></html>"
  );
}
