import { redirect } from "next/navigation";
import { getUserWorkspace, isOrganizationAdmin, requireUser } from "@/lib/auth/server";

export default async function NewRunLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/admin/runs/new");
  const workspace = await getUserWorkspace(user.id);
  const membership = workspace.defaultMembership ?? workspace.memberships.find((item) => item.memberRole === "admin") ?? null;

  if (!workspace.profile || !workspace.memberships.length) redirect("/onboarding");
  if (!isOrganizationAdmin(membership)) redirect("/dashboard");

  return children;
}
