"use client";

import { Copy, Download } from "lucide-react";

export function PresentControls({ copyText, downloadUrl }: { copyText: string; downloadUrl: string }) {
  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
  }

  async function downloadJson() {
    const response = await fetch(downloadUrl);
    const text = await response.text();
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "field-cocreation-export.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <button className="chip" onClick={() => void copy(copyText)} type="button">
        <Copy size={14} /> 复制链接
      </button>
      <button className="solid-btn" onClick={() => void downloadJson()} type="button">
        <Download size={16} /> 导出 JSON
      </button>
    </>
  );
}
