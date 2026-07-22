import Link from "next/link";
import { NewProjectForm } from "../new-form";

export default function NewProjectPage() {
  return (
    <div className="max-w-2xl mx-auto animate-fade-rise">
      <Link
        href="/app/projects"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 inline-block"
      >
        ← 项目
      </Link>
      <h1 className="font-serif text-2xl font-medium mb-1">项目创建已迁移至战术会</h1>
      <p className="text-sm text-muted-foreground mb-8">
        独立创建入口已停用，以保留提案、会议结果与项目之间的完整追溯。
      </p>
      <NewProjectForm />
    </div>
  );
}
