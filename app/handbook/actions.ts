"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/prisma";

// Default handbook content (HTML format)
const DEFAULT_HANDBOOK_CONTENT = `
<h2>Welcome to Our Team! 👋</h2>
<p>This handbook is designed to help you understand our company culture, policies, and procedures. Please read through it carefully and refer back as needed.</p>

<h3>1. Welcome & Mission Statement</h3>
<p>Welcome to our company! We're thrilled to have you as part of our team. Our mission is to deliver exceptional service while maintaining a positive, supportive work environment for all employees.</p>
<p><strong>Our Core Values:</strong></p>
<ul>
<li>Integrity and honesty in all interactions</li>
<li>Excellence in craftsmanship and service</li>
<li>Respect for all team members and clients</li>
<li>Continuous learning and improvement</li>
<li>Safety above all else</li>
</ul>

<h3>2. Code of Conduct</h3>
<p>All employees are expected to:</p>
<ul>
<li>Treat colleagues, clients, and vendors with respect</li>
<li>Maintain professional behavior at all times</li>
<li>Follow all company policies and procedures</li>
<li>Report any concerns or violations to management</li>
<li>Maintain confidentiality of company and client information</li>
</ul>
<p><strong>⚠️ Note:</strong> Violations of our code of conduct may result in disciplinary action, up to and including termination.</p>

<h3>3. Work Hours & Attendance</h3>
<p><strong>Standard Work Week:</strong> Monday - Friday, 8:00 AM - 5:00 PM</p>
<p><strong>Break Policy:</strong></p>
<ul>
<li>30-minute unpaid lunch break (for shifts over 6 hours)</li>
<li>Two 15-minute paid breaks (one morning, one afternoon)</li>
</ul>
<p><strong>Attendance:</strong></p>
<ul>
<li>Punctuality is expected for all shifts</li>
<li>Notify your supervisor immediately if you will be late or absent</li>
<li>Excessive tardiness or absences may result in disciplinary action</li>
</ul>

<h3>4. Time Tracking System</h3>
<p>We use a digital time clock system to track work hours:</p>
<ul>
<li><strong>Clock In:</strong> When you arrive and are ready to begin work</li>
<li><strong>Clock Out:</strong> When you leave for the day or for breaks</li>
<li><strong>Job Assignment:</strong> Select the job you're working on when clocking in</li>
<li><strong>Notes:</strong> Add notes about your work, progress, or issues</li>
<li><strong>Photos:</strong> Upload photos of completed work or problems encountered</li>
</ul>
<p><strong>💡 Tip:</strong> Access the time clock from your dashboard. Make sure to clock in/out accurately - your hours are automatically calculated!</p>

<h3>5. Paid Time Off (PTO)</h3>
<p><strong>Accrual:</strong></p>
<ul>
<li>0-1 year: 10 days per year</li>
<li>1-5 years: 15 days per year</li>
<li>5+ years: 20 days per year</li>
</ul>
<p><strong>Requesting PTO:</strong></p>
<ul>
<li>Submit requests at least 2 weeks in advance when possible</li>
<li>Requests are subject to manager approval based on staffing needs</li>
<li>PTO must be used within the calendar year (no rollover)</li>
</ul>

<h3>6. Benefits</h3>
<p>Full-time employees are eligible for:</p>
<ul>
<li>Health insurance (medical, dental, vision)</li>
<li>401(k) retirement plan with company match</li>
<li>Paid holidays (8 per year)</li>
<li>Paid time off (see PTO section)</li>
<li>Professional development opportunities</li>
<li>Safety equipment and gear provided</li>
</ul>
<p><em>Benefits eligibility begins after 90 days of employment.</em></p>

<h3>7. Safety Policies</h3>
<p><strong>⚠️ Safety is our #1 priority!</strong></p>
<p><strong>Required Safety Practices:</strong></p>
<ul>
<li>Always wear required Personal Protective Equipment (PPE)</li>
<li>Follow all OSHA guidelines and company safety procedures</li>
<li>Report all injuries, no matter how minor, immediately</li>
<li>Report unsafe conditions or hazards to your supervisor</li>
<li>Never operate equipment you're not trained or authorized to use</li>
<li>Keep work areas clean and organized</li>
</ul>
<p><strong>🚨 Emergency Contact:</strong> In case of emergency, call 911 first, then notify your supervisor immediately.</p>

<h3>8. Technology & Equipment</h3>
<p><strong>Company Portal Access:</strong></p>
<ul>
<li>You have been provided login credentials for our employee portal</li>
<li>Do not share your password with anyone</li>
<li>Log out when using shared computers</li>
</ul>
<p><strong>Equipment:</strong></p>
<ul>
<li>Company-provided tools and equipment must be maintained properly</li>
<li>Report any damaged or malfunctioning equipment immediately</li>
<li>Personal use of company equipment is not permitted</li>
</ul>

<h3>9. Communication Guidelines</h3>
<p><strong>Internal Communication:</strong></p>
<ul>
<li>Check the employee portal daily for updates and announcements</li>
<li>Respond to manager communications promptly</li>
<li>Use the job management system to update job status and notes</li>
<li>Material requests can be submitted through the time clock or job pages</li>
</ul>
<p><strong>Client Communication:</strong></p>
<ul>
<li>Always be professional and courteous with clients</li>
<li>Direct any client concerns or complaints to your supervisor</li>
<li>Do not discuss pricing or make commitments without manager approval</li>
</ul>

<h3>10. Contact Information</h3>
<p><strong>HR Department:</strong></p>
<ul>
<li>Email: hr@company.com</li>
<li>Phone: (555) 123-4567</li>
</ul>
<p><strong>Emergency Contacts:</strong></p>
<ul>
<li>Emergency: 911</li>
<li>Supervisor On-Call: (555) 987-6543</li>
</ul>
<p><strong>IT Support:</strong></p>
<ul>
<li>Email: support@company.com</li>
<li>For portal login issues or technical problems</li>
</ul>
`;

export async function getHandbookContent() {
  try {
    let handbook = await prisma.employeeHandbook.findFirst({
      orderBy: { updatedAt: "desc" },
    });

    // If no handbook exists, create one with default content
    if (!handbook) {
      handbook = await prisma.employeeHandbook.create({
        data: {
          content: DEFAULT_HANDBOOK_CONTENT.trim(),
          updatedBy: null,
        },
      });
    }

    return {
      ok: true,
      content: handbook.content,
      lastUpdated: handbook.updatedAt,
    };
  } catch (error: any) {
    console.error("Error loading handbook:", error);
    return {
      ok: false,
      error: error?.message || "Failed to load handbook",
      content: DEFAULT_HANDBOOK_CONTENT.trim(),
      lastUpdated: null,
    };
  }
}

export async function saveHandbookContent(content: string) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return { ok: false, error: "Not authenticated" };
  }

  const userRole = (session.user as any).role;

  // Only admins can save handbook content
  if (userRole !== "ADMIN") {
    return { ok: false, error: "Unauthorized: Only admins can edit the handbook" };
  }

  try {
    // Clean up the content - remove any wrapper divs that Quill might add
    // Quill sometimes wraps content in <p><br></p> or adds extra whitespace
    let cleanedContent = content.trim();
    
    // Remove empty paragraphs that Quill might add
    cleanedContent = cleanedContent.replace(/<p><br><\/p>/g, '');
    cleanedContent = cleanedContent.replace(/<p>\s*<\/p>/g, '');
    
    // Ensure content is not empty
    if (!cleanedContent || cleanedContent === '<p></p>' || cleanedContent === '<p><br></p>') {
      return { ok: false, error: "Content cannot be empty" };
    }

    // Check if handbook exists
    const existing = await prisma.employeeHandbook.findFirst({
      orderBy: { updatedAt: "desc" },
    });

    if (existing) {
      // Update existing handbook
      await prisma.employeeHandbook.update({
        where: { id: existing.id },
        data: {
          content: cleanedContent,
          updatedBy: (session.user as any).id,
        },
      });
    } else {
      // Create new handbook
      await prisma.employeeHandbook.create({
        data: {
          content: cleanedContent,
          updatedBy: (session.user as any).id,
        },
      });
    }

    return { ok: true };
  } catch (error: any) {
    console.error("Error saving handbook:", error);
    return {
      ok: false,
      error: error?.message || "Failed to save handbook",
    };
  }
}

