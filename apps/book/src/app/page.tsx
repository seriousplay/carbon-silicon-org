import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "碳硅组织进化工作室",
  description: "AI时代领导者的组织设计工具集。",
};

export default function StudioHomePage() {
  redirect("/loop-designer/studio");
}
