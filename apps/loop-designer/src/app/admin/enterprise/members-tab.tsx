"use client";

import { useState, useEffect } from "react";

interface Member {
  id: string;
  userId: string;
  role: string;
  isActive: boolean;
  joinedAt: string;
  user?: {
    displayName: string;
    avatarUrl: string | null;
  };
}

interface EnterpriseInfo {
  seats: {
    used: number;
    limit: number;
  };
  currentUserRole: string;
}

export default function MembersTab() {
  const [members, setMembers] = useState<Member[]>([]);
  const [enterprise, setEnterprise] = useState<EnterpriseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMembers();
  }, []);

  async function fetchMembers() {
    try {
      const res = await fetch("/loop-designer/api/admin/members");
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch members");
      }

      setMembers(data.data.members);
      setEnterprise(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load members");
    } finally {
      setLoading(false);
    }
  }

  async function removeMember(memberId: string) {
    if (!confirm("确定要移除此成员吗？")) return;

    try {
      const res = await fetch(`/loop-designer/api/admin/members/${memberId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to remove member");
      }

      // 刷新列表
      await fetchMembers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove member");
    }
  }

  async function updateRole(memberId: string, newRole: string) {
    try {
      const res = await fetch(`/loop-designer/api/admin/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) {
        throw new Error("Failed to update role");
      }

      // 刷新列表
      await fetchMembers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update role");
    }
  }

  if (loading) {
    return <div className="text-white/55">加载中...</div>;
  }

  if (error) {
    return <div className="text-red-400">{error}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">成员管理</h2>
          <p className="mt-1 text-sm text-white/55">
            管理企业成员及其角色权限
          </p>
        </div>
        {enterprise && (
          <div className="text-sm text-white/55">
            席位使用：{enterprise.seats.used} / {enterprise.seats.limit}
          </div>
        )}
      </div>

      {/* Members Table */}
      <div className="overflow-hidden rounded border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/5">
            <tr>
              <th className="px-4 py-3 font-medium">用户</th>
              <th className="px-4 py-3 font-medium">角色</th>
              <th className="px-4 py-3 font-medium">加入时间</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {members.map((member) => (
              <tr key={member.id} className="hover:bg-white/5">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {member.user?.avatarUrl ? (
                      <div
                        aria-hidden="true"
                        className="h-10 w-10 rounded-full"
                        style={{ backgroundImage: `url(${member.user.avatarUrl})`, backgroundPosition: "center", backgroundSize: "cover" }}
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-white/10" />
                    )}
                    <div>
                      <div className="font-medium">
                        {member.user?.displayName || "Unknown"}
                      </div>
                      <div className="text-xs text-white/40">
                        ID: {member.userId.slice(0, 8)}...
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <RoleBadge role={member.role} />
                </td>
                <td className="px-4 py-3 text-white/55">
                  {new Date(member.joinedAt).toLocaleDateString("zh-CN")}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded px-2 py-1 text-xs ${
                      member.isActive
                        ? "bg-green-500/20 text-green-400"
                        : "bg-gray-500/20 text-gray-400"
                    }`}
                  >
                    {member.isActive ? "活跃" : "已离开"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <RoleSelect
                    currentRole={member.role}
                    disabled={member.role === "super_admin"}
                    onChange={(newRole) => updateRole(member.userId, newRole)}
                  />
                  {member.role !== "super_admin" && (
                    <button
                      onClick={() => removeMember(member.userId)}
                      className="ml-2 text-xs text-red-400 hover:text-red-300"
                    >
                      移除
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {members.length === 0 && (
        <div className="py-12 text-center text-white/40">
          暂无成员数据
        </div>
      )}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    super_admin: "bg-purple-500/20 text-purple-400",
    billing_admin: "bg-blue-500/20 text-blue-400",
    member_admin: "bg-cyan-500/20 text-cyan-400",
    member: "bg-gray-500/20 text-gray-400",
  };

  const labels: Record<string, string> = {
    super_admin: "超级管理员",
    billing_admin: "计费管理员",
    member_admin: "成员管理员",
    member: "成员",
  };

  return (
    <span
      className={`inline-flex rounded px-2 py-1 text-xs ${colors[role] || colors.member}`}
    >
      {labels[role] || role}
    </span>
  );
}

function RoleSelect({
  currentRole,
  disabled,
  onChange,
}: {
  currentRole: string;
  disabled?: boolean;
  onChange: (role: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const roles = [
    { value: "member", label: "成员" },
    { value: "member_admin", label: "成员管理员" },
    { value: "billing_admin", label: "计费管理员" },
  ];

  return (
    <div className="relative inline-block">
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`text-xs ${
          disabled
            ? "cursor-not-allowed text-white/30"
            : "cursor-pointer text-[var(--cyan)] hover:underline"
        }`}
      >
        {disabled ? "超级管理员" : "更改角色"}
      </button>
      {open && !disabled && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-1 rounded border border-white/10 bg-black/80 p-1 shadow-lg">
            {roles.map((role) => (
              <button
                key={role.value}
                onClick={() => {
                  onChange(role.value);
                  setOpen(false);
                }}
                className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-white/10 ${
                  currentRole === role.value ? "text-[var(--acid)]" : ""
                }`}
              >
                {role.label}
                {currentRole === role.value && " ✓"}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
