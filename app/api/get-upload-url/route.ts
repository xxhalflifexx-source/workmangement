import { NextRequest, NextResponse } from "next/server";
import { getSafeServerSession } from "@/lib/api-auth";
import { createClient } from "@supabase/supabase-js";

/**
 * API endpoint to generate signed upload URLs for direct client-to-Supabase uploads.
 * This bypasses Vercel's 4.5MB payload limit by allowing the client to upload directly to Supabase.
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
		// Allow ADMIN, MANAGER, and EMPLOYEE to upload files
		if (userRole !== "ADMIN" && userRole !== "MANAGER" && userRole !== "EMPLOYEE") {
			return NextResponse.json({ error: "Unauthorized: You do not have permission to upload files" }, { status: 403 });
		}

		const supabaseUrl = process.env.SUPABASE_URL;
		const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
		const bucket = process.env.SUPABASE_BUCKET || "uploads";

		if (!supabaseUrl || !supabaseServiceKey) {
			console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
			return NextResponse.json(
				{ 
					error: "File storage is not configured. Please contact your administrator." 
				},
				{ status: 500 }
			);
		}

		const supabase = createClient(supabaseUrl, supabaseServiceKey);

		const body = await request.json();
		const { files, folder = "operations-common" } = body;

		if (!files || !Array.isArray(files) || files.length === 0) {
			return NextResponse.json({ error: "No files specified" }, { status: 400 });
		}

		const uploadUrls: Array<{
			originalName: string;
			path: string;
			signedUrl: string;
			token: string;
		}> = [];

		for (const file of files) {
			const { name, type } = file;
			
			const timestamp = Date.now();
			const sanitizedName = name.replace(/[^a-zA-Z0-9.-]/g, "_");
			const objectPath = `${folder}/${(session.user as any).id || "user"}/${timestamp}-${sanitizedName}`;

			// Create a signed URL for upload (valid for 1 hour)
			const { data, error } = await supabase.storage
				.from(bucket)
				.createSignedUploadUrl(objectPath);

			if (error) {
				console.error(`Error creating signed URL for ${name}:`, error);
				continue;
			}

			if (data) {
				uploadUrls.push({
					originalName: name,
					path: objectPath,
					signedUrl: data.signedUrl,
					token: data.token,
				});
			}
		}

		if (uploadUrls.length === 0) {
			return NextResponse.json(
				{ error: "Failed to generate upload URLs" },
				{ status: 500 }
			);
		}

		return NextResponse.json({
			success: true,
			bucket,
			uploadUrls,
		});
	} catch (error: any) {
		console.error("Get upload URL error:", error);
		return NextResponse.json(
			{ error: error?.message || "Failed to generate upload URLs" },
			{ status: 500 }
		);
	}
}

