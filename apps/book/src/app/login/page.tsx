import { AppShell, Container, GlassCard, SectionLabel } from "@/components/ui";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = Array.isArray(params.next) ? params.next[0] : params.next;

  return (
    <AppShell>
      <Container className="max-w-3xl py-16">
        <GlassCard className="p-8">
          <SectionLabel>Account</SectionLabel>
          <h1 className="text-4xl font-black text-white">登录碳硅组织工具站</h1>
          <p className="mt-4 text-base leading-8 text-emerald-50/65">
            使用邮箱验证码登录。登录后，你可以找回自己的测评报告、工具记录，并进入所属组织的数据空间。
          </p>
          <LoginForm nextPath={next} />
        </GlassCard>
      </Container>
    </AppShell>
  );
}
