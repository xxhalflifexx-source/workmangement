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
  const organizationId = (session.user as any).organizationId;

  // Fetch user data with hourly rate
  const [user, entries, companySettings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { hourlyRate: true },
    }),
    prisma.timeEntry.findMany({
      where: { userId },
      include: {
        job: { select: { title: true } },
      },
      orderBy: { clockIn: "desc" },
      take: 300,
    }),
    organizationId
      ? prisma.companySettings.findFirst({
          where: { organizationId },
          select: {
            payPeriodType: true,
            payDay: true,
            payPeriodStartDate: true,
            overtimeEnabled: true,
            overtimeType: true,
            overtimeRate: true,
          },
        })
      : null,
  ]);

  const serialized = entries.map((entry) => ({
    id: entry.id,
    clockIn: entry.clockIn.toISOString(),
    clockOut: entry.clockOut ? entry.clockOut.toISOString() : null,
    breakStart: entry.breakStart ? entry.breakStart.toISOString() : null,
    breakEnd: entry.breakEnd ? entry.breakEnd.toISOString() : null,
    durationHours: entry.durationHours,
    clockInNotes: entry.clockInNotes,
    notes: entry.notes,
    images: entry.images,
    jobTitle: entry.job?.title || null,
    isRework: entry.isRework,
  }));

  const payrollSettings = {
    payPeriodType: companySettings?.payPeriodType ?? "weekly",
    payDay: companySettings?.payDay ?? "friday",
    payPeriodStartDate: companySettings?.payPeriodStartDate?.toISOString() ?? null,
    overtimeEnabled: companySettings?.overtimeEnabled ?? false,
    overtimeType: companySettings?.overtimeType ?? "weekly40",
    overtimeRate: companySettings?.overtimeRate ?? 1.5,
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <TimeRecordsClient 
        entries={serialized} 
        userName={session.user?.name || "You"}
        hourlyRate={user?.hourlyRate ?? null}
        payrollSettings={payrollSettings}
      />
    </main>
  );
}

