import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "隐私政策 — 碳硅组织设计工作室",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-16 text-gray-900">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-2 text-3xl font-bold">隐私政策</h1>
        <p className="mb-8 text-sm text-gray-500">最后更新日期：2026年6月</p>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold">1. 我们收集的信息</h2>
          <ul className="list-disc space-y-2 pl-5 text-gray-700">
            <li><strong>身份信息：</strong>您的姓名、邮箱地址、飞书企业标识（tenant_key）和用户标识（open_id）。</li>
            <li><strong>使用数据：</strong>您提交的课前问卷、创建的组织进化蓝图、回路设计方案、对话历史、以及方案导出记录。</li>
            <li><strong>技术数据：</strong>IP 地址、浏览器类型、访问时间等用于服务安全和性能分析。</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold">2. 信息的使用方式</h2>
          <ul className="list-disc space-y-2 pl-5 text-gray-700">
            <li>为您提供课前问卷、蓝图生成、回路设计方案的生成、修改和导出服务。</li>
            <li>保障服务安全，防止未经授权的访问和滥用。</li>
            <li>改进 AI 模型的输出质量（不含个人身份信息）。</li>
            <li>遵守法律法规要求。</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold">3. AI 数据处理</h2>
          <p className="text-gray-700">
            您提交的企业业务数据将发送至 AI 模型服务商（如阶跃星辰 StepFun）进行处理。
            我们已与服务商签署数据处理协议（DPA），确保您的数据仅用于响应您的请求，
            不会被用于训练或改进模型。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold">4. 数据存储与安全</h2>
          <p className="text-gray-700">
            您的数据存储在 Supabase 云数据库中。我们采用以下安全措施：
            密码哈希存储（bcrypt）、传输层加密（HTTPS）、会话令牌哈希存储、
            以及基于角色的访问控制（RLS）。
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold">5. 您的权利</h2>
          <ul className="list-disc space-y-2 pl-5 text-gray-700">
            <li><strong>访问权：</strong>您可以查看我们存储的您的个人信息。</li>
            <li><strong>导出权：</strong>您可以通过「设置」页面导出您的数据。</li>
            <li><strong>删除权：</strong>您可以通过「设置」页面删除您的账号，我们将匿名化您的个人数据。</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold">6. 联系方式</h2>
          <p className="text-gray-700">
            如有隐私相关问题，请通过企业管理员联系我们。
          </p>
        </section>
      </div>
    </main>
  );
}
