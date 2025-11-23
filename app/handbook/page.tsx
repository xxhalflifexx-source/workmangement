"use client";

import Link from "next/link";

export default function HandbookPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-3 sm:px-4 lg:px-5 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Employee Handbook</h1>
            <p className="text-sm text-gray-500">Company policies and procedures</p>
          </div>
          <Link
            href="/hr"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            Back to HR
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-5 py-8">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-8 mb-8 text-white">
          <h2 className="text-3xl font-bold mb-4">Welcome to Our Team! 👋</h2>
          <p className="text-blue-100 text-lg">
            This handbook is designed to help you understand our company culture, policies, and procedures. 
            Please read through it carefully and refer back as needed.
          </p>
        </div>

        {/* Table of Contents */}
        <div className="bg-white rounded-xl shadow p-6 mb-8 border border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 mb-4">📋 Table of Contents</h3>
          <ul className="space-y-2 text-blue-600">
            <li><a href="#welcome" className="hover:underline">1. Welcome & Mission Statement</a></li>
            <li><a href="#code-of-conduct" className="hover:underline">2. Code of Conduct</a></li>
            <li><a href="#work-hours" className="hover:underline">3. Work Hours & Attendance</a></li>
            <li><a href="#time-tracking" className="hover:underline">4. Time Tracking System</a></li>
            <li><a href="#pto" className="hover:underline">5. Paid Time Off (PTO)</a></li>
            <li><a href="#benefits" className="hover:underline">6. Benefits</a></li>
            <li><a href="#safety" className="hover:underline">7. Safety Policies</a></li>
            <li><a href="#technology" className="hover:underline">8. Technology & Equipment</a></li>
            <li><a href="#communication" className="hover:underline">9. Communication Guidelines</a></li>
            <li><a href="#contact" className="hover:underline">10. Contact Information</a></li>
          </ul>
        </div>

        {/* Content Sections */}
        <div className="space-y-8">
          {/* Section 1 */}
          <section id="welcome" className="bg-white rounded-xl shadow p-6 border border-gray-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">1. Welcome & Mission Statement</h3>
            <div className="prose max-w-none text-gray-700 space-y-3">
              <p>
                Welcome to our company! We're thrilled to have you as part of our team. Our mission is to deliver 
                exceptional service while maintaining a positive, supportive work environment for all employees.
              </p>
              <p className="font-semibold">Our Core Values:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Integrity and honesty in all interactions</li>
                <li>Excellence in craftsmanship and service</li>
                <li>Respect for all team members and clients</li>
                <li>Continuous learning and improvement</li>
                <li>Safety above all else</li>
              </ul>
            </div>
          </section>

          {/* Section 2 */}
          <section id="code-of-conduct" className="bg-white rounded-xl shadow p-6 border border-gray-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">2. Code of Conduct</h3>
            <div className="prose max-w-none text-gray-700 space-y-3">
              <p>All employees are expected to:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Treat colleagues, clients, and vendors with respect</li>
                <li>Maintain professional behavior at all times</li>
                <li>Follow all company policies and procedures</li>
                <li>Report any concerns or violations to management</li>
                <li>Maintain confidentiality of company and client information</li>
              </ul>
              <div className="mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800">
                <p className="font-semibold">⚠️ Note:</p>
                <p>Violations of our code of conduct may result in disciplinary action, up to and including termination.</p>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section id="work-hours" className="bg-white rounded-xl shadow p-6 border border-gray-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">3. Work Hours & Attendance</h3>
            <div className="prose max-w-none text-gray-700 space-y-3">
              <p><strong>Standard Work Week:</strong> Monday - Friday, 8:00 AM - 5:00 PM</p>
              <p><strong>Break Policy:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>30-minute unpaid lunch break (for shifts over 6 hours)</li>
                <li>Two 15-minute paid breaks (one morning, one afternoon)</li>
              </ul>
              <p><strong>Attendance:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Punctuality is expected for all shifts</li>
                <li>Notify your supervisor immediately if you will be late or absent</li>
                <li>Excessive tardiness or absences may result in disciplinary action</li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section id="time-tracking" className="bg-white rounded-xl shadow p-6 border border-gray-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">4. Time Tracking System</h3>
            <div className="prose max-w-none text-gray-700 space-y-3">
              <p>We use a digital time clock system to track work hours:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Clock In:</strong> When you arrive and are ready to begin work</li>
                <li><strong>Clock Out:</strong> When you leave for the day or for breaks</li>
                <li><strong>Job Assignment:</strong> Select the job you're working on when clocking in</li>
                <li><strong>Notes:</strong> Add notes about your work, progress, or issues</li>
                <li><strong>Photos:</strong> Upload photos of completed work or problems encountered</li>
              </ul>
              <div className="mt-4 p-4 bg-blue-50 border-l-4 border-blue-400 text-blue-800">
                <p className="font-semibold">💡 Tip:</p>
                <p>Access the time clock from your dashboard. Make sure to clock in/out accurately - your hours are automatically calculated!</p>
              </div>
            </div>
          </section>

          {/* Section 5 */}
          <section id="pto" className="bg-white rounded-xl shadow p-6 border border-gray-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">5. Paid Time Off (PTO)</h3>
            <div className="prose max-w-none text-gray-700 space-y-3">
              <p><strong>Accrual:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>0-1 year: 10 days per year</li>
                <li>1-5 years: 15 days per year</li>
                <li>5+ years: 20 days per year</li>
              </ul>
              <p><strong>Requesting PTO:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Submit requests at least 2 weeks in advance when possible</li>
                <li>Requests are subject to manager approval based on staffing needs</li>
                <li>PTO must be used within the calendar year (no rollover)</li>
              </ul>
            </div>
          </section>

          {/* Section 6 */}
          <section id="benefits" className="bg-white rounded-xl shadow p-6 border border-gray-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">6. Benefits</h3>
            <div className="prose max-w-none text-gray-700 space-y-3">
              <p>Full-time employees are eligible for:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Health insurance (medical, dental, vision)</li>
                <li>401(k) retirement plan with company match</li>
                <li>Paid holidays (8 per year)</li>
                <li>Paid time off (see PTO section)</li>
                <li>Professional development opportunities</li>
                <li>Safety equipment and gear provided</li>
              </ul>
              <p className="italic">Benefits eligibility begins after 90 days of employment.</p>
            </div>
          </section>

          {/* Section 7 */}
          <section id="safety" className="bg-white rounded-xl shadow p-6 border border-gray-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">7. Safety Policies</h3>
            <div className="prose max-w-none text-gray-700 space-y-3">
              <p className="font-semibold text-red-600">⚠️ Safety is our #1 priority!</p>
              <p><strong>Required Safety Practices:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Always wear required Personal Protective Equipment (PPE)</li>
                <li>Follow all OSHA guidelines and company safety procedures</li>
                <li>Report all injuries, no matter how minor, immediately</li>
                <li>Report unsafe conditions or hazards to your supervisor</li>
                <li>Never operate equipment you're not trained or authorized to use</li>
                <li>Keep work areas clean and organized</li>
              </ul>
              <div className="mt-4 p-4 bg-red-50 border-l-4 border-red-400 text-red-800">
                <p className="font-semibold">🚨 Emergency Contact:</p>
                <p>In case of emergency, call 911 first, then notify your supervisor immediately.</p>
              </div>
            </div>
          </section>

          {/* Section 8 */}
          <section id="technology" className="bg-white rounded-xl shadow p-6 border border-gray-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">8. Technology & Equipment</h3>
            <div className="prose max-w-none text-gray-700 space-y-3">
              <p><strong>Company Portal Access:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>You have been provided login credentials for our employee portal</li>
                <li>Do not share your password with anyone</li>
                <li>Log out when using shared computers</li>
              </ul>
              <p><strong>Equipment:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Company-provided tools and equipment must be maintained properly</li>
                <li>Report any damaged or malfunctioning equipment immediately</li>
                <li>Personal use of company equipment is not permitted</li>
              </ul>
            </div>
          </section>

          {/* Section 9 */}
          <section id="communication" className="bg-white rounded-xl shadow p-6 border border-gray-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">9. Communication Guidelines</h3>
            <div className="prose max-w-none text-gray-700 space-y-3">
              <p><strong>Internal Communication:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Check the employee portal daily for updates and announcements</li>
                <li>Respond to manager communications promptly</li>
                <li>Use the job management system to update job status and notes</li>
                <li>Material requests can be submitted through the time clock or job pages</li>
              </ul>
              <p><strong>Client Communication:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Always be professional and courteous with clients</li>
                <li>Direct any client concerns or complaints to your supervisor</li>
                <li>Do not discuss pricing or make commitments without manager approval</li>
              </ul>
            </div>
          </section>

          {/* Section 10 */}
          <section id="contact" className="bg-white rounded-xl shadow p-6 border border-gray-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">10. Contact Information</h3>
            <div className="prose max-w-none text-gray-700 space-y-3">
              <p><strong>HR Department:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Email: hr@company.com</li>
                <li>Phone: (555) 123-4567</li>
              </ul>
              <p><strong>Emergency Contacts:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Emergency: 911</li>
                <li>Supervisor On-Call: (555) 987-6543</li>
              </ul>
              <p><strong>IT Support:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Email: support@company.com</li>
                <li>For portal login issues or technical problems</li>
              </ul>
            </div>
          </section>
        </div>

        {/* Acknowledgment Section */}
        <div className="mt-8 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl shadow p-6 border-2 border-green-200">
          <h3 className="text-xl font-bold text-gray-900 mb-3">📝 Handbook Acknowledgment</h3>
          <p className="text-gray-700 mb-4">
            By accessing this handbook, you acknowledge that you have read, understood, and agree to comply with 
            all policies and procedures outlined above. This handbook is subject to change, and you will be notified 
            of any updates.
          </p>
          <p className="text-sm text-gray-600 italic">
            Last Updated: October 2025
          </p>
        </div>

        {/* Back Button */}
        <div className="mt-8 text-center">
          <Link
            href="/hr"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-lg"
          >
            ← Return to HR Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}



