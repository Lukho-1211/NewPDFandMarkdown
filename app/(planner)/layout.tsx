import { requireUser } from "@/lib/auth";

export default async function PlannerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return children;
}
