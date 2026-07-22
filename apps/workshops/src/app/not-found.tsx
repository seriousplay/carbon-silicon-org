import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="not-found shell">
      <span>404</span>
      <div>
        <p className="eyebrow">PAGE NOT FOUND</p>
        <h1>这一页还没有被写出来。</h1>
        <p>链接可能已经变化，也可能这项实验尚未发生。</p>
        <Link className="read-link" href="/">
          <ArrowLeft size={18} aria-hidden="true" /> 返回首页
        </Link>
      </div>
    </div>
  );
}
