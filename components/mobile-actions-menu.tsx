"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { FolderArchive, Moon, MoreHorizontal, Sun, Trash2, Undo2 } from "lucide-react";

interface MobileActionsMenuProps {
  canUndo: boolean;
  onUndo: () => void;
  onReset: () => void;
  onDownloadBundle: () => void;
}

/**
 * Phone-only overflow menu for the header actions, so the studio tabs and this
 * button keep 44px touch targets without the header overflowing at 320px.
 */
export function MobileActionsMenu({
  canUndo,
  onUndo,
  onReset,
  onDownloadBundle,
}: MobileActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();

    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  const isDark = resolvedTheme === "dark";
  const itemClass =
    "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-foreground hover:bg-accent focus-visible:bg-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="More actions"
          className="absolute right-0 top-full z-50 mt-1 w-56 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card p-1 shadow-xl"
        >
          <button role="menuitem" type="button" disabled={!canUndo} onClick={() => run(onUndo)} className={itemClass}>
            <Undo2 className="h-4 w-4" /> Undo last change
          </button>
          <button role="menuitem" type="button" onClick={() => run(onDownloadBundle)} className={itemClass}>
            <FolderArchive className="h-4 w-4" /> Download bundle (.zip)
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => run(() => setTheme(isDark ? "light" : "dark"))}
            className={itemClass}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {isDark ? "Light theme" : "Dark theme"}
          </button>
          <div className="my-1 h-px bg-border" />
          <button
            role="menuitem"
            type="button"
            onClick={() => run(onReset)}
            className={itemClass + " text-destructive hover:bg-destructive/10"}
          >
            <Trash2 className="h-4 w-4" /> Reset editor
          </button>
        </div>
      )}
    </div>
  );
}
