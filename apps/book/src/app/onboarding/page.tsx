import { redirect } from "next/navigation";
import { AppShell, Container, GlassCard, SectionLabel } from "@/components/ui";
import { getUserWorkspace, requireUser } from "@/lib/auth/server";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const user = await requireUser("/onboarding");
  const workspace = await getUserWorkspace(user.id);

  if (workspace.profile && workspace.memberships.length) {
    redirect("/dashboard");
  }

  return (
    <AppShell>
      <Container className="max-w-5xl py-12">
        <SectionLabel>Setup</SectionLabel>
        <h1 className="text-4xl font-black text-white">建立你的组织数据空间</h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-emerald-50/65">
          你可以创建一个新的组织空间，也可以通过邀请码加入已有组织。后续测评和工具提交会自动沉淀到你的个人工作台，并按组织边界进入企业数据池。
        </p>
        <GlassCard className="mt-8 p-6">
          <OnboardingForm email={user.email ?? ""} />
        </GlassCard>
      </Container>
    </AppShell>
  );
}
