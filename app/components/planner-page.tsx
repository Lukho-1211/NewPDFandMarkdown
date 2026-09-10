import { AppHeader } from "@/app/components/app-header";
import type { AuthProfile } from "@/lib/auth";

export function PlannerPage({
  crumbs,
  profile,
  children,
  footer,
}: {
  crumbs: { href?: string; label: string }[];
  profile: AuthProfile | null;
  children: React.ReactNode;
  footer?: string;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <AppHeader profile={profile} crumbs={crumbs} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-10">
        {children}
        <p className="mt-auto pt-10 text-center text-xs text-ember-muted/70">
          {footer ??
            "Worksheets are stored for the class. Scans are sent to Gemini for transcription."}
        </p>
      </main>
    </div>
  );
}
