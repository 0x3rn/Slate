"use client";

import { useState, useEffect, useCallback } from "react";
import {
  VectorizerOptions,
  VectorizeResult,
  RasterPixelData,
  traceImageWithPotrace,
  optimizeSvgCode,
  svgToReactComponent,
  imageDataToAscii,
  createIcoFromPngBuffers,
} from "@/lib/converters/image-vectorizer";
import {
  downloadBlob,
  downloadTextFile,
  downloadZipArchive,
  ZipEntry,
} from "@/lib/zip-archive";
import {
  Image as ImageIcon,
  Upload,
  FileDown,
  Copy,
  FolderArchive,
  Sparkles,
  Code2,
  Layers,
  Loader2,
  ArrowRightLeft,
  Check,
  Lock,
  Unlock,
} from "lucide-react";

interface ImageStudioProps {
  onInsertMarkdown: (mdSnippet: string) => void;
}

const CHECKERBOARD_STYLE: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg, #cbd5e1 25%, transparent 25%), " +
    "linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), " +
    "linear-gradient(45deg, transparent 75%, #cbd5e1 75%), " +
    "linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)",
  backgroundSize: "20px 20px",
  backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0",
  backgroundColor: "#f8fafc",
  minHeight: "260px",
};

const CONTAINED_MEDIA_STYLE: React.CSSProperties = {
  maxWidth: "100%",
  maxHeight: "260px",
  width: "auto",
  height: "auto",
  objectFit: "contain",
  display: "block",
};

function parseSvgIntrinsicDimensions(svgStr: string): { width: number; height: number } {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgStr, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return { width: 512, height: 512 };

    const viewBox = svg.getAttribute("viewBox");
    if (viewBox) {
      const parts = viewBox
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        return { width: Math.round(parts[2]), height: Math.round(parts[3]) };
      }
    }

    const wAttr = parseFloat(svg.getAttribute("width") || "");
    const hAttr = parseFloat(svg.getAttribute("height") || "");
    if (wAttr > 0 && hAttr > 0) {
      return { width: Math.round(wAttr), height: Math.round(hAttr) };
    }
  } catch {
    // fallback
  }
  return { width: 512, height: 512 };
}

function prepareSvgForScale(svgStr: string, targetW: number, targetH: number): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgStr, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg) return svgStr;

    if (!svg.getAttribute("xmlns")) {
      svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    }
    if (!svg.getAttribute("viewBox")) {
      const dims = parseSvgIntrinsicDimensions(svgStr);
      svg.setAttribute("viewBox", "0 0 " + dims.width + " " + dims.height);
    }
    svg.setAttribute("width", String(targetW));
    svg.setAttribute("height", String(targetH));
    return new XMLSerializer().serializeToString(svg);
  } catch {
    return svgStr;
  }
}

function createSampleLogoCanvas(): {
  canvas: HTMLCanvasElement;
  pixelData: RasterPixelData;
  dataUrl: string;
} {
  const size = 280;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = "#4f46e5";
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const x = size / 2 + 102 * Math.cos(angle);
    const y = size / 2 + 102 * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 52, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#10b981";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 28, 0, Math.PI * 2);
  ctx.fill();

  const imgData = ctx.getImageData(0, 0, size, size);
  return {
    canvas,
    pixelData: { width: size, height: size, data: imgData.data },
    dataUrl: canvas.toDataURL("image/png"),
  };
}

export function ImageStudio({ onInsertMarkdown }: ImageStudioProps) {
  const [studioMode, setStudioMode] = useState<"raster-to-svg" | "svg-to-png">(
    "raster-to-svg"
  );

  const [sourceElement, setSourceElement] = useState<
    HTMLImageElement | HTMLCanvasElement | null
  >(null);
  const [raster, setRaster] = useState<RasterPixelData | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [fileName, setFileName] = useState("vectorized-logo");
  const [customSvgOverride, setCustomSvgOverride] = useState<string | null>(null);
  const [isTracing, setIsTracing] = useState(false);
  const [vectorResult, setVectorResult] = useState<VectorizeResult | null>(null);

  const [options, setOptions] = useState<VectorizerOptions>({
    maxColors: 4,
    colorTol: 38,
    alphaMax: 1.0,
    turdSize: 8,
    removeBg: true,
    upscale2x: true,
  });

  const [inspectorTab, setInspectorTab] = useState<
    "preview" | "svg" | "react" | "ascii"
  >("preview");

  // SVG -> PNG state
  const [svgInputCode, setSvgInputCode] = useState<string>("");
  const [svgBaseDims, setSvgBaseDims] = useState<{ width: number; height: number }>({
    width: 280,
    height: 280,
  });
  const [exportWidth, setExportWidth] = useState<number>(560);
  const [exportHeight, setExportHeight] = useState<number>(560);
  const [lockAspect, setLockAspect] = useState<boolean>(true);
  const [exportPadding, setExportPadding] = useState<number>(0);
  const [exportBgMode, setExportBgMode] = useState<
    "transparent" | "white" | "dark" | "custom"
  >("transparent");
  const [exportCustomBg, setExportCustomBg] = useState<string>("#4f46e5");
  const [pngPreviewUrl, setPngPreviewUrl] = useState<string>("");
  const [pngBlobSize, setPngBlobSize] = useState<number>(0);
  const [copiedPng, setCopiedPng] = useState<boolean>(false);
  const [batchStatus, setBatchStatus] = useState<string | null>(null);

  useEffect(() => {
    const sample = createSampleLogoCanvas();
    setSourceElement(sample.canvas);
    setRaster(sample.pixelData);
    setPreviewUrl(sample.dataUrl);
  }, []);

  useEffect(() => {
    if (!sourceElement) return;
    let cancelled = false;
    setIsTracing(true);

    traceImageWithPotrace(sourceElement, options)
      .then((res) => {
        if (!cancelled) {
          setVectorResult(res);
          setCustomSvgOverride(null);
          setSvgInputCode((prev) => (prev ? prev : res.svg));
        }
      })
      .catch(() => {
        console.error("Potrace vectorization failed");
      })
      .finally(() => {
        if (!cancelled) setIsTracing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sourceElement, options]);

  const activeSvg = customSvgOverride ?? vectorResult?.svg ?? "";
  const effectiveSvgForRaster = svgInputCode.trim() || activeSvg;

  // Inject inline max-width/max-height onto preview SVG so it behaves identically to your index.html CSS
  const previewReadySvg = activeSvg.replace(
    /<svg([^>]*)>/,
    '<svg$1 style="max-width:100%;max-height:260px;width:auto;height:auto;display:block;">'
  );

  const renderSvgToBlob = useCallback(
    (
      svgStr: string,
      width: number,
      height: number,
      mimeType: string,
      bgFill: string | null = null,
      padding = 0
    ): Promise<Blob> => {
      return new Promise((resolve, reject) => {
        const safeW = Math.max(16, Math.min(4096, Math.round(width)));
        const safeH = Math.max(16, Math.min(4096, Math.round(height)));
        const pad = Math.max(
          0,
          Math.min(Math.floor(Math.min(safeW, safeH) / 3), padding)
        );
        const drawW = Math.max(8, safeW - pad * 2);
        const drawH = Math.max(8, safeH - pad * 2);

        const scaledSvg = prepareSvgForScale(svgStr, drawW, drawH);
        const img = new window.Image();
        const svgBlob = new Blob([scaledSvg], {
          type: "image/svg+xml;charset=utf-8",
        });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = safeW;
          canvas.height = safeH;
          const ctx = canvas.getContext("2d")!;
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";

          if (bgFill) {
            ctx.fillStyle = bgFill;
            ctx.fillRect(0, 0, safeW, safeH);
          } else if (mimeType === "image/jpeg") {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, safeW, safeH);
          }

          ctx.drawImage(img, pad, pad, drawW, drawH);
          URL.revokeObjectURL(url);
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("Canvas export failed"))),
            mimeType,
            0.95
          );
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Invalid SVG markup"));
        };
        img.src = url;
      });
    },
    []
  );

  const resolvedBgColor =
    exportBgMode === "transparent"
      ? null
      : exportBgMode === "white"
      ? "#ffffff"
      : exportBgMode === "dark"
      ? "#09090b"
      : exportCustomBg;

  useEffect(() => {
    if (studioMode !== "svg-to-png" || !effectiveSvgForRaster.includes("<svg")) return;
    let cancelled = false;
    let createdUrl = "";

    renderSvgToBlob(
      effectiveSvgForRaster,
      exportWidth,
      exportHeight,
      "image/png",
      resolvedBgColor,
      exportPadding
    )
      .then((blob) => {
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setPngPreviewUrl(createdUrl);
        setPngBlobSize(blob.size);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [
    studioMode,
    effectiveSvgForRaster,
    exportWidth,
    exportHeight,
    resolvedBgColor,
    exportPadding,
    renderSvgToBlob,
  ]);

  const loadSvgStringIntoRasterizer = useCallback((rawSvg: string, name?: string) => {
    if (name) setFileName(name);
    setSvgInputCode(rawSvg);
    const dims = parseSvgIntrinsicDimensions(rawSvg);
    setSvgBaseDims(dims);
    setExportWidth(dims.width * 2);
    setExportHeight(dims.height * 2);
    setStudioMode("svg-to-png");
  }, []);

  const loadImageFile = useCallback(
    (file: File) => {
      const baseName = file.name.replace(/\.[^.]+$/, "") || "graphic";
      setFileName(baseName);

      if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            loadSvgStringIntoRasterizer(reader.result, baseName);
          }
        };
        reader.readAsText(file);
        return;
      }

      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      const img = new window.Image();
      img.onload = () => {
        setSourceElement(img);
        const c = document.createElement("canvas");
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const id = ctx.getImageData(0, 0, c.width, c.height);
        setRaster({ width: c.width, height: c.height, data: id.data });
      };
      img.src = url;
    },
    [loadSvgStringIntoRasterizer]
  );

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) loadImageFile(f);
          return;
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [loadImageFile]);

  const applyScalePreset = (mult: number) => {
    setExportWidth(Math.max(16, Math.round(svgBaseDims.width * mult)));
    setExportHeight(Math.max(16, Math.round(svgBaseDims.height * mult)));
  };

  const handleWidthChange = (newW: number) => {
    const clamped = Math.max(16, Math.min(4096, newW || 16));
    setExportWidth(clamped);
    if (lockAspect && svgBaseDims.width > 0) {
      setExportHeight(
        Math.max(16, Math.round((clamped * svgBaseDims.height) / svgBaseDims.width))
      );
    }
  };

  const handleHeightChange = (newH: number) => {
    const clamped = Math.max(16, Math.min(4096, newH || 16));
    setExportHeight(clamped);
    if (lockAspect && svgBaseDims.height > 0) {
      setExportWidth(
        Math.max(16, Math.round((clamped * svgBaseDims.width) / svgBaseDims.height))
      );
    }
  };

  const handleDownloadRaster = async (format: "png" | "webp" | "jpeg") => {
    if (!effectiveSvgForRaster) return;
    const blob = await renderSvgToBlob(
      effectiveSvgForRaster,
      exportWidth,
      exportHeight,
      "image/" + format,
      resolvedBgColor,
      exportPadding
    );
    const ext = format === "jpeg" ? "jpg" : format;
    downloadBlob(blob, fileName + "-" + exportWidth + "x" + exportHeight + "." + ext);
  };

  const handleCopyPngToClipboard = async () => {
    if (!effectiveSvgForRaster) return;
    try {
      const blob = await renderSvgToBlob(
        effectiveSvgForRaster,
        exportWidth,
        exportHeight,
        "image/png",
        resolvedBgColor,
        exportPadding
      );
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopiedPng(true);
      setTimeout(() => setCopiedPng(false), 2000);
    } catch {
      console.error("Copy PNG failed");
    }
  };

  const handleDownloadMultiSizePngZip = async () => {
    if (!effectiveSvgForRaster) return;
    setBatchStatus("Building multi-size PNG + ICO bundle...");
    const sizes = [16, 32, 48, 64, 128, 180, 192, 256, 512, 1024];
    const pngMap = new Map<number, Uint8Array>();

    for (const sz of sizes) {
      const blob = await renderSvgToBlob(
        effectiveSvgForRaster,
        sz,
        sz,
        "image/png",
        resolvedBgColor,
        exportPadding
      );
      pngMap.set(sz, new Uint8Array(await blob.arrayBuffer()));
    }

    const icoBytes = createIcoFromPngBuffers([
      { width: 16, height: 16, pngBytes: pngMap.get(16)! },
      { width: 32, height: 32, pngBytes: pngMap.get(32)! },
      { width: 48, height: 48, pngBytes: pngMap.get(48)! },
    ]);

    const entries: ZipEntry[] = [
      { name: fileName + ".svg", data: optimizeSvgCode(effectiveSvgForRaster) },
      { name: "favicon.ico", data: icoBytes },
      ...sizes.map((sz) => ({
        name: "png/" + fileName + "-" + sz + "x" + sz + ".png",
        data: pngMap.get(sz)!,
      })),
    ];

    downloadZipArchive(entries, fileName + "-png-pack.zip");
    setBatchStatus("Exported PNG Pack (.zip)!");
    setTimeout(() => setBatchStatus(null), 3500);
  };

  const handleBatchSvgToPngZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setBatchStatus("Converting " + files.length + " SVGs to PNG...");

    const entries: ZipEntry[] = [];
    for (const file of files) {
      const svgText = await file.text();
      const dims = parseSvgIntrinsicDimensions(svgText);
      const targetW = exportWidth || dims.width * 2;
      const targetH = exportHeight || dims.height * 2;
      const blob = await renderSvgToBlob(
        svgText,
        targetW,
        targetH,
        "image/png",
        resolvedBgColor,
        exportPadding
      );
      const base = file.name.replace(/\.[^.]+$/, "") || "icon";
      entries.push({
        name: base + "-" + targetW + "x" + targetH + ".png",
        data: new Uint8Array(await blob.arrayBuffer()),
      });
    }

    downloadZipArchive(entries, "batch-svg-to-png.zip");
    setBatchStatus("Exported " + entries.length + " PNGs (.zip)!");
    setTimeout(() => setBatchStatus(null), 4000);
  };

  const handleBatchVectorizeZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setBatchStatus("Tracing " + files.length + " images to SVG...");

    const entries: ZipEntry[] = [];
    for (const file of files) {
      const img = await new Promise<HTMLImageElement>((res) => {
        const url = URL.createObjectURL(file);
        const i = new window.Image();
        i.onload = () => res(i);
        i.src = url;
      });

      const traced = await traceImageWithPotrace(img, options);
      const base = file.name.replace(/\.[^.]+$/, "") || "vector";
      entries.push({ name: base + ".svg", data: traced.svg });
    }

    downloadZipArchive(entries, "batch-traced-vectors.zip");
    setBatchStatus("Exported " + entries.length + " SVGs (.zip)!");
    setTimeout(() => setBatchStatus(null), 4000);
  };

  const reactCode = activeSvg ? svgToReactComponent(activeSvg, "SlateVectorIcon") : "";
  const asciiArt = raster ? imageDataToAscii(raster, 68, false) : "";

  return (
    <div className="flex flex-1 flex-col overflow-y-auto lg:overflow-hidden bg-background">
      {/* Top Studio Bar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border bg-card/60 px-4 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg bg-muted/70 p-0.5">
            <button
              onClick={() => setStudioMode("raster-to-svg")}
              className={
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all " +
                (studioMode === "raster-to-svg"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
              PNG / JPG &rarr; SVG
            </button>
            <button
              onClick={() => {
                if (!svgInputCode && activeSvg) {
                  loadSvgStringIntoRasterizer(activeSvg, fileName);
                } else {
                  setStudioMode("svg-to-png");
                }
              }}
              className={
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all " +
                (studioMode === "svg-to-png"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              <ArrowRightLeft className="h-3.5 w-3.5 text-blue-500" />
              SVG &rarr; PNG / WebP / JPG
            </button>
          </div>

          {studioMode === "raster-to-svg" ? (
            <>
              <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90">
                <Upload className="h-3.5 w-3.5" />
                <span>Upload PNG / JPG</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    e.target.files?.[0] && loadImageFile(e.target.files[0])
                  }
                  className="hidden"
                />
              </label>

              <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium hover:bg-accent">
                <FolderArchive className="h-3.5 w-3.5" />
                <span>Batch PNG/JPG &rarr; SVG (.zip)</span>
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleBatchVectorizeZip}
                  className="hidden"
                />
              </label>
            </>
          ) : (
            <>
              <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90">
                <Upload className="h-3.5 w-3.5" />
                <span>Upload .SVG File</span>
                <input
                  type="file"
                  accept=".svg,image/svg+xml"
                  onChange={(e) =>
                    e.target.files?.[0] && loadImageFile(e.target.files[0])
                  }
                  className="hidden"
                />
              </label>

              <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium hover:bg-accent">
                <FolderArchive className="h-3.5 w-3.5" />
                <span>Batch .SVG &rarr; .PNG (.zip)</span>
                <input
                  type="file"
                  multiple
                  accept=".svg,image/svg+xml"
                  onChange={handleBatchSvgToPngZip}
                  className="hidden"
                />
              </label>
            </>
          )}

          {isTracing && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Tracing...
            </span>
          )}
          {batchStatus && (
            <span className="text-xs font-medium text-emerald-500">{batchStatus}</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {studioMode === "raster-to-svg" && activeSvg && (
            <>
              <button
                onClick={() => loadSvgStringIntoRasterizer(activeSvg, fileName)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium hover:bg-accent"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Convert SVG &rarr; PNG
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(activeSvg)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium hover:bg-accent"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy SVG
              </button>
              <button
                onClick={() =>
                  downloadTextFile(activeSvg, fileName + ".svg", "image/svg+xml")
                }
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-500"
              >
                <FileDown className="h-3.5 w-3.5" />
                Download .SVG
              </button>
            </>
          )}

          {studioMode === "svg-to-png" && effectiveSvgForRaster && (
            <>
              <button
                onClick={handleCopyPngToClipboard}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium hover:bg-accent"
              >
                {copiedPng ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span>{copiedPng ? "Copied PNG!" : "Copy PNG"}</span>
              </button>
              <button
                onClick={() => handleDownloadRaster("png")}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-500"
              >
                <FileDown className="h-3.5 w-3.5" />
                Download .PNG ({exportWidth}&times;{exportHeight})
              </button>
              <button
                onClick={handleDownloadMultiSizePngZip}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium hover:bg-accent"
              >
                <FolderArchive className="h-3.5 w-3.5" />
                All Sizes (.zip)
              </button>
            </>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* MODE 1: PNG / JPG -> SVG (Potrace Wasm Vectorizer)                  */}
      {/* =================================================================== */}
      {studioMode === "raster-to-svg" && (
        <div className="flex flex-col lg:grid lg:flex-1 lg:grid-cols-12 lg:overflow-hidden">
          <div className="flex shrink-0 flex-col gap-3.5 border-b border-border bg-card/30 p-4 lg:col-span-3 lg:overflow-y-auto lg:border-b-0 lg:border-r">
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-medium text-muted-foreground">
                  Max Colors (Auto-Clusters)
                </span>
                <span className="font-mono font-semibold text-foreground">
                  {options.maxColors}
                </span>
              </div>
              <input
                type="range"
                min={2}
                max={12}
                step={1}
                value={options.maxColors}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, maxColors: Number(e.target.value) }))
                }
                className="w-full"
              />
            </div>

            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-medium text-muted-foreground">
                  Color Merge Tolerance
                </span>
                <span className="font-mono font-semibold text-foreground">
                  {options.colorTol}
                </span>
              </div>
              <input
                type="range"
                min={15}
                max={80}
                step={1}
                value={options.colorTol}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, colorTol: Number(e.target.value) }))
                }
                className="w-full"
              />
            </div>

            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-medium text-muted-foreground">
                  Corner Sharpness (AlphaMax)
                </span>
                <span className="font-mono font-semibold text-foreground">
                  {options.alphaMax.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0.0}
                max={1.34}
                step={0.05}
                value={options.alphaMax}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, alphaMax: Number(e.target.value) }))
                }
                className="w-full"
              />
            </div>

            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-medium text-muted-foreground">
                  Speckle Filter (TurdSize)
                </span>
                <span className="font-mono font-semibold text-foreground">
                  {options.turdSize}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={30}
                step={1}
                value={options.turdSize}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, turdSize: Number(e.target.value) }))
                }
                className="w-full"
              />
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={options.removeBg}
                  onChange={(e) =>
                    setOptions((o) => ({ ...o, removeBg: e.target.checked }))
                  }
                />
                Remove Background Color
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={options.upscale2x}
                  onChange={(e) =>
                    setOptions((o) => ({ ...o, upscale2x: e.target.checked }))
                  }
                />
                2x Sub-Pixel Super-Sampling
              </label>
            </div>

            {vectorResult && (
              <div className="mt-auto rounded-lg border border-border bg-muted/40 p-3 text-xs">
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">Dimensions:</span>
                  <span className="font-mono">
                    {vectorResult.width} &times; {vectorResult.height}px
                  </span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">Vector Paths:</span>
                  <span className="font-mono">{vectorResult.pathCount}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-muted-foreground">SVG Size:</span>
                  <span className="font-mono">
                    {(activeSvg.length / 1024).toFixed(1)} KB
                  </span>
                </div>
              </div>
            )}
          </div>

          <div
            className="flex flex-col lg:col-span-9 lg:overflow-y-auto"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) loadImageFile(f);
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2">
              <div className="flex max-w-full items-center gap-1 overflow-x-auto whitespace-nowrap rounded-lg bg-muted/60 p-0.5">
                {(
                  [
                    { id: "preview", label: "Side-by-Side Preview", icon: Layers },
                    { id: "svg", label: "Editable SVG Code", icon: Code2 },
                    { id: "react", label: "React .TSX", icon: Sparkles },
                    { id: "ascii", label: "ASCII Art", icon: ImageIcon },
                  ] as const
                ).map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setInspectorTab(tab.id)}
                      className={
                        "inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all " +
                        (inspectorTab === tab.id
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground")
                      }
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {activeSvg && (
                <button
                  onClick={() => {
                    const b64 =
                      "data:image/svg+xml;utf8," +
                      encodeURIComponent(optimizeSvgCode(activeSvg));
                    onInsertMarkdown("![" + fileName + "](" + b64 + ")");
                  }}
                  className="text-xs font-medium text-blue-500 hover:underline"
                >
                  Insert SVG into Markdown
                </button>
              )}
            </div>

            {inspectorTab === "preview" && (
              <div className="grid grid-cols-1 gap-5 p-4 pb-12 md:grid-cols-2 md:p-6">
                {/* Original Raster Card */}
                <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3 text-xs font-semibold">
                    <span>Original Raster Image</span>
                    {vectorResult && (
                      <span className="font-mono font-normal text-muted-foreground">
                        {vectorResult.width} &times; {vectorResult.height}px
                      </span>
                    )}
                  </div>
                  <div
                    className="flex items-center justify-center p-5"
                    style={CHECKERBOARD_STYLE}
                  >
                    {previewUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewUrl}
                        alt="Original Raster"
                        style={CONTAINED_MEDIA_STYLE}
                      />
                    )}
                  </div>
                </div>

                {/* Vectorized SVG Card */}
                <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3 text-xs font-semibold">
                    <span>Vectorized SVG Output</span>
                    <div className="flex items-center gap-1.5">
                      {vectorResult?.palette.map((hex) => (
                        <span
                          key={hex}
                          title={hex}
                          className="h-4 w-4 rounded border border-black/20"
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  </div>
                  <div
                    className="flex items-center justify-center p-5"
                    style={CHECKERBOARD_STYLE}
                    dangerouslySetInnerHTML={{
                      __html: isTracing
                        ? '<span style="color:#475569;font-weight:600;font-size:13px;">Tracing vector paths...</span>'
                        : previewReadySvg,
                    }}
                  />
                </div>
              </div>
            )}

            {inspectorTab === "svg" && (
              <div className="flex min-h-[360px] flex-1 flex-col">
                <div className="flex items-center justify-between border-b border-border bg-muted/20 px-4 py-1.5">
                  <span className="text-[11px] text-muted-foreground">
                    Generated Potrace Wasm &lt;svg&gt; code (editable)
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(activeSvg)}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy SVG
                  </button>
                </div>
                <textarea
                  value={activeSvg}
                  onChange={(e) => setCustomSvgOverride(e.target.value)}
                  className="min-h-[320px] flex-1 resize-none bg-transparent p-4 font-mono text-xs leading-relaxed focus:outline-none"
                  spellCheck={false}
                />
              </div>
            )}

            {inspectorTab === "react" && (
              <div className="flex min-h-[360px] flex-1 flex-col">
                <div className="flex items-center justify-end gap-3 border-b border-border px-4 py-1.5">
                  <button
                    onClick={() => navigator.clipboard.writeText(reactCode)}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy React .TSX
                  </button>
                  <button
                    onClick={() => downloadTextFile(reactCode, "SlateVectorIcon.tsx")}
                    className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline"
                  >
                    Download .tsx
                  </button>
                </div>
                <textarea
                  readOnly
                  value={reactCode}
                  className="min-h-[320px] flex-1 resize-none bg-transparent p-4 font-mono text-xs leading-relaxed focus:outline-none"
                />
              </div>
            )}

            {inspectorTab === "ascii" && (
              <div className="flex min-h-[360px] flex-1 flex-col">
                <div className="flex items-center justify-end gap-2 border-b border-border px-4 py-1.5">
                  <button
                    onClick={() => {
                      const fence = "\x60\x60\x60";
                      onInsertMarkdown(fence + "text\n" + asciiArt + "\n" + fence);
                    }}
                    className="text-xs font-medium text-blue-500 hover:underline"
                  >
                    Send ASCII Art to Markdown Editor
                  </button>
                </div>
                <pre className="flex-1 overflow-auto p-4 font-mono text-[10px] leading-none">
                  {asciiArt}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODE 2: Dedicated SVG -> PNG / WebP / JPG Converter                 */}
      {/* =================================================================== */}
      {studioMode === "svg-to-png" && (
        <div
          className="flex flex-col lg:grid lg:flex-1 lg:grid-cols-12 lg:overflow-hidden"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) loadImageFile(f);
          }}
        >
          <div className="flex shrink-0 flex-col gap-4 border-b border-border bg-card/30 p-4 lg:col-span-3 lg:overflow-y-auto lg:border-b-0 lg:border-r">
            <div>
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Quick Resolution Scale
              </span>
              <div className="grid grid-cols-5 gap-1">
                {[1, 2, 4, 8, 16].map((mult) => (
                  <button
                    key={mult}
                    onClick={() => applyScalePreset(mult)}
                    className={
                      "rounded-md border py-1.5 font-mono text-xs font-medium transition-all " +
                      (exportWidth === Math.round(svgBaseDims.width * mult)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-accent")
                    }
                  >
                    {mult}x
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Output Dimensions (px)
                </span>
                <button
                  onClick={() => setLockAspect((l) => !l)}
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  {lockAspect ? (
                    <Lock className="h-3 w-3 text-blue-500" />
                  ) : (
                    <Unlock className="h-3 w-3" />
                  )}
                  <span>{lockAspect ? "Locked" : "Unlocked"}</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] text-muted-foreground">
                    Width (px)
                  </label>
                  <input
                    type="number"
                    min={16}
                    max={4096}
                    value={exportWidth}
                    onChange={(e) => handleWidthChange(Number(e.target.value))}
                    className="h-8 w-full rounded-md border border-border bg-background px-2 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] text-muted-foreground">
                    Height (px)
                  </label>
                  <input
                    type="number"
                    min={16}
                    max={4096}
                    value={exportHeight}
                    onChange={(e) => handleHeightChange(Number(e.target.value))}
                    className="h-8 w-full rounded-md border border-border bg-background px-2 font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-medium text-muted-foreground">Outer Padding</span>
                <span className="font-mono font-semibold text-foreground">
                  {exportPadding}px
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={120}
                step={4}
                value={exportPadding}
                onChange={(e) => setExportPadding(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Background Fill
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: "transparent", label: "Transparent" },
                    { id: "white", label: "White (#FFF)" },
                    { id: "dark", label: "Dark (#09090B)" },
                    { id: "custom", label: "Custom Color" },
                  ] as const
                ).map((bg) => (
                  <button
                    key={bg.id}
                    onClick={() => setExportBgMode(bg.id)}
                    className={
                      "rounded-md border px-2 py-1.5 text-xs font-medium " +
                      (exportBgMode === bg.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-accent")
                    }
                  >
                    {bg.label}
                  </button>
                ))}
              </div>
              {exportBgMode === "custom" && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="color"
                    value={exportCustomBg}
                    onChange={(e) => setExportCustomBg(e.target.value)}
                    className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
                  />
                  <input
                    type="text"
                    value={exportCustomBg}
                    onChange={(e) => setExportCustomBg(e.target.value)}
                    className="h-8 flex-1 rounded-md border border-border bg-background px-2 font-mono text-xs"
                  />
                </div>
              )}
            </div>

            <div className="border-t border-border pt-3">
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Download Format
              </span>
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => handleDownloadRaster("png")}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-500"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Download .PNG ({exportWidth}&times;{exportHeight})
                </button>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => handleDownloadRaster("webp")}
                    className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-border bg-background text-xs font-medium hover:bg-accent"
                  >
                    <FileDown className="h-3 w-3" /> .WebP
                  </button>
                  <button
                    onClick={() => handleDownloadRaster("jpeg")}
                    className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-border bg-background text-xs font-medium hover:bg-accent"
                  >
                    <FileDown className="h-3 w-3" /> .JPG
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-auto rounded-lg border border-border bg-muted/40 p-3 text-xs">
              <div className="flex justify-between py-0.5">
                <span className="text-muted-foreground">Intrinsic SVG:</span>
                <span className="font-mono">
                  {svgBaseDims.width} &times; {svgBaseDims.height}
                </span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-muted-foreground">PNG Output:</span>
                <span className="font-mono font-semibold text-blue-500">
                  {exportWidth} &times; {exportHeight}px
                </span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-muted-foreground">Est. PNG Size:</span>
                <span className="font-mono">
                  {pngBlobSize > 0 ? (pngBlobSize / 1024).toFixed(1) + " KB" : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 p-4 pb-12 md:grid-cols-2 md:p-6 lg:col-span-9 lg:overflow-y-auto">
            <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between border-b border-border px-4 py-3 text-xs font-semibold">
                <span>Source &lt;SVG&gt; Markup (Paste or Edit)</span>
                <button
                  onClick={() => {
                    const dims = parseSvgIntrinsicDimensions(effectiveSvgForRaster);
                    setSvgBaseDims(dims);
                    setExportWidth(dims.width * 2);
                    setExportHeight(dims.height * 2);
                  }}
                  className="text-[11px] font-medium text-blue-500 hover:underline"
                >
                  Auto-Fit Dimensions
                </button>
              </div>
              <textarea
                value={effectiveSvgForRaster}
                onChange={(e) => {
                  const val = e.target.value;
                  setSvgInputCode(val);
                  if (val.includes("<svg")) {
                    const dims = parseSvgIntrinsicDimensions(val);
                    setSvgBaseDims(dims);
                  }
                }}
                placeholder="Paste your <svg>...</svg> code here or upload an .svg file..."
                className="min-h-[260px] flex-1 resize-none bg-transparent p-4 font-mono text-xs leading-relaxed focus:outline-none"
                spellCheck={false}
              />
            </div>

            <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between border-b border-border px-4 py-3 text-xs font-semibold">
                <span>Live Rasterized .PNG Preview</span>
                <span className="font-mono font-normal text-muted-foreground">
                  {exportWidth} &times; {exportHeight}px
                </span>
              </div>
              <div
                className="flex items-center justify-center p-5"
                style={CHECKERBOARD_STYLE}
              >
                {pngPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pngPreviewUrl}
                    alt="Rendered PNG Preview"
                    style={CONTAINED_MEDIA_STYLE}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Paste valid &lt;svg&gt; code or upload an .svg file to preview PNG
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
