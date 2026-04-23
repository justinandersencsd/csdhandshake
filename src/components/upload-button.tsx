"use client";

import { useRef, useState } from "react";
import { initUpload } from "@/app/projects/[id]/upload-actions";
import { createBrowserClient } from "@supabase/ssr";

export type UploadedAttachment = {
  path: string;
  name: string;
  size: number;
  mime: string;
};

export function UploadButton({
  projectId,
  onUploaded,
  disabled,
}: {
  projectId: string;
  onUploaded: (a: UploadedAttachment) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setProgress(`Uploading ${file.name}…`);

    try {
      const init = await initUpload(projectId, file.name, file.type || "application/octet-stream", file.size);
      if ("error" in init) {
        setError(init.error);
        return;
      }

      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
      );

      const { error: upErr } = await supabase.storage
        .from("attachments")
        .uploadToSignedUrl(init.path, init.token, file);

      if (upErr) {
        setError("Upload failed: " + upErr.message);
        return;
      }

      onUploaded({
        path: init.path,
        name: file.name,
        size: file.size,
        mime: file.type || "application/octet-stream",
      });
      setProgress(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="inline-flex flex-col">
      <input
        ref={inputRef}
        type="file"
        hidden
        onChange={handleFile}
        disabled={disabled || busy}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || busy}
        className="text-xs text-neutral-dark hover:text-navy disabled:opacity-50"
      >
        {busy ? progress ?? "Uploading…" : "+ Attach file"}
      </button>
      {error && <div className="mt-1 text-xs text-danger">{error}</div>}
    </div>
  );
}
