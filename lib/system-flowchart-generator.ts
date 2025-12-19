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
    
    // Split text into multiple lines if needed
    const lines = doc.splitTextToSize(text, width - 4);
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
  drawBox(pageWidth / 2 - boxWidth / 2, yPos, boxWidth, boxHeight, "START", green, [255, 255, 255]);
  yPos += boxHeight + arrowLength;

  // Login/Register
  drawBox(pageWidth / 2 - boxWidth / 2, yPos, boxWidth, boxHeight, "Login / Register", lightBlue, [255, 255, 255]);
  yPos += boxHeight + arrowLength;

  // Dashboard
  drawBox(pageWidth / 2 - boxWidth / 2, yPos, boxWidth, boxHeight, "Dashboard", navyBlue, [255, 255, 255]);
  yPos += boxHeight + arrowLength + 5;

  // Main Modules (in a row)
  const moduleBoxWidth = 28;
  const moduleBoxHeight = 10;
  const modulesX = (pageWidth - (moduleBoxWidth * 4 + boxSpacing * 3)) / 2;
  let moduleX = modulesX;

  // Row 1: Time Clock, Job Management, QC, HR
  yPos += 5;
  drawBox(moduleX, yPos, moduleBoxWidth, moduleBoxHeight, "Time Clock\n⏰", lightBlue, [255, 255, 255]);
  moduleX += moduleBoxWidth + boxSpacing;
  drawBox(moduleX, yPos, moduleBoxWidth, moduleBoxHeight, "Job Management\n📋", orange, [255, 255, 255]);
  moduleX += moduleBoxWidth + boxSpacing;
  drawBox(moduleX, yPos, moduleBoxWidth, moduleBoxHeight, "Quality Control\n✅", green, [255, 255, 255]);
  moduleX += moduleBoxWidth + boxSpacing;
  drawBox(moduleX, yPos, moduleBoxWidth, moduleBoxHeight, "HR\n👥", [147, 51, 234], [255, 255, 255]);

  yPos += moduleBoxHeight + arrowLength + 5;
  moduleX = modulesX;

  // Row 2: Finance, Inventory, Admin, Handbook
  drawBox(moduleX, yPos, moduleBoxWidth, moduleBoxHeight, "Finance\n💰", orange, [255, 255, 255]);
  moduleX += moduleBoxWidth + boxSpacing;
  drawBox(moduleX, yPos, moduleBoxWidth, moduleBoxHeight, "Inventory\n📦", [139, 69, 19], [255, 255, 255]);
  moduleX += moduleBoxWidth + boxSpacing;
  drawBox(moduleX, yPos, moduleBoxWidth, moduleBoxHeight, "Admin Panel\n⚙️", [168, 85, 247], [255, 255, 255]);
  moduleX += moduleBoxWidth + boxSpacing;
  drawBox(moduleX, yPos, moduleBoxWidth, moduleBoxHeight, "Handbook\n📖", lightBlue, [255, 255, 255]);

  // Draw arrows from Dashboard to modules
  const dashboardCenterX = pageWidth / 2;
  const dashboardBottomY = margin + 10 + boxHeight + arrowLength;
  const moduleTopY = dashboardBottomY + arrowLength + 5 + 5;

  // Arrows to first row
  drawArrow(dashboardCenterX, dashboardBottomY, modulesX + moduleBoxWidth / 2, moduleTopY);
  drawArrow(dashboardCenterX, dashboardBottomY, modulesX + moduleBoxWidth + boxSpacing + moduleBoxWidth / 2, moduleTopY);
  drawArrow(dashboardCenterX, dashboardBottomY, modulesX + (moduleBoxWidth + boxSpacing) * 2 + moduleBoxWidth / 2, moduleTopY);
  drawArrow(dashboardCenterX, dashboardBottomY, modulesX + (moduleBoxWidth + boxSpacing) * 3 + moduleBoxWidth / 2, moduleTopY);

  // ========== PAGE 2: Job Management Workflow ==========
  doc.addPage();
  yPos = margin;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
  doc.text("Job Management Workflow", pageWidth / 2, yPos, { align: "center" });
  yPos += 12;

  // Create Job
  drawBox(pageWidth / 2 - boxWidth / 2, yPos, boxWidth, boxHeight, "Create Job\n(Manager/Admin)", orange, [255, 255, 255]);
  yPos += boxHeight + arrowLength;

  // Assign Workers
  drawBox(pageWidth / 2 - boxWidth / 2, yPos, boxWidth, boxHeight, "Assign Workers\n(Multiple)", lightBlue, [255, 255, 255]);
  yPos += boxHeight + arrowLength;

  // Time Clock
  const timeClockX = pageWidth / 2 - boxWidth - boxSpacing / 2;
  const photoX = pageWidth / 2 + boxSpacing / 2;
  drawBox(timeClockX, yPos, boxWidth, boxHeight, "Clock In\n(Employee)", green, [255, 255, 255]);
  drawBox(photoX, yPos, boxWidth, boxHeight, "Add Photos\n(Employee)", lightBlue, [255, 255, 255]);
  yPos += boxHeight + arrowLength;

  // Work on Job
  drawBox(pageWidth / 2 - boxWidth / 2, yPos, boxWidth, boxHeight, "Work on Job", gray, [255, 255, 255]);
  yPos += boxHeight + arrowLength;

  // Clock Out
  drawBox(pageWidth / 2 - boxWidth / 2, yPos, boxWidth, boxHeight, "Clock Out\n(Employee)", green, [255, 255, 255]);
  yPos += boxHeight + arrowLength;

  // Submit to QC
  drawBox(pageWidth / 2 - boxWidth / 2, yPos, boxWidth, boxHeight, "Submit to QC\n(Employee)", [59, 130, 246], [255, 255, 255]);
  yPos += boxHeight + arrowLength;

  // QC Review
  const qcPassX = pageWidth / 2 - boxWidth - boxSpacing / 2;
  const qcFailX = pageWidth / 2 + boxSpacing / 2;
  drawBox(qcPassX, yPos, boxWidth, boxHeight, "QC PASS\n(Manager/Admin)", green, [255, 255, 255]);
  drawBox(qcFailX, yPos, boxWidth, boxHeight, "QC FAIL\n(Manager/Admin)", [239, 68, 68], [255, 255, 255]);
  yPos += boxHeight + arrowLength;

  // Outcomes
  const completeX = pageWidth / 2 - boxWidth - boxSpacing / 2;
  const reworkX = pageWidth / 2 + boxSpacing / 2;
  drawBox(completeX, yPos, boxWidth, boxHeight, "Job\nCompleted", green, [255, 255, 255]);
  drawBox(reworkX, yPos, boxWidth, boxHeight, "Rework\n(Back to Work)", orange, [255, 255, 255]);

  // Draw arrows
  const arrowY1 = margin + 12 + boxHeight;
  const arrowY2 = arrowY1 + boxHeight + arrowLength;
  const arrowY3 = arrowY2 + boxHeight + arrowLength;
  const arrowY4 = arrowY3 + boxHeight + arrowLength;
  const arrowY5 = arrowY4 + boxHeight + arrowLength;
  const arrowY6 = arrowY5 + boxHeight + arrowLength;
  const arrowY7 = arrowY6 + boxHeight + arrowLength;

  drawArrow(pageWidth / 2, arrowY1, pageWidth / 2, arrowY2);
  drawArrow(pageWidth / 2, arrowY2, pageWidth / 2, arrowY3);
  drawArrow(pageWidth / 2, arrowY3, timeClockX + boxWidth / 2, arrowY4);
  drawArrow(pageWidth / 2, arrowY3, photoX + boxWidth / 2, arrowY4);
  drawArrow(timeClockX + boxWidth / 2, arrowY4 + boxHeight, pageWidth / 2, arrowY5);
  drawArrow(photoX + boxWidth / 2, arrowY4 + boxHeight, pageWidth / 2, arrowY5);
  drawArrow(pageWidth / 2, arrowY5, pageWidth / 2, arrowY6);
  drawArrow(pageWidth / 2, arrowY6, pageWidth / 2, arrowY7);
  drawArrow(pageWidth / 2, arrowY7, qcPassX + boxWidth / 2, arrowY7 + boxHeight);
  drawArrow(pageWidth / 2, arrowY7, qcFailX + boxWidth / 2, arrowY7 + boxHeight);
  drawArrow(qcPassX + boxWidth / 2, arrowY7 + boxHeight, completeX + boxWidth / 2, arrowY7 + boxHeight + arrowLength);
  drawArrow(qcFailX + boxWidth / 2, arrowY7 + boxHeight, reworkX + boxWidth / 2, arrowY7 + boxHeight + arrowLength);

  // ========== PAGE 3: Invoice & Quotation Workflow ==========
  doc.addPage();
  yPos = margin;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
  doc.text("Invoice & Quotation Workflow", pageWidth / 2, yPos, { align: "center" });
  yPos += 12;

  // From Job
  drawBox(pageWidth / 2 - boxWidth / 2, yPos, boxWidth, boxHeight, "Job Created", lightBlue, [255, 255, 255]);
  yPos += boxHeight + arrowLength;

  // Create Quotation
  drawBox(pageWidth / 2 - boxWidth / 2, yPos, boxWidth, boxHeight, "Create Quotation\n(Manager/Admin)", orange, [255, 255, 255]);
  yPos += boxHeight + arrowLength;

  // Send to Customer
  drawBox(pageWidth / 2 - boxWidth / 2, yPos, boxWidth, boxHeight, "Send to Customer", green, [255, 255, 255]);
  yPos += boxHeight + arrowLength + 10;

  // Create Invoice (alternative path)
  const invoiceX = pageWidth / 2 - boxWidth / 2;
  drawBox(invoiceX, yPos, boxWidth, boxHeight, "Create Invoice\n(Manager/Admin)", orange, [255, 255, 255]);
  yPos += boxHeight + arrowLength;

  // Add Line Items
  drawBox(invoiceX, yPos, boxWidth, boxHeight, "Add Line Items\n& Details", lightBlue, [255, 255, 255]);
  yPos += boxHeight + arrowLength;

  // Generate PDF
  drawBox(invoiceX, yPos, boxWidth, boxHeight, "Generate PDF", navyBlue, [255, 255, 255]);
  yPos += boxHeight + arrowLength;

  // Send/Record Payment
  const sendX = pageWidth / 2 - boxWidth - boxSpacing / 2;
  const paymentX = pageWidth / 2 + boxSpacing / 2;
  drawBox(sendX, yPos, boxWidth, boxHeight, "Send Invoice", green, [255, 255, 255]);
  drawBox(paymentX, yPos, boxWidth, boxHeight, "Record Payment", [34, 197, 94], [255, 255, 255]);

  // Draw arrows
  const invArrowY1 = margin + 12 + boxHeight;
  const invArrowY2 = invArrowY1 + boxHeight + arrowLength;
  const invArrowY3 = invArrowY2 + boxHeight + arrowLength;
  const invArrowY4 = invArrowY3 + boxHeight + arrowLength + 10;
  const invArrowY5 = invArrowY4 + boxHeight + arrowLength;
  const invArrowY6 = invArrowY5 + boxHeight + arrowLength;

  drawArrow(pageWidth / 2, invArrowY1, pageWidth / 2, invArrowY2);
  drawArrow(pageWidth / 2, invArrowY2, pageWidth / 2, invArrowY3);
  drawArrow(pageWidth / 2, invArrowY3, invoiceX + boxWidth / 2, invArrowY4);
  drawArrow(invoiceX + boxWidth / 2, invArrowY4, invoiceX + boxWidth / 2, invArrowY5);
  drawArrow(invoiceX + boxWidth / 2, invArrowY5, invoiceX + boxWidth / 2, invArrowY6);
  drawArrow(invoiceX + boxWidth / 2, invArrowY6, sendX + boxWidth / 2, invArrowY6 + boxHeight);
  drawArrow(invoiceX + boxWidth / 2, invArrowY6, paymentX + boxWidth / 2, invArrowY6 + boxHeight);

  // ========== PAGE 4: Time Tracking & Material Requests ==========
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
  drawBox(margin, yPos, timeBoxWidth, boxHeight, "Select Job\n(Optional)", lightBlue, [255, 255, 255]);
  yPos += boxHeight + arrowLength;

  drawBox(margin, yPos, timeBoxWidth, boxHeight, "Clock In", green, [255, 255, 255]);
  yPos += boxHeight + arrowLength;

  drawBox(margin, yPos, timeBoxWidth, boxHeight, "Work on Job", gray, [255, 255, 255]);
  yPos += boxHeight + arrowLength;

  const breakX = margin;
  const clockOutX = margin + timeBoxWidth + boxSpacing;
  drawBox(breakX, yPos, timeBoxWidth, boxHeight, "Take Break\n(Optional)", orange, [255, 255, 255]);
  drawBox(clockOutX, yPos, timeBoxWidth, boxHeight, "Clock Out", green, [255, 255, 255]);
  yPos += boxHeight + arrowLength + 5;

  // View Time Records
  drawBox(margin, yPos, timeBoxWidth, boxHeight, "View Time Records", lightBlue, [255, 255, 255]);
  yPos += boxHeight + arrowLength + 10;

  // Material Request Flow
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(navyBlue[0], navyBlue[1], navyBlue[2]);
  doc.text("Material Request Process:", margin, yPos);
  yPos += 8;

  const matBoxWidth = 32;
  drawBox(margin, yPos, matBoxWidth, boxHeight, "Request Material\n(Employee)", lightBlue, [255, 255, 255]);
  yPos += boxHeight + arrowLength;

  drawBox(margin, yPos, matBoxWidth, boxHeight, "Review Request\n(Manager/Admin)", orange, [255, 255, 255]);
  yPos += boxHeight + arrowLength;

  const approveX = margin;
  const rejectX = margin + matBoxWidth + boxSpacing;
  drawBox(approveX, yPos, matBoxWidth, boxHeight, "Approve", green, [255, 255, 255]);
  drawBox(rejectX, yPos, matBoxWidth, boxHeight, "Reject", [239, 68, 68], [255, 255, 255]);
  yPos += boxHeight + arrowLength;

  drawBox(margin, yPos, matBoxWidth, boxHeight, "Fulfill Request", [34, 197, 94], [255, 255, 255]);

  // Draw arrows for time clock
  const timeArrowY1 = margin + 12 + 8 + boxHeight;
  const timeArrowY2 = timeArrowY1 + boxHeight + arrowLength;
  const timeArrowY3 = timeArrowY2 + boxHeight + arrowLength;
  const timeArrowY4 = timeArrowY3 + boxHeight + arrowLength;

  drawArrow(margin + timeBoxWidth / 2, timeArrowY1, margin + timeBoxWidth / 2, timeArrowY2);
  drawArrow(margin + timeBoxWidth / 2, timeArrowY2, margin + timeBoxWidth / 2, timeArrowY3);
  drawArrow(margin + timeBoxWidth / 2, timeArrowY3, breakX + timeBoxWidth / 2, timeArrowY4);
  drawArrow(margin + timeBoxWidth / 2, timeArrowY3, clockOutX + timeBoxWidth / 2, timeArrowY4);
  drawArrow(breakX + timeBoxWidth / 2, timeArrowY4 + boxHeight, clockOutX + timeBoxWidth / 2, timeArrowY4);
  drawArrow(clockOutX + timeBoxWidth / 2, timeArrowY4 + boxHeight, margin + timeBoxWidth / 2, timeArrowY4 + boxHeight + arrowLength + 5);

  // Draw arrows for material requests
  const matArrowY1 = margin + 12 + 8 + boxHeight + arrowLength + boxHeight + arrowLength + boxHeight + arrowLength + boxHeight + arrowLength + 5 + 10 + 8;
  const matArrowY2 = matArrowY1 + boxHeight + arrowLength;
  const matArrowY3 = matArrowY2 + boxHeight + arrowLength;

  drawArrow(margin + matBoxWidth / 2, matArrowY1, margin + matBoxWidth / 2, matArrowY2);
  drawArrow(margin + matBoxWidth / 2, matArrowY2, margin + matBoxWidth / 2, matArrowY3);
  drawArrow(margin + matBoxWidth / 2, matArrowY2, approveX + matBoxWidth / 2, matArrowY3);
  drawArrow(margin + matBoxWidth / 2, matArrowY2, rejectX + matBoxWidth / 2, matArrowY3);
  drawArrow(approveX + matBoxWidth / 2, matArrowY3 + boxHeight, margin + matBoxWidth / 2, matArrowY3 + boxHeight + arrowLength);

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
  drawBox(margin, yPos, roleBoxWidth, roleBoxHeight, "EMPLOYEE\n\n• Time Clock\n• View Assigned Jobs\n• Submit to QC\n• View Time Records\n• Request Materials", lightBlue, [255, 255, 255]);
  
  // Manager
  const managerX = margin + roleBoxWidth + roleSpacing;
  drawBox(managerX, yPos, roleBoxWidth, roleBoxHeight, "MANAGER\n\n• All Employee features\n• Create/Edit Jobs\n• QC Review\n• Create Invoices\n• Create Quotations\n• Manage Inventory", orange, [255, 255, 255]);
  
  // Admin
  const adminX = managerX + roleBoxWidth + roleSpacing;
  drawBox(adminX, yPos, roleBoxWidth, roleBoxHeight, "ADMIN\n\n• All Manager features\n• User Management\n• Access Control\n• Company Settings\n• System Configuration", [168, 85, 247], [255, 255, 255]);

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
    doc.text(`• ${module}:`, margin, modY);
    doc.setFont("helvetica", "bold");
    doc.text("Employee", margin + 30, modY);
    doc.setFont("helvetica", "normal");
    doc.text("|", margin + 45, modY);
    doc.setFont("helvetica", "bold");
    doc.text("Manager", margin + 50, modY);
    doc.setFont("helvetica", "normal");
    doc.text("|", margin + 70, modY);
    doc.setFont("helvetica", "bold");
    doc.text("Admin", margin + 75, modY);
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

