import { cn } from "@/lib/utils";

type BadgeVariant = "seed" | "growing" | "needs-light" | "mature" | "urgent";

const variantClass: Record<BadgeVariant, string> = {
  seed: "bg-seed-pale text-seed",
  growing: "bg-growing-pale text-growing",
  "needs-light": "bg-needs-light-pale text-needs-light",
  mature: "bg-mature-pale text-mature",
  urgent: "bg-urgent-pale text-urgent",
};

const variantDot: Record<BadgeVariant, string> = {
  seed: "bg-seed",
  growing: "bg-growing",
  "needs-light": "bg-needs-light",
  mature: "bg-mature",
  urgent: "bg-urgent",
};

/**
 * 通用状态徽章
 *
 * 配合 src/lib/constants.ts 的状态映射使用。
 * 用法：<StatusBadge variant="growing" label="生长中" icon="◐" />
 */
export function StatusBadge({
  variant = "growing",
  label,
  icon,
  pulse,
  className,
}: {
  variant?: BadgeVariant;
  label: string;
  icon?: string;
  pulse?: boolean; // 紧急状态用呼吸效果
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClass[variant],
        pulse && "animate-breathe",
        className
      )}
    >
      {icon && (
        <span className={cn("h-1.5 w-1.5 rounded-full", variantDot[variant], pulse && "animate-pulse")} />
      )}
      {label}
    </span>
  );
}
