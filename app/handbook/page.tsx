"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { getHandbookContent, saveHandbookContent } from "./actions";

// Default handbook content (used if no content in database)
const DEFAULT_HANDBOOK_CONTENT = `
<div class="space-y-6 sm:space-y-8">
  <section id="welcome" class="bg-white rounded-xl shadow p-6 border border-gray-200">
    <h3 class="text-2xl font-bold text-gray-900 mb-4">1. Welcome & Mission Statement</h3>
    <div class="prose max-w-none text-gray-700 space-y-3">
      <p>Welcome to our company! We're thrilled to have you as part of our team. Our mission is to deliver exceptional service while maintaining a positive, supportive work environment for all employees.</p>
      <p class="font-semibold">Our Core Values:</p>
      <ul class="list-disc list-inside space-y-1">
        <li>Integrity and honesty in all interactions</li>
        <li>Excellence in craftsmanship and service</li>
        <li>Respect for all team members and clients</li>
        <li>Continuous learning and improvement</li>
        <li>Safety above all else</li>
      </ul>
    </div>
  </section>

  <section id="code-of-conduct" class="bg-white rounded-xl shadow p-6 border border-gray-200">
    <h3 class="text-2xl font-bold text-gray-900 mb-4">2. Code of Conduct</h3>
    <div class="prose max-w-none text-gray-700 space-y-3">
      <p>All employees are expected to:</p>
      <ul class="list-disc list-inside space-y-1">
        <li>Treat colleagues, clients, and vendors with respect</li>
        <li>Maintain professional behavior at all times</li>
        <li>Follow all company policies and procedures</li>
        <li>Report any concerns or violations to management</li>
        <li>Maintain confidentiality of company and client information</li>
      </ul>
      <div class="mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800">
        <p class="font-semibold">⚠️ Note:</p>
        <p>Violations of our code of conduct may result in disciplinary action, up to and including termination.</p>
      </div>
    </div>
  </section>

  <section id="work-hours" class="bg-white rounded-xl shadow p-6 border border-gray-200">
    <h3 class="text-2xl font-bold text-gray-900 mb-4">3. Work Hours & Attendance</h3>
    <div class="prose max-w-none text-gray-700 space-y-3">
      <p><strong>Standard Work Week:</strong> Monday - Friday, 8:00 AM - 5:00 PM</p>
      <p><strong>Break Policy:</strong></p>
      <ul class="list-disc list-inside space-y-1">
        <li>30-minute unpaid lunch break (for shifts over 6 hours)</li>
        <li>Two 15-minute paid breaks (one morning, one afternoon)</li>
      </ul>
      <p><strong>Attendance:</strong></p>
      <ul class="list-disc list-inside space-y-1">
        <li>Punctuality is expected for all shifts</li>
        <li>Notify your supervisor immediately if you will be late or absent</li>
        <li>Excessive tardiness or absences may result in disciplinary action</li>
      </ul>
    </div>
  </section>

  <section id="time-tracking" class="bg-white rounded-xl shadow p-6 border border-gray-200">
    <h3 class="text-2xl font-bold text-gray-900 mb-4">4. Time Tracking System</h3>
    <div class="prose max-w-none text-gray-700 space-y-3">
      <p>We use a digital time clock system to track work hours:</p>
      <ul class="list-disc list-inside space-y-1">
        <li><strong>Clock In:</strong> When you arrive and are ready to begin work</li>
        <li><strong>Clock Out:</strong> When you leave for the day or for breaks</li>
        <li><strong>Job Assignment:</strong> Select the job you're working on when clocking in</li>
        <li><strong>Notes:</strong> Add notes about your work, progress, or issues</li>
        <li><strong>Photos:</strong> Upload photos of completed work or problems encountered</li>
      </ul>
      <div class="mt-4 p-4 bg-blue-50 border-l-4 border-blue-400 text-blue-800">
        <p class="font-semibold">💡 Tip:</p>
        <p>Access the time clock from your dashboard. Make sure to clock in/out accurately - your hours are automatically calculated!</p>
      </div>
    </div>
  </section>

  <section id="pto" class="bg-white rounded-xl shadow p-6 border border-gray-200">
    <h3 class="text-2xl font-bold text-gray-900 mb-4">5. Paid Time Off (PTO)</h3>
    <div class="prose max-w-none text-gray-700 space-y-3">
      <p><strong>Accrual:</strong></p>
      <ul class="list-disc list-inside space-y-1">
        <li>0-1 year: 10 days per year</li>
        <li>1-5 years: 15 days per year</li>
        <li>5+ years: 20 days per year</li>
      </ul>
      <p><strong>Requesting PTO:</strong></p>
      <ul class="list-disc list-inside space-y-1">
        <li>Submit requests at least 2 weeks in advance when possible</li>
        <li>Requests are subject to manager approval based on staffing needs</li>
        <li>PTO must be used within the calendar year (no rollover)</li>
      </ul>
    </div>
  </section>

  <section id="benefits" class="bg-white rounded-xl shadow p-6 border border-gray-200">
    <h3 class="text-2xl font-bold text-gray-900 mb-4">6. Benefits</h3>
    <div class="prose max-w-none text-gray-700 space-y-3">
      <p>Full-time employees are eligible for:</p>
      <ul class="list-disc list-inside space-y-1">
        <li>Health insurance (medical, dental, vision)</li>
        <li>401(k) retirement plan with company match</li>
        <li>Paid holidays (8 per year)</li>
        <li>Paid time off (see PTO section)</li>
        <li>Professional development opportunities</li>
        <li>Safety equipment and gear provided</li>
      </ul>
      <p class="italic">Benefits eligibility begins after 90 days of employment.</p>
    </div>
  </section>

  <section id="safety" class="bg-white rounded-xl shadow p-6 border border-gray-200">
    <h3 class="text-2xl font-bold text-gray-900 mb-4">7. Safety Policies</h3>
    <div class="prose max-w-none text-gray-700 space-y-3">
      <p class="font-semibold text-red-600">⚠️ Safety is our #1 priority!</p>
      <p><strong>Required Safety Practices:</strong></p>
      <ul class="list-disc list-inside space-y-1">
        <li>Always wear required Personal Protective Equipment (PPE)</li>
        <li>Follow all OSHA guidelines and company safety procedures</li>
        <li>Report all injuries, no matter how minor, immediately</li>
        <li>Report unsafe conditions or hazards to your supervisor</li>
        <li>Never operate equipment you're not trained or authorized to use</li>
        <li>Keep work areas clean and organized</li>
      </ul>
      <div class="mt-4 p-4 bg-red-50 border-l-4 border-red-400 text-red-800">
        <p class="font-semibold">🚨 Emergency Contact:</p>
        <p>In case of emergency, call 911 first, then notify your supervisor immediately.</p>
      </div>
    </div>
  </section>

  <section id="technology" class="bg-white rounded-xl shadow p-6 border border-gray-200">
    <h3 class="text-2xl font-bold text-gray-900 mb-4">8. Technology & Equipment</h3>
    <div class="prose max-w-none text-gray-700 space-y-3">
      <p><strong>Company Portal Access:</strong></p>
      <ul class="list-disc list-inside space-y-1">
        <li>You have been provided login credentials for our employee portal</li>
        <li>Do not share your password with anyone</li>
        <li>Log out when using shared computers</li>
      </ul>
      <p><strong>Equipment:</strong></p>
      <ul class="list-disc list-inside space-y-1">
        <li>Company-provided tools and equipment must be maintained properly</li>
        <li>Report any damaged or malfunctioning equipment immediately</li>
        <li>Personal use of company equipment is not permitted</li>
      </ul>
    </div>
  </section>

  <section id="communication" class="bg-white rounded-xl shadow p-6 border border-gray-200">
    <h3 class="text-2xl font-bold text-gray-900 mb-4">9. Communication Guidelines</h3>
    <div class="prose max-w-none text-gray-700 space-y-3">
      <p><strong>Internal Communication:</strong></p>
      <ul class="list-disc list-inside space-y-1">
        <li>Check the employee portal daily for updates and announcements</li>
        <li>Respond to manager communications promptly</li>
        <li>Use the job management system to update job status and notes</li>
        <li>Material requests can be submitted through the time clock or job pages</li>
      </ul>
      <p><strong>Client Communication:</strong></p>
      <ul class="list-disc list-inside space-y-1">
        <li>Always be professional and courteous with clients</li>
        <li>Direct any client concerns or complaints to your supervisor</li>
        <li>Do not discuss pricing or make commitments without manager approval</li>
      </ul>
    </div>
  </section>

  <section id="contact" class="bg-white rounded-xl shadow p-6 border border-gray-200">
    <h3 class="text-2xl font-bold text-gray-900 mb-4">10. Contact Information</h3>
    <div class="prose max-w-none text-gray-700 space-y-3">
      <p><strong>HR Department:</strong></p>
      <ul class="list-disc list-inside space-y-1">
        <li>Email: hr@company.com</li>
        <li>Phone: (555) 123-4567</li>
      </ul>
      <p><strong>Emergency Contacts:</strong></p>
      <ul class="list-disc list-inside space-y-1">
        <li>Emergency: 911</li>
        <li>Supervisor On-Call: (555) 987-6543</li>
      </ul>
      <p><strong>IT Support:</strong></p>
      <ul class="list-disc list-inside space-y-1">
        <li>Email: support@company.com</li>
        <li>For portal login issues or technical problems</li>
      </ul>
    </div>
  </section>
</div>
`;

export default function HandbookPage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const isAdmin = userRole === "ADMIN";
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [success, setSuccess] = useState<string | undefined>();

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async () => {
    setLoading(true);
    setError(undefined);
    const res = await getHandbookContent();
    if (res.ok) {
      setContent(res.content || DEFAULT_HANDBOOK_CONTENT);
    } else {
      setError(res.error);
      setContent(DEFAULT_HANDBOOK_CONTENT);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(undefined);
    setSuccess(undefined);

    const res = await saveHandbookContent(content);
    if (res.ok) {
      setSuccess("Handbook updated successfully!");
      setIsEditing(false);
      setTimeout(() => setSuccess(undefined), 3000);
    } else {
      setError(res.error || "Failed to save handbook");
    }
    setSaving(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    loadContent(); // Reload original content
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading handbook...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-24 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">📖 Employee Handbook</h1>
            <p className="text-xs sm:text-sm text-gray-500">Company policies and procedures</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {isAdmin && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium whitespace-nowrap min-h-[44px] flex items-center justify-center"
              >
                ✏️ Edit Handbook
              </button>
            )}
            {isAdmin && isEditing && (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium whitespace-nowrap min-h-[44px] flex items-center justify-center disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving..." : "💾 Save Changes"}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium whitespace-nowrap min-h-[44px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </>
            )}
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium whitespace-nowrap min-h-[44px] flex items-center justify-center"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-24 py-6 sm:py-8">
        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
            {success}
            <button
              onClick={() => setSuccess(undefined)}
              className="float-right text-green-600 hover:text-green-800"
            >
              ×
            </button>
          </div>
        )}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            {error}
            <button
              onClick={() => setError(undefined)}
              className="float-right text-red-600 hover:text-red-800"
            >
              ×
            </button>
          </div>
        )}

        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 sm:p-8 mb-6 sm:mb-8 text-white">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Welcome to Our Team! 👋</h2>
          <p className="text-blue-100 text-sm sm:text-base lg:text-lg">
            This handbook is designed to help you understand our company culture, policies, and procedures. 
            Please read through it carefully and refer back as needed.
          </p>
        </div>

        {/* Content Editor or Viewer */}
        {isEditing ? (
          <div className="bg-white rounded-xl shadow border border-gray-200 p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Handbook Content</h3>
            <p className="text-sm text-gray-600 mb-4">
              You can use HTML tags for formatting. Common tags: &lt;p&gt;, &lt;h3&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;strong&gt;, &lt;em&gt;
            </p>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full h-[600px] border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter handbook content (HTML supported)..."
            />
          </div>
        ) : (
          <div 
            className="space-y-6 sm:space-y-8"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        )}

        {/* Acknowledgment Section */}
        {!isEditing && (
          <div className="mt-8 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl shadow p-4 sm:p-6 border-2 border-green-200">
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3">📝 Handbook Acknowledgment</h3>
            <p className="text-gray-700 mb-4 text-sm sm:text-base">
              By accessing this handbook, you acknowledge that you have read, understood, and agree to comply with 
              all policies and procedures outlined above. This handbook is subject to change, and you will be notified 
              of any updates.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
