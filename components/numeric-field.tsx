"use client";

import { useState } from "react";
import type { InputHTMLAttributes } from "react";
import { parseNumericDraft, resolveNumericDraft } from "@/lib/numeric-input";

type NativeProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "defaultValue" | "onChange" | "min" | "max"
>;

interface NumericFieldProps extends NativeProps {
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
  /**
   * true (default): commit each in-range value while typing so previews update live.
   * false: commit only on blur/Enter, for expensive or lossy updates (e.g. rescaling a canvas).
   */
  liveCommit?: boolean;
}

/** Number input that lets the user type freely and clamps once editing ends. */
export function NumericField({
  value,
  min,
  max,
  onCommit,
  liveCommit = true,
  onBlur,
  onKeyDown,
  ...rest
}: NumericFieldProps) {
  // null while not editing, so external value changes always show through.
  const [draft, setDraft] = useState<string | null>(null);

  const finish = (text: string) => {
    const next = resolveNumericDraft(text, min, max, value);
    if (next !== value) onCommit(next);
    setDraft(null);
  };

  return (
    <input
      {...rest}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      value={draft ?? String(value)}
      onChange={(e) => {
        const text = e.target.value;
        setDraft(text);
        if (liveCommit) {
          const parsed = parseNumericDraft(text, min, max);
          if (parsed !== null && parsed !== value) onCommit(parsed);
        }
      }}
      onBlur={(e) => {
        if (draft !== null) finish(draft);
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && draft !== null) finish(draft);
        onKeyDown?.(e);
      }}
    />
  );
}
