import "server-only";

import { redirect } from "next/navigation";
import { readAppSession } from "./app-session";

export async function getCurrentUser() {
  return readAppSession();
}

export async function requireUser(returnPath = "/loop-designer") {
  const user = await getCurrentUser();
  if (user) return user;
  redirect(`/auth/login?next=${encodeURIComponent(returnPath)}`);
}
