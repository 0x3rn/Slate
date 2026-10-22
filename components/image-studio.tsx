"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  VectorizerOptions,
  VectorizeResult,
  RasterPixelData,
  traceImageWithPotrace,
  parseSvgDimensions,
  isWhiteFill,
  getElementFill,
  stripWhiteBackground,
  optimizeSvgCode,
  svgToReactComponent,
  imageDataToAscii,
  createIcoFromPngBuffers,
} from "@/lib/converters/image-vectorizer";
import { generateNativePdfFromSvgs } from "@/lib/pdf-export";
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

  // Raster -> SVG state (using lifted picture-to-svg.html defaults)
  const [sourceElement, setSourceElement] = useState<
    HTMLImageElement | HTMLCanvasElement | null
  >(null);
  const [raster, setRaster] = useState<RasterPixelData | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [fileName, setFileName] = useState("vectorized-logo");
  const [customSvgOverride, setCustomSvgOverride] = useState<string | null>(null);
  const [isTracing, setIsTracing] = useState(false);
  const [traceError, setTraceError] = useState<string | null>(null);
  const [vectorResult, setVectorResult] = useState<VectorizeResult | null>(null);

  const [options, setOptions] = useState<VectorizerOptions>({
    maxColors: 16,
    colorTol: 16,
    alphaMax: 1.0,
    turdSize: 8,
    removeBg: false,
    upscale2x: true,
  });

  const [inspectorTab, setInspectorTab] = useState<
    "preview" | "svg" | "react" | "ascii"
  >("preview");

  // SVG -> Picture state (using lifted svg-to-picture.html mechanics)
  const [svgInputCode, setSvgInputCode] = useState<string>("");
  const [svgBaseDims, setSvgBaseDims] = useState<{ width: number; height: number }>({
    width: 280,
    height: 280,
  });
  const [scaleSelect, setScaleSelect] = useState<string>("2");
  const [exportWidth, setExportWidth] = useState<number>(560);
  const [exportHeight, setExportHeight] = useState<number>(560);
  const [exportFormat, setExportFormat] = useState<
    "image/png" | "image/webp" | "image/jpeg"
  >("image/png");
  const [exportBgMode, setExportBgMode] = useState<"keep" | "transparent" | "custom">(
    "keep"
  );
  const [exportCustomBg, setExportCustomBg] = useState<string>("#ffffff");
  const [viewerBackdrop, setViewerBackdrop] = useState<
    "bg-checker" | "bg-dark" | "bg-light"
  >("bg-checker");
  const [viewerZoom, setViewerZoom] = useState<number>(100);
  const [svgValidStatus, setSvgValidStatus] = useState<{ text: string; ok: boolean }>({
    text: "● Valid SVG",
    ok: true,
  });
  const [pngPreviewUrl, setPngPreviewUrl] = useState<string>("");
  const [pngBlobSize, setPngBlobSize] = useState<number>(0);
  const [copiedPng, setCopiedPng] = useState<boolean>(false);
  const [batchStatus, setBatchStatus] = useState<string | null>(null);
  const renderIdRef = useRef<number>(0);

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
    setTraceError(null);

    traceImageWithPotrace(sourceElement, options)
      .then((res) => {
        if (!cancelled) {
          setVectorResult(res);
          setCustomSvgOverride(null);
          setSvgInputCode((prev) => (prev ? prev : res.svg));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setTraceError(err instanceof Error ? err.message : "Tracing failed");
        }
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

  const previewReadySvg = activeSvg.replace(
    /<svg([^>]*)>/,
    '<svg$1 style="max-width:100%;max-height:260px;width:auto;height:auto;display:block;">'
  );

  // Lifted SVG-to-Picture rendering engine (with white BG flood-fill stripper & destination-over composite)
  const renderSvgToBlob = useCallback(
    (
      svgStr: string,
      width: number,
      height: number,
      mimeType: "image/png" | "image/webp" | "image/jpeg",
      bgModeVal: "keep" | "transparent" | "custom",
      customHex: string
    ): Promise<Blob> => {
      return new Promise((resolve, reject) => {
        const parsed = parseSvgDimensions(svgStr);
        if (!parsed) {
          reject(new Error("Invalid SVG XML"));
          return;
        }

        const targetW = Math.max(16, Math.min(10000, Math.round(width || parsed.w)));
        const targetH = Math.max(16, Math.min(10000, Math.round(height || parsed.h)));
        const { svgEl } = parsed;

        svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        if (!svgEl.hasAttribute("viewBox")) {
          svgEl.setAttribute("viewBox", "0 0 " + parsed.w + " " + parsed.h);
        }
        svgEl.setAttribute("width", String(targetW));
        svgEl.setAttribute("height", String(targetH));

        if (bgModeVal === "transparent" || bgModeVal === "custom") {
          svgEl.querySelectorAll(":scope > rect").forEach((rect) => {
            const rw = rect.getAttribute("width") || "";
            const rh = rect.getAttribute("height") || "";
            const fullW = rw === "100%" || parseFloat(rw) >= parsed.w * 0.98;
            const fullH = rh === "100%" || parseFloat(rh) >= parsed.h * 0.98;
            if (
              fullW &&
              fullH &&
              (bgModeVal === "custom" || isWhiteFill(getElementFill(rect)))
            ) {
              rect.remove();
            }
          });
        }

        const serialized = new XMLSerializer().serializeToString(svgEl);
        const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);

        const img = new window.Image();
        img.onload = () => {
          URL.revokeObjectURL(url);
          const canvas = document.createElement("canvas");
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
          ctx.clearRect(0, 0, targetW, targetH);
          ctx.drawImage(img, 0, 0, targetW, targetH);

          if (bgModeVal === "transparent" || bgModeVal === "custom") {
            stripWhiteBackground(ctx, targetW, targetH);
          }

          if (bgModeVal === "custom" || mimeType === "image/jpeg") {
            ctx.globalCompositeOperation = "destination-over";
            ctx.fillStyle = bgModeVal === "custom" ? customHex : "#ffffff";
            ctx.fillRect(0, 0, targetW, targetH);
            ctx.globalCompositeOperation = "source-over";
          }

          canvas.toBlob(
            (out) => (out ? resolve(out) : reject(new Error("Canvas export failed"))),
            mimeType,
            0.98
          );
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("SVG failed to render"));
        };
        img.src = url;
      });
    },
    []
  );

  useEffect(() => {
    if (studioMode !== "svg-to-png") return;
    const myRender = ++renderIdRef.current;
    const parsed = parseSvgDimensions(effectiveSvgForRaster);
    if (!parsed) {
      setSvgValidStatus({ text: "⚠️ Invalid SVG XML", ok: false });
      return;
    }
    setSvgValidStatus({ text: "● Valid SVG", ok: true });
    setSvgBaseDims({ width: parsed.w, height: parsed.h });

    let createdUrl = "";
    const timer = setTimeout(() => {
      renderSvgToBlob(
        effectiveSvgForRaster,
        exportWidth,
        exportHeight,
        exportFormat,
        exportBgMode,
        exportCustomBg
      )
        .then((blob) => {
          if (myRender !== renderIdRef.current) return;
          createdUrl = URL.createObjectURL(blob);
          setPngPreviewUrl(createdUrl);
          setPngBlobSize(blob.size);
        })
        .catch(() => {
          if (myRender === renderIdRef.current) {
            setSvgValidStatus({ text: "⚠️ SVG failed to render", ok: false });
          }
        });
    }, 120);

    return () => {
      clearTimeout(timer);
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [
    studioMode,
    effectiveSvgForRaster,
    exportWidth,
    exportHeight,
    exportFormat,
    exportBgMode,
    exportCustomBg,
    renderSvgToBlob,
  ]);

  const loadSvgStringIntoRasterizer = useCallback(
    (rawSvg: string, name?: string) => {
      if (name) setFileName(name);
      setSvgInputCode(rawSvg);
      const parsed = parseSvgDimensions(rawSvg);
      if (parsed) {
        const s = parseFloat(scaleSelect) || 1;
        setSvgBaseDims({ width: parsed.w, height: parsed.h });
        setExportWidth(Math.round(parsed.w * s));
        setExportHeight(Math.round(parsed.h * s));
      }
      setStudioMode("svg-to-png");
    },
    [scaleSelect]
  );

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

  const applyScalePreset = (scaleStr: string) => {
    setScaleSelect(scaleStr);
    const mult = parseFloat(scaleStr) || 1;
    setExportWidth(Math.max(16, Math.round(svgBaseDims.width * mult)));
    setExportHeight(Math.max(16, Math.round(svgBaseDims.height * mult)));
  };

  const handleWidthChange = (newW: number) => {
    const clamped = Math.max(16, Math.min(10000, newW || svgBaseDims.width));
    const ratio = svgBaseDims.height / (svgBaseDims.width || 1);
    setExportWidth(clamped);
    setExportHeight(Math.max(16, Math.round(clamped * ratio)));
  };

  const handleHeightChange = (newH: number) => {
    const clamped = Math.max(16, Math.min(10000, newH || svgBaseDims.height));
    const ratio = svgBaseDims.width / (svgBaseDims.height || 1);
    setExportHeight(clamped);
    setExportWidth(Math.max(16, Math.round(clamped * ratio)));
  };

  const handleDownloadRaster = async (
    fmt: "image/png" | "image/webp" | "image/jpeg" = exportFormat
  ) => {
    if (!effectiveSvgForRaster) return;
    const blob = await renderSvgToBlob(
      effectiveSvgForRaster,
      exportWidth,
      exportHeight,
      fmt,
      exportBgMode,
      exportCustomBg
    );
    const ext = fmt === "image/jpeg" ? "jpeg" : fmt.split("/")[1];
    downloadBlob(
      blob,
      "rendered-image-" + exportWidth + "x" + exportHeight + "." + ext
    );
  };

  const handleCopyPngToClipboard = async () => {
    if (!effectiveSvgForRaster) return;
    try {
      const blob = await renderSvgToBlob(
        effectiveSvgForRaster,
        exportWidth,
        exportHeight,
        "image/png",
        exportBgMode,
        exportCustomBg
      );
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopiedPng(true);
      setTimeout(() => setCopiedPng(false), 1800);
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
        exportBgMode,
        exportCustomBg
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
    setBatchStatus("Converting " + files.length + " SVGs to Picture...");

    const entries: ZipEntry[] = [];
    for (const file of files) {
      const svgText = await file.text();
      const parsed = parseSvgDimensions(svgText);
      const mult = parseFloat(scaleSelect) || 1;
      const targetW = parsed ? Math.round(parsed.w * mult) : exportWidth;
      const targetH = parsed ? Math.round(parsed.h * mult) : exportHeight;
      const blob = await renderSvgToBlob(
        svgText,
        targetW,
        targetH,
        exportFormat,
        exportBgMode,
        exportCustomBg
      );
      const ext = exportFormat.split("/")[1];
      const base = file.name.replace(/\.[^.]+$/, "") || "icon";
      entries.push({
        name: base + "-" + targetW + "x" + targetH + "." + ext,
        data: new Uint8Array(await blob.arrayBuffer()),
      });
    }

    downloadZipArchive(entries, "batch-svg-to-picture.zip");
    setBatchStatus("Exported " + entries.length + " pictures (.zip)!");
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
      {/* Top Studio Bar (Slate's Native Layout & Theme) */}
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
              <ImageIcon className="h-3.5 w-3.5 text-indigo-400" />
              Picture to SVG
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
              SVG to Picture
            </button>
          </div>

          {studioMode === "raster-to-svg" ? (
            <>
              <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90">
                <Upload className="h-3.5 w-3.5" />
                <span>Upload Image</span>
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
                <span>Load .SVG File</span>
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
                <span>Batch .SVG &rarr; Picture (.zip)</span>
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
              Tracing vector paths...
            </span>
          )}
          {traceError && (
            <span className="text-xs font-medium text-destructive">{traceError}</span>
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
                Convert SVG &rarr; Picture
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
                <span>{copiedPng ? "Copied Picture!" : "Copy Picture (PNG)"}</span>
              </button>
              <button
                onClick={() => handleDownloadRaster(exportFormat)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-500"
              >
                <FileDown className="h-3.5 w-3.5" />
                Download Picture ({exportWidth}&times;{exportHeight})
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
      {/* MODE 1: PICTURE TO SVG (Slate Layout + Lifted Engine)               */}
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
                min={1}
                max={32}
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
                min={2}
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

                <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3 text-xs font-semibold">
                    <span>Vectorized SVG Output</span>
                    <div className="flex items-center gap-1.5">
                      {vectorResult?.palette.map((hex, i) => (
                        <span
                          key={hex + i}
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
      {/* MODE 2: SVG TO PICTURE (Slate Layout + Lifted svg-to-picture Engine)*/}
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
          <div className="flex shrink-0 flex-col gap-3.5 border-b border-border bg-card/30 p-4 lg:col-span-3 lg:overflow-y-auto lg:border-b-0 lg:border-r">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Output Format
              </label>
              <select
                value={exportFormat}
                onChange={(e) =>
                  setExportFormat(
                    e.target.value as "image/png" | "image/webp" | "image/jpeg"
                  )
                }
                className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
              >
                <option value="image/png">PNG (Lossless / Transparent)</option>
                <option value="image/webp">WebP (Crisp &amp; Small File)</option>
                <option value="image/jpeg">JPEG (Solid Background)</option>
              </select>
            </div>

            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-medium text-muted-foreground">
                  Resolution Scale
                </span>
                <span className="font-mono font-semibold text-foreground">
                  {scaleSelect}x
                </span>
              </div>
              <select
                value={scaleSelect}
                onChange={(e) => applyScalePreset(e.target.value)}
                className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
              >
                <option value="0.5">0.5x (Half Size)</option>
                <option value="1">1x (Original ViewBox)</option>
                <option value="2">2x (Retina / 2K)</option>
                <option value="4">4x (Ultra HD / 4K)</option>
                <option value="8">8x (Print / 8K)</option>
              </select>
            </div>

            <div>
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Custom Width &times; Height (px)
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] text-muted-foreground">
                    Width (px)
                  </label>
                  <input
                    type="number"
                    min={16}
                    max={10000}
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
                    max={10000}
                    value={exportHeight}
                    onChange={(e) => handleHeightChange(Number(e.target.value))}
                    className="h-8 w-full rounded-md border border-border bg-background px-2 font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Export Background
              </label>
              <select
                value={exportBgMode}
                onChange={(e) =>
                  setExportBgMode(
                    e.target.value as "keep" | "transparent" | "custom"
                  )
                }
                className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
              >
                <option value="keep">Keep SVG&apos;s Original (BG or No BG)</option>
                <option value="transparent">Force Transparent (Strip White BG)</option>
                <option value="custom">Custom Solid Color</option>
              </select>
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

            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Viewer Backdrop
              </label>
              <select
                value={viewerBackdrop}
                onChange={(e) =>
                  setViewerBackdrop(
                    e.target.value as "bg-checker" | "bg-dark" | "bg-light"
                  )
                }
                className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
              >
                <option value="bg-checker">Transparency Grid</option>
                <option value="bg-dark">Dark Canvas (Clean)</option>
                <option value="bg-light">Light Canvas</option>
              </select>
            </div>

            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-medium text-muted-foreground">Viewer Zoom</span>
                <span className="font-mono font-semibold text-foreground">
                  {viewerZoom}%
                </span>
              </div>
              <input
                type="range"
                min={25}
                max={300}
                value={viewerZoom}
                onChange={(e) => setViewerZoom(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="border-t border-border pt-3">
              <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Quick Export
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                <button
                  onClick={() => handleDownloadRaster("image/png")}
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background text-xs font-medium hover:bg-accent"
                >
                  .PNG
                </button>
                <button
                  onClick={() => handleDownloadRaster("image/webp")}
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background text-xs font-medium hover:bg-accent"
                >
                  .WebP
                </button>
                <button
                  onClick={() => handleDownloadRaster("image/jpeg")}
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background text-xs font-medium hover:bg-accent"
                >
                  .JPG
                </button>
                <button
                  onClick={() =>
                    generateNativePdfFromSvgs(
                      [effectiveSvgForRaster],
                      exportWidth,
                      exportHeight,
                      fileName + "-" + exportWidth + "x" + exportHeight + ".pdf",
                      exportBgMode === "custom" ? exportCustomBg : "#ffffff"
                    )
                  }
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background text-xs font-medium hover:bg-accent"
                >
                  .PDF
                </button>
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
                <span className="text-muted-foreground">Picture Output:</span>
                <span className="font-mono font-semibold text-blue-500">
                  {exportWidth} &times; {exportHeight}px
                </span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-muted-foreground">Est. File Size:</span>
                <span className="font-mono">
                  {pngBlobSize > 0 ? (pngBlobSize / 1024).toFixed(1) + " KB" : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 p-4 pb-12 md:grid-cols-2 md:p-6 lg:col-span-9 lg:overflow-y-auto">
            <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between border-b border-border px-4 py-3 text-xs font-semibold">
                <span>SVG Source Code (Paste or Edit Live)</span>
                <span
                  style={{ color: svgValidStatus.ok ? "#10b981" : "#ef4444" }}
                  className="text-xs font-normal"
                >
                  {svgValidStatus.text}
                </span>
              </div>
              <textarea
                value={effectiveSvgForRaster}
                onChange={(e) => {
                  const val = e.target.value;
                  setSvgInputCode(val);
                  const parsed = parseSvgDimensions(val);
                  if (parsed) {
                    const s = parseFloat(scaleSelect) || 1;
                    setSvgBaseDims({ width: parsed.w, height: parsed.h });
                    setExportWidth(Math.round(parsed.w * s));
                    setExportHeight(Math.round(parsed.h * s));
                  }
                }}
                placeholder="Paste your <svg>...</svg> code here or load an .svg file..."
                className="min-h-[260px] flex-1 resize-none bg-transparent p-4 font-mono text-xs leading-relaxed focus:outline-none"
                spellCheck={false}
              />
            </div>

            <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              <div className="flex items-center justify-between border-b border-border px-4 py-3 text-xs font-semibold">
                <span>Rendered Picture Preview (True Raster Output)</span>
                <span className="font-mono font-normal text-muted-foreground">
                  {exportWidth} &times; {exportHeight} px
                </span>
              </div>
              <div
                className="flex flex-1 items-center justify-center overflow-auto p-5"
                style={
                  viewerBackdrop === "bg-checker"
                    ? CHECKERBOARD_STYLE
                    : viewerBackdrop === "bg-light"
                    ? { background: "#ffffff", minHeight: "260px" }
                    : { background: "#090d16", minHeight: "260px" }
                }
              >
                {pngPreviewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pngPreviewUrl}
                    alt="Rendered Picture Preview"
                    style={{
                      ...CONTAINED_MEDIA_STYLE,
                      transform: "scale(" + viewerZoom / 100 + ")",
                      transition: "transform 0.15s ease",
                    }}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Paste valid &lt;svg&gt; code or load an .svg file to preview picture
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
