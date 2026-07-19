import { useState, useEffect } from "react";
import { FileText, MapPin, Clock, PlusCircle } from "lucide-react";
import { API_BASE_URL, fetchWithRetry } from "../config";

const statusStyles = {
  Pending: "bg-gray-100 text-gray-600",
  "Under Review": "bg-blue-50 text-blue-600",
  Submitted: "bg-orange-50 text-orange-600",
  Resolved: "bg-green-50 text-green-600",
};

function getMyReportIds() {
  try {
    const raw = localStorage.getItem("vayu_my_report_ids");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function MyReportsTracker({ onNewReport }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const myIds = getMyReportIds();
    if (myIds.length === 0) {
      setLoading(false);
      return;
    }

    fetchWithRetry(`${API_BASE_URL}/reports`)
      .then((res) => res.json())
      .then((data) => {
        const all = data.reports || [];
        const mine = all.filter((r) => myIds.includes(r.id));
        setReports(mine);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-gray-800">My Reports</h2>
        <button
          onClick={onNewReport}
          className="flex items-center gap-2 bg-teal-800 hover:bg-teal-900 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          <PlusCircle size={16} /> Report an Issue
        </button>
      </div>
      <p className="text-sm text-gray-400 mb-6">
        Track the status of pollution reports you've submitted.
      </p>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
          Loading your reports...
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
          You haven't submitted any reports yet from this device.
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
              <div className="flex items-start gap-3">
                <div className="bg-gray-100 text-gray-500 p-2.5 rounded-lg">
                  <FileText size={18} />
                </div>
                <div>
                  <p className="font-medium text-gray-800">{r.area}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    <MapPin size={11} /> Report #{r.id}
                  </p>
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    <Clock size={11} /> {r.reported_date}
                  </p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusStyles[r.status] || statusStyles.Pending}`}>
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyReportsTracker;