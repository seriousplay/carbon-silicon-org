"use client";

import { useState, useEffect } from "react";

interface AuditLog {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
  user?: {
    displayName: string;
  };
}

const ACTION_LABELS: Record<string, string> = {
  member_added: "添加成员",
  member_removed: "移除成员",
  member_role_updated: "更新角色",
  subscription_upgraded: "升级订阅",
  settings_updated: "修改设置",
};

export default function AuditLogsTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLogs() {
      try {
        const res = await fetch("/loop-designer/api/admin/audit-logs?limit=100");
        const data = await res.json();

        if (!data.success) {
          throw new Error(data.error || "Failed to fetch audit logs");
        }

        setLogs(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load audit logs");
      } finally {
        setLoading(false);
      }
    }

    void fetchLogs();
  }, []);

  if (loading) {
    return <div className="text-white/55">加载中...</div>;
  }

  if (error) {
    return <div className="text-red-400">{error}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold">审计日志</h2>
        <p className="mt-1 text-sm text-white/55">查看所有管理员操作记录</p>
      </div>

      {/* Logs */}
      <div className="overflow-hidden rounded border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5">
            <tr>
              <th className="px-4 py-3 font-medium">时间</th>
              <th className="px-4 py-3 font-medium">操作人</th>
              <th className="px-4 py-3 font-medium">操作</th>
              <th className="px-4 py-3 font-medium">资源类型</th>
              <th className="px-4 py-3 font-medium">详情</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-white/5">
                <td className="px-4 py-3 text-white/55">
                  {new Date(log.createdAt).toLocaleString("zh-CN")}
                </td>
                <td className="px-4 py-3">
                  {log.user?.displayName || "系统"}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex rounded bg-blue-500/20 px-2 py-1 text-xs text-blue-400">
                    {ACTION_LABELS[log.action] || log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-white/55">{log.resourceType}</td>
                <td className="px-4 py-3 text-xs text-white/40">
                  {log.details && typeof log.details === "object"
                    ? JSON.stringify(log.details)
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {logs.length === 0 && (
        <div className="py-12 text-center text-white/40">暂无审计日志</div>
      )}
    </div>
  );
}
