"use server";

import { revalidatePath } from "next/cache";
import { getCurrentPerson } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function markAllReadAction() {
  const person = await getCurrentPerson();
  if (!person) return;

  await prisma.notification.updateMany({
    where: { organizationId: person.organizationId, recipientId: person.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath("/app/notifications");
  revalidatePath("/app");
}

export async function markReadAction(notificationId: string) {
  const person = await getCurrentPerson();
  if (!person) return;

  await prisma.notification.updateMany({
    where: {
      id: notificationId,
      organizationId: person.organizationId,
      recipientId: person.id,
    },
    data: { readAt: new Date() },
  });
  revalidatePath("/app/notifications");
  revalidatePath("/app");
}
