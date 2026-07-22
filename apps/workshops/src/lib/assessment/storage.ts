"use client";

import type { Report } from "./types";

const REPORTS_KEY = "carbon-silicon-reports";

export function saveLocalReport(report: Report) {
  const current = getLocalReports();
  const next = [report, ...current.filter((item) => item.id !== report.id)];
  localStorage.setItem(REPORTS_KEY, JSON.stringify(next.slice(0, 50)));
}

export function getLocalReports(): Report[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(REPORTS_KEY);
    return raw ? (JSON.parse(raw) as Report[]) : [];
  } catch {
    return [];
  }
}

export function getLocalReport(id: string): Report | undefined {
  return getLocalReports().find((report) => report.id === id);
}
