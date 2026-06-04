"use client";

import {
  Sparkles,
  BookOpen,
  PenLine,
  Loader2,
  Check,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

type AIAction = "summarize" | "improve" | "fix-grammar";

interface AIToolbarProps {
  onAction: (action: AIAction) => Promise<void>;
  selectedText: string;
}

const actions: {
  id: AIAction;
  label: string;
  icon: typeof Sparkles;
  shortcut: string;
}[] = [
  { id: "improve", label: "Improve Writing", icon: PenLine, shortcut: "⌘I" },
  { id: "fix-grammar", label: "Fix Grammar", icon: Check, shortcut: "⌘G" },
  { id: "summarize", label: "Summarize", icon: BookOpen, shortcut: "⌘S" },
];

export function AIToolbar({ onAction, selectedText }: AIToolbarProps) {
  const [loadingAction, setLoadingAction] = useState<AIAction | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        toolbarRef.current &&
        !toolbarRef.current.contains(e.target as Node)
      ) {
        // Don't close on outside click; instead we position it near the textarea
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAction = async (action: AIAction) => {
    setLoadingAction(action);
    try {
      await onAction(action);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div
      ref={toolbarRef}
      className="inline-flex items-center gap-0.5 rounded-xl border border-border bg-card/95 p-1 shadow-lg backdrop-blur-md dark:bg-card/90"
    >
      {actions.map((action) => {
        const isLoading = loadingAction === action.id;
        const Icon = isLoading ? Loader2 : action.icon;

        return (
          <button
            key={action.id}
            onClick={() => handleAction(action.id)}
            disabled={loadingAction !== null}
            title={`${action.label} (${action.shortcut})`}
            className="group relative inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            <Icon
              className={`h-3.5 w-3.5 ${
                isLoading ? "animate-spin" : ""
              }`}
            />
            <span className="hidden sm:inline">{action.label}</span>
            <kbd className="hidden md:inline-flex h-5 items-center gap-0.5 rounded-md border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground/60 group-hover:text-muted-foreground">
              {action.shortcut.replace("⌘", "")}
            </kbd>
          </button>
        );
      })}
    </div>
  );
}