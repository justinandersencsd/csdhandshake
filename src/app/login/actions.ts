"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;

  if (!email || !password) {
    redirect("/login?error=Email+and+password+are+required");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  // Check deactivated status
  if (data.user) {
    const { data: profile } = await supabase
      .from("users")
      .select("deactivated_at")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profile?.deactivated_at) {
      await supabase.auth.signOut();
      redirect("/login?error=Your+account+has+been+deactivated.+Contact+your+district+administrator.");
    }
  }

  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
