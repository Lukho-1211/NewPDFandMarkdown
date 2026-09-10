import Link from "next/link";
import { CreateTerm } from "@/app/components/create-term";

export function MissingTerm({
  term,
  canUpload,
}: {
  term: number;
  canUpload: boolean;
}) {
  return (
    <div className="rounded-2xl border border-ember-muted/25 bg-white/[0.03] px-6 py-10">
      <h1 className="font-[family-name:var(--font-outfit)] text-2xl font-semibold">
        Term {term} is not on the planner yet
      </h1>
      {canUpload ? (
        <div className="mt-6">
          <CreateTerm unused={[term]} />
        </div>
      ) : (
        <p className="mt-3 text-sm text-ember-muted">
          Ask a teacher or admin to create this term.
        </p>
      )}
      <Link
        href="/"
        className="mt-6 inline-block text-sm text-ember-amber underline-offset-4 hover:underline"
      >
        Back to terms
      </Link>
    </div>
  );
}
