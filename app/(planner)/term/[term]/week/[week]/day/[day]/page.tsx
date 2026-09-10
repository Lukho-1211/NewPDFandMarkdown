import { notFound } from "next/navigation";
import { MissingTerm } from "@/app/components/missing-term";
import { PlannerPage } from "@/app/components/planner-page";
import { WorksheetConverter } from "@/app/components/worksheet-converter";
import { requireUser } from "@/lib/auth";
import {
  parseTerm,
  parseWeek,
  parseWeekday,
  WEEKDAY_LABELS,
  type PlannerDay,
  type Weekday,
} from "@/lib/planner";
import { createClient } from "@/lib/supabase/server";

export default async function DayPage({
  params,
}: PageProps<"/term/[term]/week/[week]/day/[day]">) {
  const { term: termParam, week: weekParam, day: dayParam } = await params;
  const term = parseTerm(termParam);
  const week = parseWeek(weekParam);
  const day = parseWeekday(dayParam);
  if (term === null || week === null || day === null) notFound();

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

  const { data: dayRow } = await supabase
    .from("planner_days")
    .select("term, week, day, file_name, markdown, pdf_path")
    .eq("term", term)
    .eq("week", week)
    .eq("day", day)
    .maybeSingle();

  const existing: PlannerDay | null = dayRow
    ? {
        term: dayRow.term,
        week: dayRow.week,
        day: dayRow.day as Weekday,
        file_name: dayRow.file_name,
        markdown: dayRow.markdown,
        pdf_path: dayRow.pdf_path,
      }
    : null;

  return (
    <PlannerPage
      profile={profile}
      crumbs={[
        { href: "/", label: "Terms" },
        { href: `/term/${term}`, label: `Term ${term}` },
        { href: `/term/${term}/week/${week}`, label: `Week ${week}` },
        {
          href: `/term/${term}/week/${week}/day/${day}`,
          label: WEEKDAY_LABELS[day],
        },
      ]}
    >
      <h1 className="font-[family-name:var(--font-outfit)] text-2xl font-semibold">
        {WEEKDAY_LABELS[day]}
      </h1>
      <p className="mt-2 text-sm text-ember-muted">
        Term {term} · Week {week}
      </p>
      <div className="mt-8">
        <WorksheetConverter
          key={existing?.pdf_path ?? "empty"}
          term={term}
          week={week}
          day={day}
          canUpload={canUpload}
          existing={existing}
        />
      </div>
    </PlannerPage>
  );
}
