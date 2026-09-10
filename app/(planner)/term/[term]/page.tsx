import Link from "next/link";
import { notFound } from "next/navigation";
import { MissingTerm } from "@/app/components/missing-term";
import { PlannerPage } from "@/app/components/planner-page";
import { requireUser } from "@/lib/auth";
import { parseTerm, weeks } from "@/lib/planner";
import { createClient } from "@/lib/supabase/server";

export default async function TermPage({
  params,
}: PageProps<"/term/[term]">) {
  const { term: termParam } = await params;
  const term = parseTerm(termParam);
  if (term === null) notFound();

  const { profile, canUpload } = await requireUser();
  const supabase = await createClient();
  const { data: termRow } = await supabase
    .from("planner_terms")
    .select("number")
    .eq("number", term)
    .maybeSingle();

  if (!termRow) {
    return (
      <PlannerPage
        profile={profile}
        crumbs={[
          { href: "/", label: "Terms" },
          { label: `Term ${term}` },
        ]}
      >
        <MissingTerm term={term} canUpload={canUpload} />
      </PlannerPage>
    );
  }

  const { data: days } = await supabase
    .from("planner_days")
    .select("week")
    .eq("term", term);

  const filledWeeks = new Set((days ?? []).map((row) => row.week));

  return (
    <PlannerPage
      profile={profile}
      crumbs={[
        { href: "/", label: "Terms" },
        { href: `/term/${term}`, label: `Term ${term}` },
      ]}
    >
      <h1 className="font-[family-name:var(--font-outfit)] text-2xl font-semibold">
        Term {term}
      </h1>
      <p className="mt-2 text-sm text-ember-muted">
        Amber mark means at least one worksheet is saved in that week.
      </p>
      <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {weeks().map((week) => {
          const filled = filledWeeks.has(week);
          return (
            <li key={week}>
              <Link
                href={`/term/${term}/week/${week}`}
                className="flex items-center justify-between rounded-2xl border border-ember-muted/25 bg-white/[0.03] px-4 py-4 transition-colors hover:border-ember-amber/60"
              >
                <span className="font-[family-name:var(--font-outfit)] font-semibold">
                  Week {week}
                </span>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    filled ? "bg-ember-amber" : "bg-ember-muted/30"
                  }`}
                  aria-label={filled ? "Has worksheets" : "Empty"}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </PlannerPage>
  );
}
