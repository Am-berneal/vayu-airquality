import { useState, useRef, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { Upload, MapPin, Video as VideoIcon, Navigation } from "lucide-react";
import { API_BASE_URL } from "../config";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const PLACE_CATEGORIES = [
  "Market / Commercial Area",
  "Industrial Unit / Factory",
  "Construction Site",
  "Residential Colony",
  "Government School / College",
  "Community Park / Green Belt",
  "Bus Stand / Transport Hub",
  "Others",
];

const CHANDIGARH_CENTER = [30.7333, 76.7794];

function compressImageToDataUrl(file, maxWidth = 900, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ClickToPlacePin({ onPick }) {
  useMapEvents({
    click(e) {
      onPick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

function AreaChangeRecenter({ area, defaultCoords, onRecenter }) {
  const map = useMap();
  const prevAreaRef = useRef(area);

  useEffect(() => {
    if (area !== prevAreaRef.current && defaultCoords) {
      map.setView(defaultCoords, 15);
      onRecenter(defaultCoords);
      prevAreaRef.current = area;
    }
  }, [area, defaultCoords, map, onRecenter]);

  return null;
}

function MapResizeFix() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 200);
  }, [map]);
  return null;
}

function ReportIssueForm({ onDone, state = "Chandigarh", district, area, defaultCoords }) {
  const [placeCategory, setPlaceCategory] = useState("");
  const [customPlaceName, setCustomPlaceName] = useState("");
  const [description, setDescription] = useState("");
  const [pinPosition, setPinPosition] = useState(defaultCoords || CHANDIGARH_CENTER);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [reportId, setReportId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const photoInputRef = useRef(null);
  const videoInputRef = useRef(null);

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleVideoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoFile(file);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setErrorMsg("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setPinPosition([pos.coords.latitude, pos.coords.longitude]),
      () => setErrorMsg("Could not get your location. Please place the pin manually.")
    );
  };

  const finalPlaceName = placeCategory === "Others" ? customPlaceName.trim() : placeCategory;

  const canSubmit =
    placeCategory !== "" &&
    (placeCategory !== "Others" || customPlaceName.trim() !== "") &&
    photoFile !== null &&
    pinPosition;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!canSubmit) {
      setErrorMsg("Please select a place type, confirm the location pin, and attach a photo before submitting.");
      return;
    }

    setLoading(true);
    try {
      const photoDataUrl = await compressImageToDataUrl(photoFile);

      const response = await fetch(`${API_BASE_URL}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          place_name: finalPlaceName,
          place_type: placeCategory,
          description,
          state,
          district,
          area,
          latitude: pinPosition[0],
          longitude: pinPosition[1],
          photo_data_url: photoDataUrl,
          video_filename: videoFile ? videoFile.name : null,
        }),
      });
      const data = await response.json();
      setReportId(data.report_id);
      setSubmitted(true);

      try {
        const existing = JSON.parse(localStorage.getItem("vayu_my_report_ids") || "[]");
        existing.push(data.report_id);
        localStorage.setItem("vayu_my_report_ids", JSON.stringify(existing));
      } catch (err) {
        console.error("Could not save report locally:", err);
      }
    } catch (err) {
      console.error("Failed to submit report:", err);
      setErrorMsg("Something went wrong submitting your report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <p className="text-teal-700 font-semibold text-lg mb-2">Report Submitted</p>
          <p className="text-gray-500 text-sm">
            Report ID #{reportId} — we'll notify you on the status.
          </p>
          {onDone && (
            <button onClick={onDone} className="mt-6 text-sm text-teal-700 underline">
              Back to My Reports
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-xl font-bold text-gray-800 mb-1">Report an Issue</h2>
      <p className="text-sm text-gray-400 mb-1">
        Help us enforce clean air by detailing the pollution source.
      </p>
      {area ? (
        <p className="text-xs text-teal-700 mb-6">Reporting in: {area}{district ? `, ${district}` : ""}</p>
      ) : (
        <div className="mb-6" />
      )}

      {errorMsg && (
        <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-2 mb-4">{errorMsg}</div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
        <div>
          <label className="text-xs font-medium text-gray-600">
            Place / Location Type <span className="text-red-500">*</span>
          </label>
          <select
            value={placeCategory}
            onChange={(e) => setPlaceCategory(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            <option value="">Select a place type</option>
            {PLACE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          {placeCategory === "Others" && (
            <input
              type="text"
              placeholder="Type the specific place name"
              value={customPlaceName}
              onChange={(e) => setCustomPlaceName(e.target.value)}
              className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 flex items-center gap-1 mb-1">
            <MapPin size={14} /> Pinpoint Location <span className="text-red-500">*</span>
          </label>
          <div className="rounded-lg overflow-hidden border border-gray-200" style={{ height: "220px" }}>
            <MapContainer center={pinPosition} zoom={15} style={{ height: "100%", width: "100%" }} preferCanvas={true}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
              <MapResizeFix />
              <AreaChangeRecenter area={area} defaultCoords={defaultCoords} onRecenter={setPinPosition} />
              <ClickToPlacePin onPick={setPinPosition} />
              <Marker
                position={pinPosition}
                draggable={true}
                eventHandlers={{
                  dragend: (e) => {
                    const pos = e.target.getLatLng();
                    setPinPosition([pos.lat, pos.lng]);
                  },
                }}
              />
            </MapContainer>
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-gray-400">Drag the pin or click the map to set the exact location.</p>
            <button type="button" onClick={handleUseMyLocation} className="flex items-center gap-1 text-xs text-teal-700 font-medium">
              <Navigation size={13} /> Use my location
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">
            Photo Evidence <span className="text-red-500">*</span>
          </label>
          <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
          {photoPreview ? (
            <div className="relative">
              <img src={photoPreview} alt="Preview" className="w-full h-40 object-cover rounded-lg" />
              <button
                type="button"
                onClick={() => photoInputRef.current.click()}
                className="absolute bottom-2 right-2 bg-white text-gray-700 text-xs px-3 py-1.5 rounded-lg shadow"
              >
                Change Photo
              </button>
            </div>
          ) : (
            <div
              onClick={() => photoInputRef.current.click()}
              className="border-2 border-dashed border-gray-200 rounded-lg py-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-teal-300"
            >
              <div className="bg-teal-50 text-teal-600 p-3 rounded-full mb-2">
                <Upload size={20} />
              </div>
              <p className="text-sm text-gray-600">Click to upload a photo</p>
              <p className="text-xs text-gray-300 mt-2">JPG or PNG, required</p>
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Video Evidence (optional)</label>
          <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoChange} className="hidden" />
          <div
            onClick={() => videoInputRef.current.click()}
            className="border-2 border-dashed border-gray-200 rounded-lg py-4 flex items-center justify-center gap-2 text-center cursor-pointer hover:border-teal-300"
          >
            <VideoIcon size={18} className="text-gray-400" />
            <p className="text-sm text-gray-600">{videoFile ? videoFile.name : "Click to attach a video (optional)"}</p>
          </div>
          {videoFile && (
            <p className="text-xs text-gray-400 mt-1">
              Video filename is recorded for reference; full video storage isn't enabled in this demo.
            </p>
          )}
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what you're seeing — smoke, burning smell, dust, etc."
            className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-lg text-sm h-24 focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-teal-800 hover:bg-teal-900 text-white font-medium py-2.5 rounded-lg disabled:opacity-50"
        >
          {loading ? "Submitting..." : "Submit Report"}
        </button>
      </form>
    </div>
  );
}

export default ReportIssueForm;