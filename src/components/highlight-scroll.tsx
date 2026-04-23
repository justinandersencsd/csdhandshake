"use client";

import { useEffect } from "react";

export function HighlightScroll({ messageId }: { messageId: string }) {
  useEffect(() => {
    const el = document.getElementById(`msg-${messageId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-warning", "bg-warning/5", "rounded-md");
    const timer = setTimeout(() => {
      el.classList.remove("ring-2", "ring-warning", "bg-warning/5", "rounded-md");
    }, 4000);
    return () => clearTimeout(timer);
  }, [messageId]);

  return null;
}
