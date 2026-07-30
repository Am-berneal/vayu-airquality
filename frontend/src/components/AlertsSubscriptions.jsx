import { useState, useEffect } from "react";
import { Bell, Plus, Trash2 } from "lucide-react";

function getSubscriptions() {
  try {
    const raw = localStorage.getItem("vayu_subscriptions");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSubscriptions(subs) {
  localStorage.setItem("vayu_subscriptions", JSON.stringify(subs));
}

function AlertsSubscriptions({ areaLabel, currentAQI }) {
  const [subs, setSubs] = useState([]);
  const [threshold, setThreshold] = useState(150);

  useEffect(() => {
    setSubs(getSubscriptions());
  }, []);

  const handleAdd = () => {
    if (!areaLabel) return;
    const newSub = { id: Date.now(), area: areaLabel, threshold };
    const updated = [...subs, newSub];
    setSubs(updated);
    saveSubscriptions(updated);
  };

  const handleRemove = (id) => {
    const updated = subs.filter((s) => s.id !== id);
    setSubs(updated);
    saveSubscriptions(updated);
  };

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-xl font-bold text-gray-800 mb-1">Alerts & Subscriptions</h2>
      <p className="text-sm text-gray-400 mb-6">
        Get notified when air quality crosses a threshold you care about in your saved areas.
      </p>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
        <h3 className="font-semibold text-gray-800 mb-3">Subscribe to an Area</h3>
        {!areaLabel ? (
          <p className="text-sm text-gray-400">
            Select a State, District, and Area from the dropdowns above to subscribe to it.
          </p>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Area</p>
              <p className="text-sm font-medium text-gray-800">{areaLabel}</p>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Alert me when AQI exceeds</label>
              <input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value) || 0)}
                className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <button
              onClick={handleAdd}
              className="flex items-center gap-1 bg-teal-800 hover:bg-teal-900 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              <Plus size={15} /> Subscribe
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Your Subscriptions</h3>
        {subs.length === 0 ? (
          <p className="text-sm text-gray-400">No active subscriptions yet.</p>
        ) : (
          <div className="space-y-3">
            {subs.map((s) => {
              const isActive = s.area === areaLabel;
              const triggered = isActive && currentAQI != null && currentAQI >= s.threshold;
              return (
                <div key={s.id} className="flex items-center justify-between border border-gray-100 rounded-xl p-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${triggered ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-500"}`}>
                      <Bell size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{s.area}</p>
                      <p className="text-xs text-gray-400">Alert above AQI {s.threshold}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {triggered && (
                      <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">
                        Triggered now
                      </span>
                    )}
                    <button onClick={() => handleRemove(s.id)} className="text-gray-400 hover:text-red-500">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default AlertsSubscriptions;