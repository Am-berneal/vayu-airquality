import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
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

const locationData = {
  Chandigarh: { Chandigarh: ["Sector 22", "Sector 36", "Sector 17"] },
  Punjab: { Mohali: ["Phase 1", "Phase 5"], Ludhiana: ["Model Town", "Civil Lines"] },
  Haryana: { Panchkula: ["Sector 5", "Sector 10"] },
};

const stateCoords = {
  Chandigarh: [30.7333, 76.7794],
  Punjab: [31.1471, 75.3412],
  Haryana: [29.0588, 76.0856],
};

function MapFlyTo({ coords, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo(coords, zoom, { duration: 1.2 });
  }, [coords, zoom, map]);
  return null;
}

function MapResizeFix() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 200);
  }, [map]);
  return null;
}

function DashboardMap({ selectedState, stations }) {
  return (
    <div className="flex-1 m-6 rounded-2xl overflow-hidden border border-gray-200" style={{ minHeight: "400px" }}>
      <MapContainer
        center={[20.5937, 78.9629]}
        zoom={5}
        style={{ height: "100%", width: "100%", minHeight: "400px" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        <MapFlyTo coords={selectedState ? stateCoords[selectedState] : [20.5937, 78.9629]} zoom={selectedState ? 10 : 5} />
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
                {Object.entries(station.pollutants).map(([name, vals]) => (
                  <div key={name}>{name}: {vals.avg}</div>
                ))}
              </Popup>
            </Marker>
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
  const districts = selectedState ? Object.keys(locationData[selectedState]) : [];
  const areas = selectedDistrict ? locationData[selectedState][selectedDistrict] : [];

  useEffect(() => {
    if (!selectedState) return;
    fetch(`http://127.0.0.1:8000/stations?state=${selectedState}`)
      .then((res) => res.json())
      .then((data) => setStations(data.stations || []))
      .catch((err) => console.error("Failed to fetch stations:", err));
  }, [selectedState]);

  const handleReviewClick = (report) => {
    setSelectedReport(report);
    setActivePage("__review__"); // internal marker for showing AI Review Panel
  };

  const renderMainContent = () => {
    if (activePage === "__review__") {
      return (
        <AIReviewPanel
          report={selectedReport}
          onBack={() => setActivePage("Home")}
        />
      );
    }

    if (activePage === "Home" && role === "officer") {
      return (
        <>
          <DashboardMap selectedState={selectedState} stations={stations} />
          <OfficerReportsTable onReviewClick={handleReviewClick} />
        </>
      );
    }

    if (activePage === "My Reports" && role === "citizen") {
      return <ReportIssueForm />;
    }

    // Default: Home map view (citizen) or any other page placeholder
    return <DashboardMap selectedState={selectedState} stations={stations} />;
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar role={role} activePage={activePage === "__review__" ? "Home" : activePage} setActivePage={setActivePage} />

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
            {states.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          <select
            value={selectedDistrict}
            onChange={(e) => { setSelectedDistrict(e.target.value); setSelectedArea(""); }}
            disabled={!selectedState}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 disabled:bg-gray-50"
          >
            <option value="">Select District</option>
            {districts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            disabled={!selectedDistrict}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 disabled:bg-gray-50"
          >
            <option value="">Select Area</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {renderMainContent()}
        </div>
      </div>
    </div>
  );
}

export default DashboardShell;