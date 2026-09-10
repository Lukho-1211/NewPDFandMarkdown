"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUploader } from "@/lib/auth";
import { TERM_MAX, TERM_MIN, WORKSHEETS_BUCKET } from "@/lib/planner";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createTerm(number: number) {
  if (!Number.isInteger(number) || number < TERM_MIN || number > TERM_MAX) {
    return { error: "Choose a term from 1 to 4." };
  }

  const { userId } = await requireUploader();
  const supabase = await createClient();
  const { error } = await supabase.from("planner_terms").insert({
    number,
    created_by: userId,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: `Term ${number} already exists.` };
    }
    return { error: error.message };
  }

  revalidatePath("/");
  redirect(`/term/${number}`);
}

export async function deleteTerm(number: number) {
  if (!Number.isInteger(number) || number < TERM_MIN || number > TERM_MAX) {
    return { error: "Choose a term from 1 to 4." };
  }

  await requireUploader();
  const supabase = await createClient();

  const { data: days } = await supabase
    .from("planner_days")
    .select("pdf_path")
    .eq("term", number);

  const paths = (days ?? []).map((row) => row.pdf_path).filter(Boolean);
  if (paths.length > 0) {
    await supabase.storage.from(WORKSHEETS_BUCKET).remove(paths);
  }

  const { error } = await supabase
    .from("planner_terms")
    .delete()
    .eq("number", number);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  revalidatePath(`/term/${number}`);
  return { error: null };
}
