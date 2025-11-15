import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user) {
			return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
		}

		const supabaseUrl = process.env.SUPABASE_URL;
		const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
		const bucket = process.env.SUPABASE_BUCKET || "uploads";

		if (!supabaseUrl || !supabaseServiceKey) {
			console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
			return NextResponse.json(
				{ error: "Storage not configured" },
				{ status: 500 }
			);
		}

		const supabase = createClient(supabaseUrl, supabaseServiceKey);

		const formData = await request.formData();
		const files = formData.getAll("files") as File[];

		if (!files || files.length === 0) {
			return NextResponse.json({ error: "No files provided" }, { status: 400 });
		}

		const uploadedPaths: string[] = [];

		for (const file of files) {
			if (!file.type.startsWith("image/")) {
				continue;
			}

			const bytes = await file.arrayBuffer();
			const buffer = Buffer.from(bytes);

			const timestamp = Date.now();
			const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
			const objectPath = `${(session.user as any).id || "user"}/${timestamp}-${sanitizedName}`;

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
				uploadedPaths.push(publicUrlData.publicUrl);
			}
		}

		return NextResponse.json({
			success: true,
			paths: uploadedPaths,
		});
	} catch (error) {
		console.error("Upload error:", error);
		return NextResponse.json(
			{ error: "Failed to upload files" },
			{ status: 500 }
		);
	}
}
