"use client";

import {
  Sparkles,
  BookOpen,
  PenLine,
  Loader2,
  Check,
  ListTree,
  GitFork,
  Presentation,
  Table2,
  Shapes,
  Languages,
} from "lucide-react";
import { useState } from "react";
import type { AIAction } from "@/app/actions/ai";

interface AIToolbarProps {
  onAction: (action: AIAction, targetLanguage?: string) => Promise<void>;
  selectedText: string;
}

const actions: {
  id: AIAction;
  label: string;
  icon: typeof Sparkles;
  badge?: string;
}[] = [
  { id: "improve", label: "Improve", icon: PenLine },
  { id: "fix-grammar", label: "Grammar", icon: Check },
  { id: "summarize", label: "Summarize", icon: BookOpen },
  { id: "structure-notes", label: "Notes -> MD", icon: ListTree, badge: "AI" },
  { id: "prose-to-diagram", label: "Prose -> Diagram", icon: GitFork, badge: "AI" },
  { id: "to-slides", label: "To Slides", icon: Presentation, badge: "AI" },
  { id: "extract-table", label: "Extract Table", icon: Table2, badge: "AI" },
  { id: "prompt-to-svg", label: "Prompt -> SVG", icon: Shapes, badge: "AI" },
];

const LANGUAGES = [
  "Spanish",
  "French",
  "German",
  "Portuguese",
  "Arabic",
  "Chinese",
  "Japanese",
  "Yoruba",
  "Igbo",
  "Hausa",
];

export function AIToolbar({ onAction }: AIToolbarProps) {
  const [loadingAction, setLoadingAction] = useState<AIAction | null>(null);
  const [language, setLanguage] = useState("Spanish");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRun = async (action: AIAction, lang?: string) => {
    setLoadingAction(action);
    setErrorMsg(null);
    try {
      await onAction(action, lang);
    } catch {
      setErrorMsg("The AI request failed. Please try again.");
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="flex w-full max-w-full items-center justify-start gap-1 overflow-x-auto whitespace-nowrap rounded-xl border border-border bg-card/95 p-1 shadow-sm backdrop-blur-md md:w-auto md:flex-wrap md:justify-center">
      {actions.map((action) => {
        const isLoading = loadingAction === action.id;
        const Icon = isLoading ? Loader2 : action.icon;
        return (
          <button
            key={action.id}
            onClick={() => handleRun(action.id)}
            disabled={loadingAction !== null}
            title={action.label}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            <Icon className={"h-3.5 w-3.5 " + (isLoading ? "animate-spin" : "")} />
            <span>{action.label}</span>
          </button>
        );
      })}

      <div className="mx-1 h-4 w-px bg-border" />

      <div className="inline-flex items-center gap-1">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          aria-label="Target language"
          className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
        <button
          onClick={() => handleRun("translate", language)}
          disabled={loadingAction !== null}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
          title="Syntax-Safe Markdown Translate"
        >
          {loadingAction === "translate" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Languages className="h-3.5 w-3.5" />
          )}
          <span>Translate</span>
        </button>
      </div>

      {errorMsg && (
        <span
          role="status"
          aria-live="polite"
          className="ml-2 rounded bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive"
        >
          {errorMsg}
        </span>
      )}
    </div>
  );
}
