import { NextRequest, NextResponse } from "next/server";
import { getSafeServerSession } from "@/lib/api-auth";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const session = await getSafeServerSession(request);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Not authenticated. Please ensure cookies are enabled." },
        { status: 401 }
      );
    }

    const userRole = (session.user as any).role;
    if (userRole !== "ADMIN") {
      return NextResponse.json({ error: "Only admins can upload the logo" }, { status: 403 });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = process.env.SUPABASE_BUCKET || "uploads";

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return NextResponse.json(
        {
          error:
            "File storage is not configured. Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.",
        },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Limit size to ~2MB to avoid oversized logos
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "Logo must be under 2MB" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const objectPath = `company/logo/${timestamp}-${sanitizedName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(objectPath, buffer, {
        cacheControl: "3600",
        contentType: file.type || "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return NextResponse.json({ error: "Failed to upload logo" }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    const logoUrl = publicUrlData?.publicUrl;

    if (!logoUrl) {
      return NextResponse.json({ error: "Failed to retrieve logo URL" }, { status: 500 });
    }

    // Persist to company settings (create if missing) - filter by organization
    const userOrganizationId = (session.user as any)?.organizationId || null;
    const existing = userOrganizationId
      ? await prisma.companySettings.findFirst({
          where: { organizationId: userOrganizationId }
        }).catch(() => null)
      : await prisma.companySettings.findFirst().catch(() => null);
    
    if (existing) {
      await prisma.companySettings.update({
        where: { id: existing.id },
        data: { logoUrl },
      });
    } else {
      await prisma.companySettings.create({
        data: {
          companyName: "Your Company Name",
          logoUrl,
          organizationId: userOrganizationId, // Multi-tenant support
        },
      });
    }

    return NextResponse.json({ success: true, logoUrl });
  } catch (error) {
    console.error("Logo upload error:", error);
    return NextResponse.json({ error: "Failed to upload logo" }, { status: 500 });
  }
}

