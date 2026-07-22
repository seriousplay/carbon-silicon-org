import Link from "next/link";
import { ArrowRight, Plus, Workflow } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { requireOrgAdmin } from "@/lib/interface-workbench/admin";
import { createWorkbenchAction } from "./actions";

export default async function WorkbenchesPage() {
  const guard = await requireOrgAdmin();
  if (!guard.ok) notFound();
  const [workbenches, interfaces] = await Promise.all([
    prisma.interfaceWorkbench.findMany({
      where: { organizationId: guard.context.organizationId },
      select: { id: true, interfaceId: true, draftRevision: true, updatedAt: true, interface: { select: { name: true, status: true, fromCircle: { select: { name: true } }, toCircle: { select: { name: true } } } }, activeVersion: { select: { version: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.circleInterface.findMany({
      where: { organizationId: guard.context.organizationId, workbenches: { none: {} } },
      select: { id: true, name: true, fromCircle: { select: { name: true } }, toCircle: { select: { name: true } } }, orderBy: { name: "asc" },
    }),
  ]);
  return <main className="wb-list-shell">
    <header className="wb-list-header"><div><p className="wb-kicker">治理工具</p><h1>接口设计器</h1><p>{workbenches.length} 个工作流定义</p></div>
      <form action={createWorkbenchAction} className="wb-create-form"><select name="interfaceId" required disabled={!interfaces.length} defaultValue=""><option value="" disabled>选择未配置接口</option>{interfaces.map((item) => <option key={item.id} value={item.id}>{item.fromCircle.name} → {item.toCircle.name} · {item.name}</option>)}</select><Button type="submit" disabled={!interfaces.length}><Plus />创建</Button></form>
    </header>
    <div className="wb-table-wrap"><table className="wb-table"><thead><tr><th>接口路径</th><th>工作流</th><th>草稿</th><th>激活版本</th><th>生命周期</th><th><span className="sr-only">打开</span></th></tr></thead><tbody>{workbenches.map((item) => <tr key={item.id}><td><strong>{item.interface.fromCircle.name}</strong><ArrowRight /><strong>{item.interface.toCircle.name}</strong></td><td><Link href={`/app/interfaces/workbenches/${item.id}`}>{item.interface.name}</Link><span>{item.interfaceId}</span></td><td>r{item.draftRevision}</td><td>{item.activeVersion ? `v${item.activeVersion.version}` : "未发布"}</td><td><Badge variant={item.activeVersion ? "secondary" : "outline"}>{item.activeVersion ? "已激活" : item.interface.status}</Badge></td><td><Button variant="ghost" size="icon-sm" title="打开设计器" render={<Link href={`/app/interfaces/workbenches/${item.id}`} />}><Workflow /></Button></td></tr>)}</tbody></table>{!workbenches.length ? <div className="wb-table-empty">尚未创建接口工作流</div> : null}</div>
  </main>;
}
