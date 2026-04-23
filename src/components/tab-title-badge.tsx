"use client";

import { useEffect } from "react";

export function TabTitleBadge({ count }: { count: number }) {
  useEffect(() => {
    const original = document.title.replace(/^\(\d+\) /, "");
    if (count > 0) {
      document.title = `(${count > 99 ? "99+" : count}) ${original}`;
    } else {
      document.title = original;
    }
    return () => {
      document.title = original;
    };
  }, [count]);

  return null;
}
