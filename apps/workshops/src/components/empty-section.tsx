import { PenLine } from "lucide-react";

export function EmptySection({ message }: { message: string }) {
  return (
    <div className="empty-section">
      <PenLine size={24} aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
