import { useState } from "react";
import { Globe, MapPin, Save } from "lucide-react";

function getSavedSettings() {
  try {
    const raw = localStorage.getItem("vayu_settings");
    return raw ? JSON.parse(raw) : { language: "English", defaultState: "", defaultDistrict: "", defaultArea: "" };
  } catch {
    return { language: "English", defaultState: "", defaultDistrict: "", defaultArea: "" };
  }
}

function Settings({ currentState, currentDistrict, currentArea }) {
  const [settings, setSettings] = useState(getSavedSettings());
  const [saved, setSaved] = useState(false);

  const handleSaveDefaultArea = () => {
    const updated = { ...settings, defaultState: currentState, defaultDistrict: currentDistrict, defaultArea: currentArea };
    setSettings(updated);
    localStorage.setItem("vayu_settings", JSON.stringify(updated));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLanguageChange = (lang) => {
    const updated = { ...settings, language: lang };
    setSettings(updated);
    localStorage.setItem("vayu_settings", JSON.stringify(updated));
  };

  return (
    <div className="p-6 max-w-xl">
      <h2 className="text-xl font-bold text-gray-800 mb-1">Settings</h2>
      <p className="text-sm text-gray-400 mb-6">Manage your VAYU preferences.</p>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="bg-teal-50 text-teal-600 p-2 rounded-lg">
            <Globe size={16} />
          </div>
          <h3 className="font-semibold text-gray-800">Preferred Language</h3>
        </div>
        <select
          value={settings.language}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
        >
          <option value="English">English</option>
          <option value="Hindi">Hindi</option>
          <option value="Punjabi">Punjabi</option>
        </select>
        <p className="text-xs text-gray-400 mt-2">Used as the default language for Health Advisory.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="bg-teal-50 text-teal-600 p-2 rounded-lg">
            <MapPin size={16} />
          </div>
          <h3 className="font-semibold text-gray-800">Default Area</h3>
        </div>
        {currentArea ? (
          <>
            <p className="text-sm text-gray-600 mb-3">
              Current selection: <span className="font-medium text-gray-800">{currentArea}, {currentDistrict}, {currentState}</span>
            </p>
            <button
              onClick={handleSaveDefaultArea}
              className="flex items-center gap-2 bg-teal-800 hover:bg-teal-900 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              <Save size={15} /> Save as My Default Area
            </button>
            {saved && <p className="text-xs text-green-600 mt-2">Saved!</p>}
          </>
        ) : (
          <p className="text-sm text-gray-400">Select a State, District, and Area above, then save it here as your default.</p>
        )}
        {settings.defaultArea && (
          <p className="text-xs text-gray-400 mt-3">
            Currently saved default: {settings.defaultArea}, {settings.defaultDistrict}, {settings.defaultState}
          </p>
        )}
      </div>
    </div>
  );
}

export default Settings;