export type DataFormat = "markdown" | "csv" | "tsv" | "json" | "yaml" | "sql" | "html" | "xml";
export type ColumnAlignment = "left" | "center" | "right";

export interface TableData {
  headers: string[];
  rows: string[][];
  alignments: ColumnAlignment[];
}

export const SAMPLE_TABLE_MARKDOWN = [
  "| Feature | Studio | Engine | Offline |",
  "| :--- | :---: | :--- | :---: |",
  "| Markdown <-> Rich Text | Document | Marked + Turndown | Yes |",
  "| CSV / JSON / YAML / SQL | Data Studio | AST Table Parser | Yes |",
  "| JPG / PNG -> True SVG | Vector Studio | Marching Squares | Yes |",
  "| Markdown -> Slide Deck | Visual Studio | Slide Renderer | Yes |",
  "| Markdown -> Mindmap | Visual Studio | SVG Tree Layout | Yes |",
].join("\n");

function normalizeRowsToTable(rawRows: string[][]): TableData {
  if (rawRows.length === 0) return { headers: ["Column 1"], rows: [], alignments: ["left"] };
  const maxCols = Math.max(...rawRows.map((r) => r.length), 1);
  const headers = Array.from({ length: maxCols }, (_, i) => rawRows[0][i]?.trim() || "Column " + (i + 1));
  const rows = rawRows.slice(1).map((r) => Array.from({ length: maxCols }, (_, i) => (r[i] ?? "").trim()));
  return { headers, rows, alignments: headers.map(() => "left") };
}

export function parseDelimitedText(input: string, delimiter = ","): TableData {
  const text = input.replace(/\r\n/g, "\n").trim();
  if (!text) return { headers: ["Column 1"], rows: [[""]], alignments: ["left"] };
  const parsedRows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { currentCell += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else currentCell += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delimiter) { currentRow.push(currentCell.trim()); currentCell = ""; }
      else if (ch === "\n") { currentRow.push(currentCell.trim()); parsedRows.push(currentRow); currentRow = []; currentCell = ""; }
      else currentCell += ch;
    }
  }
  currentRow.push(currentCell.trim());
  if (currentRow.some((c) => c.length > 0)) parsedRows.push(currentRow);
  return normalizeRowsToTable(parsedRows);
}

export function parseMarkdownTable(markdown: string): TableData {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim()).filter((l) => l.includes("|"));
  if (lines.length === 0) return parseDelimitedText(markdown, ",");

  const splitRow = (line: string): string[] =>
    line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());

  const headers = splitRow(lines[0]);
  const colCount = Math.max(headers.length, 1);
  let alignments: ColumnAlignment[] = headers.map(() => "left");
  let start = 1;

  if (lines.length > 1) {
    const sec = splitRow(lines[1]);
    if (sec.every((c) => /^:?-{2,}:?$/.test(c))) {
      start = 2;
      alignments = Array.from({ length: colCount }, (_, i) => {
        const c = sec[i] || "---";
        if (c.startsWith(":") && c.endsWith(":")) return "center";
        if (c.endsWith(":")) return "right";
        return "left";
      });
    }
  }
  const rows = lines.slice(start).map((l) => {
    const cells = splitRow(l);
    return Array.from({ length: colCount }, (_, i) => cells[i] ?? "");
  });
  return { headers, rows, alignments };
}

export function parseJsonToTable(jsonText: string): TableData {
  const parsed: unknown = JSON.parse(jsonText);
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return { headers: ["Column 1"], rows: [], alignments: ["left"] };
    if (Array.isArray(parsed[0])) {
      return normalizeRowsToTable(parsed.map((r) => (Array.isArray(r) ? r.map(String) : [String(r)])));
    }
    const keys = Array.from(new Set(parsed.flatMap((item) => (item && typeof item === "object" ? Object.keys(item as Record<string, unknown>) : []))));
    const headers = keys.length ? keys : ["Value"];
    const rows = parsed.map((item) => {
      const obj = (item ?? {}) as Record<string, unknown>;
      return headers.map((h) => (obj[h] === undefined || obj[h] === null ? "" : String(obj[h])));
    });
    return { headers, rows, alignments: headers.map(() => "left") };
  }
  if (parsed && typeof parsed === "object") {
    const entries = Object.entries(parsed as Record<string, unknown>);
    return { headers: ["Key", "Value"], rows: entries.map(([k, v]) => [k, String(v ?? "")]), alignments: ["left", "left"] };
  }
  throw new Error("Invalid JSON structure for table.");
}

export function parseYamlToTable(yamlText: string): TableData {
  const lines = yamlText.replace(/\r\n/g, "\n").split("\n");
  const records: Record<string, string>[] = [];
  let cur: Record<string, string> | null = null;

  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trimRight();
    if (!line.trim() || line.trim() === "---") continue;
    const listMatch = line.match(/^\s*-\s+([^:]+):\s*(.*)$/);
    if (listMatch) {
      if (cur) records.push(cur);
      cur = { [listMatch[1].trim()]: listMatch[2].trim().replace(/^['"]|['"]$/g, "") };
      continue;
    }
    const propMatch = line.match(/^\s*([^:]+):\s*(.*)$/);
    if (propMatch) {
      if (!cur) cur = {};
      cur[propMatch[1].trim()] = propMatch[2].trim().replace(/^['"]|['"]$/g, "");
    }
  }
  if (cur && Object.keys(cur).length) records.push(cur);
  if (!records.length) return { headers: ["Column 1"], rows: [], alignments: ["left"] };
  const headers = Array.from(new Set(records.flatMap((r) => Object.keys(r))));
  return { headers, rows: records.map((r) => headers.map((h) => r[h] ?? "")), alignments: headers.map(() => "left") };
}

export function parseHtmlTable(html: string): TableData {
  const trs = Array.from(html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi));
  const rawRows = trs.map((m) =>
    Array.from(m[1].matchAll(/<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)).map((c) =>
      c[1].replace(/<[^>]+>/g, "").trim()
    )
  ).filter((r) => r.length > 0);
  return normalizeRowsToTable(rawRows);
}

export function parseXmlToTable(xml: string): TableData {
  const items = Array.from(xml.matchAll(/<(?:row|record|item)[^>]*>([\s\S]*?)<\/(?:row|record|item)>/gi));
  const records = items.map((m) => {
    const rec: Record<string, string> = {};
    for (const f of m[1].matchAll(/<([a-zA-Z0-9_.-]+)[^>]*>([\s\S]*?)<\/\1>/g)) {
      rec[f[1]] = f[2].trim();
    }
    return rec;
  });
  const headers = Array.from(new Set(records.flatMap((r) => Object.keys(r))));
  return {
    headers: headers.length ? headers : ["Column 1"],
    rows: records.map((r) => headers.map((h) => r[h] ?? "")),
    alignments: (headers.length ? headers : ["Column 1"]).map(() => "left"),
  };
}

export function parseAnyToTable(input: string, format?: DataFormat): TableData {
  const t = input.trim();
  if (!t) return { headers: ["Column 1"], rows: [[""]], alignments: ["left"] };
  const fmt: DataFormat =
    format ??
    (t.startsWith("[") || t.startsWith("{") ? "json" :
     t.includes("<tr") ? "html" :
     t.includes("<record") || t.includes("<row") ? "xml" :
     t.includes("|") ? "markdown" :
     t.includes("\t") ? "tsv" :
     t.includes("- ") && t.includes(":") ? "yaml" : "csv");

  switch (fmt) {
    case "markdown": return parseMarkdownTable(t);
    case "csv": return parseDelimitedText(t, ",");
    case "tsv": return parseDelimitedText(t, "\t");
    case "json": return parseJsonToTable(t);
    case "yaml": return parseYamlToTable(t);
    case "html": return parseHtmlTable(t);
    case "xml": return parseXmlToTable(t);
    default: return parseMarkdownTable(t);
  }
}

export function tableToMarkdown(table: TableData): string {
  const colCount = Math.max(table.headers.length, 1);
  const clean = (v: string) => (v ?? "").replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
  const headers = Array.from({ length: colCount }, (_, i) => clean(table.headers[i] || "Col " + (i + 1)));
  const rows = table.rows.map((r) => Array.from({ length: colCount }, (_, i) => clean(r[i] ?? "")));
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length), 3));

  const headerLine = "| " + headers.map((h, i) => h.padEnd(widths[i], " ")).join(" | ") + " |";
  const divLine = "| " + widths.map((w, i) => {
    const a = table.alignments[i] || "left";
    if (a === "center") return ":" + "-".repeat(Math.max(1, w - 2)) + ":";
    if (a === "right") return "-".repeat(Math.max(2, w - 1)) + ":";
    return "-".repeat(w);
  }).join(" | ") + " |";
  const body = rows.map((r) => "| " + r.map((c, i) => c.padEnd(widths[i], " ")).join(" | ") + " |");
  return [headerLine, divLine, ...body].join("\n");
}

export function tableToDelimited(table: TableData, delimiter = ","): string {
  const esc = (v: string) => {
    const s = v ?? "";
    return s.includes(delimiter) || s.includes('"') || s.includes("\n") ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [
    table.headers.map(esc).join(delimiter),
    ...table.rows.map((r) => table.headers.map((_, i) => esc(r[i] ?? "")).join(delimiter)),
  ].join("\n");
}

export function tableToJson(table: TableData): string {
  const arr = table.rows.map((r) => {
    const obj: Record<string, string | number | boolean> = {};
    table.headers.forEach((h, i) => {
      const val = (r[i] ?? "").trim();
      obj[h] = /^-?\d+(\.\d+)?$/.test(val) ? Number(val) : val === "true" ? true : val === "false" ? false : val;
    });
    return obj;
  });
  return JSON.stringify(arr, null, 2);
}

export function tableToYaml(table: TableData): string {
  if (!table.rows.length) return "[]";
  return table.rows.map((r) =>
    table.headers.map((h, i) => (i === 0 ? "- " : "  ") + h + ": " + JSON.stringify(r[i] ?? "")).join("\n")
  ).join("\n");
}

export function tableToSql(table: TableData, tableName = "slate_table"): string {
  const id = (s: string) => s.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "col";
  const cols = table.headers.map((h, i) => id(h) || "col_" + (i + 1));
  const create = "CREATE TABLE " + id(tableName) + " (\n" + cols.map((c) => "  " + c + " TEXT").join(",\n") + "\n);";
  if (!table.rows.length) return create;
  const vals = table.rows.map((r) => "  (" + cols.map((_, i) => "'" + (r[i] ?? "").replace(/'/g, "''") + "'").join(", ") + ")");
  return create + "\n\nINSERT INTO " + id(tableName) + " (" + cols.join(", ") + ")\nVALUES\n" + vals.join(",\n") + ";";
}

export function tableToHtml(table: TableData): string {
  const ths = table.headers.map((h) => "      <th>" + h + "</th>").join("\n");
  const trs = table.rows.map((r) => "    <tr>\n" + table.headers.map((_, i) => "      <td>" + (r[i] ?? "") + "</td>").join("\n") + "\n    </tr>").join("\n");
  return "<table>\n  <thead>\n    <tr>\n" + ths + "\n    </tr>\n  </thead>\n  <tbody>\n" + trs + "\n  </tbody>\n</table>";
}

export function tableToXml(table: TableData): string {
  const tag = (s: string, i: number) => s.toLowerCase().replace(/[^a-z0-9_]+/g, "_") || "col_" + i;
  const recs = table.rows.map((r) => "  <record>\n" + table.headers.map((h, i) => "    <" + tag(h, i) + ">" + (r[i] ?? "") + "</" + tag(h, i) + ">").join("\n") + "\n  </record>").join("\n");
  return '<?xml version="1.0" encoding="UTF-8"?>\n<dataset>\n' + recs + "\n</dataset>";
}

export function serializeTable(table: TableData, format: DataFormat): string {
  switch (format) {
    case "markdown": return tableToMarkdown(table);
    case "csv": return tableToDelimited(table, ",");
    case "tsv": return tableToDelimited(table, "\t");
    case "json": return tableToJson(table);
    case "yaml": return tableToYaml(table);
    case "sql": return tableToSql(table);
    case "html": return tableToHtml(table);
    case "xml": return tableToXml(table);
  }
}

export function extractTablesFromMarkdown(markdown: string): TableData[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const tables: TableData[] = [];
  let block: string[] = [];
  for (const line of lines) {
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      block.push(line);
    } else {
      if (block.length >= 2) tables.push(parseMarkdownTable(block.join("\n")));
      block = [];
    }
  }
  if (block.length >= 2) tables.push(parseMarkdownTable(block.join("\n")));
  return tables;
}
