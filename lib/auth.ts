import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRole } from "@/lib/database.types";

export type AuthProfile = {
  id: string;
  name: string;
  email: string;
  role: ProfileRole;
};

export type AuthState = {
  userId: string;
  profile: AuthProfile | null;
  canUpload: boolean;
};

export function canUploadRole(role: ProfileRole | null | undefined) {
  return role === "admin" || role === "teacher";
}

export async function getAuthState(): Promise<AuthState | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (typeof userId !== "string") return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, email, role")
    .eq("id", userId)
    .maybeSingle();

  return {
    userId,
    profile,
    canUpload: canUploadRole(profile?.role),
  };
}

export async function requireUser() {
  const state = await getAuthState();
  if (!state) redirect("/login");
  return state;
}

export async function requireUploader() {
  const state = await requireUser();
  if (!state.canUpload) {
    throw new Error("Only teachers and admins can change the class planner.");
  }
  return state;
}
