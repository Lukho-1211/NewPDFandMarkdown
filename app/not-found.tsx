import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-16">
      <h1 className="font-[family-name:var(--font-outfit)] text-2xl font-semibold">
        Page not found
      </h1>
      <p className="mt-2 text-sm text-ember-muted">
        That term, week, or day is outside the class planner.
      </p>
      <Link
        href="/"
        className="mt-6 text-sm text-ember-amber underline-offset-4 hover:underline"
      >
        Back to terms
      </Link>
    </div>
  );
}
