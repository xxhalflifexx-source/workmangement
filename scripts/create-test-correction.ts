import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Get an employee from TCB Metal Works
  const emp = await prisma.user.findFirst({
    where: { 
      organizationId: 'e64f38b3-a436-4f90-af70-854425016cd7',
      role: 'EMPLOYEE'
    }
  });
  
  if (!emp) {
    console.log('No employee found');
    return;
  }
  
  console.log('Creating test correction for:', emp.name || emp.email);
  
  const now = new Date();
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  
  // Clean up any test entries
  const deleted = await prisma.timeEntry.deleteMany({
    where: { id: { startsWith: 'test_correction_' } }
  });
  console.log('Cleaned up', deleted.count, 'old test entries');
  
  // Create test entry with correction
  const entry = await prisma.timeEntry.create({
    data: {
      id: 'test_correction_' + Date.now(),
      userId: emp.id,
      organizationId: emp.organizationId,
      clockIn: sixHoursAgo,
      clockOut: fourHoursAgo, // Actually clocked out 4 hours ago
      durationHours: 2.0, // Corrected to 2 hours
      state: 'CLOCKED_OUT',
      flagStatus: 'FORGOT_CLOCK_OUT',
      wrongRecordedNetSeconds: Math.floor(5.5 * 3600), // Would have been 5.5 hours if let run
      correctionNote: 'Forgot to clock out for lunch - corrected by employee',
      correctionAppliedAt: now,
      updatedAt: now,
    }
  });
  
  console.log('\n✅ Created test correction entry:', entry.id);
  console.log('   Wrong hours (frozen snapshot):', 5.5);
  console.log('   Corrected hours:', 2.0);
  console.log('   Difference saved:', 3.5, 'hours');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());

