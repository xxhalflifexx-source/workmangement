"use client";

export default function RegistrationCodes() {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // You could add a toast notification here if desired
      alert(`Copied "${text}" to clipboard!`);
    });
  };

  return (
    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl shadow-lg p-6 mb-8 text-white">
      <div className="flex items-center gap-3 mb-4">
        <div className="text-3xl">🔑</div>
        <div>
          <h3 className="text-xl font-bold">Registration Codes</h3>
          <p className="text-purple-100 text-sm">Share these codes with new users during registration</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Employee Code */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-purple-100 text-sm font-medium">Employee</span>
            <span className="text-xs bg-white/20 px-2 py-1 rounded">Default</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-2xl font-bold text-white bg-white/20 px-3 py-2 rounded font-mono">
              sunrise
            </code>
            <button
              onClick={() => copyToClipboard("sunrise")}
              className="text-white hover:text-purple-200 transition-colors cursor-pointer"
              title="Copy code"
            >
              📋
            </button>
          </div>
        </div>

        {/* Manager Code */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-purple-100 text-sm font-medium">Manager</span>
            <span className="text-xs bg-yellow-400/30 px-2 py-1 rounded text-yellow-100">Manager+</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-2xl font-bold text-white bg-white/20 px-3 py-2 rounded font-mono">
              sunset
            </code>
            <button
              onClick={() => copyToClipboard("sunset")}
              className="text-white hover:text-purple-200 transition-colors cursor-pointer"
              title="Copy code"
            >
              📋
            </button>
          </div>
        </div>

        {/* Admin Code */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-purple-100 text-sm font-medium">Admin</span>
            <span className="text-xs bg-red-400/30 px-2 py-1 rounded text-red-100">Admin Only</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-2xl font-bold text-white bg-white/20 px-3 py-2 rounded font-mono">
              moonlight
            </code>
            <button
              onClick={() => copyToClipboard("moonlight")}
              className="text-white hover:text-purple-200 transition-colors cursor-pointer"
              title="Copy code"
            >
              📋
            </button>
          </div>
        </div>
      </div>
      <div className="mt-4 text-purple-100 text-sm">
        <p>💡 <strong>Tip:</strong> Users enter these codes during registration to get the corresponding role. Leave empty for Employee role.</p>
      </div>
    </div>
  );
}

