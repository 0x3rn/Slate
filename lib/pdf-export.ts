export function exportToPdf(previewEl: HTMLElement): void {
  if (!previewEl) return;

  // Gather all style tags from the main document
  const allStyles = Array.from(document.querySelectorAll("style"))
    .map((s) => s.textContent)
    .filter(Boolean)
    .join("\n");

  const content = previewEl.innerHTML;

  const styles = [
    "*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }",
    "html, body {",
    "  background: #ffffff;",
    "  color: #111827;",
    "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;",
    "  font-size: 16px;",
    "  line-height: 1.75;",
    "  -webkit-font-smoothing: antialiased;",
    "  -webkit-print-color-adjust: exact;",
    "  print-color-adjust: exact;",
    "}",
    "body {",
    "  padding: 2rem 2.5rem;",
    "  max-width: 100%;",
    "}",
    "h1, h2, h3, h4, h5, h6 {",
    "  color: #111827;",
    "  font-weight: 600;",
    "  line-height: 1.3;",
    "  margin-top: 1.5em;",
    "  margin-bottom: 0.4em;",
    "}",
    "h1 { font-size: 2rem; font-weight: 700; }",
    "h2 { font-size: 1.5rem; }",
    "h3 { font-size: 1.25rem; }",
    "h4 { font-size: 1.1rem; }",
    "p { margin: 0.75em 0; }",
    "a {",
    "  color: #2563eb;",
    "  text-decoration: none;",
    "  border-bottom: 1px solid #2563eb;",
    "}",
    "strong { color: #111827; font-weight: 600; }",
    "code {",
    "  background: #f3f4f6;",
    "  color: #dc2626;",
    "  padding: 0.15em 0.4em;",
    "  border-radius: 0.3em;",
    "  font-size: 0.875em;",
    "  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;",
    "}",
    "pre {",
    "  background: #f9fafb;",
    "  border: 1px solid #d1d5db;",
    "  border-radius: 8px;",
    "  padding: 1rem 1.25rem;",
    "  overflow-x: auto;",
    "  font-size: 0.85rem;",
    "  line-height: 1.6;",
    "  margin: 1.25em 0;",
    "}",
    "pre code {",
    "  background: none;",
    "  color: inherit;",
    "  padding: 0;",
    "  border-radius: 0;",
    "  font-size: inherit;",
    "  border: none;",
    "}",
    "blockquote {",
    "  border-left: 3px solid #d1d5db;",
    "  background: #f9fafb;",
    "  color: #6b7280;",
    "  padding: 0.75em 1.25em;",
    "  border-radius: 0 6px 6px 0;",
    "  margin: 1.25em 0;",
    "  font-style: italic;",
    "}",
    "blockquote p { margin: 0; }",
    "ul, ol { padding-left: 1.5em; margin: 0.75em 0; }",
    "li { margin: 0.25em 0; }",
    "hr { border: 0; border-top: 1px solid #e5e7eb; margin: 2em 0; }",
    "table {",
    "  width: 100%;",
    "  border-collapse: collapse;",
    "  margin: 1.25em 0;",
    "  font-size: 0.875rem;",
    "}",
    "th {",
    "  background: #f3f4f6;",
    "  font-weight: 600;",
    "  text-align: left;",
    "  padding: 0.5em 0.75em;",
    "  border: 1px solid #d1d5db;",
    "}",
    "td {",
    "  padding: 0.5em 0.75em;",
    "  border: 1px solid #d1d5db;",
    "}",
    "tr:nth-child(even) td { background: #f9fafb; }",
    "img {",
    "  max-width: 100%;",
    "  height: auto;",
    "  border-radius: 8px;",
    "  margin: 1.25em 0;",
    "}",
    "@media print {",
    "  body { padding: 1cm 1.5cm; }",
    "  @page { size: A4; margin: 0; }",
    "}",
  ].join("\n");

  const html = [
    "<!DOCTYPE html>",
    "<html>",
    "<head>",
    '<meta charset="utf-8" />',
    "<title>Slate Export</title>",
    "<style>" + styles + "</style>",
    allStyles ? "<style>" + allStyles + "</style>" : "",
    "</head>",
    "<body>",
    content,
    "</body>",
    "</html>",
  ].join("");

  // Create a hidden iframe in the same page
  const iframe = document.createElement("iframe");
  iframe.id = "slate-pdf-frame";
  iframe.style.cssText =
    "position: fixed; top: 0; left: 0; width: 100%; height: 100%; border: none; z-index: 99999;";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    return;
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  // Wait for content to render, then print from the iframe
  const iframeWindow = iframe.contentWindow;
  if (!iframeWindow) {
    document.body.removeChild(iframe);
    return;
  }

  // Listen for print completion to clean up
  const handleAfterPrint = () => {
    document.body.removeChild(iframe);
  };

  iframeWindow.addEventListener("afterprint", handleAfterPrint, { once: true });

  // Trigger print from within the iframe
  setTimeout(() => {
    iframeWindow.focus();
    iframeWindow.print();
  }, 400);
}