import { NextRequest, NextResponse } from "next/server";
import { getSafeServerSession } from "@/lib/api-auth";
import { createClient } from "@supabase/supabase-js";

/**
 * API endpoint to confirm an upload and get the public URL.
 * Called after the client has directly uploaded to Supabase using a signed URL.
 */
export async function POST(request: NextRequest) {
	try {
		const session = await getSafeServerSession(request);

		if (!session?.user) {
			return NextResponse.json({ 
				error: "Not authenticated. Please ensure cookies are enabled." 
			}, { status: 401 });
		}

		const userRole = (session.user as any).role;
		// Allow ADMIN, MANAGER, and EMPLOYEE
		if (userRole !== "ADMIN" && userRole !== "MANAGER" && userRole !== "EMPLOYEE") {
			return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
		}

		const supabaseUrl = process.env.SUPABASE_URL;
		const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
		const bucket = process.env.SUPABASE_BUCKET || "uploads";

		if (!supabaseUrl || !supabaseServiceKey) {
			return NextResponse.json(
				{ error: "File storage is not configured." },
				{ status: 500 }
			);
		}

		const supabase = createClient(supabaseUrl, supabaseServiceKey);

		const body = await request.json();
		const { path, originalName, fileSize } = body;

		if (!path) {
			return NextResponse.json({ error: "Path is required" }, { status: 400 });
		}

		// Get the public URL for the uploaded file
		const { data: publicUrlData } = supabase.storage
			.from(bucket)
			.getPublicUrl(path);

		if (!publicUrlData?.publicUrl) {
			return NextResponse.json(
				{ error: "Failed to get public URL" },
				{ status: 500 }
			);
		}

		// Determine file type from extension
		const fileNameLower = (originalName || path).toLowerCase();
		let fileType = "other";
		
		if (fileNameLower.endsWith(".pdf")) {
			fileType = "pdf";
		} else if (fileNameLower.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
			fileType = "image";
		} else if (fileNameLower.match(/\.(doc|docx)$/)) {
			fileType = "word";
		} else if (fileNameLower.match(/\.(xls|xlsx)$/)) {
			fileType = "excel";
		} else if (fileNameLower.match(/\.(dwg|dxf)$/)) {
			fileType = "cad";
		}

		return NextResponse.json({
			success: true,
			fileUrl: publicUrlData.publicUrl,
			originalName: originalName || path.split("/").pop(),
			fileType,
			fileSize: fileSize || 0,
		});
	} catch (error: any) {
		console.error("Confirm upload error:", error);
		return NextResponse.json(
			{ error: error?.message || "Failed to confirm upload" },
			{ status: 500 }
		);
	}
}

