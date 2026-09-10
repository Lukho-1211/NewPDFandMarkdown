import Link from "next/link";
import { notFound } from "next/navigation";
import { MissingTerm } from "@/app/components/missing-term";
import { PlannerPage } from "@/app/components/planner-page";
import { requireUser } from "@/lib/auth";
import {
  parseTerm,
  parseWeek,
  WEEKDAY_LABELS,
  WEEKDAYS,
} from "@/lib/planner";
import { createClient } from "@/lib/supabase/server";

export default async function WeekPage({
  params,
}: PageProps<"/term/[term]/week/[week]">) {
  const { term: termParam, week: weekParam } = await params;
  const term = parseTerm(termParam);
  const week = parseWeek(weekParam);
  if (term === null || week === null) notFound();

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
    .select("day")
    .eq("term", term)
    .eq("week", week);

  const filledDays = new Set((days ?? []).map((row) => row.day));

  return (
    <PlannerPage
      profile={profile}
      crumbs={[
        { href: "/", label: "Terms" },
        { href: `/term/${term}`, label: `Term ${term}` },
        { href: `/term/${term}/week/${week}`, label: `Week ${week}` },
      ]}
    >
      <h1 className="font-[family-name:var(--font-outfit)] text-2xl font-semibold">
        Week {week}
      </h1>
      <p className="mt-2 text-sm text-ember-muted">
        Amber mark means a worksheet is saved for that day.
      </p>
      <ul className="mt-8 grid gap-3">
        {WEEKDAYS.map((day) => {
          const filled = filledDays.has(day);
          return (
            <li key={day}>
              <Link
                href={`/term/${term}/week/${week}/day/${day}`}
                className="flex items-center justify-between rounded-2xl border border-ember-muted/25 bg-white/[0.03] px-5 py-4 transition-colors hover:border-ember-amber/60"
              >
                <span className="font-[family-name:var(--font-outfit)] text-lg font-semibold">
                  {WEEKDAY_LABELS[day]}
                </span>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    filled ? "bg-ember-amber" : "bg-ember-muted/30"
                  }`}
                  aria-label={filled ? "Has worksheet" : "Empty"}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </PlannerPage>
  );
}
