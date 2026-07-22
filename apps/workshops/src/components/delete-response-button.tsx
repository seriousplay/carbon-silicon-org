"use client";

import { useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";

interface DeleteConfirmationDialogProps {
  selectedCount: number;
  assessmentIds: string[];
  onConfirm?: (ids: string[]) => Promise<void>;
}

export function DeleteConfirmationDialog({ selectedCount, assessmentIds, onConfirm }: DeleteConfirmationDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = async () => {
    if (selectedCount === 0) return;

    setIsDeleting(true);
    try {
      if (onConfirm) {
        await onConfirm(assessmentIds);
      } else {
        const response = await fetch(`/api/assessment-responses/delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assessmentIds }),
        });

        if (!response.ok) {
          throw new Error("Delete failed");
        }
      }

      setShowConfirm(false);
      // Refresh the page to show updated data
      window.location.reload();
    } catch (error) {
      console.error("Delete error:", error);
      alert("删除失败，请稍后重试。");
    } finally {
      setIsDeleting(false);
    }
  };

  if (selectedCount === 0) return null;

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="inline-flex items-center gap-2 rounded-full border border-red-300/30 bg-red-300/10 px-4 py-2 text-sm font-bold text-red-200 transition hover:bg-red-300/20"
      >
        <Trash2 className="h-4 w-4" />
        删除选中 ({selectedCount})
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="rounded-3xl border border-red-300/30 bg-[#0c201c] p-6 shadow-2xl max-w-md">
            <div className="flex items-center gap-3 text-red-200">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-black">确认删除</h3>
            </div>
            <p className="mt-3 text-sm text-emerald-50/70">
              确定要删除选中的 {selectedCount} 条测评记录吗？此操作不可撤销。
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-full border border-emerald-200/25 px-4 py-2 text-sm font-bold text-emerald-50 transition hover:bg-white/10"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 rounded-full bg-red-300 px-4 py-2 text-sm font-black text-[#06110f] disabled:opacity-50"
              >
                {isDeleting ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
