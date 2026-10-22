"use client";

import { useEffect } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps } from "next-themes";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  useEffect(() => {
    const timers = new WeakMap<Element, ReturnType<typeof setTimeout>>();
    const handleScroll = (e: Event) => {
      const el =
        e.target === document
          ? document.documentElement
          : (e.target as Element | null);
      if (!el || !el.classList) return;
      el.classList.add("is-scrolling");
      const prev = timers.get(el);
      if (prev) clearTimeout(prev);
      timers.set(
        el,
        setTimeout(() => {
          el.classList.remove("is-scrolling");
        }, 800)
      );
    };
    document.addEventListener("scroll", handleScroll, {
      capture: true,
      passive: true,
    });
    return () => {
      document.removeEventListener("scroll", handleScroll, {
        capture: true,
      });
    };
  }, []);

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
