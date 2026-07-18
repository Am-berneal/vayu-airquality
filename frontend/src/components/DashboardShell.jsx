import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import Sidebar from "./Sidebar";
import OfficerReportsTable from "./OfficerReportsTable";
import AIReviewPanel from "./AIReviewPanel";
import ReportIssueForm from "./ReportIssueForm";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ---- Location data with bounding boxes: [[southWestLat, southWestLng], [northEastLat, northEastLng]] ----
const locationData = {
  Chandigarh: {
    bounds: [[30.68, 76.72], [30.77, 76.83]],
    districts: {
      Chandigarh: {
        bounds: [[30.69, 76.73], [30.76, 76.82]],
        areas: {
          "Sector 22 (Live Station)": { bounds: [[30.7306, 76.7707], [30.7406, 76.7807]], coords: [30.735567, 76.775714] },
          "Sector 25 (Live Station)": { bounds: [[30.7465, 76.7579], [30.7565, 76.7679]], coords: [30.751462, 76.762879] },
          "Sector 53 (Live Station)": { bounds: [[30.7149, 76.7336], [30.7249, 76.7436]], coords: [30.719859, 76.738637] },
        },
      },
    },
  },
  Punjab: {
    bounds: [[29.5, 73.5], [32.5, 76.5]],
    districts: {
      Mohali: {
        bounds: [[30.65, 76.68], [30.76, 76.78]],
        areas: {
          "Phase 1": { bounds: [[30.70, 76.70], [30.72, 76.72]], coords: [30.71, 76.71] },
          "Phase 5": { bounds: [[30.71, 76.71], [30.73, 76.73]], coords: [30.72, 76.72] },
        },
      },
      Ludhiana: {
        bounds: [[30.85, 75.80], [30.95, 75.95]],
        areas: {
          "Model Town": { bounds: [[30.90, 75.85], [30.92, 75.87]], coords: [30.91, 75.86] },
          "Civil Lines": { bounds: [[30.91, 75.84], [30.93, 75.86]], coords: [30.92, 75.85] },
        },
      },
    },
  },
  Haryana: {
    bounds: [[27.65, 74.5], [30.9, 77.6]],
    districts: {
      Panchkula: {
        bounds: [[30.64, 76.81], [30.75, 76.91]],
        areas: {
          "Sector 5": { bounds: [[30.69, 76.85], [30.71, 76.87]], coords: [30.70, 76.86] },
          "Sector 10": { bounds: [[30.70, 76.86], [30.72, 76.88]], coords: [30.71, 76.87] },
        },
      },
    },
  },
};

const INDIA_BOUNDS = [[6.5, 68.0], [35.5, 97.5]];

// ---- Controls the map's zoom/fit and pan restriction based on current selection ----
function MapBoundsController({ bounds, locked, onAnimatingChange }) {
  const map = useMap();

  useEffect(() => {
    map.setMaxBounds(null);
    map.setMinZoom(4);

    if (onAnimatingChange) onAnimatingChange(true);

    const target = bounds || INDIA_BOUNDS;
    map.flyToBounds(target, { padding: [30, 30], duration: 1.0 });

    const applyLock = () => {
      if (locked && bounds) {
        const padded = L.latLngBounds(bounds).pad(0.25);
        map.setMaxBounds(padded);
      }
      if (onAnimatingChange) onAnimatingChange(false);
    };
    map.once("moveend", applyLock);

    return () => {
      map.off("moveend", applyLock);
    };
  }, [bounds, locked, map, onAnimatingChange]);

  return null;
}

function MapResizeFix() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 200);
  }, [map]);
  return null;
}

// ---- AQI color helper for the hover circle ----
function aqiColor(aqi) {
  if (aqi <= 50) return "#00b050";
  if (aqi <= 100) return "#a8d600";
  if (aqi <= 200) return "#ffd400";
  if (aqi <= 300) return "#ff8c00";
  if (aqi <= 400) return "#e53e3e";
  return "#800000";
}

// Pulls out every sector marked "(Live Station)" from locationData, across all states/districts
function getKnownStations() {
  const result = [];
  Object.values(locationData).forEach((stateObj) => {
    Object.values(stateObj.districts).forEach((distObj) => {
      Object.entries(distObj.areas).forEach(([areaName, areaObj]) => {
        if (areaName.includes("Live Station")) {
          result.push({ name: areaName, coords: areaObj.coords });
        }
      });
    });
  });
  return result;
}

const KNOWN_STATIONS = getKnownStations();

// Matches a known sector (e.g. "Sector 25 (Live Station)") to real backend data by sector number
function findMatchingStationData(name, stations) {
  const match = name.match(/Sector\s*(\d+)/i);
  if (!match) return null;
  const sectorNum = match[1];

  return stations.find((s) => {
    if (!s.station) return false;
    const normalized = s.station.toLowerCase().replace(/[-,]/g, " ");
    const numMatch = normalized.match(/sector\s*(\d+)/i);
    return numMatch && numMatch[1] === sectorNum;
  });
}

function DashboardMap({ activeBounds, isLocked, stations }) {
  const [isAnimating, setIsAnimating] = useState(false);
  return (
    <div
      className="flex-1 m-6 rounded-2xl overflow-hidden border border-gray-200"
      style={{ minHeight: "450px" }}
    >
      <MapContainer
        center={[20.5937, 78.9629]}
        zoom={5}
        style={{ height: "100%", width: "100%", minHeight: "450px" }}
        scrollWheelZoom={true}
        preferCanvas={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />

        <MapBoundsController bounds={activeBounds} locked={isLocked} onAnimatingChange={setIsAnimating} />
        <MapResizeFix />

        {stations.map((station, idx) => {
          const lat = parseFloat(station.latitude);
          const lng = parseFloat(station.longitude);
          if (isNaN(lat) || isNaN(lng)) return null;

          const pm25 = station.pollutants?.["PM2.5"]?.avg;
          const aqiValue = pm25 ? Math.round(parseFloat(pm25)) : null;
          const color = aqiValue ? aqiColor(aqiValue) : "#3b82f6";

          return (
            <React.Fragment key={idx}>
              
              <Marker position={[lat, lng]}>
                <Tooltip direction="top" offset={[0, -8]} opacity={1} sticky>
                  <div className="text-xs">
                    <strong>{station.station}</strong>
                    <br />
                    AQI (PM2.5): {aqiValue ?? "N/A"}
                  </div>
                </Tooltip>
                <Popup>
                  <strong>{station.station}</strong>
                  <br />
                  {Object.entries(station.pollutants || {}).map(([name, vals]) => (
                    <div key={name}>{name}: {vals.avg}</div>
                  ))}
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}
        {!isAnimating && KNOWN_STATIONS.map((ks, idx) => {
          const matched = findMatchingStationData(ks.name, stations);
          const pm25 = matched?.pollutants?.["PM2.5"]?.avg;
          const aqiValue = pm25 ? Math.round(parseFloat(pm25)) : null;
          const color = aqiValue ? aqiColor(aqiValue) : "#9ca3af";

          return (
            <Circle
              key={`known-${idx}`}
              center={ks.coords}
              radius={450}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.2, weight: 2 }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={1} sticky>
                <div className="text-xs">
                  <strong>{ks.name}</strong>
                  <br />
                  AQI (PM2.5): {aqiValue ?? "Data unavailable"}
                </div>
              </Tooltip>
            </Circle>
          );
        })}
      </MapContainer>
    </div>
  );
}

function DashboardShell({ role = "citizen" }) {
  const [selectedState, setSelectedState] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedArea, setSelectedArea] = useState("");
  const [activePage, setActivePage] = useState("Home");
  const [stations, setStations] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);

  const states = Object.keys(locationData);
  const districts = selectedState ? Object.keys(locationData[selectedState].districts) : [];
  const areas =
    selectedState && selectedDistrict
      ? Object.keys(locationData[selectedState].districts[selectedDistrict].areas)
      : [];

  // Determine which bounds to zoom to, based on the deepest selection made
  let activeBounds = null;
  if (selectedState && selectedDistrict && selectedArea) {
    activeBounds = locationData[selectedState].districts[selectedDistrict].areas[selectedArea].bounds;
  } else if (selectedState && selectedDistrict) {
    activeBounds = locationData[selectedState].districts[selectedDistrict].bounds;
  } else if (selectedState) {
    activeBounds = locationData[selectedState].bounds;
  }

  const isLocked = Boolean(selectedState); // lock as soon as any level is picked

  useEffect(() => {
  if (!selectedState) return;
  fetch(`http://127.0.0.1:8000/stations?state=${selectedState}`)
    .then((res) => res.json())
    .then((data) => {
      console.log("RAW STATIONS DATA:", data.stations);
      setStations(data.stations || []);
    })
    .catch((err) => console.error("Failed to fetch stations:", err));
  }, [selectedState]);

  const handleReviewClick = (report) => {
    setSelectedReport(report);
    setActivePage("__review__");
  };

  const renderMainContent = () => {
    if (activePage === "__review__") {
      return <AIReviewPanel report={selectedReport} onBack={() => setActivePage("Home")} />;
    }
    if (activePage === "Home" && role === "officer") {
      return (
        <>
          <DashboardMap activeBounds={activeBounds} isLocked={isLocked} stations={stations} />
          <OfficerReportsTable onReviewClick={handleReviewClick} />
        </>
      );
    }
    if (activePage === "My Reports" && role === "citizen") {
      return <ReportIssueForm />;
    }
    return <DashboardMap activeBounds={activeBounds} isLocked={isLocked} stations={stations} />;
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar
        role={role}
        activePage={activePage === "__review__" ? "Home" : activePage}
        setActivePage={setActivePage}
      />

      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between bg-white border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-800">
            {activePage === "__review__" ? "AI Review Panel" : activePage}
          </h2>
          <div className="flex items-center gap-2 bg-red-50 text-red-600 px-3 py-1.5 rounded-full text-sm font-medium">
            AQI 240 — Poor
          </div>
        </header>

        <div className="flex gap-4 px-6 py-4 bg-white border-b border-gray-100">
          <select
            value={selectedState}
            onChange={(e) => {
              setSelectedState(e.target.value);
              setSelectedDistrict("");
              setSelectedArea("");
            }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1"
          >
            <option value="">Select State</option>
            {states.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={selectedDistrict}
            onChange={(e) => {
              setSelectedDistrict(e.target.value);
              setSelectedArea("");
            }}
            disabled={!selectedState}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 disabled:bg-gray-50"
          >
            <option value="">Select District</option>
            {districts.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            disabled={!selectedDistrict}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 disabled:bg-gray-50"
          >
            <option value="">Select Area</option>
            {areas.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          {selectedState && (
            <button
              onClick={() => {
                setSelectedState("");
                setSelectedDistrict("");
                setSelectedArea("");
              }}
              className="text-sm text-gray-400 hover:text-gray-600 px-3"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">{renderMainContent()}</div>
      </div>
    </div>
  );
}

export default DashboardShell;