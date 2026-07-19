import { useState, useEffect } from "react";
import { Factory, Car, HardHat, HelpCircle, Wind } from "lucide-react";
import { API_BASE_URL } from "../config";

const sourceConfig = [
  { key: "industrial_percent", label: "Industrial", icon: Factory, color: "bg-red-500" },
  { key: "vehicular_percent", label: "Vehicular", icon: Car, color: "bg-orange-500" },
  { key: "construction_percent", label: "Construction", icon: HardHat, color: "bg-yellow-500" },
  { key: "other_percent", label: "Other", icon: HelpCircle, color: "bg-gray-400" },
];

function SourceAttribution({ areaLabel, aqi, role }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!areaLabel || aqi == null) return;
    setLoading(true);
    fetch(`${API_BASE_URL}/source-attribution`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area: areaLabel, aqi, wind_speed: 3 }),
    })
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [areaLabel, aqi]);

  const title = role === "officer" ? "Source Attribution" : "Why Is My Area Polluted?";
  const subtitle =
    role === "officer"
      ? "Technical breakdown of pollution sources based on satellite and meteorological data."
      : "A simple explanation of what's affecting your air, in plain language.";

  if (!areaLabel) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">{title}</h2>
        <p className="text-sm text-gray-400 mb-6">{subtitle}</p>
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
          Select a State, District, and Area from the dropdowns above.
        </div>
      </div>
    );
  }

  if (aqi == null) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">{title}</h2>
        <p className="text-sm text-gray-400 mb-6">{subtitle}</p>
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
          Loading live air quality data — please wait a moment.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-1">{title}</h2>
      <p className="text-sm text-gray-400 mb-6">{subtitle}</p>

      {loading || !data ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
          Analyzing sources for {areaLabel}...
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Estimated Source Breakdown</h3>
            <div className="space-y-3">
              {sourceConfig.map(({ key, label, icon: Icon, color }) => (
                <div key={key}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="flex items-center gap-2 text-gray-600">
                      <Icon size={15} /> {label}
                    </span>
                    <span className="font-semibold text-gray-800">{data[key]}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className={`${color} h-2 rounded-full`} style={{ width: `${data[key]}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="bg-blue-50 text-blue-600 p-2 rounded-lg">
                <Wind size={16} />
              </div>
              <h3 className="font-semibold text-gray-800">
                {role === "officer" ? "Technical Analysis" : "In Simple Terms"}
              </h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              {role === "officer" ? data.technical_summary : data.plain_summary}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default SourceAttribution;