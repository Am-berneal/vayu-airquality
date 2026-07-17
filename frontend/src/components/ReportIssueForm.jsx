import { useState } from "react";
import { Upload, MapPin } from "lucide-react";

function ReportIssueForm() {
  const [placeName, setPlaceName] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [reportId, setReportId] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          place_name: placeName,
          description: description,
          state: "Chandigarh",
        }),
      });
      const data = await response.json();
      setReportId(data.report_id);
      setSubmitted(true);
    } catch (err) {
      console.error("Failed to submit report:", err);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <p className="text-teal-700 font-semibold text-lg mb-2">
            Report Submitted
          </p>
          <p className="text-gray-500 text-sm">
            Report ID #{reportId} — we'll notify you on the status.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-xl font-bold text-gray-800 mb-1">Report an Issue</h2>
      <p className="text-sm text-gray-400 mb-6">
        Help us enforce clean air by detailing the pollution source.
      </p>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
        <div>
          <label className="text-xs font-medium text-gray-600">Place Name</label>
          <input
            type="text"
            placeholder="e.g., Okhla Industrial Area, Phase 1"
            value={placeName}
            onChange={(e) => setPlaceName(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 flex items-center gap-1 mb-1">
            <MapPin size={14} /> Pinpoint Location
          </label>
          <div className="bg-gray-100 rounded-lg h-48 flex items-center justify-center text-gray-400 text-sm">
            Map pin picker (wired in next step)
          </div>
          <p className="text-xs text-gray-400 mt-1">Drag the pin to the exact location of the issue.</p>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Photographic Evidence</label>
          <div className="border-2 border-dashed border-gray-200 rounded-lg py-8 flex flex-col items-center justify-center text-center">
            <div className="bg-teal-50 text-teal-600 p-3 rounded-full mb-2">
              <Upload size={20} />
            </div>
            <p className="text-sm text-gray-600">Drag and drop media here</p>
            <p className="text-xs text-gray-400 mb-3">or click to browse files</p>
            <button type="button" className="bg-gray-100 text-gray-700 text-sm px-4 py-1.5 rounded-lg">
              Browse Files
            </button>
            <p className="text-xs text-gray-300 mt-2">Supports JPG, PNG, MP4 (Max 10MB)</p>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what you're seeing — smoke, burning smell, dust, etc."
            className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm h-24 focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-teal-800 hover:bg-teal-900 text-white font-medium py-2.5 rounded-lg disabled:opacity-50"
        >
          {loading ? "Submitting..." : "Submit Report"}
        </button>
      </form>
    </div>
  );
}

export default ReportIssueForm;