import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export { clsx, twMerge };

// Re-export commonly used utilities
export type { ClassValue } from "clsx";
