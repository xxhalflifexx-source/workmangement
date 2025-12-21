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

		console.log("Received files:", files.length);
		if (files.length > 0) {
			console.log("First file:", {
				name: files[0].name,
				type: files[0].type,
				size: files[0].size,
			});
		}

		if (!files || files.length === 0) {
			return NextResponse.json({ error: "No files provided" }, { status: 400 });
		}

		const uploadedFiles: Array<{
			originalName: string;
			fileType: string;
			fileSize: number;
			fileUrl: string;
		}> = [];
		const failedFiles: Array<{
			originalName: string;
			error: string;
		}> = [];

		for (const file of files) {
			try {
				console.log(`Processing file: ${file.name}, type: ${file.type}, size: ${file.size}`);
				
				const bytes = await file.arrayBuffer();
				const buffer = Buffer.from(bytes);
				
				console.log(`File buffer created, size: ${buffer.length} bytes`);

				const timestamp = Date.now();
				const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
				const objectPath = `operations-common/${(session.user as any).id || "user"}/${timestamp}-${sanitizedName}`;
				
				console.log(`Upload path: ${objectPath}`);

				// Determine file type category with improved PDF detection
				let fileType = "other";
				let contentType = file.type || "application/octet-stream";
				const mimeType = (file.type || "").toLowerCase();
				const fileNameLower = file.name.toLowerCase();
				
				console.log(`File detection - mimeType: "${mimeType}", fileName: "${fileNameLower}"`);
				
				// Check PDF: MIME type OR file extension
				if (mimeType === "application/pdf" || mimeType.includes("pdf") || fileNameLower.endsWith(".pdf")) {
					fileType = "pdf";
					// Ensure Content-Type is set correctly for PDFs
					if (!mimeType || !mimeType.includes("pdf")) {
						contentType = "application/pdf";
						console.log("PDF detected by extension, setting Content-Type to application/pdf");
					} else {
						console.log("PDF detected by MIME type");
					}
				} else if (mimeType.startsWith("image/")) {
					fileType = "image";
				} else if (mimeType.includes("word") || mimeType.includes("document") || fileNameLower.endsWith(".doc") || fileNameLower.endsWith(".docx")) {
					fileType = "word";
				} else if (mimeType.includes("excel") || mimeType.includes("spreadsheet") || fileNameLower.endsWith(".xls") || fileNameLower.endsWith(".xlsx")) {
					fileType = "excel";
				} else if (mimeType.includes("cad") || fileNameLower.endsWith(".dwg") || fileNameLower.endsWith(".dxf")) {
					fileType = "cad";
				}
				
				console.log(`File type determined: ${fileType}, Content-Type: ${contentType}`);

				console.log(`Uploading to bucket: ${bucket}`);
				const { error: uploadError, data: uploadData } = await supabase
					.storage
					.from(bucket)
					.upload(objectPath, buffer, {
						cacheControl: "3600",
						contentType: contentType,
						upsert: false,
					});

				if (uploadError) {
					console.error(`Supabase upload error for ${file.name}:`, uploadError);
					console.error(`Upload error details:`, JSON.stringify(uploadError, null, 2));
					failedFiles.push({
						originalName: file.name,
						error: uploadError.message || "Upload failed",
					});
					continue;
				}
				
				console.log(`Upload successful for ${file.name}`);

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
				} else {
					failedFiles.push({
						originalName: file.name,
						error: "Failed to generate public URL",
					});
				}
			} catch (fileError: any) {
				console.error(`Error processing file ${file.name}:`, fileError);
				failedFiles.push({
					originalName: file.name,
					error: fileError?.message || "File processing failed",
				});
			}
		}

		// If all files failed, return an error
		if (uploadedFiles.length === 0 && failedFiles.length > 0) {
			return NextResponse.json(
				{
					success: false,
					error: `All ${failedFiles.length} file(s) failed to upload`,
					failedFiles: failedFiles,
				},
				{ status: 400 }
			);
		}

		// Return success with uploaded files and any failures
		return NextResponse.json({
			success: true,
			files: uploadedFiles,
			failedFiles: failedFiles.length > 0 ? failedFiles : undefined,
		});
	} catch (error) {
		console.error("Upload error:", error);
		return NextResponse.json(
			{ error: "Failed to upload files" },
			{ status: 500 }
		);
	}
}

