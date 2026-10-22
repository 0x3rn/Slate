import { DocumentExportTheme, getThemeStylesheet } from "./converters/document-converters";

export interface JpegPageData {
  bytes: Uint8Array;
  rW: number;
  rH: number;
}

let cachedEmbeddedFontCss = "";
let fontLoadPromise: Promise<string> | null = null;

/**
 * Preloads the 12 open-source Google Fonts as base64 woff2 rules so standalone
 * SVG, PNG, and native PDF exports preserve exact typography offline.
 */
export function ensureEmbeddedGoogleFonts(): Promise<string> {
  if (cachedEmbeddedFontCss) return Promise.resolve(cachedEmbeddedFontCss);
  if (fontLoadPromise) return fontLoadPromise;

  fontLoadPromise = (async () => {
    try {
      const cssUrl =
        "https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@600&family=Lora:wght@600&family=Merriweather:wght@700&family=Montserrat:wght@700&family=Oswald:wght@700&family=Playfair+Display:wght@700&family=Plus+Jakarta+Sans:wght@700&family=Poppins:wght@600&family=Space+Grotesk:wght@700&family=Syne:wght@700&display=swap";
      const res = await fetch(cssUrl);
      let cssText = await res.text();
      const urlMatches = Array.from(cssText.matchAll(/url\((https:\/\/[^)]+)\)/g));
      for (const m of urlMatches) {
        const fontUrl = m[1].replace(/['"]/g, "");
        const fRes = await fetch(fontUrl);
        const buf = await fRes.arrayBuffer();
        let binary = "";
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const b64 = btoa(binary);
        cssText = cssText.replace(m[0], "url(data:font/woff2;base64," + b64 + ")");
      }
      cachedEmbeddedFontCss = "<style>" + cssText + "</style>";
    } catch {
      cachedEmbeddedFontCss = "";
    }
    return cachedEmbeddedFontCss;
  })();

  return fontLoadPromise;
}

export function getCachedEmbeddedFontCss(): string {
  return cachedEmbeddedFontCss;
}

/**
 * Renders an SVG string to high-resolution JPEG bytes at controlled dimensions
 * (with automatic 2x super-sampling when width < 2400px).
 */
export function renderSvgToJpegBytes(
  svgText: string,
  width: number,
  height: number,
  bgColor = "#0f172a"
): Promise<JpegPageData> {
  return new Promise((resolve, reject) => {
    const superScale = width < 2400 ? 2 : 1;
    const rW = Math.round(width * superScale);
    const rH = Math.round(height * superScale);

    let hiResSvg = svgText;
    if (hiResSvg.includes('width="' + width + '"')) {
      hiResSvg = hiResSvg
        .replace('width="' + width + '"', 'width="' + rW + '"')
        .replace('height="' + height + '"', 'height="' + rH + '"');
    } else {
      hiResSvg = hiResSvg.replace(
        /<svg([^>]*)>/i,
        '<svg$1 width="' + rW + '" height="' + rH + '">'
      );
    }

    const blob = new Blob([hiResSvg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = rW;
      canvas.height = rH;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, rW, rH);
      ctx.drawImage(img, 0, 0, rW, rH);
      URL.revokeObjectURL(url);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.98);
      const binStr = atob(dataUrl.split(",")[1]);
      const bytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) {
        bytes[i] = binStr.charCodeAt(i);
      }
      resolve({ bytes, rW, rH });
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

/**
 * Builds a native binary %PDF-1.4 file directly in TypeScript from JPEG page streams
 * with exact controlled dimensions (no browser print dialog).
 */
export function buildNativePdfBlobFromJpegPages(
  pagesJpeg: JpegPageData[],
  widthPx: number,
  heightPx: number
): Blob {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let byteLength = 0;

  const pushStr = (str: string) => {
    const b = encoder.encode(str);
    chunks.push(b);
    byteLength += b.length;
  };
  const pushBytes = (b: Uint8Array) => {
    chunks.push(b);
    byteLength += b.length;
  };
  const startObj = (id: number) => {
    offsets[id] = byteLength;
    pushStr(id + " 0 obj\n");
  };
  const endObj = () => pushStr("\nendobj\n");

  const ptW = Number((widthPx * 0.75).toFixed(2));
  const ptH = Number((heightPx * 0.75).toFixed(2));

  pushStr("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n");

  startObj(1);
  pushStr("<< /Type /Catalog /Pages 2 0 R >>");
  endObj();

  const pageObjIds = pagesJpeg.map((_, i) => 3 + i * 3);
  startObj(2);
  pushStr(
    "<< /Type /Pages /Kids [" +
      pageObjIds.map((id) => id + " 0 R").join(" ") +
      "] /Count " +
      pagesJpeg.length +
      " >>"
  );
  endObj();

  pagesJpeg.forEach((pageImg, i) => {
    const jpegBytes = pageImg.bytes;
    const imgW = pageImg.rW || widthPx;
    const imgH = pageImg.rH || heightPx;
    const pageId = 3 + i * 3;
    const contentId = pageId + 1;
    const imgId = pageId + 2;

    startObj(pageId);
    pushStr(
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " +
        ptW +
        " " +
        ptH +
        "] /Resources << /XObject << /Im" +
        i +
        " " +
        imgId +
        " 0 R >> >> /Contents " +
        contentId +
        " 0 R >>"
    );
    endObj();

    const contentStream = "q " + ptW + " 0 0 " + ptH + " 0 0 cm /Im" + i + " Do Q";
    startObj(contentId);
    pushStr(
      "<< /Length " +
        contentStream.length +
        " >>\nstream\n" +
        contentStream +
        "\nendstream"
    );
    endObj();

    startObj(imgId);
    pushStr(
      "<< /Type /XObject /Subtype /Image /Width " +
        imgW +
        " /Height " +
        imgH +
        " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " +
        jpegBytes.length +
        " >>\nstream\n"
    );
    pushBytes(jpegBytes);
    pushStr("\nendstream");
    endObj();
  });

  const totalObjs = 2 + pagesJpeg.length * 3;
  const xrefOffset = byteLength;
  pushStr("xref\n0 " + (totalObjs + 1) + "\n0000000000 65535 f \n");
  for (let id = 1; id <= totalObjs; id++) {
    pushStr(String(offsets[id]).padStart(10, "0") + " 00000 n \n");
  }
  pushStr(
    "trailer\n<< /Size " +
      (totalObjs + 1) +
      " /Root 1 0 R >>\nstartxref\n" +
      xrefOffset +
      "\n%%EOF"
  );

  return new Blob(chunks as BlobPart[], { type: "application/pdf" });
}

export async function generateNativePdfFromSvgs(
  svgStrings: string[],
  widthPx: number,
  heightPx: number,
  filename: string,
  bgColor = "#0f172a"
): Promise<void> {
  await ensureEmbeddedGoogleFonts();
  const pagesJpeg: JpegPageData[] = [];
  for (const svgStr of svgStrings) {
    pagesJpeg.push(await renderSvgToJpegBytes(svgStr, widthPx, heightPx, bgColor));
  }
  const pdfBlob = buildNativePdfBlobFromJpegPages(pagesJpeg, widthPx, heightPx);
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".pdf") ? filename : filename + ".pdf";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function downloadSvgString(svgText: string, filename: string): void {
  const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".svg") ? filename : filename + ".svg";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function exportSvgMarkupToPng(
  svgText: string,
  width: number,
  height: number,
  filename: string
): void {
  let sizedSvg = svgText;
  if (!sizedSvg.includes('width="' + width + '"')) {
    sizedSvg = sizedSvg.replace(
      /<svg([^>]*)>/i,
      '<svg$1 width="' + width + '" height="' + height + '">'
    );
  }
  const blob = new Blob([sizedSvg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const img = new window.Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = filename.endsWith(".png") ? filename : filename + ".png";
    a.click();
  };
  img.src = url;
}

function buildControlledDocumentSvgPages(
  previewEl: HTMLElement,
  theme: DocumentExportTheme,
  widthPx: number,
  heightPx: number
): string[] {
  const themeCss = getThemeStylesheet(theme);
  const blocks = Array.from(previewEl.children);
  const padX = Math.round(widthPx * 0.07);
  const padY = Math.round(heightPx * 0.07);
  const usableH = heightPx - padY * 2;

  const pageHtmlChunks: string[][] = [];
  let currentChunk: string[] = [];
  let currentHeight = 0;

  if (blocks.length === 0) {
    pageHtmlChunks.push([previewEl.innerHTML]);
  } else {
    for (const el of blocks) {
      const rect = el.getBoundingClientRect();
      const estH = Math.max(36, rect.height || 48);
      if (currentHeight + estH > usableH && currentChunk.length > 0) {
        pageHtmlChunks.push(currentChunk);
        currentChunk = [el.outerHTML];
        currentHeight = estH;
      } else {
        currentChunk.push(el.outerHTML);
        currentHeight += estH + 16;
      }
    }
    if (currentChunk.length > 0) {
      pageHtmlChunks.push(currentChunk);
    }
  }

  return pageHtmlChunks.map((chunkHtml) => {
    const xhtml =
      '<div xmlns="http://www.w3.org/1999/xhtml" style="width:' +
      widthPx +
      "px;height:" +
      heightPx +
      "px;padding:" +
      padY +
      "px " +
      padX +
      'px;background:#ffffff;color:#0f172a;overflow:hidden;box-sizing:border-box;">' +
      "<style>" +
      themeCss +
      " body { padding: 0 !important; margin: 0 !important; max-width: none !important; }</style>" +
      chunkHtml.join("\n") +
      "</div>";

    return (
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
      widthPx +
      " " +
      heightPx +
      '" width="' +
      widthPx +
      '" height="' +
      heightPx +
      '">' +
      '<rect width="100%" height="100%" fill="#ffffff"/>' +
      '<foreignObject x="0" y="0" width="' +
      widthPx +
      '" height="' +
      heightPx +
      '">' +
      xhtml +
      "</foreignObject>" +
      "</svg>"
    );
  });
}

export async function exportToPdf(
  previewEl: HTMLElement,
  theme: DocumentExportTheme = "modern",
  widthPx = 1240,
  heightPx = 1754,
  filename?: string
): Promise<void> {
  if (!previewEl) return;
  const w = Math.max(300, Math.min(8000, Math.round(widthPx)));
  const h = Math.max(300, Math.min(8000, Math.round(heightPx)));
  const svgPages = buildControlledDocumentSvgPages(previewEl, theme, w, h);
  const outName = filename || "slate-document-" + w + "x" + h + ".pdf";
  await generateNativePdfFromSvgs(svgPages, w, h, outName, "#ffffff");
}

export function exportDocumentToPng(
  previewEl: HTMLElement,
  theme: DocumentExportTheme = "modern",
  widthPx = 1240,
  heightPx = 1754,
  filename?: string
): void {
  if (!previewEl) return;
  const w = Math.max(300, Math.min(8000, Math.round(widthPx)));
  const h = Math.max(300, Math.min(8000, Math.round(heightPx)));
  const svgPages = buildControlledDocumentSvgPages(previewEl, theme, w, h);
  const outName = filename || "slate-document-" + w + "x" + h + ".png";
  exportSvgMarkupToPng(svgPages[0], w, h, outName);
}
