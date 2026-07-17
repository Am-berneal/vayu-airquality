import { useState } from "react";
import { AlertTriangle, Send } from "lucide-react";

function AIReviewPanel({ report, onBack }) {
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    // Later: POST to backend /submit-report endpoint
    setSubmitted(true);
  };

  if (!report) {
    return <div className="p-6 text-gray-400">No report selected.</div>;
  }

  if (submitted) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <p className="text-teal-700 font-semibold text-lg mb-2">
            Submitted to Government Portal
          </p>
          <p className="text-gray-500 text-sm">
            Report ID #CHD-2026-{Math.floor(1000 + Math.random() * 9000)}
          </p>
          <button
            onClick={onBack}
            className="mt-6 text-sm text-teal-700 underline"
          >
            Back to Reports
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-gray-800">AI Review Panel</h2>
        <span className="bg-green-50 text-green-600 text-xs font-medium px-3 py-1 rounded-full">
          Live Analysis Active
        </span>
      </div>
      <p className="text-sm text-gray-400 mb-6">
        Incident #CHD-2026-0412 pending officer validation.
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Citizen Evidence */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-3">📷 Citizen Evidence</h3>
          <div className="bg-gray-100 rounded-lg h-40 mb-3 flex items-center justify-center text-gray-400 text-sm">
            Photo/video evidence
          </div>
          <p className="text-sm text-gray-600">
            "Large pile of industrial plastic and rubber waste being burned in
            the empty lot behind the textile factory. Extremely thick,
            foul-smelling smoke blowing towards the residential colony."
          </p>
          <p className="text-xs text-gray-400 mt-2">
            📍 {report.area}
          </p>
        </div>

        {/* AI Analysis */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">🛰️ AI Analysis</h3>
            <span className="bg-green-50 text-green-600 text-xs font-medium px-2 py-0.5 rounded-full">
              Confidence 85%
            </span>
          </div>
          <div className="bg-gray-100 rounded-lg h-40 mb-3 flex items-center justify-center text-gray-400 text-sm">
            Satellite / wind overlay
          </div>
          <div className="flex items-start gap-2 bg-orange-50 text-orange-700 text-sm p-3 rounded-lg mb-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <div>
              <strong>Industrial Source Detected.</strong> Visual analysis
              aligns with unpermitted biomass/synthetic burning. Wind pattern
              confirms trajectory towards residential area.
            </div>
          </div>
          <div className="flex gap-4 text-sm">
            <div>
              <p className="text-gray-400 text-xs">PM2.5 Spike</p>
              <p className="text-red-600 font-semibold">+450 µg/m³</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Affected Area</p>
              <p className="font-semibold text-gray-800">2.4 sq km</p>
            </div>
          </div>
        </div>
      </div>

      {/* Officer Actions */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 mt-6">
        <h3 className="font-semibold text-gray-800 mb-3">Officer Actions</h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Enter official validation notes and prescribed penalties..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-24 mb-4 focus:outline-none focus:ring-2 focus:ring-teal-600"
        />
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            className="flex items-center gap-2 bg-teal-800 hover:bg-teal-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg"
          >
            Submit Validated Report
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIReviewPanel;