import { useState, useEffect } from "react";
import { Users, TrendingUp, CheckCircle2 } from "lucide-react";
import { API_BASE_URL, fetchWithRetry } from "../config";

const STATUS_COLORS = {
  Pending: "bg-gray-100 text-gray-600",
  "Under Review": "bg-blue-50 text-blue-600",
  Submitted: "bg-orange-50 text-orange-600",
  Resolved: "bg-green-50 text-green-600",
};

function CommunityImpact() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWithRetry(`${API_BASE_URL}/community-impact`)
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-1">Community Impact</h2>
      <p className="text-sm text-gray-400 mb-6">
        See how citizen reports are contributing to enforcement across Chandigarh.
      </p>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
          Loading community data...
        </div>
      ) : !data || data.total_reports === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
          No reports have been submitted yet. Be the first to report an issue!
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="bg-teal-50 text-teal-600 p-2 rounded-lg inline-flex mb-2">
                <Users size={18} />
              </div>
              <p className="text-2xl font-bold text-gray-800">{data.total_reports}</p>
              <p className="text-xs text-gray-400">Total reports submitted</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="bg-blue-50 text-blue-600 p-2 rounded-lg inline-flex mb-2">
                <TrendingUp size={18} />
              </div>
              <p className="text-2xl font-bold text-gray-800">{data.by_area.length}</p>
              <p className="text-xs text-gray-400">Areas with reports</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="bg-green-50 text-green-600 p-2 rounded-lg inline-flex mb-2">
                <CheckCircle2 size={18} />
              </div>
              <p className="text-2xl font-bold text-gray-800">
                {(data.by_status["Submitted"] || 0) + (data.by_status["Resolved"] || 0)}
              </p>
              <p className="text-xs text-gray-400">Reviewed by officers</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4">Reports by Area</h3>
            <div className="space-y-3">
              {data.by_area.map((a) => (
                <div key={a.area}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{a.area}</span>
                    <span className="font-medium text-gray-800">{a.count}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-teal-600 h-2 rounded-full"
                      style={{ width: `${(a.count / data.total_reports) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Report Status Breakdown</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.by_status).map(([status, count]) => (
                <span key={status} className={`px-3 py-1.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] || STATUS_COLORS.Pending}`}>
                  {status}: {count}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default CommunityImpact;