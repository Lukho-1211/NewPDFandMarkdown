import Link from "next/link";
import { CreateTerm } from "@/app/components/create-term";
import { DeleteTerm } from "@/app/components/delete-term";
import { PlannerPage } from "@/app/components/planner-page";
import { requireUser } from "@/lib/auth";
import { unusedTerms } from "@/lib/planner";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const { profile, canUpload } = await requireUser();
  const supabase = await createClient();
  const { data: terms, error } = await supabase
    .from("planner_terms")
    .select("number")
    .order("number");

  if (error) {
    return (
      <PlannerPage profile={profile} crumbs={[{ label: "Terms" }]}>
        <p className="text-sm text-red-300">{error.message}</p>
      </PlannerPage>
    );
  }

  const numbers = (terms ?? []).map((row) => row.number);
  const available = unusedTerms(numbers);

  return (
    <PlannerPage profile={profile} crumbs={[{ href: "/", label: "Terms" }]}>
      <h1 className="font-[family-name:var(--font-outfit)] text-2xl font-semibold">
        Terms
      </h1>
      <p className="mt-2 text-sm text-ember-muted">
        One shared calendar for the class. Open a term, then a week, then a day.
      </p>

      {numbers.length === 0 ? (
        <p className="mt-8 text-sm text-ember-muted">
          {canUpload
            ? "Create a term to start the planner."
            : "No terms yet. A teacher or admin will create them."}
        </p>
      ) : (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {numbers.map((number) => (
            <li key={number}>
              <div className="rounded-2xl border border-ember-muted/25 bg-white/[0.03] p-5">
                <Link
                  href={`/term/${number}`}
                  className="block font-[family-name:var(--font-outfit)] text-xl font-semibold text-ember-paper transition-colors hover:text-ember-amber"
                >
                  Term {number}
                </Link>
                <p className="mt-1 text-sm text-ember-muted">
                  Weeks 1–13 · Monday–Friday
                </p>
                {canUpload && (
                  <div className="mt-4">
                    <DeleteTerm number={number} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canUpload && (
        <div className="mt-8">
          <CreateTerm unused={available} />
        </div>
      )}
    </PlannerPage>
  );
}
