import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function updateUserRole() {
  try {
    // Find user by email or name
    const email = "xxhalflifexx@gmail.com"; // Update this if needed
    
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.log(`❌ User with email ${email} not found.`);
      console.log("\nSearching by name instead...");
      
      const userByName = await prisma.user.findFirst({
        where: {
          name: {
            contains: "xxhalflifexx",
          },
        },
      });

      if (!userByName) {
        console.log("❌ User not found by name either.");
        console.log("\nAll users in database:");
        const allUsers = await prisma.user.findMany({
          select: { id: true, name: true, email: true, role: true },
        });
        console.table(allUsers);
        return;
      }

      // Update role for user found by name
      await prisma.user.update({
        where: { id: userByName.id },
        data: { role: "ADMIN" },
      });

      console.log(`✅ Successfully updated ${userByName.name} (${userByName.email}) to ADMIN role!`);
      return;
    }

    // Update role
    await prisma.user.update({
      where: { email },
      data: { role: "ADMIN" },
    });

    console.log(`✅ Successfully updated ${user.name} (${user.email}) to ADMIN role!`);
  } catch (error) {
    console.error("Error updating user role:", error);
  } finally {
    await prisma.$disconnect();
  }
}

updateUserRole();



