import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import TimeRecordsClient from "./TimeRecordsClient";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

export default async function TimeRecordsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return redirect("/login");
  }

  const userId = (session.user as any).id;

  const entries = await prisma.timeEntry.findMany({
    where: { userId },
    include: {
      job: { select: { title: true } },
    },
    orderBy: { clockIn: "desc" },
    take: 300,
  });

  const serialized = entries.map((entry) => ({
    id: entry.id,
    clockIn: entry.clockIn.toISOString(),
    clockOut: entry.clockOut ? entry.clockOut.toISOString() : null,
    durationHours: entry.durationHours,
    clockInNotes: entry.clockInNotes,
    notes: entry.notes,
    images: entry.images,
    jobTitle: entry.job?.title || null,
    isRework: entry.isRework,
  }));

  return (
    <main className="min-h-screen bg-gray-50">
      <TimeRecordsClient entries={serialized} userName={session.user?.name || "You"} />
    </main>
  );
}

