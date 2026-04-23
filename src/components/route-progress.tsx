"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Top-of-page progress bar visible during client-side navigation.
 * Works by intercepting link clicks and showing a bar until the pathname
 * actually changes.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKey = useRef<string>(pathname + "?" + searchParams.toString());

  // When pathname/searchParams change, complete and hide the bar
  useEffect(() => {
    const currentKey = pathname + "?" + searchParams.toString();
    if (currentKey !== lastKey.current) {
      lastKey.current = currentKey;
      setProgress(100);
      const t = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [pathname, searchParams]);

  // Intercept link clicks to show bar
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const link = target.closest("a") as HTMLAnchorElement | null;
      if (!link) return;
      if (link.target === "_blank") return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (link.getAttribute("href")?.startsWith("#")) return;

      const href = link.getAttribute("href");
      if (!href) return;
      // Only same-origin internal links
      if (href.startsWith("http") && !href.startsWith(window.location.origin)) {
        return;
      }

      // Start progress
      setVisible(true);
      setProgress(10);
      if (timerRef.current) clearTimeout(timerRef.current);

      // Slow climb to simulate activity
      const climb = (p: number) => {
        if (p >= 80) return;
        timerRef.current = setTimeout(() => {
          setProgress(p);
          climb(p + Math.random() * 15);
        }, 120);
      };
      climb(25);
    }

    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] h-0.5 pointer-events-none"
      aria-hidden="true"
    >
      <div
        className="h-full bg-brand-accent transition-all duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: visible ? 1 : 0,
        }}
      />
    </div>
  );
}
