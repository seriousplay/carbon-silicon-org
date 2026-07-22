"use client";

import { useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import { buildPublicUrl, joinAppPath } from "@/lib/config";
import type { ReactNode } from "react";

export function PublicQr({ path, label }: { path: string; label: string }) {
  const value = useMemo(() => buildPublicUrl(path), [path]);
  return (
    <div className="qr-card">
      <QRCodeSVG value={value} size={152} includeMargin fgColor="#151712" bgColor="#f4efe6" />
      <strong>{label}</strong>
      <small>{value}</small>
    </div>
  );
}

export function AppLink({ path, children }: { path: string; children: ReactNode }) {
  return <a href={joinAppPath(path)}>{children}</a>;
}
