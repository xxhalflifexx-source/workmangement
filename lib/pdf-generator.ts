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
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  let yPos = margin;

  // Set navy blue color (RGB: 30, 58, 138)
  const navyBlueR = 30;
  const navyBlueG = 58;
  const navyBlueB = 138;

  // Header Section - INVOICE title and details on left, logo on top right
  const headerY = yPos;
  
  // Left: INVOICE title and details
  doc.setFontSize(32);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(50, 50, 50);
  doc.text("INVOICE", margin, yPos);
  yPos += 10;

  // Invoice Number and Date
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Invoice Number: #${data.invoiceNumber}`, margin, yPos);
  yPos += 5;
  
  const invoiceDateFormatted = new Date(data.invoiceDate).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
  doc.text(`Invoice Date: ${invoiceDateFormatted}`, margin, yPos);
  
  // Top Right: Logo text - Large "TCB" above "METAL WORKS" in top right corner (arrow area)
  const logoX = pageWidth - margin;
  const logoY = margin + 8;
  
  // TCB - Larger text on top, right-aligned
  doc.setTextColor(navyBlueR, navyBlueG, navyBlueB);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("TCB", logoX, logoY, { align: "right" });
  
  // METAL WORKS - Smaller text below, right-aligned
  doc.setFontSize(11);
  doc.text("METAL WORKS", logoX, logoY + 8, { align: "right" });
  
  // Update yPos to continue with company info
  yPos += 12;

  // Reset text color
  doc.setTextColor(50, 50, 50);

  // Company and Billing Information - Compact layout
  const infoYStart = yPos;
  let leftMaxY = yPos;
  let rightMaxY = yPos;
  
  // Left: Company Info
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(data.companyName, margin, yPos);
  leftMaxY = yPos + 5;
  yPos += 5;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  if (data.companyAddress) {
    doc.text(data.companyAddress, margin, yPos);
    leftMaxY = yPos + 4;
    yPos += 4;
  }
  
  const locationParts = [];
  if (data.companyCity) locationParts.push(data.companyCity);
  if (data.companyState) locationParts.push(data.companyState);
  if (data.companyZipCode) locationParts.push(data.companyZipCode);
  if (locationParts.length > 0) {
    doc.text(locationParts.join(", "), margin, yPos);
    leftMaxY = yPos + 4;
    yPos += 4;
  }
  
  if (data.companyPhone) {
    doc.text(data.companyPhone, margin, yPos);
    leftMaxY = yPos + 4;
    yPos += 4;
  }
  
  if (data.companyEmail) {
    doc.text(data.companyEmail, margin, yPos);
    leftMaxY = yPos + 4;
    yPos += 4;
  }

  // Right: Bill To
  const billToX = pageWidth / 2 + 15;
  yPos = infoYStart;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("BILL TO", billToX, yPos);
  rightMaxY = yPos + 5;
  yPos += 5;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(data.customerName, billToX, yPos);
  rightMaxY = yPos + 4;
  yPos += 4;
  doc.setFont("helvetica", "normal");
  
  if (data.customerAddress) {
    doc.text(data.customerAddress, billToX, yPos);
    rightMaxY = yPos + 4;
    yPos += 4;
  }
  
  if (data.customerPhone) {
    doc.text(data.customerPhone, billToX, yPos);
    rightMaxY = yPos + 4;
    yPos += 4;
  }
  
  if (data.customerEmail) {
    doc.text(data.customerEmail, billToX, yPos);
    rightMaxY = yPos + 4;
    yPos += 4;
  }

  // Use the maximum Y position from both columns
  yPos = Math.max(leftMaxY, rightMaxY) + 8;

  // Line Items Table
  const tableStartY = yPos;
  
  // Table header
  doc.setFillColor(200, 200, 200);
  doc.rect(margin, yPos - 5, contentWidth, 7, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(50, 50, 50);
  doc.text("Item & Description", margin + 2, yPos);
  doc.text("Unit Price", margin + 95, yPos, { align: "right" });
  doc.text("Qty", margin + 120, yPos, { align: "center" });
  doc.text("Amount", pageWidth - margin - 2, yPos, { align: "right" });
  yPos += 7;

  // Table rows
  doc.setFont("helvetica", "normal");
  data.lineItems.forEach((item, index) => {
    // Alternate row colors
    if (index % 2 === 1) {
      doc.setFillColor(245, 245, 245);
      doc.rect(margin, yPos - 3, contentWidth, 6, "F");
    } else {
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, yPos - 3, contentWidth, 6, "F");
    }
    
    // Draw borders
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.1);
    doc.line(margin, yPos - 3, pageWidth - margin, yPos - 3);
    
    // Item content
    doc.setTextColor(50, 50, 50);
    const description = item.description.length > 40 
      ? item.description.substring(0, 37) + "..." 
      : item.description;
    doc.text(description, margin + 2, yPos);
    doc.text(`$${item.rate.toFixed(2)}`, margin + 95, yPos, { align: "right" });
    doc.text(item.quantity.toString(), margin + 120, yPos, { align: "center" });
    doc.text(`$${item.amount.toFixed(2)}`, pageWidth - margin - 2, yPos, { align: "right" });
    yPos += 6;
  });

  // Bottom border of table
  doc.line(margin, yPos - 3, pageWidth - margin, yPos - 3);
  yPos += 6;

  // Notes and Summary Section - Compact layout
  const notesSummaryY = yPos;
  let notesMaxY = yPos;
  
  // Left: Notes/Terms
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("NOTES / TERMS:", margin, yPos);
  notesMaxY = yPos + 5;
  yPos += 5;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const notesText = data.notes || "Payment is due within 15 days of receiving this invoice.";
  const notesWidth = (pageWidth / 2) - margin - 8;
  const splitNotes = doc.splitTextToSize(notesText, notesWidth);
  doc.text(splitNotes, margin, yPos);
  notesMaxY = yPos + (splitNotes.length * 4);

  // Right: Summary Table
  const summaryX = pageWidth / 2 + 15;
  yPos = notesSummaryY;
  
  // Summary table
  const summaryRowHeight = 6;
  const summaryWidth = pageWidth - summaryX - margin;
  
  // Sub-Total row
  doc.setFillColor(240, 240, 240);
  doc.rect(summaryX, yPos - 3, summaryWidth, summaryRowHeight, "F");
  doc.setDrawColor(200, 200, 200);
  doc.rect(summaryX, yPos - 3, summaryWidth, summaryRowHeight);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Sub-Total", summaryX + 2, yPos);
  doc.text(`$${data.subtotal.toFixed(2)}`, summaryX + summaryWidth - 2, yPos, { align: "right" });
  yPos += summaryRowHeight;
  
  // Shipping Fee row
  doc.setFillColor(255, 255, 255);
  doc.rect(summaryX, yPos - 3, summaryWidth, summaryRowHeight, "F");
  doc.rect(summaryX, yPos - 3, summaryWidth, summaryRowHeight);
  doc.setFont("helvetica", "normal");
  doc.text("Shipping Fee", summaryX + 2, yPos);
  doc.text(`$${data.shippingFee.toFixed(2)}`, summaryX + summaryWidth - 2, yPos, { align: "right" });
  yPos += summaryRowHeight;
  
  // Total row (highlighted)
  doc.setFillColor(220, 220, 220);
  doc.rect(summaryX, yPos - 3, summaryWidth, summaryRowHeight, "F");
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.rect(summaryX, yPos - 3, summaryWidth, summaryRowHeight);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Total", summaryX + 2, yPos);
  doc.text(`$${data.total.toFixed(2)}`, summaryX + summaryWidth - 2, yPos, { align: "right" });
  const summaryMaxY = yPos + summaryRowHeight;

  // Use the maximum Y position from notes and summary
  yPos = Math.max(notesMaxY, summaryMaxY) + 8;

  // Footer - Payment Method and Prepared By - Compact layout
  const footerY = yPos;
  let footerMaxY = yPos;
  
  // Left: Payment Method
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("PAYMENT METHOD", margin, yPos);
  footerMaxY = yPos + 5;
  yPos += 5;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  if (data.paymentBank) {
    doc.text(`Bank: ${data.paymentBank}`, margin, yPos);
    footerMaxY = yPos + 4;
    yPos += 4;
  }
  if (data.paymentAccountName) {
    doc.text(`Account Name: ${data.paymentAccountName}`, margin, yPos);
    footerMaxY = yPos + 4;
    yPos += 4;
  }
  if (data.paymentAccountNumber) {
    doc.text(`Account Number: ${data.paymentAccountNumber}`, margin, yPos);
    footerMaxY = yPos + 4;
    yPos += 4;
  }

  // Right: Prepared By
  const preparedByX = pageWidth / 2 + 15;
  yPos = footerY;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("PREPARED BY", preparedByX, yPos);
  footerMaxY = Math.max(footerMaxY, yPos + 5);
  yPos += 5;
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  if (data.preparedByName) {
    doc.text(data.preparedByName, preparedByX, yPos);
    footerMaxY = Math.max(footerMaxY, yPos + 4);
    yPos += 4;
  }
  if (data.preparedByTitle) {
    doc.text(data.preparedByTitle, preparedByX, yPos);
    footerMaxY = Math.max(footerMaxY, yPos + 4);
  }

  // Navy blue border at bottom - positioned relative to footer
  const borderY = footerMaxY + 5;
  doc.setDrawColor(navyBlueR, navyBlueG, navyBlueB);
  doc.setLineWidth(1);
  doc.line(margin, borderY, pageWidth - margin, borderY);

  return doc;
}
