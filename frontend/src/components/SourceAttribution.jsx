import { useState, useEffect } from "react";
import {
  Factory, Car, HardHat, HelpCircle, Wind, Store, School,
  Fuel, Hospital, Route, UtensilsCrossed, Radar,
} from "lucide-react";
import { API_BASE_URL } from "../config";

const sourceConfig = [
  { key: "industrial_percent", label: "Industrial", icon: Factory, color: "bg-red-500" },
  { key: "vehicular_percent", label: "Vehicular", icon: Car, color: "bg-orange-500" },
  { key: "construction_percent", label: "Construction", icon: HardHat, color: "bg-yellow-500" },
  { key: "other_percent", label: "Other", icon: HelpCircle, color: "bg-gray-400" },
];

const landmarkConfig = [
  { key: "shops_and_markets", label: "Shops & Markets", icon: Store },
  { key: "major_roads", label: "Major Roads", icon: Route },
  { key: "restaurants_and_cafes", label: "Restaurants & Cafes", icon: UtensilsCrossed },
  { key: "industrial_sites", label: "Industrial Sites", icon: Factory },
  { key: "construction_sites", label: "Construction Sites", icon: HardHat },
  { key: "fuel_stations", label: "Fuel Stations", icon: Fuel },
  { key: "schools_and_colleges", label: "Schools & Colleges", icon: School },
  { key: "hospitals_and_clinics", label: "Hospitals & Clinics", icon: Hospital },
];

function SourceAttribution({ areaLabel, aqi, coords, role }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!areaLabel || aqi == null) return;
    setLoading(true);
    setData(null);

    fetch(`${API_BASE_URL}/source-attribution-scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        area: areaLabel,
        aqi,
        latitude: coords ? coords[0] : null,
        longitude: coords ? coords[1] : null,
        wind_speed: 3,
      }),
    })
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [areaLabel, aqi, coords]);

  const title = role === "officer" ? "Source Attribution" : "Why Is My Area Polluted?";
  const subtitle =
    role === "officer"
      ? "Land-use scan and AI-estimated pollution source breakdown."
      : "What's around you, and what it means for your air.";

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

  const landmarks = data?.landmarks;
  const hasLandmarks = landmarks && landmarks.total_features > 0;

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-1">{title}</h2>
      <p className="text-sm text-gray-400 mb-6">{subtitle}</p>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <div className="flex items-center justify-center gap-2 text-teal-700 text-sm font-medium mb-1">
            <Radar size={18} className="animate-pulse" />
            Scanning {areaLabel} for pollution sources...
          </div>
          <p className="text-xs text-gray-400">
            Mapping nearby markets, roads, industry and construction, then analysing their impact.
          </p>
        </div>
      ) : !data ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
          Could not complete the scan. Please try again.
        </div>
      ) : (
        <>
          {/* Area scan results */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-teal-50 text-teal-700 p-2 rounded-lg">
                <Radar size={16} />
              </div>
              <h3 className="font-semibold text-gray-800">Area Scan</h3>
            </div>

            {hasLandmarks ? (
              <>
                <p className="text-xs text-gray-400 mb-4">
                  {landmarks.total_features} mapped features found within {landmarks.radius_m}m of {areaLabel}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {landmarkConfig.map(({ key, label, icon: Icon }) => {
                    const count = landmarks.counts[key] || 0;
                    if (count === 0) return null;
                    return (
                      <div key={key} className="border border-gray-100 rounded-xl p-3">
                        <Icon size={15} className="text-gray-400 mb-1" />
                        <p className="text-lg font-bold text-gray-800 leading-tight">{count}</p>
                        <p className="text-[11px] text-gray-500 leading-tight">{label}</p>
                      </div>
                    );
                  })}
                </div>

                {landmarks.samples && Object.keys(landmarks.samples).length > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <p className="text-xs text-gray-400 mb-1">Identified nearby:</p>
                    <p className="text-xs text-gray-600">
                      {Object.values(landmarks.samples).flat().slice(0, 8).join(" · ")}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500 mt-2">
                No detailed land-use data was available for this area in the open mapping database.
                The estimate below is based on air quality and meteorological conditions alone.
              </p>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Attribution bars */}
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
                      <div className={`${color} h-2 rounded-full transition-all duration-700`} style={{ width: `${data[key]}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Technical / plain analysis */}
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
              {hasLandmarks && (
                <p className="text-[11px] text-gray-400 mt-3 pt-3 border-t border-gray-100">
                  Analysis grounded in live OpenStreetMap land-use data for this location.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default SourceAttribution;