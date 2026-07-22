"use client";
import AppError from "@/components/shared/app-error";
export default function Error(props: { error: Error; reset: () => void }) { return <AppError {...props} />; }
