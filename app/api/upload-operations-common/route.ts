import { NextRequest, NextResponse } from "next/server";
import { getSafeServerSession } from "@/lib/api-auth";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
	try {
		const session = await getSafeServerSession(request);

		if (!session?.user) {
			return NextResponse.json({ 
				error: "Not authenticated. Please ensure cookies are enabled." 
			}, { status: 401 });
		}

		const userRole = (session.user as any).role;
		if (userRole !== "ADMIN") {
			return NextResponse.json({ error: "Unauthorized: Only admins can upload files" }, { status: 403 });
		}

		const supabaseUrl = process.env.SUPABASE_URL;
		const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
		const bucket = process.env.SUPABASE_BUCKET || "uploads";

		if (!supabaseUrl || !supabaseServiceKey) {
			console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
			return NextResponse.json(
				{ 
					error: "File storage is not configured. Please contact your administrator. Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables." 
				},
				{ status: 500 }
			);
		}

		const supabase = createClient(supabaseUrl, supabaseServiceKey);

		const formData = await request.formData();
		const files = formData.getAll("files") as File[];

		if (!files || files.length === 0) {
			return NextResponse.json({ error: "No files provided" }, { status: 400 });
		}

		const uploadedFiles: Array<{
			originalName: string;
			fileType: string;
			fileSize: number;
			fileUrl: string;
		}> = [];

		for (const file of files) {
			const bytes = await file.arrayBuffer();
			const buffer = Buffer.from(bytes);

			const timestamp = Date.now();
			const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
			const objectPath = `operations-common/${(session.user as any).id || "user"}/${timestamp}-${sanitizedName}`;

			// Determine file type category
			let fileType = "other";
			const mimeType = file.type.toLowerCase();
			if (mimeType.includes("pdf")) {
				fileType = "pdf";
			} else if (mimeType.startsWith("image/")) {
				fileType = "image";
			} else if (mimeType.includes("word") || mimeType.includes("document") || file.name.endsWith(".doc") || file.name.endsWith(".docx")) {
				fileType = "word";
			} else if (mimeType.includes("excel") || mimeType.includes("spreadsheet") || file.name.endsWith(".xls") || file.name.endsWith(".xlsx")) {
				fileType = "excel";
			} else if (mimeType.includes("cad") || file.name.endsWith(".dwg") || file.name.endsWith(".dxf")) {
				fileType = "cad";
			}

			const { error: uploadError } = await supabase
				.storage
				.from(bucket)
				.upload(objectPath, buffer, {
					cacheControl: "3600",
					contentType: file.type,
					upsert: false,
				});

			if (uploadError) {
				console.error("Supabase upload error:", uploadError);
				continue;
			}

			const { data: publicUrlData } = supabase
				.storage
				.from(bucket)
				.getPublicUrl(objectPath);

			if (publicUrlData?.publicUrl) {
				uploadedFiles.push({
					originalName: file.name,
					fileType,
					fileSize: file.size,
					fileUrl: publicUrlData.publicUrl,
				});
			}
		}

		return NextResponse.json({
			success: true,
			files: uploadedFiles,
		});
	} catch (error) {
		console.error("Upload error:", error);
		return NextResponse.json(
			{ error: "Failed to upload files" },
			{ status: 500 }
		);
	}
}

