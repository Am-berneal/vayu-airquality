import { useState, useEffect } from "react";
import { HeartPulse, Globe, User } from "lucide-react";
import { API_BASE_URL } from "../config";

const LANGUAGES = ["English", "Hindi", "Punjabi"];
const PROFILES = [
  { value: "None", label: "No specific profile" },
  { value: "Asthma", label: "Asthma / Respiratory condition" },
  { value: "Elderly", label: "Elderly (60+)" },
  { value: "Child", label: "Young child" },
  { value: "Pregnant", label: "Pregnant" },
];

function HealthAdvisory({ areaLabel, aqi }) {
  const [language, setLanguage] = useState("English");
  const [profile, setProfile] = useState("None");
  const [advisory, setAdvisory] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!areaLabel || aqi == null) return;
    setLoading(true);
    fetch(`${API_BASE_URL}/health-advisory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ area: areaLabel, aqi, language, health_profile: profile }),
    })
      .then((res) => res.json())
      .then((data) => {
        setAdvisory(data.advisory);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [areaLabel, aqi, language, profile]);

  if (!areaLabel) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">Health Advisory</h2>
        <p className="text-sm text-gray-400 mb-6">Personalized air quality health guidance.</p>
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
          Select a State, District, and Area from the dropdowns above.
        </div>
      </div>
    );
  }

  if (aqi == null) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">Health Advisory</h2>
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
          Loading live air quality data — please wait a moment.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-xl font-bold text-gray-800 mb-1">Health Advisory</h2>
      <p className="text-sm text-gray-400 mb-6">Personalized air quality health guidance for {areaLabel}.</p>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="bg-teal-50 text-teal-600 p-2 rounded-lg">
              <HeartPulse size={18} />
            </div>
            <span className="font-semibold text-gray-800">Current AQI: {aqi}</span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-5">
          <div>
            <label className="text-xs font-medium text-gray-600 flex items-center gap-1 mb-1">
              <Globe size={13} /> Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 flex items-center gap-1 mb-1">
              <User size={13} /> Health Profile (optional)
            </label>
            <select
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              {PROFILES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-teal-50 rounded-xl p-4 min-h-[100px] flex items-center">
          {loading ? (
            <p className="text-sm text-gray-400">Generating advisory in {language}...</p>
          ) : (
            <p className="text-sm text-gray-700 leading-relaxed">{advisory}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default HealthAdvisory;