import { jsPDF } from "jspdf";

export function generateSystemFlowchartPDF(): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = margin;

  // Colors
  const navyBlue = [30, 58, 138];
  const lightBlue = [59, 130, 246];
  const gray = [107, 114, 128];
  const green = [34, 197, 94];
  const orange = [249, 115, 22];

  // Helper function to draw a box
  const drawBox = (x: number, y: number, width: number, height: number, text: string, color: number[] = [255, 255, 255], textColor: number[] = [0, 0, 0]) => {
    doc.setFillColor(color[0], color[1], color[2]);
    doc.setDrawColor(200, 200, 200);
    doc.roundedRect(x, y, width, height, 3, 3, "FD");
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    
    // Clean text - remove any remaining problematic characters
    // Since we've already removed emojis from the source strings, just ensure clean text
    const cleanText = text.trim();
    
    // Split text into multiple lines if needed
    const lines = doc.splitTextToSize(cleanText, width - 4);
    const lineHeight = 5;
    const totalHeight = lines.length * lineHeight;
    const startY = y + (height - totalHeight) / 2 + 4;
    
    lines.forEach((line: string, index: number) => {
      doc.text(line, x + width / 2, startY + (index * lineHeight), { align: "center" });
    });
  };

  // Helper function to draw an arrow
  const drawArrow = (x1: number, y1: number, x2: number, y2: number) => {
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.5);
    doc.line(x1, y1, x2, y2);
    
    // Draw arrowhead
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const arrowLength = 3;
    const arrowAngle = Math.PI / 6;
    
    const x3 = x2 - arrowLength * Math.cos(angle - arrowAngle);
    const y3 = y2 - arrowLength * Math.sin(angle - arrowAngle);
    const x4 = x2 - arrowLength * Math.cos(angle + arrowAngle);
    const y4 = y2 - arrowLength * Math.sin(angle + arrowAngle);
    
    doc.line(x2, y2, x3, y3);
    doc.line(x2, y2, x4, y4);
  };

  // Title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
  doc.text("Work Management System - User Flowchart", pageWidth / 2, yPos, { align: "center" });
  yPos += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(gray[0], gray[1], gray[2]);
  doc.text("Complete guide to using the system", pageWidth / 2, yPos, { align: "center" });
  yPos += 15;

  // Box dimensions
  const boxWidth = 35;
  const boxHeight = 12;
  const boxSpacing = 5;
  const arrowLength = 8;

  // ========== PAGE 1: Authentication & Dashboard ==========
  
  // Start
  const startY = yPos;
  drawBox(pageWidth / 2 - boxWidth / 2, yPos, boxWidth, boxHeight, "START", green, [255, 255, 255]);
  const startBottomY = yPos + boxHeight;
  yPos = startBottomY + arrowLength;

  // Login/Register
  const loginY = yPos;
  drawBox(pageWidth / 2 - boxWidth / 2, yPos, boxWidth, boxHeight, "Login / Register", lightBlue, [255, 255, 255]);
  const loginBottomY = yPos + boxHeight;
  yPos = loginBottomY + arrowLength;

  // Dashboard
  const dashboardY = yPos;
  drawBox(pageWidth / 2 - boxWidth / 2, yPos, boxWidth, boxHeight, "Dashboard", navyBlue, [255, 255, 255]);
  const dashboardBottomY = yPos + boxHeight;
  yPos = dashboardBottomY + arrowLength + 5;

  // Main Modules (in a row)
  const moduleBoxWidth = 28;
  const moduleBoxHeight = 10;
  const modulesX = (pageWidth - (moduleBoxWidth * 4 + boxSpacing * 3)) / 2;
  let moduleX = modulesX;

  // Row 1: Time Clock, Job Management, QC, HR
  yPos += 5;
  const moduleRow1Y = yPos;
  drawBox(moduleX, yPos, moduleBoxWidth, moduleBoxHeight, "Time Clock", lightBlue, [255, 255, 255]);
  moduleX += moduleBoxWidth + boxSpacing;
  drawBox(moduleX, yPos, moduleBoxWidth, moduleBoxHeight, "Job Management", orange, [255, 255, 255]);
  moduleX += moduleBoxWidth + boxSpacing;
  drawBox(moduleX, yPos, moduleBoxWidth, moduleBoxHeight, "Quality Control", green, [255, 255, 255]);
  moduleX += moduleBoxWidth + boxSpacing;
  drawBox(moduleX, yPos, moduleBoxWidth, moduleBoxHeight, "HR", [147, 51, 234], [255, 255, 255]);

  yPos += moduleBoxHeight + arrowLength + 5;
  moduleX = modulesX;

  // Row 2: Finance, Inventory, Admin, Handbook
  const moduleRow2Y = yPos;
  drawBox(moduleX, yPos, moduleBoxWidth, moduleBoxHeight, "Finance", orange, [255, 255, 255]);
  moduleX += moduleBoxWidth + boxSpacing;
  drawBox(moduleX, yPos, moduleBoxWidth, moduleBoxHeight, "Inventory", [139, 69, 19], [255, 255, 255]);
  moduleX += moduleBoxWidth + boxSpacing;
  drawBox(moduleX, yPos, moduleBoxWidth, moduleBoxHeight, "Admin Panel", [168, 85, 247], [255, 255, 255]);
  moduleX += moduleBoxWidth + boxSpacing;
  drawBox(moduleX, yPos, moduleBoxWidth, moduleBoxHeight, "Handbook", lightBlue, [255, 255, 255]);

  // Draw arrows from START to Login/Register
  drawArrow(pageWidth / 2, startBottomY, pageWidth / 2, loginY);
  
  // Draw arrow from Login/Register to Dashboard
  drawArrow(pageWidth / 2, loginBottomY, pageWidth / 2, dashboardY);
  
  // Draw arrows from Dashboard to modules (first row)
  const dashboardCenterX = pageWidth / 2;
  drawArrow(dashboardCenterX, dashboardBottomY, modulesX + moduleBoxWidth / 2, moduleRow1Y);
  drawArrow(dashboardCenterX, dashboardBottomY, modulesX + moduleBoxWidth + boxSpacing + moduleBoxWidth / 2, moduleRow1Y);
  drawArrow(dashboardCenterX, dashboardBottomY, modulesX + (moduleBoxWidth + boxSpacing) * 2 + moduleBoxWidth / 2, moduleRow1Y);
  drawArrow(dashboardCenterX, dashboardBottomY, modulesX + (moduleBoxWidth + boxSpacing) * 3 + moduleBoxWidth / 2, moduleRow1Y);

  // ========== PAGE 2: Job Management Workflow ==========
  {
    doc.addPage();
    yPos = margin;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
    doc.text("Job Management Workflow", pageWidth / 2, yPos, { align: "center" });
    yPos += 12;

    // Create Job
    const createJobY = yPos;
    drawBox(pageWidth / 2 - boxWidth / 2, yPos, boxWidth, boxHeight, "Create Job\n(Manager/Admin)", orange, [255, 255, 255]);
    const createJobBottomY = yPos + boxHeight;
    yPos = createJobBottomY + arrowLength;

    // Assign Workers
    const assignWorkersY = yPos;
    drawBox(pageWidth / 2 - boxWidth / 2, yPos, boxWidth, boxHeight, "Assign Workers\n(Multiple)", lightBlue, [255, 255, 255]);
    const assignWorkersBottomY = yPos + boxHeight;
    yPos = assignWorkersBottomY + arrowLength;

    // Time Clock and Photos (side by side)
    const timeClockX = pageWidth / 2 - boxWidth - boxSpacing / 2;
    const photoX = pageWidth / 2 + boxSpacing / 2;
    const clockInY = yPos;
    drawBox(timeClockX, yPos, boxWidth, boxHeight, "Clock In\n(Employee)", green, [255, 255, 255]);
    drawBox(photoX, yPos, boxWidth, boxHeight, "Add Photos\n(Employee)", lightBlue, [255, 255, 255]);
    const clockInBottomY = yPos + boxHeight;
    yPos = clockInBottomY + arrowLength;

    // Work on Job
    const workOnJobY = yPos;
    drawBox(pageWidth / 2 - boxWidth / 2, yPos, boxWidth, boxHeight, "Work on Job", gray, [255, 255, 255]);
    const workOnJobBottomY = yPos + boxHeight;
    yPos = workOnJobBottomY + arrowLength;

    // Clock Out
    const clockOutY = yPos;
    drawBox(pageWidth / 2 - boxWidth / 2, yPos, boxWidth, boxHeight, "Clock Out\n(Employee)", green, [255, 255, 255]);
    const clockOutBottomY = yPos + boxHeight;
    yPos = clockOutBottomY + arrowLength;

    // Submit to QC
    const submitQCY = yPos;
    drawBox(pageWidth / 2 - boxWidth / 2, yPos, boxWidth, boxHeight, "Submit to QC\n(Employee)", [59, 130, 246], [255, 255, 255]);
    const submitQCBottomY = yPos + boxHeight;
    yPos = submitQCBottomY + arrowLength;

    // QC Review (side by side)
    const qcPassX = pageWidth / 2 - boxWidth - boxSpacing / 2;
    const qcFailX = pageWidth / 2 + boxSpacing / 2;
    const qcReviewY = yPos;
    drawBox(qcPassX, yPos, boxWidth, boxHeight, "QC PASS\n(Manager/Admin)", green, [255, 255, 255]);
    drawBox(qcFailX, yPos, boxWidth, boxHeight, "QC FAIL\n(Manager/Admin)", [239, 68, 68], [255, 255, 255]);
    const qcReviewBottomY = yPos + boxHeight;
    yPos = qcReviewBottomY + arrowLength;

    // Outcomes
    const completeX = pageWidth / 2 - boxWidth - boxSpacing / 2;
    const reworkX = pageWidth / 2 + boxSpacing / 2;
    const outcomesY = yPos;
    drawBox(completeX, yPos, boxWidth, boxHeight, "Job\nCompleted", green, [255, 255, 255]);
    drawBox(reworkX, yPos, boxWidth, boxHeight, "Rework\n(Back to Work)", orange, [255, 255, 255]);

    // Draw arrows
    const centerX = pageWidth / 2;
    drawArrow(centerX, createJobBottomY, centerX, assignWorkersY);
    drawArrow(centerX, assignWorkersBottomY, centerX, clockInY);
    drawArrow(centerX, assignWorkersBottomY, timeClockX + boxWidth / 2, clockInY);
    drawArrow(centerX, assignWorkersBottomY, photoX + boxWidth / 2, clockInY);
    drawArrow(timeClockX + boxWidth / 2, clockInBottomY, centerX, workOnJobY);
    drawArrow(photoX + boxWidth / 2, clockInBottomY, centerX, workOnJobY);
    drawArrow(centerX, workOnJobBottomY, centerX, clockOutY);
    drawArrow(centerX, clockOutBottomY, centerX, submitQCY);
    drawArrow(centerX, submitQCBottomY, centerX, qcReviewY);
    drawArrow(centerX, submitQCBottomY, qcPassX + boxWidth / 2, qcReviewY);
    drawArrow(centerX, submitQCBottomY, qcFailX + boxWidth / 2, qcReviewY);
    drawArrow(qcPassX + boxWidth / 2, qcReviewBottomY, completeX + boxWidth / 2, outcomesY);
    drawArrow(qcFailX + boxWidth / 2, qcReviewBottomY, reworkX + boxWidth / 2, outcomesY);
  }

  // ========== PAGE 3: Invoice & Quotation Workflow ==========
  {
    doc.addPage();
    yPos = margin;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
    doc.text("Invoice & Quotation Workflow", pageWidth / 2, yPos, { align: "center" });
    yPos += 12;

    // From Job
    const jobCreatedY = yPos;
    drawBox(pageWidth / 2 - boxWidth / 2, yPos, boxWidth, boxHeight, "Job Created", lightBlue, [255, 255, 255]);
    const jobCreatedBottomY = yPos + boxHeight;
    yPos = jobCreatedBottomY + arrowLength;

    // Create Quotation
    const createQuotationY = yPos;
    drawBox(pageWidth / 2 - boxWidth / 2, yPos, boxWidth, boxHeight, "Create Quotation\n(Manager/Admin)", orange, [255, 255, 255]);
    const createQuotationBottomY = yPos + boxHeight;
    yPos = createQuotationBottomY + arrowLength;

    // Send to Customer
    const sendCustomerY = yPos;
    drawBox(pageWidth / 2 - boxWidth / 2, yPos, boxWidth, boxHeight, "Send to Customer", green, [255, 255, 255]);
    const sendCustomerBottomY = yPos + boxHeight;
    yPos = sendCustomerBottomY + arrowLength + 10;

    // Create Invoice (alternative path)
    const invoiceX = pageWidth / 2 - boxWidth / 2;
    const createInvoiceY = yPos;
    drawBox(invoiceX, yPos, boxWidth, boxHeight, "Create Invoice\n(Manager/Admin)", orange, [255, 255, 255]);
    const createInvoiceBottomY = yPos + boxHeight;
    yPos = createInvoiceBottomY + arrowLength;

    // Add Line Items
    const addLineItemsY = yPos;
    drawBox(invoiceX, yPos, boxWidth, boxHeight, "Add Line Items\n& Details", lightBlue, [255, 255, 255]);
    const addLineItemsBottomY = yPos + boxHeight;
    yPos = addLineItemsBottomY + arrowLength;

    // Generate PDF
    const generatePDFY = yPos;
    drawBox(invoiceX, yPos, boxWidth, boxHeight, "Generate PDF", navyBlue, [255, 255, 255]);
    const generatePDFBottomY = yPos + boxHeight;
    yPos = generatePDFBottomY + arrowLength;

    // Send/Record Payment
    const sendX = pageWidth / 2 - boxWidth - boxSpacing / 2;
    const paymentX = pageWidth / 2 + boxSpacing / 2;
    const finalActionsY = yPos;
    drawBox(sendX, yPos, boxWidth, boxHeight, "Send Invoice", green, [255, 255, 255]);
    drawBox(paymentX, yPos, boxWidth, boxHeight, "Record Payment", [34, 197, 94], [255, 255, 255]);

    // Draw arrows
    const centerX = pageWidth / 2;
    drawArrow(centerX, jobCreatedBottomY, centerX, createQuotationY);
    drawArrow(centerX, createQuotationBottomY, centerX, sendCustomerY);
    drawArrow(centerX, sendCustomerBottomY, invoiceX + boxWidth / 2, createInvoiceY);
    drawArrow(invoiceX + boxWidth / 2, createInvoiceBottomY, invoiceX + boxWidth / 2, addLineItemsY);
    drawArrow(invoiceX + boxWidth / 2, addLineItemsBottomY, invoiceX + boxWidth / 2, generatePDFY);
    drawArrow(invoiceX + boxWidth / 2, generatePDFBottomY, sendX + boxWidth / 2, finalActionsY);
    drawArrow(invoiceX + boxWidth / 2, generatePDFBottomY, paymentX + boxWidth / 2, finalActionsY);
  }

  // ========== PAGE 4: Time Tracking & Material Requests ==========
  {
    doc.addPage();
    yPos = margin;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
    doc.text("Time Tracking & Material Requests", pageWidth / 2, yPos, { align: "center" });
    yPos += 12;

    // Time Clock Flow
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
    doc.text("Time Clock Process:", margin, yPos);
    yPos += 8;

    const timeBoxWidth = 32;
    const selectJobY = yPos;
    drawBox(margin, yPos, timeBoxWidth, boxHeight, "Select Job\n(Optional)", lightBlue, [255, 255, 255]);
    const selectJobBottomY = yPos + boxHeight;
    yPos = selectJobBottomY + arrowLength;

    const clockInY = yPos;
    drawBox(margin, yPos, timeBoxWidth, boxHeight, "Clock In", green, [255, 255, 255]);
    const clockInBottomY = yPos + boxHeight;
    yPos = clockInBottomY + arrowLength;

    const workOnJobY = yPos;
    drawBox(margin, yPos, timeBoxWidth, boxHeight, "Work on Job", gray, [255, 255, 255]);
    const workOnJobBottomY = yPos + boxHeight;
    yPos = workOnJobBottomY + arrowLength;

    const breakX = margin;
    const clockOutX = margin + timeBoxWidth + boxSpacing;
    const breakClockOutY = yPos;
    drawBox(breakX, yPos, timeBoxWidth, boxHeight, "Take Break\n(Optional)", orange, [255, 255, 255]);
    drawBox(clockOutX, yPos, timeBoxWidth, boxHeight, "Clock Out", green, [255, 255, 255]);
    const breakClockOutBottomY = yPos + boxHeight;
    yPos = breakClockOutBottomY + arrowLength + 5;

    // View Time Records
    const viewRecordsY = yPos;
    drawBox(margin, yPos, timeBoxWidth, boxHeight, "View Time Records", lightBlue, [255, 255, 255]);
    yPos = viewRecordsY + boxHeight + arrowLength + 10;

    // Material Request Flow
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
    doc.text("Material Request Process:", margin, yPos);
    yPos += 8;

    const matBoxWidth = 32;
    const requestMaterialY = yPos;
    drawBox(margin, yPos, matBoxWidth, boxHeight, "Request Material\n(Employee)", lightBlue, [255, 255, 255]);
    const requestMaterialBottomY = yPos + boxHeight;
    yPos = requestMaterialBottomY + arrowLength;

    const reviewRequestY = yPos;
    drawBox(margin, yPos, matBoxWidth, boxHeight, "Review Request\n(Manager/Admin)", orange, [255, 255, 255]);
    const reviewRequestBottomY = yPos + boxHeight;
    yPos = reviewRequestBottomY + arrowLength;

    const approveX = margin;
    const rejectX = margin + matBoxWidth + boxSpacing;
    const approveRejectY = yPos;
    drawBox(approveX, yPos, matBoxWidth, boxHeight, "Approve", green, [255, 255, 255]);
    drawBox(rejectX, yPos, matBoxWidth, boxHeight, "Reject", [239, 68, 68], [255, 255, 255]);
    const approveRejectBottomY = yPos + boxHeight;
    yPos = approveRejectBottomY + arrowLength;

    const fulfillY = yPos;
    drawBox(margin, yPos, matBoxWidth, boxHeight, "Fulfill Request", [34, 197, 94], [255, 255, 255]);

    // Draw arrows for time clock
    const timeCenterX = margin + timeBoxWidth / 2;
    drawArrow(timeCenterX, selectJobBottomY, timeCenterX, clockInY);
    drawArrow(timeCenterX, clockInBottomY, timeCenterX, workOnJobY);
    drawArrow(timeCenterX, workOnJobBottomY, breakX + timeBoxWidth / 2, breakClockOutY);
    drawArrow(timeCenterX, workOnJobBottomY, clockOutX + timeBoxWidth / 2, breakClockOutY);
    drawArrow(breakX + timeBoxWidth / 2, breakClockOutBottomY, clockOutX + timeBoxWidth / 2, breakClockOutY);
    drawArrow(clockOutX + timeBoxWidth / 2, breakClockOutBottomY, timeCenterX, viewRecordsY);

    // Draw arrows for material requests
    const matCenterX = margin + matBoxWidth / 2;
    drawArrow(matCenterX, requestMaterialBottomY, matCenterX, reviewRequestY);
    drawArrow(matCenterX, reviewRequestBottomY, approveX + matBoxWidth / 2, approveRejectY);
    drawArrow(matCenterX, reviewRequestBottomY, rejectX + matBoxWidth / 2, approveRejectY);
    drawArrow(approveX + matBoxWidth / 2, approveRejectBottomY, matCenterX, fulfillY);
  }

  // ========== PAGE 5: User Roles & Permissions ==========
  doc.addPage();
  yPos = margin;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
  doc.text("User Roles & Permissions", pageWidth / 2, yPos, { align: "center" });
  yPos += 12;

  // Role boxes
  const roleBoxWidth = 50;
  const roleBoxHeight = 15;
  const roleSpacing = 5;

  // Employee
  drawBox(margin, yPos, roleBoxWidth, roleBoxHeight, "EMPLOYEE\n\n- Time Clock\n- View Assigned Jobs\n- Submit to QC\n- View Time Records\n- Request Materials", lightBlue, [255, 255, 255]);
  
  // Manager
  const managerX = margin + roleBoxWidth + roleSpacing;
  drawBox(managerX, yPos, roleBoxWidth, roleBoxHeight, "MANAGER\n\n- All Employee features\n- Create/Edit Jobs\n- QC Review\n- Create Invoices\n- Create Quotations\n- Manage Inventory", orange, [255, 255, 255]);
  
  // Admin
  const adminX = managerX + roleBoxWidth + roleSpacing;
  drawBox(adminX, yPos, roleBoxWidth, roleBoxHeight, "ADMIN\n\n- All Manager features\n- User Management\n- Access Control\n- Company Settings\n- System Configuration", [168, 85, 247], [255, 255, 255]);

  yPos += roleBoxHeight + 15;

  // Permission Matrix
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
  doc.text("Module Access Control:", margin, yPos);
  yPos += 8;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(gray[0], gray[1], gray[2]);
  
  const modules = [
    "Time Clock",
    "Job Management",
    "Quality Control",
    "HR",
    "Finance",
    "Inventory",
    "Admin Panel",
    "Employee Handbook"
  ];

  modules.forEach((module, index) => {
    const modY = yPos + (index * 5);
    doc.text(`- ${module}:`, margin, modY);
    doc.setFont("helvetica", "normal");
    doc.text("Employee", margin + 35, modY);
    doc.text("|", margin + 52, modY);
    doc.text("Manager", margin + 57, modY);
    doc.text("|", margin + 72, modY);
    doc.text("Admin", margin + 77, modY);
  });

  // Footer on last page
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(gray[0], gray[1], gray[2]);
  doc.text("Generated by Work Management System", pageWidth / 2, pageHeight - 10, { align: "center" });
  const today = new Date().toLocaleDateString();
  doc.text(`Generated on: ${today}`, pageWidth / 2, pageHeight - 5, { align: "center" });

  return doc;
}

