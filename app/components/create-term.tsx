"use client";

import { useState, useTransition } from "react";
import { createTerm } from "@/lib/actions";

export function CreateTerm({ unused }: { unused: number[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (unused.length === 0) return null;

  return (
    <section className="rounded-2xl border border-ember-muted/25 bg-white/[0.03] px-5 py-5">
      <h2 className="font-[family-name:var(--font-outfit)] text-lg font-semibold">
        Create term
      </h2>
      <p className="mt-1 text-sm text-ember-muted">
        Opens weeks 1–13, Monday to Friday.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {unused.map((number) => (
          <button
            key={number}
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await createTerm(number);
                if (result?.error) setError(result.error);
              });
            }}
            className="cursor-pointer rounded-full bg-ember-amber px-4 py-2 text-sm font-semibold text-ember-ink transition-transform duration-150 hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-amber active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
          >
            Term {number}
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
    </section>
  );
}
