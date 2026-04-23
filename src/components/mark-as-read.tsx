"use client";

import { useEffect } from "react";
import { markAsRead } from "@/app/projects/[id]/actions";

export function MarkAsReadOnMount({ projectId }: { projectId: string }) {
  useEffect(() => {
    markAsRead(projectId).catch(() => {
      // silent — read-tracking isn't worth disrupting the UI
    });
  }, [projectId]);

  return null;
}
