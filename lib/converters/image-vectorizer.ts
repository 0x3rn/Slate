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

async function getPotraceWasm(): Promise<PotraceModule> {
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

function colorDist(c1: number[], c2: number[]): number {
  const dr = c1[0] - c2[0];
  const dg = c1[1] - c2[1];
  const db = c1[2] - c2[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function rgbToHex(rgb: number[]): string {
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

export async function traceImageWithPotrace(
  loadedImage: HTMLImageElement | HTMLCanvasElement,
  options: VectorizerOptions
): Promise<VectorizeResult> {
  const mod = await getPotraceWasm();
  const { potrace } = mod;

  const origW = Math.max(1, loadedImage.width);
  const origH = Math.max(1, loadedImage.height);

  // Cap working canvas at 1024px max so W*H*4 stays safely inside Wasm's 16MB heap
  const desiredScale = options.upscale2x ? 2 : 1;
  const maxWasmDim = 1024;
  const rawW = origW * desiredScale;
  const rawH = origH * desiredScale;
  const clampRatio = Math.min(1, maxWasmDim / Math.max(rawW, rawH, 1));

  const w = Math.max(16, Math.round(rawW * clampRatio));
  const h = Math.max(16, Math.round(rawH * clampRatio));
  const effectiveScaleX = w / origW;
  const effectiveScaleY = h / origH;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(loadedImage, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Step 1: Detect background color from the 4 corners
  const cornerIndices = [
    0,
    (w - 1) * 4,
    (h - 1) * w * 4,
    ((h - 1) * w + (w - 1)) * 4,
  ];
  const bgColor = [
    Math.round(cornerIndices.reduce((s, i) => s + data[i], 0) / 4),
    Math.round(cornerIndices.reduce((s, i) => s + data[i + 1], 0) / 4),
    Math.round(cornerIndices.reduce((s, i) => s + data[i + 2], 0) / 4),
  ];

  // Step 2: Sample flat interior pixels (skip anti-aliased transition edges)
  const colorBuckets: { color: number[]; sum: number[]; count: number }[] = [];
  const mergeTol = options.colorTol;
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 40000)));

  for (let y = 1; y < h - 1; y += step) {
    for (let x = 1; x < w - 1; x += step) {
      const idx = (y * w + x) * 4;
      const c = [data[idx], data[idx + 1], data[idx + 2]];

      const idxR = (y * w + (x + 1)) * 4;
      const idxD = ((y + 1) * w + x) * 4;
      const grad =
        Math.abs(c[0] - data[idxR]) +
        Math.abs(c[1] - data[idxR + 1]) +
        Math.abs(c[2] - data[idxR + 2]) +
        Math.abs(c[0] - data[idxD]) +
        Math.abs(c[1] - data[idxD + 1]) +
        Math.abs(c[2] - data[idxD + 2]);

      if (grad > 18) continue;

      let found = false;
      for (const bucket of colorBuckets) {
        if (colorDist(c, bucket.color) < mergeTol) {
          bucket.sum[0] += c[0];
          bucket.sum[1] += c[1];
          bucket.sum[2] += c[2];
          bucket.count++;
          bucket.color[0] = bucket.sum[0] / bucket.count;
          bucket.color[1] = bucket.sum[1] / bucket.count;
          bucket.color[2] = bucket.sum[2] / bucket.count;
          found = true;
          break;
        }
      }
      if (!found) {
        colorBuckets.push({
          color: [...c],
          sum: [...c],
          count: 1,
        });
      }
    }
  }

  colorBuckets.sort((a, b) => b.count - a.count);
  const maxColors = options.maxColors;
  const palette = colorBuckets
    .filter((b) => b.count > 5)
    .slice(0, maxColors)
    .map((b) => b.color.map(Math.round));

  if (!palette.some((c) => colorDist(c, bgColor) < mergeTol)) {
    palette.unshift(bgColor);
  }

  // Step 3: Assign every pixel to its closest flat color
  const totalPixels = w * h;
  const assignments = new Uint8Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const p = [data[idx], data[idx + 1], data[idx + 2]];

    let bestIdx = 0;
    let bestDist = Infinity;
    for (let k = 0; k < palette.length; k++) {
      const d = colorDist(p, palette[k]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = k;
      }
    }
    assignments[i] = bestIdx;
  }

  // Step 4: Trace each foreground color mask with Potrace Wasm
  const parser = new DOMParser();
  const masterSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  masterSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  masterSvg.setAttribute("viewBox", "0 0 " + origW + " " + origH);
  masterSvg.setAttribute("width", String(origW));
  masterSvg.setAttribute("height", String(origH));

  const paletteSwatches: string[] = [];
  let totalPathCount = 0;

  if (!options.removeBg) {
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

  for (let k = 0; k < palette.length; k++) {
    const color = palette[k];
    const isBg = colorDist(color, bgColor) < mergeTol * 0.85;
    if (isBg) continue;

    const hex = rgbToHex(color);
    paletteSwatches.push(hex);

    for (let i = 0; i < totalPixels; i++) {
      const mIdx = i * 4;
      const val = assignments[i] === k ? 0 : 255;
      maskData[mIdx] = val;
      maskData[mIdx + 1] = val;
      maskData[mIdx + 2] = val;
      maskData[mIdx + 3] = 255;
    }
    maskCtx.putImageData(maskImgData, 0, 0);

    let rawLayerSvg = "";
    try {
      rawLayerSvg = await potrace(maskCanvas, {
        turdsize: Math.max(1, Math.round(options.turdSize * effectiveScaleX)),
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
        turdsize: Math.max(1, Math.round(options.turdSize * effectiveScaleX)),
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
    if (potraceGroup && potraceGroup.hasAttribute("transform")) {
      const sx = Number((0.1 / effectiveScaleX).toFixed(6));
      const sy = Number((0.1 / effectiveScaleY).toFixed(6));
      layerGroup.setAttribute(
        "transform",
        "translate(0, " + origH + ") scale(" + sx + ", -" + sy + ")"
      );
    } else {
      const sx = Number((1 / effectiveScaleX).toFixed(6));
      const sy = Number((1 / effectiveScaleY).toFixed(6));
      layerGroup.setAttribute("transform", "scale(" + sx + ", " + sy + ")");
    }

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
