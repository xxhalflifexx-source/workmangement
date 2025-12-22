/**
 * Migration Script: Convert Single-Tenant to Multi-Tenant
 * 
 * This script:
 * 1. Creates a default organization for existing data
 * 2. Updates all existing records to belong to this organization
 * 3. Sets the first ADMIN user as a Super Admin (isSuperAdmin = true)
 * 
 * Run with: npx tsx scripts/migrate-to-multi-tenant.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Starting multi-tenant migration...\n");

  // 1. Check if any organizations exist
  const existingOrgs = await prisma.organization.count();
  
  if (existingOrgs > 0) {
    console.log("⚠️  Organizations already exist. Skipping organization creation.");
    console.log("   If you want to re-run the migration, delete existing organizations first.\n");
  } else {
    // 2. Create default organization
    console.log("📦 Creating default organization...");
    
    // Get company settings if they exist to use for org name
    const companySettings = await prisma.companySettings.findFirst();
    const orgName = companySettings?.companyName || "Default Organization";
    const orgSlug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    
    const defaultOrg = await prisma.organization.create({
      data: {
        name: orgName,
        slug: orgSlug || "default-org",
        isActive: true,
      },
    });
    
    console.log(`✅ Created organization: "${defaultOrg.name}" (${defaultOrg.id})\n`);

    // 3. Update all existing records with the default organization
    console.log("🔄 Updating existing records with organization ID...\n");

    // Update Users
    const userCount = await prisma.user.updateMany({
      where: { organizationId: null },
      data: { organizationId: defaultOrg.id },
    });
    console.log(`   ✅ Updated ${userCount.count} users`);

    // Update Customers
    const customerCount = await prisma.customer.updateMany({
      where: { organizationId: null },
      data: { organizationId: defaultOrg.id },
    });
    console.log(`   ✅ Updated ${customerCount.count} customers`);

    // Update Jobs
    const jobCount = await prisma.job.updateMany({
      where: { organizationId: null },
      data: { organizationId: defaultOrg.id },
    });
    console.log(`   ✅ Updated ${jobCount.count} jobs`);

    // Update TimeEntries
    const timeEntryCount = await prisma.timeEntry.updateMany({
      where: { organizationId: null },
      data: { organizationId: defaultOrg.id },
    });
    console.log(`   ✅ Updated ${timeEntryCount.count} time entries`);

    // Update InventoryItems
    const inventoryCount = await prisma.inventoryItem.updateMany({
      where: { organizationId: null },
      data: { organizationId: defaultOrg.id },
    });
    console.log(`   ✅ Updated ${inventoryCount.count} inventory items`);

    // Update MaterialRequests
    const materialRequestCount = await prisma.materialRequest.updateMany({
      where: { organizationId: null },
      data: { organizationId: defaultOrg.id },
    });
    console.log(`   ✅ Updated ${materialRequestCount.count} material requests`);

    // Update JobExpenses
    const expenseCount = await prisma.jobExpense.updateMany({
      where: { organizationId: null },
      data: { organizationId: defaultOrg.id },
    });
    console.log(`   ✅ Updated ${expenseCount.count} job expenses`);

    // Update Invoices
    const invoiceCount = await prisma.invoice.updateMany({
      where: { organizationId: null },
      data: { organizationId: defaultOrg.id },
    });
    console.log(`   ✅ Updated ${invoiceCount.count} invoices`);

    // Update Quotations
    const quotationCount = await prisma.quotation.updateMany({
      where: { organizationId: null },
      data: { organizationId: defaultOrg.id },
    });
    console.log(`   ✅ Updated ${quotationCount.count} quotations`);

    // Update CompanySettings
    const settingsCount = await prisma.companySettings.updateMany({
      where: { organizationId: null },
      data: { organizationId: defaultOrg.id },
    });
    console.log(`   ✅ Updated ${settingsCount.count} company settings`);

    // Update Notifications
    const notificationCount = await prisma.notification.updateMany({
      where: { organizationId: null },
      data: { organizationId: defaultOrg.id },
    });
    console.log(`   ✅ Updated ${notificationCount.count} notifications`);

    // Update ManualFolders
    const manualFolderCount = await prisma.manualFolder.updateMany({
      where: { organizationId: null },
      data: { organizationId: defaultOrg.id },
    });
    console.log(`   ✅ Updated ${manualFolderCount.count} manual folders`);

    // Update ManualFiles
    const manualFileCount = await prisma.manualFile.updateMany({
      where: { organizationId: null },
      data: { organizationId: defaultOrg.id },
    });
    console.log(`   ✅ Updated ${manualFileCount.count} manual files`);

    // Update OperationsCommonFolders
    const opsFolderCount = await prisma.operationsCommonFolder.updateMany({
      where: { organizationId: null },
      data: { organizationId: defaultOrg.id },
    });
    console.log(`   ✅ Updated ${opsFolderCount.count} operations folders`);

    // Update OperationsCommonFiles
    const opsFileCount = await prisma.operationsCommonFile.updateMany({
      where: { organizationId: null },
      data: { organizationId: defaultOrg.id },
    });
    console.log(`   ✅ Updated ${opsFileCount.count} operations files`);

    // Update SOPDocuments
    const sopDocCount = await prisma.sOPDocument.updateMany({
      where: { organizationId: null },
      data: { organizationId: defaultOrg.id },
    });
    console.log(`   ✅ Updated ${sopDocCount.count} SOP documents`);

    // Update SOPTemplates
    const sopTemplateCount = await prisma.sOPTemplate.updateMany({
      where: { organizationId: null },
      data: { organizationId: defaultOrg.id },
    });
    console.log(`   ✅ Updated ${sopTemplateCount.count} SOP templates`);
  }

  // 4. Create Super Admin user if none exists
  console.log("\n👑 Setting up Super Admin...");
  
  const existingSuperAdmin = await prisma.user.findFirst({
    where: { isSuperAdmin: true },
  });

  if (existingSuperAdmin) {
    console.log(`   ⚠️  Super Admin already exists: ${existingSuperAdmin.email}`);
  } else {
    // Find the first ADMIN user and promote them
    const firstAdmin = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      orderBy: { createdAt: "asc" },
    });

    if (firstAdmin) {
      await prisma.user.update({
        where: { id: firstAdmin.id },
        data: { 
          isSuperAdmin: true,
          organizationId: null, // Super Admin is not tied to an org
        },
      });
      console.log(`   ✅ Promoted ${firstAdmin.email} to Super Admin`);
    } else {
      console.log("   ⚠️  No ADMIN user found. You'll need to create a Super Admin manually.");
      console.log("   Tip: Register a new user and run:");
      console.log("   npx tsx scripts/create-super-admin.ts <email>");
    }
  }

  console.log("\n✨ Migration complete!");
  console.log("\nNext steps:");
  console.log("1. Run 'npx prisma db push' to apply schema changes");
  console.log("2. Restart your development server");
  console.log("3. Log in as Super Admin to manage organizations");
}

main()
  .catch((e) => {
    console.error("❌ Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

