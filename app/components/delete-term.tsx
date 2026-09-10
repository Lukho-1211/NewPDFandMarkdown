"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteTerm } from "@/lib/actions";

export function DeleteTerm({ number }: { number: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (
            !window.confirm(
              `Delete Term ${number}? All worksheets in this term will be removed.`,
            )
          ) {
            return;
          }
          setError(null);
          startTransition(async () => {
            const result = await deleteTerm(number);
            if (result.error) {
              setError(result.error);
              return;
            }
            router.push("/");
            router.refresh();
          });
        }}
        className="cursor-pointer text-sm text-ember-muted underline-offset-4 hover:text-red-300 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-amber disabled:opacity-60"
      >
        Delete term
      </button>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
    </div>
  );
}
