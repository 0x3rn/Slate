"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface HorizontalScrollStripProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  scrollStep?: number;
}

export function HorizontalScrollStrip({
  children,
  className = "",
  innerClassName = "",
  scrollStep = 180,
}: HorizontalScrollStripProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    checkScroll();

    const ro = new ResizeObserver(() => checkScroll());
    ro.observe(el);
    window.addEventListener("resize", checkScroll);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll, children]);

  const scrollByAmount = (dir: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * scrollStep, behavior: "smooth" });
  };

  return (
    <div className={"relative flex items-center overflow-hidden " + className}>
      {canScrollLeft && (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-20 flex items-center bg-gradient-to-r from-background via-background/80 to-transparent pr-3 pl-0.5">
          <button
            type="button"
            onClick={() => scrollByAmount(-1)}
            aria-label="Scroll left"
            className="pointer-events-auto inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md transition-transform hover:scale-105 hover:bg-accent"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div
        ref={scrollerRef}
        onScroll={checkScroll}
        onWheel={(e) => {
          const el = scrollerRef.current;
          if (!el) return;
          if (el.scrollWidth > el.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            e.preventDefault();
            el.scrollLeft += e.deltaY;
          }
        }}
        className={"flex w-full items-center overflow-x-auto scroll-smooth " + innerClassName}
      >
        {children}
      </div>

      {canScrollRight && (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex items-center bg-gradient-to-l from-background via-background/80 to-transparent pr-0.5 pl-3">
          <button
            type="button"
            onClick={() => scrollByAmount(1)}
            aria-label="Scroll right"
            className="pointer-events-auto inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md transition-transform hover:scale-105 hover:bg-accent"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
