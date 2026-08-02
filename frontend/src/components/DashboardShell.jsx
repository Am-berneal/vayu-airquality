import React, { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import Sidebar from "./Sidebar";
import OfficerReportsTable from "./OfficerReportsTable";
import AIReviewPanel from "./AIReviewPanel";
import ReportIssueForm from "./ReportIssueForm";
import PredictiveAnalysis from "./PredictiveAnalysis";
import { API_BASE_URL, fetchWithRetry } from "../config";
import SourceAttribution from "./SourceAttribution";
import ComingSoon from "./ComingSoon";
import MyReportsTracker from "./MyReportsTracker";
import HealthAdvisory from "./HealthAdvisory";
import AlertsSubscriptions from "./AlertsSubscriptions";
import CommunityImpact from "./CommunityImpact";
import SatelliteContext from "./SatelliteContext";
import Settings from "./Settings";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

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
          "Sector 17": { bounds: [[30.734885, 76.777454], [30.744885, 76.787454]], coords: [30.739885, 76.782454] },
          "Sector 34": { bounds: [[30.7144, 76.7597], [30.7244, 76.7697]], coords: [30.7194, 76.7647] },
          "Sector 36": { bounds: [[30.727069, 76.747785], [30.737069, 76.757785]], coords: [30.732069, 76.752785] },
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

function distanceKm(a, b) {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function estimateBaselineAQI(targetCoords, stations) {
  const weighted = [];
  KNOWN_STATIONS.forEach((ks) => {
    const matched = findMatchingStationData(ks.name, stations);
    if (matched?.computed_aqi) {
      const dist = distanceKm(targetCoords, ks.coords);
      const weight = 1 / Math.max(dist, 0.1);
      weighted.push({ value: matched.computed_aqi, weight });
    }
  });
  if (weighted.length === 0) return null;
  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  const weightedSum = weighted.reduce((sum, w) => sum + w.value * w.weight, 0);
  return Math.round((weightedSum / totalWeight) * 10) / 10;
}

function aqiColor(aqi) {
  if (aqi <= 50) return "#00b050";
  if (aqi <= 100) return "#a8d600";
  if (aqi <= 200) return "#ffd400";
  if (aqi <= 300) return "#ff8c00";
  if (aqi <= 400) return "#e53e3e";
  return "#800000";
}

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

function DashboardMap({ activeBounds, isLocked, stations }) {
  const [isAnimating, setIsAnimating] = useState(false);

  return (
    <div className="flex-1 m-6 rounded-2xl overflow-hidden border border-gray-200" style={{ minHeight: "450px" }}>
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

          return (
            <Marker key={idx} position={[lat, lng]}>
              <Popup>
                <strong>{station.station}</strong>
                <br />
                {Object.entries(station.pollutants || {}).map(([name, vals]) => (
                  <div key={name}>{name}: {vals.avg}</div>
                ))}
              </Popup>
            </Marker>
          );
        })}

        {!isAnimating && KNOWN_STATIONS.map((ks, idx) => {
          const matched = findMatchingStationData(ks.name, stations);
          const aqiValue = matched?.computed_aqi ?? null;
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
                  <br/>
                  AQI: {aqiValue ?? "Insufficient sensor data right now"}
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

  let activeBounds = null;
  if (selectedState && selectedDistrict && selectedArea) {
    activeBounds = locationData[selectedState].districts[selectedDistrict].areas[selectedArea].bounds;
  } else if (selectedState && selectedDistrict) {
    activeBounds = locationData[selectedState].districts[selectedDistrict].bounds;
  } else if (selectedState) {
    activeBounds = locationData[selectedState].bounds;
  }

  const isLocked = Boolean(selectedState);

  const selectedAreaData =
    selectedState && selectedDistrict && selectedArea
      ? locationData[selectedState].districts[selectedDistrict].areas[selectedArea]
      : null;

  const isAreaMonitored = selectedArea.includes("Live Station");

  const baselineAQI = selectedAreaData
    ? isAreaMonitored
      ? (() => {
          const matched = findMatchingStationData(selectedArea, stations);
          return matched?.computed_aqi ?? null;
        })()
      : estimateBaselineAQI(selectedAreaData.coords, stations)
    : null;

  useEffect(() => {
    if (!selectedState) return;
    fetchWithRetry(`${API_BASE_URL}/stations?state=${selectedState}`)
      .then((res) => res.json())
      .then((data) => setStations(data.stations || []))
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

    if (activePage === "Predictive Analysis") {
      return (
        <PredictiveAnalysis
          areaLabel={selectedArea || null}
          baselineAQI={baselineAQI}
          isMonitored={isAreaMonitored}
        />
      );
    }

    if (activePage === "Source Attribution" || activePage === "Why Is My Area Polluted") {
      return (
        <SourceAttribution
          areaLabel={selectedArea || null}
          aqi={baselineAQI}
          coords={selectedAreaData?.coords}
          role={role}
        />
      );
    }

    if (activePage === "Health Advisory") {
      return <HealthAdvisory areaLabel={selectedArea || null} aqi={baselineAQI} />;
    }
    if (activePage === "Satellite Context") {
      return <SatelliteContext state={selectedState} />;
    }

    if (activePage === "Alerts & Subscriptions") {
      return <AlertsSubscriptions areaLabel={selectedArea || null} currentAQI={baselineAQI} />;
    }

    if (activePage === "Community Impact") {
      return <CommunityImpact />;
    }

    if (activePage === "Settings") {
      return <Settings currentState={selectedState} currentDistrict={selectedDistrict} currentArea={selectedArea} />;
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
      return <MyReportsTracker onNewReport={() => setActivePage("__new_report__")} />;
    }

    if (activePage === "__new_report__") {
      return (
        <ReportIssueForm
          onDone={() => setActivePage("My Reports")}
          state={selectedState || "Chandigarh"}
          district={selectedDistrict}
          area={selectedArea}
          defaultCoords={selectedAreaData?.coords}
        />
      );
    }

    return <DashboardMap activeBounds={activeBounds} isLocked={isLocked} stations={stations} />;
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar
        role={role}
        activePage={
          activePage === "__review__"
            ? "Home"
            : activePage === "__new_report__"
            ? "My Reports"
            : activePage
        }
        setActivePage={setActivePage}
      />

      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between bg-white border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-800">
            {activePage === "__review__"
              ? "AI Review Panel"
              : activePage === "__new_report__"
              ? "Report an Issue"
              : activePage}
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

