import { useState, useEffect } from "react";
import { Satellite, Info, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { API_BASE_URL } from "../config";

function TrendBadge({ trend }) {
  const map = {
    Elevated: { cls: "bg-red-50 text-red-600", Icon: TrendingUp },
    "Below average": { cls: "bg-green-50 text-green-600", Icon: TrendingDown },
    Typical: { cls: "bg-gray-100 text-gray-600", Icon: Minus },
  };
  const { cls, Icon } = map[trend] || map.Typical;
  return (
    <span className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${cls}`}>
      <Icon size={13} /> {trend}
    </span>
  );
}

function SatelliteContext({ state }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!state) return;
    setLoading(true);
    setData(null);
    fetch(`${API_BASE_URL}/satellite-no2?state=${state}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [state]);

  if (!state) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">Satellite Context</h2>
        <p className="text-sm text-gray-400 mb-6">Regional atmospheric monitoring from space.</p>
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
          Select a State from the dropdowns above.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-1">Satellite Context</h2>
      <p className="text-sm text-gray-400 mb-4">
        Tropospheric NO₂ over {state}, measured by Copernicus Sentinel-5P.
      </p>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <Satellite size={20} className="mx-auto text-teal-600 animate-pulse mb-2" />
          <p className="text-sm text-gray-500">Retrieving satellite observations...</p>
        </div>
      ) : !data?.available ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Satellite size={20} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">{data?.reason || "Satellite data unavailable."}</p>
          <p className="text-xs text-gray-400 mt-2">
            Sentinel-5P requires cloud-free conditions; coverage gaps are normal.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-6 flex items-start gap-2">
            <Info size={15} className="text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 leading-relaxed">{data.scale_note}</p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="bg-teal-50 text-teal-600 p-2 rounded-lg inline-flex mb-2">
                <Satellite size={16} />
              </div>
              <p className="text-2xl font-bold text-gray-800">{data.latest.mean_no2}</p>
              <p className="text-xs text-gray-400">Latest NO₂ ({data.latest.date})</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-2xl font-bold text-gray-800">{data.period_average}</p>
              <p className="text-xs text-gray-400">5-day regional average</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col justify-center">
              <TrendBadge trend={data.trend} />
              <p className="text-xs text-gray-400 mt-2">vs. recent baseline</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-1">Recent Satellite Passes</h3>
            <p className="text-xs text-gray-400 mb-4">{data.unit}</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.series}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="mean_no2" stroke="#0f766e" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-[11px] text-gray-400 mt-3 pt-3 border-t border-gray-100">
              Source: {data.source}. Complements ground-station data; does not replace it.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default SatelliteContext;