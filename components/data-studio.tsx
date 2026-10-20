"use client";

import { useState, useMemo } from "react";
import {
  DataFormat,
  TableData,
  ColumnAlignment,
  SAMPLE_TABLE_MARKDOWN,
  parseAnyToTable,
  serializeTable,
} from "@/lib/converters/data-converters";
import { downloadTextFile, downloadZipArchive } from "@/lib/zip-archive";
import {
  Table2,
  Plus,
  Trash2,
  Copy,
  FileDown,
  FolderArchive,
  Upload,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ArrowRightLeft,
} from "lucide-react";

const FORMATS: { id: DataFormat; label: string; ext: string }[] = [
  { id: "markdown", label: "Markdown Table", ext: "md" },
  { id: "csv", label: "CSV", ext: "csv" },
  { id: "tsv", label: "TSV (Excel/Sheets)", ext: "tsv" },
  { id: "json", label: "JSON", ext: "json" },
  { id: "yaml", label: "YAML", ext: "yaml" },
  { id: "sql", label: "SQL (CREATE + INSERT)", ext: "sql" },
  { id: "html", label: "HTML <table>", ext: "html" },
  { id: "xml", label: "XML", ext: "xml" },
];

interface DataStudioProps {
  onSendToEditor: (markdown: string) => void;
}

export function DataStudio({ onSendToEditor }: DataStudioProps) {
  const [rawInput, setRawInput] = useState(SAMPLE_TABLE_MARKDOWN);
  const [sourceFormat, setSourceFormat] = useState<DataFormat | "auto">("auto");
  const [targetFormat, setTargetFormat] = useState<DataFormat>("json");
  const [table, setTable] = useState<TableData>(() => parseAnyToTable(SAMPLE_TABLE_MARKDOWN));
  const [parseError, setParseError] = useState<string | null>(null);

  const handleParseInput = (text: string, fmt: DataFormat | "auto" = sourceFormat) => {
    setRawInput(text);
    try {
      const parsed = parseAnyToTable(text, fmt === "auto" ? undefined : fmt);
      setTable(parsed);
      setParseError(null);
    } catch {
      setParseError("Could not parse input");
    }
  };

  const convertedOutput = useMemo(() => {
    try {
      return serializeTable(table, targetFormat);
    } catch {
      return "";
    }
  }, [table, targetFormat]);

  const updateCell = (rowIndex: number, colIndex: number, value: string) => {
    setTable((prev) => {
      const rows = prev.rows.map((r, rIdx) =>
        rIdx === rowIndex ? r.map((c, cIdx) => (cIdx === colIndex ? value : c)) : r
      );
      const next = { ...prev, rows };
      setRawInput(serializeTable(next, "markdown"));
      return next;
    });
  };

  const updateHeader = (colIndex: number, value: string) => {
    setTable((prev) => {
      const headers = prev.headers.map((h, i) => (i === colIndex ? value : h));
      const next = { ...prev, headers };
      setRawInput(serializeTable(next, "markdown"));
      return next;
    });
  };

  const cycleAlignment = (colIndex: number) => {
    const order: ColumnAlignment[] = ["left", "center", "right"];
    setTable((prev) => {
      const alignments = prev.alignments.map((a, i) =>
        i === colIndex ? order[(order.indexOf(a) + 1) % order.length] : a
      );
      const next = { ...prev, alignments };
      setRawInput(serializeTable(next, "markdown"));
      return next;
    });
  };

  const addRow = () => {
    setTable((prev) => {
      const next = {
        ...prev,
        rows: [...prev.rows, prev.headers.map(() => "")],
      };
      setRawInput(serializeTable(next, "markdown"));
      return next;
    });
  };

  const removeRow = (idx: number) => {
    setTable((prev) => {
      const next = { ...prev, rows: prev.rows.filter((_, i) => i !== idx) };
      setRawInput(serializeTable(next, "markdown"));
      return next;
    });
  };

  const addColumn = () => {
    setTable((prev) => {
      const colName = "Col " + (prev.headers.length + 1);
      const next: TableData = {
        headers: [...prev.headers, colName],
        alignments: [...prev.alignments, "left"],
        rows: prev.rows.map((r) => [...r, ""]),
      };
      setRawInput(serializeTable(next, "markdown"));
      return next;
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        handleParseInput(reader.result, "auto");
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadAllZip = () => {
    const entries = FORMATS.map((f) => ({
      name: "table-export." + f.ext,
      data: serializeTable(table, f.id),
    }));
    downloadZipArchive(entries, "slate-data-bundle.zip");
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Studio Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-card/60 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Table2 className="h-4 w-4 text-blue-500" />
            Data & Table Studio
          </span>
          <select
            value={sourceFormat}
            onChange={(e) => {
              const v = e.target.value as DataFormat | "auto";
              setSourceFormat(v);
              handleParseInput(rawInput, v);
            }}
            className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs"
          >
            <option value="auto">Auto-Detect Input</option>
            {FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                From: {f.label}
              </option>
            ))}
          </select>

          <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />

          <select
            value={targetFormat}
            onChange={(e) => setTargetFormat(e.target.value as DataFormat)}
            className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs font-medium"
          >
            {FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                To: {f.label}
              </option>
            ))}
          </select>

          <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium hover:bg-accent">
            <Upload className="h-3.5 w-3.5" />
            <span>Import File</span>
            <input
              type="file"
              accept=".csv,.tsv,.json,.yaml,.yml,.md,.txt,.html,.xml"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => onSendToEditor(serializeTable(table, "markdown"))}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium hover:bg-accent"
          >
            Send Table to Editor
          </button>
          <button
            onClick={() => {
              const ext = FORMATS.find((f) => f.id === targetFormat)?.ext || "txt";
              downloadTextFile(convertedOutput, "table-export." + ext);
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium hover:bg-accent"
          >
            <FileDown className="h-3.5 w-3.5" />
            Download .{FORMATS.find((f) => f.id === targetFormat)?.ext}
          </button>
          <button
            onClick={handleDownloadAllZip}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            <FolderArchive className="h-3.5 w-3.5" />
            All Formats (.zip)
          </button>
        </div>
      </div>

      {/* Main 3-Panel Grid: Raw Input | Interactive Grid | Converted Output */}
      <div className="flex flex-1 flex-col overflow-y-auto lg:grid lg:grid-cols-3 lg:overflow-hidden">
        {/* Panel 1: Source Input */}
        <div className="flex min-h-[240px] shrink-0 flex-col border-b border-border lg:min-h-0 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Source Data (Paste CSV, Excel, JSON, YAML, MD)
            </span>
            {parseError && (
              <span
                role="status"
                aria-live="polite"
                className="text-[11px] text-destructive"
              >
                {parseError}
              </span>
            )}
          </div>
          <textarea
            value={rawInput}
            onChange={(e) => handleParseInput(e.target.value)}
            className="flex-1 resize-none bg-transparent p-4 font-mono text-xs leading-relaxed focus:outline-none"
            placeholder="Paste CSV, TSV, JSON array, YAML, or Markdown table..."
            spellCheck={false}
          />
        </div>

        {/* Panel 2: Interactive Visual Spreadsheet Grid */}
        <div className="flex min-h-[240px] shrink-0 flex-col border-b border-border lg:min-h-0 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Interactive Grid ({table.rows.length} rows &times; {table.headers.length} cols)
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={addRow}
                className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[11px] hover:bg-accent"
              >
                <Plus className="h-3 w-3" /> Row
              </button>
              <button
                onClick={addColumn}
                className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[11px] hover:bg-accent"
              >
                <Plus className="h-3 w-3" /> Col
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-3">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  {table.headers.map((h, colIdx) => {
                    const align = table.alignments[colIdx] || "left";
                    const AlignIcon =
                      align === "center"
                        ? AlignCenter
                        : align === "right"
                        ? AlignRight
                        : AlignLeft;
                    return (
                      <th
                        key={colIdx}
                        className="border border-border bg-muted/60 p-1.5"
                      >
                        <div className="flex items-center gap-1">
                          <input
                            value={h}
                            onChange={(e) => updateHeader(colIdx, e.target.value)}
                            className="w-full bg-transparent font-semibold focus:outline-none"
                          />
                          <button
                            onClick={() => cycleAlignment(colIdx)}
                            title={"Align: " + align}
                            className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                          >
                            <AlignIcon className="h-3 w-3" />
                          </button>
                        </div>
                      </th>
                    );
                  })}
                  <th className="w-8 border border-border bg-muted/60" />
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {table.headers.map((_, cIdx) => (
                      <td key={cIdx} className="border border-border p-1">
                        <input
                          value={row[cIdx] ?? ""}
                          onChange={(e) => updateCell(rIdx, cIdx, e.target.value)}
                          className="w-full bg-transparent px-1 py-0.5 focus:outline-none"
                        />
                      </td>
                    ))}
                    <td className="border border-border p-1 text-center">
                      <button
                        onClick={() => removeRow(rIdx)}
                        className="text-muted-foreground hover:text-destructive"
                        title="Remove row"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Panel 3: Target Format Output */}
        <div className="flex min-h-[240px] shrink-0 flex-col lg:min-h-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Converted Output ({targetFormat.toUpperCase()})
            </span>
            <button
              onClick={() => navigator.clipboard.writeText(convertedOutput)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
          </div>
          <textarea
            readOnly
            value={convertedOutput}
            className="flex-1 resize-none bg-muted/20 p-4 font-mono text-xs leading-relaxed focus:outline-none"
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}
