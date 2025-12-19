import { NextRequest, NextResponse } from "next/server";
import { getSafeServerSession } from "@/lib/api-auth";
import { generateSystemFlowchartPDF } from "@/lib/system-flowchart-generator";

export async function GET(request: NextRequest) {
  const session = await getSafeServerSession(request);
  if (!session?.user) {
    return NextResponse.json({ 
      error: "Not authenticated. Please ensure cookies are enabled." 
    }, { status: 401 });
  }

  try {
    const pdf = generateSystemFlowchartPDF();
    const pdfBlob = pdf.output("blob");
    const buffer = await pdfBlob.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="system-flowchart-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("Failed to generate system flowchart PDF:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate PDF" },
      { status: 500 }
    );
  }
}

