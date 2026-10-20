import { DocumentExportTheme, getThemeStylesheet } from "./converters/document-converters";

export function exportToPdf(previewEl: HTMLElement, theme: DocumentExportTheme = "modern"): void {
  if (!previewEl) return;
  const content = previewEl.innerHTML;
  const themeCss = getThemeStylesheet(theme);

  const html = [
    "<!DOCTYPE html><html><head><meta charset=\"utf-8\"/><title>Slate PDF Export</title>",
    "<style>",
    themeCss,
    "@media print { body { padding: 1cm 1.5cm; max-width: 100%; } @page { size: A4; margin: 12mm; } }",
    "</style></head><body>",
    content,
    "</body></html>",
  ].join("\n");

  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const win = iframe.contentWindow;
  win.addEventListener("afterprint", () => {
    if (iframe.parentNode) document.body.removeChild(iframe);
  }, { once: true });

  setTimeout(() => {
    win.focus();
    win.print();
  }, 350);
}
