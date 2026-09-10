import { signOut } from "@/lib/actions";
import type { AuthProfile } from "@/lib/auth";
import { Breadcrumbs } from "@/app/components/breadcrumbs";

const ROLE_LABEL: Record<AuthProfile["role"], string> = {
  admin: "Admin",
  teacher: "Teacher",
  student: "Student",
  parent: "Parent",
};

export function AppHeader({
  profile,
  crumbs,
}: {
  profile: AuthProfile | null;
  crumbs: { href?: string; label: string }[];
}) {
  return (
    <header className="border-b-[3px] border-ember-amber bg-ember-navy">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-6 pb-5 pt-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-[family-name:var(--font-outfit)] text-2xl font-semibold tracking-tight text-ember-amber md:text-3xl">
              Ember Maths12
            </p>
            <p className="mt-1 max-w-md text-sm text-ember-muted">
              Shared class planner. Teachers upload. Students download.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {profile && (
              <p className="text-right text-xs text-ember-muted">
                {profile.name}
                <span className="block text-ember-amber/90">
                  {ROLE_LABEL[profile.role]}
                </span>
              </p>
            )}
            <form action={signOut}>
              <button
                type="submit"
                className="cursor-pointer rounded-full border border-ember-muted/40 px-3 py-1 text-xs font-medium text-ember-muted transition-colors hover:border-ember-amber/70 hover:text-ember-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember-amber"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
        <Breadcrumbs items={crumbs} />
      </div>
      <div className="h-px bg-ember-muted/80" />
    </header>
  );
}
