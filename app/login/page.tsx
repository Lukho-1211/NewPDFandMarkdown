import { redirect } from "next/navigation";
import { LoginForm } from "@/app/login/login-form";
import { getAuthState } from "@/lib/auth";

export default async function LoginPage() {
  const state = await getAuthState();
  if (state) redirect("/");

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b-[3px] border-ember-amber bg-ember-navy">
        <div className="mx-auto max-w-3xl px-6 pb-5 pt-8">
          <p className="font-[family-name:var(--font-outfit)] text-2xl font-semibold tracking-tight text-ember-amber md:text-3xl">
            Ember Maths12
          </p>
          <p className="mt-1 max-w-md text-sm text-ember-muted">
            Sign in to the shared class planner.
          </p>
        </div>
        <div className="h-px bg-ember-muted/80" />
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-10">
        <h1 className="font-[family-name:var(--font-outfit)] text-2xl font-semibold">
          Sign in
        </h1>
        <p className="mt-2 text-sm text-ember-muted">
          Teachers and admins upload worksheets. Students download them.
        </p>
        <LoginForm />
      </main>
    </div>
  );
}
