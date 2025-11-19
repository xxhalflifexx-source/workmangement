import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { generateInvoicePDF } from "@/lib/pdf-generator";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const role = (session.user as any).role;
  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      lines: true,
      customer: true,
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const pdf = generateInvoicePDF({
    invoiceNumber: invoice.invoiceNumber || invoice.id.slice(0, 8).toUpperCase(),
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    customerName: invoice.customerName || invoice.customer?.name || null,
    customerEmail: invoice.customerEmail || invoice.customer?.email || null,
    lines: invoice.lines,
    total: invoice.total,
    balance: invoice.balance,
    notes: invoice.notes,
    status: invoice.status,
  });

  const pdfBlob = pdf.output("blob");
  const buffer = await pdfBlob.arrayBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${invoice.invoiceNumber || invoice.id}.pdf"`,
    },
  });
}

