import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";
import { generateInvoicePDF, InvoicePDFData } from "@/lib/pdf-generator";

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

  // Get company settings
  let companySettings = await prisma.companySettings.findFirst();
  if (!companySettings) {
    companySettings = {
      id: "",
      companyName: "TCB METAL WORKS",
      address: null,
      city: null,
      state: null,
      zipCode: null,
      phone: null,
      email: null,
      website: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // Calculate subtotal and shipping fee
  const subtotal = invoice.lines.reduce((sum, line) => sum + line.amount, 0);
  const shippingFee = invoice.total - subtotal;

  const pdfData: InvoicePDFData = {
    invoiceNumber: invoice.invoiceNumber || invoice.id.slice(0, 8).toUpperCase(),
    invoiceDate: invoice.issueDate.toISOString().split('T')[0],
    companyName: companySettings.companyName,
    companyAddress: companySettings.address || undefined,
    companyCity: companySettings.city || undefined,
    companyState: companySettings.state || undefined,
    companyZipCode: companySettings.zipCode || undefined,
    companyPhone: companySettings.phone || undefined,
    companyEmail: companySettings.email || undefined,
    customerName: invoice.customerName || invoice.customer?.name || "Customer",
    customerAddress: invoice.customer?.company || undefined,
    customerPhone: invoice.customer?.phone || undefined,
    customerEmail: invoice.customerEmail || invoice.customer?.email || undefined,
    lineItems: invoice.lines.map(line => ({
      description: line.description,
      quantity: line.quantity,
      rate: line.rate,
      amount: line.amount,
    })),
    subtotal: subtotal,
    shippingFee: shippingFee > 0 ? shippingFee : 0,
    total: invoice.total,
    notes: invoice.notes || undefined,
    paymentBank: undefined,
    paymentAccountName: companySettings.companyName,
    paymentAccountNumber: undefined,
    preparedByName: undefined,
    preparedByTitle: undefined,
  };

  const pdf = generateInvoicePDF(pdfData);
  const pdfBlob = pdf.output("blob");
  const buffer = await pdfBlob.arrayBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${invoice.invoiceNumber || invoice.id}.pdf"`,
    },
  });
}

