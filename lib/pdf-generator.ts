import { jsPDF } from "jspdf";

export interface InvoicePDFData {
  invoiceNumber: string;
  invoiceDate: string;
  companyName: string;
  companyAddress?: string;
  companyCity?: string;
  companyState?: string;
  companyZipCode?: string;
  companyPhone?: string;
  companyEmail?: string;
  customerName: string;
  customerAddress?: string;
  customerPhone?: string;
  customerEmail?: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    rate: number;
    amount: number;
  }>;
  subtotal: number;
  shippingFee: number;
  total: number;
  notes?: string;
  paymentBank?: string;
  paymentAccountName?: string;
  paymentAccountNumber?: string;
  preparedByName?: string;
  preparedByTitle?: string;
}

export function generateInvoicePDF(data: InvoicePDFData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let yPos = margin;

  // Set navy blue color (RGB: 30, 58, 138)
  const navyBlueR = 30;
  const navyBlueG = 58;
  const navyBlueB = 138;

  // Header Section - INVOICE title and details
  doc.setFontSize(36);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  doc.text("INVOICE", margin, yPos);
  yPos += 12;

  // Invoice Number and Date
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Invoice Number: #${data.invoiceNumber}`, margin, yPos);
  yPos += 6;
  
  const invoiceDateFormatted = new Date(data.invoiceDate).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  doc.text(`Invoice Date: ${invoiceDateFormatted}`, margin, yPos);
  yPos += 15;

  // Logo placeholder (Navy blue square) - positioned top right
  const logoSize = 24;
  const logoX = pageWidth - margin - logoSize;
  const logoY = margin;
  doc.setFillColor(navyBlueR, navyBlueG, navyBlueB);
  doc.rect(logoX, logoY, logoSize, logoSize, "F");
  
  // Logo text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("TCB", logoX + logoSize / 2, logoY + 8, { align: "center" });
  doc.setFontSize(6);
  doc.text("METAL WORKS", logoX + logoSize / 2, logoY + 15, { align: "center" });

  // Reset text color
  doc.setTextColor(50, 50, 50);

  // Company and Billing Information
  yPos += 5;
  const infoYStart = yPos;
  
  // Left: Company Info
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(data.companyName, margin, yPos);
  yPos += 6;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (data.companyAddress) {
    doc.text(data.companyAddress, margin, yPos);
    yPos += 5;
  }
  
  const locationParts = [];
  if (data.companyCity) locationParts.push(data.companyCity);
  if (data.companyState) locationParts.push(data.companyState);
  if (data.companyZipCode) locationParts.push(data.companyZipCode);
  if (locationParts.length > 0) {
    doc.text(locationParts.join(", "), margin, yPos);
    yPos += 5;
  }
  
  if (data.companyPhone) {
    doc.text(data.companyPhone, margin, yPos);
    yPos += 5;
  }
  
  if (data.companyEmail) {
    doc.text(data.companyEmail, margin, yPos);
    yPos += 5;
  }

  // Right: Bill To
  const billToX = pageWidth / 2 + 20;
  yPos = infoYStart;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("BILL TO", billToX, yPos);
  yPos += 6;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(data.customerName, billToX, yPos);
  yPos += 5;
  doc.setFont("helvetica", "normal");
  
  if (data.customerAddress) {
    doc.text(data.customerAddress, billToX, yPos);
    yPos += 5;
  }
  
  if (data.customerPhone) {
    doc.text(data.customerPhone, billToX, yPos);
    yPos += 5;
  }
  
  if (data.customerEmail) {
    doc.text(data.customerEmail, billToX, yPos);
    yPos += 5;
  }

  // Line Items Table
  yPos += 10;
  const tableStartY = yPos;
  
  // Table header
  doc.setFillColor(200, 200, 200);
  doc.rect(margin, yPos - 6, contentWidth, 8, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  doc.text("Item & Description", margin + 2, yPos);
  doc.text("Unit Price", margin + 100, yPos, { align: "right" });
  doc.text("Qty", margin + 130, yPos, { align: "center" });
  doc.text("Amount", pageWidth - margin - 2, yPos, { align: "right" });
  yPos += 8;

  // Table rows
  doc.setFont("helvetica", "normal");
  data.lineItems.forEach((item, index) => {
    // Alternate row colors
    if (index % 2 === 1) {
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, yPos - 4, contentWidth, 7, "F");
    } else {
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, yPos - 4, contentWidth, 7, "F");
    }
    
    // Draw borders
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.1);
    doc.line(margin, yPos - 4, pageWidth - margin, yPos - 4);
    
    // Item content
    doc.setTextColor(50, 50, 50);
    const description = item.description.length > 45 
      ? item.description.substring(0, 42) + "..." 
      : item.description;
    doc.text(description, margin + 2, yPos);
    doc.text(`$${item.rate.toFixed(2)}`, margin + 100, yPos, { align: "right" });
    doc.text(item.quantity.toString(), margin + 130, yPos, { align: "center" });
    doc.text(`$${item.amount.toFixed(2)}`, pageWidth - margin - 2, yPos, { align: "right" });
    yPos += 7;
  });

  // Bottom border of table
  doc.line(margin, yPos - 4, pageWidth - margin, yPos - 4);
  yPos += 5;

  // Notes and Summary Section
  const notesSummaryY = yPos;
  
  // Left: Notes/Terms
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("NOTES / TERMS:", margin, yPos);
  yPos += 6;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const notesText = data.notes || "Payment is due within 15 days of receiving this invoice.";
  const splitNotes = doc.splitTextToSize(notesText, (pageWidth / 2) - margin - 10);
  doc.text(splitNotes, margin, yPos);

  // Right: Summary Table
  const summaryX = pageWidth / 2 + 20;
  yPos = notesSummaryY;
  
  // Summary table
  const summaryRowHeight = 7;
  const summaryWidth = pageWidth - summaryX - margin;
  
  // Sub-Total row
  doc.setFillColor(240, 240, 240);
  doc.rect(summaryX, yPos - 4, summaryWidth, summaryRowHeight, "F");
  doc.setDrawColor(200, 200, 200);
  doc.rect(summaryX, yPos - 4, summaryWidth, summaryRowHeight);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Sub-Total", summaryX + 2, yPos);
  doc.text(`$${data.subtotal.toFixed(2)}`, summaryX + summaryWidth - 2, yPos, { align: "right" });
  yPos += summaryRowHeight;
  
  // Shipping Fee row
  doc.setFillColor(255, 255, 255);
  doc.rect(summaryX, yPos - 4, summaryWidth, summaryRowHeight, "F");
  doc.rect(summaryX, yPos - 4, summaryWidth, summaryRowHeight);
  doc.setFont("helvetica", "normal");
  doc.text("Shipping Fee", summaryX + 2, yPos);
  doc.text(`$${data.shippingFee.toFixed(2)}`, summaryX + summaryWidth - 2, yPos, { align: "right" });
  yPos += summaryRowHeight;
  
  // Total row (highlighted)
  doc.setFillColor(220, 220, 220);
  doc.rect(summaryX, yPos - 4, summaryWidth, summaryRowHeight, "F");
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.rect(summaryX, yPos - 4, summaryWidth, summaryRowHeight);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Total", summaryX + 2, yPos);
  doc.text(`$${data.total.toFixed(2)}`, summaryX + summaryWidth - 2, yPos, { align: "right" });
  yPos += summaryRowHeight + 10;

  // Footer - Payment Method and Prepared By
  const footerY = Math.max(yPos, pageHeight - 50);
  yPos = footerY;
  
  // Left: Payment Method
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("PAYMENT METHOD", margin, yPos);
  yPos += 6;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (data.paymentBank) {
    doc.text(`Bank: ${data.paymentBank}`, margin, yPos);
    yPos += 5;
  }
  if (data.paymentAccountName) {
    doc.text(`Account Name: ${data.paymentAccountName}`, margin, yPos);
    yPos += 5;
  }
  if (data.paymentAccountNumber) {
    doc.text(`Account Number: ${data.paymentAccountNumber}`, margin, yPos);
    yPos += 5;
  }

  // Right: Prepared By
  const preparedByX = pageWidth / 2 + 20;
  yPos = footerY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("PREPARED BY", preparedByX, yPos);
  yPos += 6;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (data.preparedByName) {
    doc.text(data.preparedByName, preparedByX, yPos);
    yPos += 5;
  }
  if (data.preparedByTitle) {
    doc.text(data.preparedByTitle, preparedByX, yPos);
  }

  // Navy blue border at bottom
  const borderY = pageHeight - 15;
  doc.setDrawColor(navyBlueR, navyBlueG, navyBlueB);
  doc.setLineWidth(1);
  doc.line(margin, borderY, pageWidth - margin, borderY);

  return doc;
}
