import { useState, useEffect } from "react";
import { AlertTriangle, Send, Loader2 } from "lucide-react";
import { API_BASE_URL } from "../config";

function AIReviewPanel({ report, onBack }) {
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!report) return;

    setLoadingAnalysis(true);
    fetch(`${API_BASE_URL}/analyze-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: report.description || "No description provided.",
        area: report.area,
        aqi: report.aqi,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        setAnalysis(data.analysis);
        setLoadingAnalysis(false);
      })
      .catch((err) => {
        console.error("Analysis fetch failed:", err);
        setAnalysis({
          likely_source: "Unknown",
          confidence_percent: 0,
          severity: "Medium",
          analysis_summary: "Could not reach the analysis service.",
          recommended_action: "Conduct a manual site inspection.",
        });
        setLoadingAnalysis(false);
      });
  }, [report]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await fetch(`${API_BASE_URL}/reports/${report.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Submitted" }),
      });
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setSubmitting(false);
      setSubmitted(true);
    }
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
          <p className="text-gray-500 text-sm">Report ID #{report.id}</p>
          <button onClick={onBack} className="mt-6 text-sm text-teal-700 underline">
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
          {loadingAnalysis ? "Analyzing..." : "Live Analysis Active"}
        </span>
      </div>
      <p className="text-sm text-gray-400 mb-6">
        Incident #{report.id} pending officer validation.
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-3">📷 Citizen Evidence</h3>
          <div className="bg-gray-100 rounded-lg h-40 mb-3 flex items-center justify-center text-gray-400 text-sm">
            Photo/video evidence
          </div>
          <p className="text-sm text-gray-600">
            {report.description || "No description provided."}
          </p>
          <p className="text-xs text-gray-400 mt-2">📍 {report.area}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">🛰️ AI Analysis</h3>
            {!loadingAnalysis && analysis && (
              <span className="bg-green-50 text-green-600 text-xs font-medium px-2 py-0.5 rounded-full">
                Confidence {analysis.confidence_percent}%
              </span>
            )}
          </div>

          {loadingAnalysis ? (
            <div className="h-40 flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
              <Loader2 size={24} className="animate-spin" />
              Gemini is analyzing this report...
            </div>
          ) : (
            <>
              <div className="bg-gray-100 rounded-lg h-24 mb-3 flex items-center justify-center text-gray-400 text-sm">
                Satellite / wind overlay
              </div>
              <div className="flex items-start gap-2 bg-orange-50 text-orange-700 text-sm p-3 rounded-lg mb-3">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <div>
                  <strong>{analysis.likely_source} Source Detected.</strong>{" "}
                  {analysis.analysis_summary}
                </div>
              </div>
              <div className="flex gap-4 text-sm">
                <div>
                  <p className="text-gray-400 text-xs">Severity</p>
                  <p className="text-red-600 font-semibold">{analysis.severity}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">AQI at report</p>
                  <p className="font-semibold text-gray-800">{report.aqi}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-gray-400 text-xs mb-1">Recommended Action</p>
                <p className="text-sm text-gray-700">{analysis.recommended_action}</p>
              </div>
            </>
          )}
        </div>
      </div>

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
            disabled={submitting || loadingAnalysis}
            className="flex items-center gap-2 bg-teal-800 hover:bg-teal-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Validated Report"}
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIReviewPanel;