"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markReadAction } from "./actions";

export function NotificationItem({
  id,
  targetUrl,
  className,
  animationDelay,
  children,
}: {
  id: string;
  targetUrl: string | null;
  className: string;
  animationDelay: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!targetUrl) return <div className={className} style={{ animationDelay }}>{children}</div>;

  return (
    <button
      type="button"
      className={`${className} w-full text-left`}
      style={{ animationDelay }}
      disabled={pending}
      onClick={() => startTransition(async () => {
        await markReadAction(id);
        router.push(targetUrl);
      })}
    >
      {children}
    </button>
  );
}
