import { useState } from "react";
import { Users, Shield, ArrowRight, Info } from "lucide-react";

function LoginPage({ onCitizenLogin, onOfficerLogin }) {
  const [citizenTab, setCitizenTab] = useState("login"); // "login" | "signup"
  const [citizenForm, setCitizenForm] = useState({ name: "", contact: "", password: "" });
  const [officerForm, setOfficerForm] = useState({ officialId: "", password: "" });

  const handleCitizenSubmit = (e) => {
    e.preventDefault();
    if (onCitizenLogin) onCitizenLogin(citizenForm);
  };

  const handleOfficerSubmit = (e) => {
    e.preventDefault();
    if (onOfficerLogin) onOfficerLogin(officerForm);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-blue-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-teal-800 tracking-tight">VAYU</h1>
        <p className="text-gray-500 mt-1">Clean Air, Enforced.</p>
      </div>

      {/* Cards */}
      <div className="flex flex-col md:flex-row gap-6 w-full max-w-3xl">
        {/* Citizen Card */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start gap-3 mb-5">
            <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
              <Users size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">Continue as Citizen</h2>
              <p className="text-sm text-gray-400">Report issues and track air quality.</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-5 text-sm font-medium">
            <button
              onClick={() => setCitizenTab("login")}
              className={`pb-2 px-3 -mb-px border-b-2 transition ${
                citizenTab === "login"
                  ? "border-teal-700 text-teal-700"
                  : "border-transparent text-gray-400"
              }`}
            >
              Log In
            </button>
            <button
              onClick={() => setCitizenTab("signup")}
              className={`pb-2 px-3 -mb-px border-b-2 transition ${
                citizenTab === "signup"
                  ? "border-teal-700 text-teal-700"
                  : "border-transparent text-gray-400"
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleCitizenSubmit} className="space-y-4">
            {citizenTab === "signup" && (
              <div>
                <label className="text-xs font-medium text-gray-600">Full Name</label>
                <input
                  type="text"
                  placeholder="Enter your name"
                  value={citizenForm.name}
                  onChange={(e) => setCitizenForm({ ...citizenForm, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-gray-600">Email or Phone</label>
              <input
                type="text"
                placeholder="Enter your email or phone"
                value={citizenForm.contact}
                onChange={(e) => setCitizenForm({ ...citizenForm, contact: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600">Password</label>
              <input
                type="password"
                placeholder="Enter password"
                value={citizenForm.password}
                onChange={(e) => setCitizenForm({ ...citizenForm, password: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-teal-800 hover:bg-teal-900 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition"
            >
              {citizenTab === "login" ? "Log In to Portal" : "Create Account"}
              <ArrowRight size={16} />
            </button>
          </form>
        </div>

        {/* Officer Card */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start gap-3 mb-5">
            <div className="bg-gray-100 text-gray-600 p-2 rounded-lg">
              <Shield size={20} />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">Regulatory Officer</h2>
              <p className="text-sm text-gray-400">Access enforcement dashboard.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-gray-50 text-gray-500 text-xs px-3 py-2 rounded-lg mb-5">
            <Info size={14} />
            Secure institutional login portal.
          </div>

          <form onSubmit={handleOfficerSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600">Official ID</label>
              <input
                type="text"
                placeholder="e.g. CPCB-ID-1234"
                value={officerForm.officialId}
                onChange={(e) => setOfficerForm({ ...officerForm, officialId: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600">Password</label>
              <input
                type="password"
                placeholder="Institutional password"
                value={officerForm.password}
                onChange={(e) => setOfficerForm({ ...officerForm, password: e.target.value })}
                className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition"
            >
              <Shield size={16} />
              Authenticate
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <p className="text-xs text-gray-400 mt-6 text-center">
        By continuing, you agree to the VAYU{" "}
        <span className="underline cursor-pointer">Terms of Service</span> and{" "}
        <span className="underline cursor-pointer">Privacy Policy</span>.
      </p>
    </div>
  );
}

export default LoginPage;