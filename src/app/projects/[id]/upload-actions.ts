"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_SIZE = 25 * 1024 * 1024; // 25 MB
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "video/mp4",
  "video/quicktime",
]);

type UploadInitResult =
  | { ok: true; path: string; uploadUrl: string; token: string }
  | { error: string };

export async function initUpload(
  projectId: string,
  filename: string,
  mime: string,
  size: number
): Promise<UploadInitResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  if (size > MAX_SIZE) {
    return { error: `File too large (max ${Math.floor(MAX_SIZE / 1024 / 1024)} MB).` };
  }
  if (!ALLOWED_MIME.has(mime)) {
    return {
      error: `That file type isn't allowed. Supported: images, PDF, Word/Excel/PowerPoint, MP4.`,
    };
  }

  // Verify project membership
  const { data: membership } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .is("left_at", null)
    .maybeSingle();
  if (!membership) return { error: "You are not a member of this project." };

  // Path: {project_id}/{timestamp}-{safe_filename}
  const safeFilename = filename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 100);
  const path = `${projectId}/${Date.now()}-${safeFilename}`;

  // Create a signed upload URL — client will PUT directly to Storage
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("attachments")
    .createSignedUploadUrl(path);

  if (error || !data) {
    return { error: "Upload setup failed: " + (error?.message ?? "unknown") };
  }

  return {
    ok: true,
    path: data.path,
    uploadUrl: data.signedUrl,
    token: data.token,
  };
}
