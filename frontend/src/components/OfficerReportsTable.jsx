import { useState, useEffect } from "react";

const priorityStyles = {
  Urgent: "bg-red-50 text-red-600",
  High: "bg-orange-50 text-orange-600",
  Medium: "bg-yellow-50 text-yellow-700",
  Low: "bg-green-50 text-green-600",
};

function OfficerReportsTable({ onReviewClick }) {
  const [filter, setFilter] = useState("All Priorities");

  const [reports, setReports] = useState([]);

  useEffect(() => {
    const fetchReports = () => {
      fetch("http://127.0.0.1:8000/reports")
        .then((res) => res.json())
        .then((data) => setReports(data.reports || []))
        .catch((err) => console.error("Failed to fetch reports:", err));
    };

    fetchReports();
    const interval = setInterval(fetchReports, 5000);
    return () => clearInterval(interval);
  }, []);

  const filtered =
    filter === "All Priorities"
      ? reports
      : reports.filter((r) => r.priority === filter);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Active Reports</h2>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          >
            <option>All Priorities</option>
            <option>Urgent</option>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-gray-100">
              <th className="px-6 py-3 font-medium">Area Name</th>
              <th className="px-6 py-3 font-medium">AQI</th>
              <th className="px-6 py-3 font-medium">Reported Date</th>
              <th className="px-6 py-3 font-medium">Priority</th>
              <th className="px-6 py-3 font-medium">Source Type</th>
              <th className="px-6 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, idx) => (
              <tr key={idx} className="border-b border-gray-50 last:border-0">
                <td className="px-6 py-4 font-medium text-gray-800">{r.area}</td>
                <td className="px-6 py-4 text-red-500 font-semibold">{r.aqi}</td>
                <td className="px-6 py-4 text-gray-500">{r.reported_date}</td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${priorityStyles[r.priority]}`}>
                    {r.priority}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-600">{r.source}</td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => onReviewClick(r)}
                    className="bg-teal-800 hover:bg-teal-900 text-white text-xs font-medium px-4 py-2 rounded-lg"
                  >
                    Review & Take Action
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default OfficerReportsTable;