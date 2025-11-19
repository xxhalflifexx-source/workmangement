import { jsPDF } from "jspdf";

export interface InvoiceData {
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date | null;
  customerName: string | null;
  customerEmail: string | null;
  lines: Array<{
    description: string;
    quantity: number;
    rate: number;
    amount: number;
  }>;
  total: number;
  balance: number;
  notes: string | null;
  status: string;
}

export function generateInvoicePDF(invoice: InvoiceData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = margin;

  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", pageWidth - margin, yPos, { align: "right" });
  yPos += 10;

  // Invoice Number
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Invoice #: ${invoice.invoiceNumber}`, pageWidth - margin, yPos, { align: "right" });
  yPos += 15;

  // Invoice Date
  const issueDateStr = new Date(invoice.issueDate).toLocaleDateString();
  doc.text(`Date: ${issueDateStr}`, margin, yPos);
  if (invoice.dueDate) {
    const dueDateStr = new Date(invoice.dueDate).toLocaleDateString();
    doc.text(`Due Date: ${dueDateStr}`, margin, yPos + 6);
  }
  yPos += 15;

  // Customer Info
  if (invoice.customerName) {
    doc.setFont("helvetica", "bold");
    doc.text("Bill To:", margin, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(invoice.customerName, margin, yPos + 6);
    if (invoice.customerEmail) {
      doc.text(invoice.customerEmail, margin, yPos + 12);
    }
  }
  yPos += 30;

  // Line Items Table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Description", margin, yPos);
  doc.text("Qty", margin + 100, yPos);
  doc.text("Rate", margin + 120, yPos);
  doc.text("Amount", pageWidth - margin, yPos, { align: "right" });
  yPos += 8;

  // Draw line
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 5;

  // Line items
  doc.setFont("helvetica", "normal");
  invoice.lines.forEach((line) => {
    if (yPos > 250) {
      // New page if needed
      doc.addPage();
      yPos = margin;
    }

    const description = line.description.length > 40 
      ? line.description.substring(0, 37) + "..." 
      : line.description;
    
    doc.text(description, margin, yPos);
    doc.text(line.quantity.toString(), margin + 100, yPos);
    doc.text(`$${line.rate.toFixed(2)}`, margin + 120, yPos);
    doc.text(`$${line.amount.toFixed(2)}`, pageWidth - margin, yPos, { align: "right" });
    yPos += 8;
  });

  yPos += 5;
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  // Total
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Total: $${invoice.total.toFixed(2)}`, pageWidth - margin, yPos, { align: "right" });
  yPos += 8;

  if (invoice.balance < invoice.total) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Balance: $${invoice.balance.toFixed(2)}`, pageWidth - margin, yPos, { align: "right" });
    yPos += 8;
  }

  // Status
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Status: ${invoice.status}`, margin, yPos);

  // Notes
  if (invoice.notes) {
    yPos += 15;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    const splitNotes = doc.splitTextToSize(invoice.notes, pageWidth - 2 * margin);
    doc.text("Notes:", margin, yPos);
    yPos += 6;
    doc.text(splitNotes, margin, yPos);
  }

  return doc;
}

