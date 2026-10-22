export interface VectorizerOptions {
  maxColors: number;
  colorTol: number;
  alphaMax: number;
  turdSize: number;
  removeBg: boolean;
  upscale2x: boolean;
}

export interface VectorizeResult {
  svg: string;
  pathCount: number;
  width: number;
  height: number;
  palette: string[];
}

export interface RasterPixelData {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

type PotraceFn = (
  source: ImageBitmapSource,
  options?: Record<string, unknown>
) => Promise<string>;

interface PotraceModule {
  init: () => Promise<void>;
  potrace: PotraceFn;
}

let potraceModPromise: Promise<PotraceModule> | null = null;

export async function getPotraceWasm(): Promise<PotraceModule> {
  if (!potraceModPromise) {
    potraceModPromise = (async () => {
      const importer = new Function(
        "url",
        "return import(url)"
      ) as (url: string) => Promise<PotraceModule>;
      const mod = await importer(
        "https://cdn.jsdelivr.net/npm/esm-potrace-wasm@0.4.1/+esm"
      );
      await mod.init();
      return mod;
    })();
  }
  return potraceModPromise;
}

const MAX_WORK_PIXELS = 1_200_000;
const ALPHA_CUTOFF = 128;
const NONE = 255;

function dist2(r: number, g: number, b: number, c: number[]): number {
  const dr = r - c[0];
  const dg = g - c[1];
  const db = b - c[2];
  return dr * dr + dg * dg + db * db;
}

export function rgbToHex(rgb: number[]): string {
  return (
    "#" +
    rgb
      .map((x) =>
        Math.max(0, Math.min(255, Math.round(x)))
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
  );
}

function getSourceDims(
  img: HTMLImageElement | HTMLCanvasElement
): { w0: number; h0: number } {
  if ("naturalWidth" in img && img.naturalWidth > 0) {
    return { w0: img.naturalWidth, h0: img.naturalHeight };
  }
  return { w0: img.width || 280, h0: img.height || 280 };
}

export function analyseColors(
  img: HTMLImageElement | HTMLCanvasElement,
  mergeTol: number,
  maxColors: number
): { palette: number[][]; bgColor: number[] | null } {
  const { w0: W0, h0: H0 } = getSourceDims(img);
  const s = Math.min(1, Math.sqrt(4_000_000 / (W0 * H0)));
  const w = Math.max(1, Math.round(W0 * s));
  const h = Math.max(1, Math.round(H0 * s));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const cx = c.getContext("2d", { willReadFrequently: true })!;
  cx.drawImage(img, 0, 0, w, h);
  const d = cx.getImageData(0, 0, w, h).data;
  const keyAt = (i: number) => (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
  const keyToRgb = (k: number): number[] => [(k >> 16) & 255, (k >> 8) & 255, k & 255];

  const border = new Map<number, number>();
  let borderTotal = 0;
  let borderTransparent = 0;
  const addBorder = (p: number) => {
    const i = p * 4;
    borderTotal++;
    if (d[i + 3] < ALPHA_CUTOFF) {
      borderTransparent++;
      return;
    }
    const k = keyAt(i);
    border.set(k, (border.get(k) || 0) + 1);
  };
  for (let x = 0; x < w; x++) {
    addBorder(x);
    addBorder((h - 1) * w + x);
  }
  for (let y = 1; y < h - 1; y++) {
    addBorder(y * w);
    addBorder(y * w + w - 1);
  }
  const transparentBg = borderTransparent > borderTotal / 2;
  let bgRgb: number[] | null = null;
  if (!transparentBg) {
    let bestK = 0;
    let bestN = -1;
    for (const [k, n] of border.entries()) {
      if (n > bestN) {
        bestN = n;
        bestK = k;
      }
    }
    bgRgb = keyToRgb(bestK);
  }

  const hist = new Map<number, number>();
  let flatTotal = 0;
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      const iR = i + 4;
      const iD = i + w * 4;
      if (
        d[i + 3] < ALPHA_CUTOFF ||
        d[iR + 3] < ALPHA_CUTOFF ||
        d[iD + 3] < ALPHA_CUTOFF
      ) {
        continue;
      }
      const grad =
        Math.abs(d[i] - d[iR]) +
        Math.abs(d[i + 1] - d[iR + 1]) +
        Math.abs(d[i + 2] - d[iR + 2]) +
        Math.abs(d[i] - d[iD]) +
        Math.abs(d[i + 1] - d[iD + 1]) +
        Math.abs(d[i + 2] - d[iD + 2]);
      if (grad > 18) continue;
      const k = keyAt(i);
      hist.set(k, (hist.get(k) || 0) + 1);
      flatTotal++;
    }
  }

  const tol2 = mergeTol * mergeTol;
  const clusters: { color: number[]; count: number }[] = [];
  const entries = [...hist.entries()].sort((a, b) => b[1] - a[1]);
  for (const [k, n] of entries) {
    const [r, g, b] = keyToRgb(k);
    let best: { color: number[]; count: number } | null = null;
    let bestD = Infinity;
    for (const cl of clusters) {
      const dd = dist2(r, g, b, cl.color);
      if (dd < bestD) {
        bestD = dd;
        best = cl;
      }
    }
    if (best && (bestD <= tol2 || clusters.length >= 256)) {
      best.count += n;
    } else {
      clusters.push({ color: [r, g, b], count: n });
    }
  }

  const minArea = Math.max(16, flatTotal * 0.0001);
  let bgCluster: { color: number[]; count: number } | null = null;
  if (bgRgb) {
    let bestD = Infinity;
    for (const cl of clusters) {
      const dd = dist2(bgRgb[0], bgRgb[1], bgRgb[2], cl.color);
      if (dd < bestD) {
        bestD = dd;
        bgCluster = cl;
      }
    }
    if (bestD > tol2) bgCluster = null;
  }

  const foreground = clusters
    .filter((cl) => cl !== bgCluster && cl.count >= minArea)
    .sort((a, b) => b.count - a.count)
    .slice(0, maxColors)
    .map((cl) => cl.color);

  const bgColor = bgRgb ? (bgCluster ? bgCluster.color : bgRgb) : null;
  return { palette: bgColor ? [bgColor, ...foreground] : foreground, bgColor };
}

function dilate(
  src: Uint8Array,
  tmp: Uint8Array,
  dst: Uint8Array,
  w: number,
  h: number,
  r: number
): void {
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let xx = Math.max(0, x - r), xe = Math.min(w - 1, x + r); xx <= xe; xx++) {
        if (src[row + xx]) {
          v = 1;
          break;
        }
      }
      tmp[row + x] = v;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let yy = Math.max(0, y - r), ye = Math.min(h - 1, y + r); yy <= ye; yy++) {
        if (tmp[yy * w + x]) {
          v = 1;
          break;
        }
      }
      dst[y * w + x] = v;
    }
  }
}

export async function traceImageWithPotrace(
  loadedImage: HTMLImageElement | HTMLCanvasElement,
  options: VectorizerOptions
): Promise<VectorizeResult> {
  const mod = await getPotraceWasm();
  const { potrace } = mod;

  const { w0: origW, h0: origH } = getSourceDims(loadedImage);
  const wantScale = options.upscale2x ? 2 : 1;
  const scale = Math.min(wantScale, Math.sqrt(MAX_WORK_PIXELS / (origW * origH)));
  const w = Math.max(1, Math.round(origW * scale));
  const h = Math.max(1, Math.round(origH * scale));
  const sx = w / origW;
  const sy = h / origH;

  const mergeTol = options.colorTol;
  const maxColors = options.maxColors;
  const { palette, bgColor } = analyseColors(loadedImage, mergeTol, maxColors);
  if (palette.length === 0 || (bgColor && palette.length === 1)) {
    throw new Error("No flat colour regions found in this image.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(loadedImage, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const totalPixels = w * h;

  const P = palette.length;
  const PENDING = 254;
  const coreTol2 = mergeTol * mergeTol;
  const assignments = new Uint8Array(totalPixels);
  let pending: number[] = [];

  const nearest = (r: number, g: number, b: number): [number, number] => {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let k = 0; k < P; k++) {
      const d = dist2(r, g, b, palette[k]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = k;
      }
    }
    return [bestIdx, bestDist];
  };

  for (let i = 0, idx = 0; i < totalPixels; i++, idx += 4) {
    if (data[idx + 3] < ALPHA_CUTOFF) {
      assignments[i] = NONE;
      continue;
    }
    const [k, d] = nearest(data[idx], data[idx + 1], data[idx + 2]);
    if (d <= coreTol2) {
      assignments[i] = k;
    } else {
      assignments[i] = PENDING;
      pending.push(i);
    }
  }

  const nbOffset = [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1];
  const nbDx = [-1, 0, 1, -1, 1, -1, 0, 1];
  while (pending.length) {
    const decided: number[] = [];
    const still: number[] = [];
    for (const p of pending) {
      const x = p % w;
      const idx = p * 4;
      let best = -1;
      let bestDist = Infinity;
      for (let n = 0; n < 8; n++) {
        if ((nbDx[n] < 0 && x === 0) || (nbDx[n] > 0 && x === w - 1)) continue;
        const q = p + nbOffset[n];
        if (q < 0 || q >= totalPixels) continue;
        const a = assignments[q];
        if (a >= P) continue;
        const d = dist2(data[idx], data[idx + 1], data[idx + 2], palette[a]);
        if (d < bestDist) {
          bestDist = d;
          best = a;
        }
      }
      if (best >= 0) {
        decided.push(p, best);
      } else {
        still.push(p);
      }
    }
    if (decided.length === 0) break;
    for (let j = 0; j < decided.length; j += 2) {
      assignments[decided[j]] = decided[j + 1];
    }
    pending = still;
  }
  for (const p of pending) {
    const idx = p * 4;
    assignments[p] = nearest(data[idx], data[idx + 1], data[idx + 2])[0];
  }

  const counts = new Uint32Array(P);
  for (let i = 0; i < totalPixels; i++) {
    if (assignments[i] < P) counts[assignments[i]]++;
  }

  const isBg = palette.map((_, k) => !!bgColor && k === 0);
  const layers = palette
    .map((_, k) => k)
    .filter((k) => !isBg[k] && counts[k] > 0)
    .sort((a, b) => counts[b] - counts[a]);

  const rankOf = new Int16Array(256).fill(-1);
  layers.forEach((k, j) => {
    rankOf[k] = j;
  });
  const pixelRank = new Int16Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    pixelRank[i] = rankOf[assignments[i]];
  }
  const OVERLAP = 2;
  const own = new Uint8Array(totalPixels);
  const tmp = new Uint8Array(totalPixels);
  const near = new Uint8Array(totalPixels);

  const parser = new DOMParser();
  const masterSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  masterSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  masterSvg.setAttribute("viewBox", "0 0 " + origW + " " + origH);
  masterSvg.setAttribute("width", String(origW));
  masterSvg.setAttribute("height", String(origH));

  if (bgColor && !options.removeBg) {
    const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("width", String(origW));
    bgRect.setAttribute("height", String(origH));
    bgRect.setAttribute("fill", rgbToHex(bgColor));
    masterSvg.appendChild(bgRect);
  }

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = w;
  maskCanvas.height = h;
  const maskCtx = maskCanvas.getContext("2d")!;
  const maskImgData = maskCtx.createImageData(w, h);
  const maskData = maskImgData.data;
  const turdsize = Math.max(1, Math.round(options.turdSize * sx * sy));
  const fitTransform =
    sx !== 1 || sy !== 1 ? "scale(" + 1 / sx + ", " + 1 / sy + ")" : "";

  const paletteSwatches: string[] = [];
  let totalPathCount = 0;

  for (let j = 0; j < layers.length; j++) {
    const color = palette[layers[j]];
    const hex = rgbToHex(color);
    paletteSwatches.push(hex);

    for (let i = 0; i < totalPixels; i++) {
      own[i] = pixelRank[i] === j ? 1 : 0;
    }
    dilate(own, tmp, near, w, h, OVERLAP);
    for (let i = 0, mIdx = 0; i < totalPixels; i++, mIdx += 4) {
      const val =
        pixelRank[i] === j || (pixelRank[i] > j && near[i]) ? 0 : 255;
      maskData[mIdx] = val;
      maskData[mIdx + 1] = val;
      maskData[mIdx + 2] = val;
      maskData[mIdx + 3] = 255;
    }
    maskCtx.putImageData(maskImgData, 0, 0);

    let rawLayerSvg = "";
    try {
      rawLayerSvg = await potrace(maskCanvas, {
        turdsize,
        turnpolicy: 4,
        alphamax: options.alphaMax,
        opticurve: 1,
        opttolerance: 0.2,
        pathonly: false,
        extractcolors: false,
      });
    } catch {
      await mod.init();
      rawLayerSvg = await potrace(maskCanvas, {
        turdsize,
        turnpolicy: 4,
        alphamax: options.alphaMax,
        opticurve: 1,
        opttolerance: 0.2,
        pathonly: false,
        extractcolors: false,
      });
    }

    const doc = parser.parseFromString(rawLayerSvg, "image/svg+xml");
    const paths = doc.querySelectorAll("path");
    if (paths.length === 0) continue;

    const layerGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    layerGroup.setAttribute("fill", hex);

    const potraceGroup = doc.querySelector("g");
    const potraceTransform =
      (potraceGroup && potraceGroup.getAttribute("transform")) || "";
    const transform = (fitTransform + " " + potraceTransform).trim();
    if (transform) layerGroup.setAttribute("transform", transform);

    paths.forEach((p) => {
      const d = p.getAttribute("d");
      if (d) {
        const cleanPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        cleanPath.setAttribute("d", d);
        layerGroup.appendChild(cleanPath);
        totalPathCount++;
      }
    });

    masterSvg.appendChild(layerGroup);
  }

  const currentSvgString = new XMLSerializer()
    .serializeToString(masterSvg)
    .replace(/><(rect|g|path)/g, ">\n  <$1")
    .replace(/><\/svg>/g, ">\n</svg>");

  return {
    svg: currentSvgString,
    pathCount: totalPathCount,
    width: origW,
    height: origH,
    palette: paletteSwatches,
  };
}

// ---------------------------------------------------------------------------
// SVG to Picture Core Engine Helpers (lifted from svg-to-picture.html)
// ---------------------------------------------------------------------------
export function parseSvgDimensions(
  svgText: string
): { doc: Document; svgEl: SVGSVGElement; w: number; h: number } | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText.trim(), "image/svg+xml");
  const svgEl = doc.querySelector("svg");
  if (!svgEl || doc.querySelector("parsererror")) return null;

  let w = 1000;
  let h = 1000;
  const vb = svgEl.getAttribute("viewBox");
  if (vb) {
    const parts = vb.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      w = Math.round(parts[2]);
      h = Math.round(parts[3]);
    }
  } else {
    const attrW = parseFloat(svgEl.getAttribute("width") || "");
    const attrH = parseFloat(svgEl.getAttribute("height") || "");
    if (attrW > 0 && attrH > 0) {
      w = Math.round(attrW);
      h = Math.round(attrH);
    }
  }
  return { doc, svgEl, w, h };
}

export function isWhiteFill(fillStr: string | null): boolean {
  if (!fillStr) return false;
  const f = fillStr.trim().toLowerCase().replace(/\s+/g, "");
  return (
    f === "#ffffff" || f === "#fff" || f === "white" || f === "rgb(255,255,255)"
  );
}

export function getElementFill(el: Element): string | null {
  const m = /(?:^|;)\s*fill\s*:\s*([^;]+)/i.exec(el.getAttribute("style") || "");
  return m ? m[1] : el.getAttribute("fill");
}

export function stripWhiteBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
): void {
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  const total = w * h;
  const bg = new Uint8Array(total);
  const stack = new Int32Array(total);
  let sp = 0;

  const seed = (p: number) => {
    const i = p * 4;
    if (
      !bg[p] &&
      d[i + 3] > 250 &&
      d[i] > 245 &&
      d[i + 1] > 245 &&
      d[i + 2] > 245
    ) {
      bg[p] = 1;
      stack[sp++] = p;
    }
  };

  for (let x = 0; x < w; x++) {
    seed(x);
    seed((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    seed(y * w);
    seed(y * w + w - 1);
  }
  if (sp === 0) return;

  while (sp > 0) {
    const p = stack[--sp];
    const x = p % w;
    if (x > 0) seed(p - 1);
    if (x < w - 1) seed(p + 1);
    if (p >= w) seed(p - w);
    if (p < total - w) seed(p + w);
  }

  for (let p = 0; p < total; p++) {
    const i = p * 4;
    if (bg[p]) {
      d[i + 3] = 0;
      continue;
    }
    if (d[i + 3] < 250) continue;
    const x = p % w;
    const touchesBg =
      (x > 0 && bg[p - 1]) ||
      (x < w - 1 && bg[p + 1]) ||
      (p >= w && bg[p - w]) ||
      (p < total - w && bg[p + w]);
    if (!touchesBg) continue;
    const a = Math.max(255 - d[i], 255 - d[i + 1], 255 - d[i + 2]) / 255;
    if (a <= 0) {
      d[i + 3] = 0;
      continue;
    }
    for (let c = 0; c < 3; c++) {
      d[i + c] = Math.round(255 - (255 - d[i + c]) / a);
    }
    d[i + 3] = Math.round(255 * a);
  }
  ctx.putImageData(imgData, 0, 0);
}

export function optimizeSvgCode(svg: string): string {
  return svg
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\?xml[^>]*\?>/gi, "")
    .replace(/<metadata>[\s\S]*?<\/metadata>/gi, "")
    .trim();
}

export function svgToReactComponent(svg: string, componentName = "VectorGraphic"): string {
  const safe = componentName.replace(/[^a-zA-Z0-9_]/g, "") || "VectorGraphic";
  const jsx = optimizeSvgCode(svg)
    .replace(/fill-rule=/g, "fillRule=")
    .replace(/clip-rule=/g, "clipRule=")
    .replace(/stroke-width=/g, "strokeWidth=")
    .replace(/stroke-linecap=/g, "strokeLinecap=")
    .replace(/stroke-linejoin=/g, "strokeLinejoin=")
    .replace(/shape-rendering=/g, "shapeRendering=")
    .replace(/class=/g, "className=")
    .replace(/<svg([^>]*)>/, "<svg$1 {...props}>");
  return (
    'import * as React from "react";\n\nexport function ' +
    safe +
    "(props: React.SVGProps<SVGSVGElement>) {\n  return (\n    " +
    jsx +
    "\n  );\n}\n"
  );
}

export function imageDataToAscii(
  source: RasterPixelData,
  targetWidth = 64,
  invert = false
): string {
  const chars = invert ? " .:-=+*#%@" : "@%#*+=-:. ";
  const ratio = targetWidth / source.width;
  const targetH = Math.max(8, Math.round(source.height * ratio * 0.5));
  const lines: string[] = [];
  for (let y = 0; y < targetH; y++) {
    const sy = Math.min(source.height - 1, Math.floor(y / (ratio * 0.5)));
    let row = "";
    for (let x = 0; x < targetWidth; x++) {
      const sx = Math.min(source.width - 1, Math.floor(x / ratio));
      const i = (sy * source.width + sx) * 4;
      if (source.data[i + 3] < 50) {
        row += " ";
        continue;
      }
      const lum =
        (0.299 * source.data[i] +
          0.587 * source.data[i + 1] +
          0.114 * source.data[i + 2]) /
        255;
      row += chars[Math.min(chars.length - 1, Math.floor(lum * (chars.length - 1)))];
    }
    lines.push(row);
  }
  return lines.join("\n");
}

export function createIcoFromPngBuffers(
  images: { width: number; height: number; pngBytes: Uint8Array }[]
): Uint8Array {
  const headerSize = 6 + images.length * 16;
  const total = headerSize + images.reduce((s, img) => s + img.pngBytes.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, images.length, true);
  let offset = headerSize;
  images.forEach((img, i) => {
    const pos = 6 + i * 16;
    out[pos] = img.width >= 256 ? 0 : img.width;
    out[pos + 1] = img.height >= 256 ? 0 : img.height;
    view.setUint16(pos + 4, 1, true);
    view.setUint16(pos + 6, 32, true);
    view.setUint32(pos + 8, img.pngBytes.length, true);
    view.setUint32(pos + 12, offset, true);
    out.set(img.pngBytes, offset);
    offset += img.pngBytes.length;
  });
  return out;
}
