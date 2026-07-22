"use client";

import { useState, useEffect } from "react";

interface SubscriptionInfo {
  tier: string;
  seatLimit: number | string;
  usedSeats: number;
  isTrial: boolean;
  trialEndsAt: string | null;
  nextBillingDate: string | null;
  amount: number | null;
  availableTiers: Array<{
    tier: string;
    name: string;
    price: number | string;
    seats: number | string;
  }>;
}

export default function SubscriptionTab() {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    fetchSubscription();
  }, []);

  async function fetchSubscription() {
    try {
      const res = await fetch("/loop-designer/api/admin/subscription");
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch subscription");
      }

      setSubscription(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load subscription");
    } finally {
      setLoading(false);
    }
  }

  async function upgradeTier(tier: string) {
    if (
      !confirm(
        `确定要升级到${subscription?.availableTiers.find((t) => t.tier === tier)?.name}吗？`
      )
    ) {
      return;
    }

    setUpgrading(true);
    try {
      const res = await fetch("/loop-designer/api/admin/subscription", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to upgrade subscription");
      }

      alert("订阅升级成功！");
      await fetchSubscription();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to upgrade subscription");
    } finally {
      setUpgrading(false);
    }
  }

  if (loading) {
    return <div className="text-white/55">加载中...</div>;
  }

  if (error) {
    return <div className="text-red-400">{error}</div>;
  }

  if (!subscription) {
    return <div className="text-white/55">暂无订阅信息</div>;
  }

  const tierLabels: Record<string, string> = {
    free: "免费版",
    pro: "专业版",
    enterprise: "企业版",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold">订阅管理</h2>
        <p className="mt-1 text-sm text-white/55">查看和管理企业订阅</p>
      </div>

      {/* Current Plan */}
      <div className="rounded-lg border border-[var(--acid)]/30 bg-[var(--acid)]/5 p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-white/40">当前套餐</div>
            <div className="mt-1 text-2xl font-bold text-[var(--acid)]">
              {tierLabels[subscription.tier] || subscription.tier}
            </div>
            {subscription.isTrial && subscription.trialEndsAt && (
              <div className="mt-2 text-sm text-orange-400">
                试用期至：{new Date(subscription.trialEndsAt).toLocaleDateString("zh-CN")}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-sm text-white/55">席位使用</div>
            <div className="mt-1 text-lg font-bold">
              {subscription.usedSeats} / {subscription.seatLimit === 999 ? "∞" : subscription.seatLimit}
            </div>
          </div>
        </div>
      </div>

      {/* Available Tiers */}
      <div>
        <h3 className="mb-4 text-lg font-bold">可用套餐</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {subscription.availableTiers.map((tier) => {
            const isCurrent = tier.tier === subscription.tier;
            const priceDisplay =
              tier.price === 0
                ? "免费"
                : tier.price === "custom"
                ? "定制"
                : `¥${tier.price}/月`;

            return (
              <div
                key={tier.tier}
                className={`rounded-lg border p-6 ${
                  isCurrent
                    ? "border-[var(--acid)] bg-[var(--acid)]/5"
                    : "border-white/10 bg-white/5"
                }`}
              >
                <div className="mb-4">
                  <div className="text-lg font-bold">{tier.name}</div>
                  <div className="mt-2 text-2xl font-bold text-[var(--cyan)]">
                    {priceDisplay}
                  </div>
                  <div className="mt-1 text-xs text-white/40">
                    {tier.seats === "unlimited"
                      ? "无限席位"
                      : `最多 ${tier.seats} 席位`}
                  </div>
                </div>

                {isCurrent && (
                  <div className="mb-4 rounded bg-[var(--acid)]/20 px-3 py-1.5 text-center text-sm text-[var(--acid)]">
                    当前套餐
                  </div>
                )}

                {!isCurrent && (
                  <button
                    onClick={() => upgradeTier(tier.tier)}
                    disabled={upgrading}
                    className="w-full rounded border border-white/20 px-4 py-2 text-sm font-bold hover:bg-white/10 disabled:opacity-50"
                  >
                    {upgrading ? "处理中..." : "升级"}
                  </button>
                )}

                {/* Features */}
                <ul className="mt-4 space-y-2 text-xs text-white/55">
                  {tier.tier === "free" && (
                    <>
                      <li>✓ 基础回路设计</li>
                      <li>✓ Markdown 导出</li>
                      <li>✓ PDF 导出</li>
                      <li className="text-white/30">✗ 飞书文档导出</li>
                      <li className="text-white/30">✗ GPT-4 模型</li>
                    </>
                  )}
                  {tier.tier === "pro" && (
                    <>
                      <li>✓ 基础回路设计</li>
                      <li>✓ Markdown 导出</li>
                      <li>✓ PDF 导出</li>
                      <li>✓ 飞书文档导出</li>
                      <li>✓ GPT-4 模型</li>
                      <li className="text-white/30">✗ Claude 模型</li>
                      <li className="text-white/30">✗ SSO 单点登录</li>
                    </>
                  )}
                  {tier.tier === "enterprise" && (
                    <>
                      <li>✓ 专业版全部功能</li>
                      <li>✓ Claude 模型</li>
                      <li>✓ SSO 单点登录</li>
                      <li>✓ 自定义品牌标识</li>
                      <li>✓ SLA 保障</li>
                      <li>✓ 专属客户成功经理</li>
                    </>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
