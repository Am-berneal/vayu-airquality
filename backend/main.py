import os
import time
import requests
import json
import math
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from google import genai
from pydantic import BaseModel

import base64
import io
from fastapi.responses import StreamingResponse
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as RLImage, Table, TableStyle, HRFlowable

AQI_BREAKPOINTS = {
    "PM2.5": [(0, 30, 0, 50), (31, 60, 51, 100), (61, 90, 101, 200), (91, 120, 201, 300), (121, 250, 301, 400), (251, 500, 401, 500)],
    "PM10":  [(0, 50, 0, 50), (51, 100, 51, 100), (101, 250, 101, 200), (251, 350, 201, 300), (351, 430, 301, 400), (431, 600, 401, 500)],
    "NO2":   [(0, 40, 0, 50), (41, 80, 51, 100), (81, 180, 101, 200), (181, 280, 201, 300), (281, 400, 301, 400), (401, 600, 401, 500)],
    "SO2":   [(0, 40, 0, 50), (41, 80, 51, 100), (81, 380, 101, 200), (381, 800, 201, 300), (801, 1600, 301, 400), (1601, 2100, 401, 500)],
    "NH3":   [(0, 200, 0, 50), (201, 400, 51, 100), (401, 800, 101, 200), (801, 1200, 201, 300), (1201, 1800, 301, 400), (1801, 2400, 401, 500)],
    "OZONE": [(0, 50, 0, 50), (51, 100, 51, 100), (101, 168, 101, 200), (169, 208, 201, 300), (209, 748, 301, 400), (749, 1000, 401, 500)],
    "CO":    [(0, 1000, 0, 50), (1001, 2000, 51, 100), (2001, 10000, 101, 200), (10001, 17000, 201, 300), (17001, 34000, 301, 400), (34001, 50000, 401, 500)],
}

def calculate_sub_index(pollutant_id, value):
    table = AQI_BREAKPOINTS.get(pollutant_id.upper())
    if not table:
        return None
    try:
        conc = float(value)
    except (ValueError, TypeError):
        return None
    for lo, hi, aqi_lo, aqi_hi in table:
        if lo <= conc <= hi:
            return round(((aqi_hi - aqi_lo) / (hi - lo)) * (conc - lo) + aqi_lo, 1)
    return table[-1][3]  # above highest breakpoint -> cap at top AQI value

def calculate_overall_aqi(pollutants_dict):
    sub_indices = {}
    for pollutant_id, vals in pollutants_dict.items():
        # Blend current avg with the min/max midpoint to approximate a longer averaging window
        try:
            avg = float(vals.get("avg"))
            mn = float(vals.get("min", avg))
            blended = 0.45 * avg + 0.55 * mn
        except (ValueError, TypeError):
            continue

        sub = calculate_sub_index(pollutant_id, blended)
        if sub is not None:
            sub_indices[pollutant_id] = sub

    has_pm = "PM2.5" in sub_indices or "PM10" in sub_indices
    if not sub_indices or not has_pm or len(sub_indices) < 3:
        return None, None

    dominant = max(sub_indices, key=sub_indices.get)
    return round(sub_indices[dominant]), dominant

load_dotenv()

app = FastAPI(title="VAYU Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CPCB_API_KEY = os.getenv("CPCB_API_KEY")
OWM_API_KEY = os.getenv("OWM_API_KEY")
WAQI_TOKEN = os.getenv("WAQI_TOKEN")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
CPCB_BASE_URL = "https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69"
COPERNICUS_CLIENT_ID = os.getenv("COPERNICUS_CLIENT_ID")
COPERNICUS_CLIENT_SECRET = os.getenv("COPERNICUS_CLIENT_SECRET")

gemini_client = genai.Client(api_key=GEMINI_API_KEY)

# Simple in-memory cache: { key: (timestamp, data) }
cache = {}
CACHE_TTL = 1800  # 30 minutes


def get_cached(key):
    if key in cache:
        ts, data = cache[key]
        if time.time() - ts < CACHE_TTL:
            return data
    return None


def set_cache(key, data):
    cache[key] = (time.time(), data)


@app.get("/")
def root():
    return {"status": "VAYU backend running"}


@app.get("/stations")
def get_stations(state: str = "Chandigarh", limit: int = 100):
    cache_key = f"stations_{state}"
    cached = get_cached(cache_key)
    if cached:
        return cached

    params = {
        "api-key": CPCB_API_KEY,
        "format": "json",
        "limit": limit,
        "filters[state]": state
    }
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    response = requests.get(CPCB_BASE_URL, params=params, headers=headers, timeout=15)

    print("CPCB STATUS CODE:", response.status_code)
    print("CPCB RAW RESPONSE:", response.text[:500])

    try:
        data = response.json()
    except Exception as e:
        return {"error": "CPCB API did not return valid JSON", "status_code": response.status_code, "raw": response.text[:300]}

    records = data.get("records", [])

    stations = {}
        
    for row in records:
        station_name = row.get("station")
        if not station_name:
            continue

        if station_name not in stations:
            stations[station_name] = {
                "station": station_name,
                "city": row.get("city"),
                "state": row.get("state"),
                "latitude": row.get("latitude"),
                "longitude": row.get("longitude"),
                "last_update": row.get("last_update"),
                "pollutants": {}
            }

        pollutant_id = row.get("pollutant_id")
        avg_value = row.get("avg_value")

        if pollutant_id and avg_value and avg_value != "NA":
            stations[station_name]["pollutants"][pollutant_id] = {
                "min": row.get("min_value"),
                "max": row.get("max_value"),
                "avg": avg_value
            }
            
    
    for s in stations.values():
        aqi, dominant = calculate_overall_aqi(s["pollutants"])
        s["computed_aqi"] = aqi
        s["dominant_pollutant"] = dominant

    result = {"count": len(stations), "stations": list(stations.values())}
    set_cache(cache_key, result)
    return result
SUPPORTED_STATES = ["Chandigarh", "Punjab", "Haryana"]

@app.get("/warm-cache")
def warm_cache():
    results = {}
    for state in SUPPORTED_STATES:
        try:
            data = get_stations(state=state)
            results[state] = data.get("count", "no data")
        except Exception as e:
            results[state] = f"error: {e}"
    return {"warmed": results}
@app.get("/ping")
def ping():
    for state in SUPPORTED_STATES:
        try:
            get_stations(state=state)
        except Exception:
            pass
    return {"ok": True}


@app.get("/weather")
def get_weather(city: str = "Chandigarh"):
    cache_key = f"weather_{city}"
    cached = get_cached(cache_key)
    if cached:
        return cached

    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {"q": city, "appid": OWM_API_KEY, "units": "metric"}
    response = requests.get(url, params=params)

    if response.status_code != 200:
        return {"error": "Could not fetch weather data", "details": response.json()}

    data = response.json()
    result = {
        "city": city,
        "temperature": data.get("main", {}).get("temp"),
        "humidity": data.get("main", {}).get("humidity"),
        "wind_speed": data.get("wind", {}).get("speed"),
        "wind_direction": data.get("wind", {}).get("deg"),
        "weather": data.get("weather", [{}])[0].get("description")
    }
    set_cache(cache_key, result)
    return result


@app.get("/waqi")
def get_waqi(city: str = "chandigarh"):
    cache_key = f"waqi_{city}"
    cached = get_cached(cache_key)
    if cached:
        return cached

    url = f"https://api.waqi.info/feed/{city}/"
    params = {"token": WAQI_TOKEN}
    response = requests.get(url, params=params)
    data = response.json()

    if data.get("status") != "ok":
        return {"error": "Could not fetch WAQI data", "details": data}

    d = data.get("data", {})
    result = {
        "city": city,
        "aqi": d.get("aqi"),
        "dominant_pollutant": d.get("dominentpol"),
        "station_name": d.get("city", {}).get("name")
    }
    set_cache(cache_key, result)
    return result


@app.get("/advisory")
def get_advisory(area: str = "Chandigarh", aqi: int = 150, language: str = "English"):
    prompt = f"""
    You are an air quality health advisor. The current AQI in {area} is {aqi}.
    Write a short, clear health advisory (2-3 sentences) in {language} for
    residents, focusing on practical precautions. Keep it simple, no jargon.
    """

    try:
        response = gemini_client.models.generate_content(
            model="gemini-3.1-flash-lite",
            contents=prompt
        )
        return {"area": area, "aqi": aqi, "language": language, "advisory": response.text}
    except Exception as e:
        return {"error": str(e)}


class ReportSubmission(BaseModel):
    place_name: str
    place_type: Optional[str] = None
    description: str
    state: str
    district: Optional[str] = None
    area: Optional[str] = None
    latitude: float
    longitude: float
    photo_data_url: Optional[str] = None
    video_filename: Optional[str] = None

reports_db = []

def calculate_priority(aqi: int) -> str:
    if aqi >= 400:
        return "Urgent"
    elif aqi >= 300:
        return "High"
    elif aqi >= 200:
        return "Medium"
    else:
        return "Low"

@app.post("/reports")
def submit_report(report: ReportSubmission):
    report_id = f"CHD-2026-{str(uuid.uuid4())[:4].upper()}"
    simulated_aqi = 250

    new_report = {
        "id": report_id,
        "area": report.place_name,
        "place_type": report.place_type,
        "description": report.description,
        "state": report.state,
        "district": report.district,
        "location_area": report.area,
        "latitude": report.latitude,
        "longitude": report.longitude,
        "photo_data_url": report.photo_data_url,
        "video_filename": report.video_filename,
        "aqi": simulated_aqi,
        "priority": calculate_priority(simulated_aqi),
        "source": "Pending Analysis",
        "status": "Pending",
        "reported_date": datetime.now().strftime("%b %d, %I:%M %p"),
    }
    reports_db.append(new_report)
    return {"success": True, "report_id": report_id, "report": new_report}


@app.get("/reports")
def get_reports():
    sorted_reports = sorted(reports_db, key=lambda r: r["aqi"], reverse=True)
    return {"count": len(sorted_reports), "reports": sorted_reports}

class AnalysisRequest(BaseModel):
    description: str
    area: str
    aqi: int

@app.post("/analyze-report")
def analyze_report(req: AnalysisRequest):
    prompt = f"""You are an AI environmental enforcement analyst reviewing a citizen-submitted air pollution report for an Indian regulatory officer.

Location: {req.area}
Current AQI: {req.aqi}
Citizen's description: "{req.description}"

Analyze this report and respond ONLY with valid JSON (no markdown formatting, no code fences, no extra text before or after) using exactly these fields:
{{"likely_source": "Industrial, Vehicular, Construction, Agricultural Burning, Residential Burning, or Unknown", "confidence_percent": a number between 0 and 100, "severity": "Low, Medium, High, or Critical", "analysis_summary": "2-3 sentence technical analysis for a government enforcement officer", "recommended_action": "1-2 sentence specific recommended enforcement action"}}"""

    try:
        response = gemini_client.models.generate_content(
            model="gemini-3.1-flash-lite",
            contents=prompt
        )
        text = response.text.strip()

        if text.startswith("```"):
            text = text.split("```")[1]
            if text.lower().startswith("json"):
                text = text[4:]
        text = text.strip()

        analysis = json.loads(text)
        return {"success": True, "analysis": analysis}
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "analysis": {
                "likely_source": "Unknown",
                "confidence_percent": 0,
                "severity": "Medium",
                "analysis_summary": "AI analysis is temporarily unavailable. Please review the citizen evidence manually.",
                "recommended_action": "Conduct a manual site inspection before proceeding."
            }
        }


class StatusUpdate(BaseModel):
    status: str

@app.patch("/reports/{report_id}/status")
def update_report_status(report_id: str, update: StatusUpdate):
    for r in reports_db:
        if r["id"] == report_id:
            r["status"] = update.status
            return {"success": True, "report": r}
    return {"success": False, "error": "Report not found"}

class PredictionRequest(BaseModel):
    area: str
    baseline_aqi: float
    wind_speed: Optional[float] = 3.0
    wind_deg: Optional[float] = None
    temperature: Optional[float] = 25.0
    is_monitored: bool = True

@app.post("/predict")
def predict_aqi(req: PredictionRequest):
    now = datetime.now()
    current_hour = now.hour

    def diurnal_factor(hour):
        morning_peak = math.exp(-((hour - 8) ** 2) / 18)
        evening_peak = math.exp(-((hour - 20) ** 2) / 18)
        midday_dip = math.exp(-((hour - 14) ** 2) / 30) * 0.5
        return 1 + 0.35 * morning_peak + 0.45 * evening_peak - 0.3 * midday_dip

    wind_speed = req.wind_speed or 3.0
    wind_factor = max(0.6, 1.3 - (wind_speed / 10))

    forecast = []
    for i in range(25):
        future_time = now + timedelta(hours=i)
        hour = future_time.hour
        factor = diurnal_factor(hour) * wind_factor
        predicted = req.baseline_aqi * factor
        band_width = predicted * (0.08 + 0.015 * i)
        low = max(0, predicted - band_width)
        high = predicted + band_width

        forecast.append({
            "hour_offset": i,
            "time_label": future_time.strftime("%I%p").lstrip("0").lower(),
            "predicted_aqi": round(predicted, 1),
            "low": round(low, 1),
            "high": round(high, 1),
        })

    wind_trend = "Falling" if wind_speed < 4 else "Rising"
    temp_trend = "Stable"
    burning_trend = "Increasing" if 17 <= current_hour <= 22 else "Stable"

    monitoring_note = "Live sensor" if req.is_monitored else "Estimated via interpolation from nearby stations (no direct sensor here)"

    prompt = f"""You are an air quality analyst. Given this data for {req.area}:
- Current AQI: {req.baseline_aqi}
- Wind speed: {wind_speed} m/s ({wind_trend})
- Temperature: {req.temperature}°C
- Time: {now.strftime('%I:%M %p')}
- Monitoring: {monitoring_note}

Write a single, concise 2-sentence insight (under 40 words total) for a citizen or officer about how AQI is expected to change in the next few hours and why. Be specific about timing. Respond with ONLY the insight text, no preamble, no quotes."""

    try:
        response = gemini_client.models.generate_content(
            model="gemini-3.1-flash-lite",
            contents=prompt
        )
        insight = response.text.strip()
    except Exception:
        insight = f"AQI patterns suggest changes over the next 24 hours based on wind and time-of-day trends for {req.area}."

    return {
        "area": req.area,
        "forecast": forecast,
        "insight": insight,
        "factors": {
            "wind_speed": wind_speed,
            "wind_trend": wind_trend,
            "temperature": req.temperature,
            "temp_trend": temp_trend,
            "burning_trend": burning_trend,
        }
    }

class EvidencePDFRequest(BaseModel):
    report_id: str
    area: str
    place_type: Optional[str] = None
    description: Optional[str] = None
    aqi: float
    state: Optional[str] = "Chandigarh"
    district: Optional[str] = None
    photo_data_url: Optional[str] = None
    likely_source: Optional[str] = "Unknown"
    confidence_percent: Optional[float] = 0
    severity: Optional[str] = "Medium"
    analysis_summary: Optional[str] = ""
    recommended_action: Optional[str] = ""
    officer_notes: Optional[str] = ""


@app.post("/generate-evidence-pdf")
def generate_evidence_pdf(req: EvidencePDFRequest):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=1.5*cm, bottomMargin=1.5*cm, leftMargin=2*cm, rightMargin=2*cm)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle("TitleStyle", parent=styles["Title"], textColor=colors.HexColor("#0f766e"), fontSize=20)
    heading_style = ParagraphStyle("HeadingStyle", parent=styles["Heading2"], textColor=colors.HexColor("#0f766e"), spaceBefore=14, spaceAfter=6)
    normal_style = styles["Normal"]
    small_gray = ParagraphStyle("SmallGray", parent=styles["Normal"], textColor=colors.gray, fontSize=9)

    elements = []
    elements.append(Paragraph("VAYU — Enforcement Evidence Package", title_style))
    elements.append(Paragraph("Generated by AI-assisted air quality enforcement analysis", small_gray))
    elements.append(Spacer(1, 0.3*cm))
    elements.append(HRFlowable(width="100%", color=colors.HexColor("#0f766e"), thickness=1))
    elements.append(Spacer(1, 0.5*cm))

    location_line = req.area + (f", {req.district}" if req.district else "") + f", {req.state}"
    meta_data = [
        ["Report ID", f"#{req.report_id}"],
        ["Location", location_line],
        ["Place Type", req.place_type or "Not specified"],
        ["AQI at time of report", str(req.aqi)],
        ["Generated on", datetime.now().strftime("%d %b %Y, %I:%M %p")],
    ]
    meta_table = Table(meta_data, colWidths=[4*cm, 11*cm])
    meta_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 0.4*cm))

    elements.append(Paragraph("Citizen-Submitted Evidence", heading_style))
    if req.photo_data_url:
        try:
            header, encoded = req.photo_data_url.split(",", 1)
            img_bytes = base64.b64decode(encoded)
            img_buffer = io.BytesIO(img_bytes)
            rl_img = RLImage(img_buffer, width=10*cm, height=6.5*cm)
            elements.append(rl_img)
            elements.append(Spacer(1, 0.2*cm))
        except Exception:
            elements.append(Paragraph("(Photo could not be embedded)", small_gray))
    else:
        elements.append(Paragraph("No photo evidence attached.", small_gray))

    elements.append(Paragraph(f"<b>Citizen description:</b> {req.description or 'No description provided.'}", normal_style))
    elements.append(Spacer(1, 0.4*cm))

    elements.append(Paragraph("AI Source Attribution Analysis", heading_style))
    analysis_data = [
        ["Likely Source", req.likely_source],
        ["Confidence", f"{req.confidence_percent}%"],
        ["Severity", req.severity],
    ]
    analysis_table = Table(analysis_data, colWidths=[4*cm, 11*cm])
    analysis_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(analysis_table)
    elements.append(Spacer(1, 0.2*cm))
    elements.append(Paragraph(f"<b>Analysis summary:</b> {req.analysis_summary}", normal_style))
    elements.append(Spacer(1, 0.2*cm))
    elements.append(Paragraph(f"<b>Recommended enforcement action:</b> {req.recommended_action}", normal_style))
    elements.append(Spacer(1, 0.4*cm))

    if req.officer_notes:
        elements.append(Paragraph("Officer Validation Notes", heading_style))
        elements.append(Paragraph(req.officer_notes, normal_style))
        elements.append(Spacer(1, 0.4*cm))

    elements.append(Spacer(1, 0.5*cm))
    elements.append(HRFlowable(width="100%", color=colors.HexColor("#d1d5db"), thickness=0.5))
    elements.append(Spacer(1, 0.2*cm))
    elements.append(Paragraph(
        "This document was generated by VAYU, an AI-assisted air quality enforcement platform. "
        "AI-generated analysis is intended to support, not replace, official inspection and judgment.",
        small_gray
    ))

    doc.build(elements)
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=VAYU_Evidence_{req.report_id}.pdf"}
    )
    
class HealthAdvisoryRequest(BaseModel):
    area: str
    aqi: float
    language: str = "English"
    health_profile: Optional[str] = "None"

@app.post("/health-advisory")
def health_advisory(req: HealthAdvisoryRequest):
    profile_context = ""
    if req.health_profile and req.health_profile != "None":
        profile_context = f"The reader has indicated a health profile of: {req.health_profile}. Tailor advice accordingly."

    prompt = f"""You are a public health advisor communicating air quality guidance to a
citizen in {req.area}, India. Current AQI is {req.aqi}.
{profile_context}

Write a health advisory in {req.language} only — do not include any English translation
or transliteration if the language is not English. Keep it to 3-4 short sentences:
(1) a plain-language description of how the air quality is right now,
(2) specific practical precautions for outdoor activity,
(3) a special note for the given health profile, if one was provided.
Respond with ONLY the advisory text in {req.language}, no preamble, no markdown, no
English commentary."""

    try:
        response = gemini_client.models.generate_content(
            model="gemini-3.1-flash-lite",
            contents=prompt
        )
        return {"success": True, "advisory": response.text.strip(), "language": req.language}
    except Exception as e:
        return {"success": False, "advisory": "Health advisory temporarily unavailable. Please check back shortly.", "error": str(e)}
    
@app.delete("/reports/clear-all")
def clear_all_reports():
    reports_db.clear()
    return {"success": True, "message": "All reports cleared"}
@app.get("/community-impact")
def community_impact():
    total = len(reports_db)
    by_area = {}
    by_status = {}
    for r in reports_db:
        area = r.get("area") or "Unknown"
        by_area[area] = by_area.get(area, 0) + 1
        status = r.get("status") or "Pending"
        by_status[status] = by_status.get(status, 0) + 1

    area_breakdown = [{"area": k, "count": v} for k, v in sorted(by_area.items(), key=lambda x: -x[1])]

    return {
        "total_reports": total,
        "by_area": area_breakdown,
        "by_status": by_status,
    }
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

landmark_cache = {}
LANDMARK_CACHE_TTL = 86400  # 24 hours — land use barely changes


def scan_area_landmarks(lat: float, lon: float, radius: int = 900):
    cache_key = f"landmarks_{round(lat, 4)}_{round(lon, 4)}_{radius}"
    if cache_key in landmark_cache:
        ts, data = landmark_cache[cache_key]
        if time.time() - ts < LANDMARK_CACHE_TTL:
            return data

    query = f"""
[out:json][timeout:25];
(
  nwr["shop"](around:{radius},{lat},{lon});
  nwr["amenity"~"marketplace|restaurant|cafe|fuel|bus_station|school|college|university|hospital|clinic"](around:{radius},{lat},{lon});
  nwr["landuse"~"industrial|construction|retail|commercial"](around:{radius},{lat},{lon});
  nwr["building"~"industrial|warehouse|commercial|retail|school|hospital|university"](around:{radius},{lat},{lon});
  way["highway"~"^(primary|secondary|trunk|motorway)$"](around:{radius},{lat},{lon});
  nwr["man_made"~"works|chimney"](around:{radius},{lat},{lon});
);
out center 400;
"""

    try:
        resp = requests.post(
            OVERPASS_URL,
            data={"data": query},
            timeout=30,
            headers={"User-Agent": "VAYU-AirQuality/1.0"},
        )
        if resp.status_code != 200:
            return None
        raw = resp.json()
    except Exception:
        return None

    counts = {
        "shops_and_markets": 0,
        "restaurants_and_cafes": 0,
        "industrial_sites": 0,
        "construction_sites": 0,
        "schools_and_colleges": 0,
        "hospitals_and_clinics": 0,
        "fuel_stations": 0,
        "bus_stations": 0,
        "major_roads": 0,
    }
    samples = {k: [] for k in counts}

    def add(key, name):
        counts[key] += 1
        if name and name not in samples[key] and len(samples[key]) < 4:
            samples[key].append(name)

    for el in raw.get("elements", []):
        tags = el.get("tags") or {}
        name = tags.get("name")
        amenity = tags.get("amenity")
        landuse = tags.get("landuse")
        highway = tags.get("highway")
        man_made = tags.get("man_made")
        building = tags.get("building")

        if tags.get("shop") or amenity == "marketplace" or landuse in ("retail", "commercial") or building in ("commercial", "retail"):
            add("shops_and_markets", name)
        elif amenity in ("restaurant", "cafe"):
            add("restaurants_and_cafes", name)
        elif landuse == "industrial" or man_made in ("works", "chimney") or building in ("industrial", "warehouse"):
            add("industrial_sites", name)
        elif landuse == "construction":
            add("construction_sites", name)
        elif amenity in ("school", "college", "university") or building in ("school", "university"):
            add("schools_and_colleges", name)
        elif amenity in ("hospital", "clinic") or building == "hospital":
            add("hospitals_and_clinics", name)
        elif amenity == "fuel":
            add("fuel_stations", name)
        elif amenity == "bus_station":
            add("bus_stations", name)
        elif highway:
            add("major_roads", name)

    result = {
        "counts": counts,
        "samples": {k: v for k, v in samples.items() if v},
        "total_features": sum(counts.values()),
        "radius_m": radius,
    }
    landmark_cache[cache_key] = (time.time(), result)
    return result


class AttributionRequestV2(BaseModel):
    area: str
    aqi: float
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    wind_speed: Optional[float] = 3.0


@app.post("/source-attribution-scan")
def source_attribution_scan(req: AttributionRequestV2):
    landmarks = None
    if req.latitude is not None and req.longitude is not None:
        landmarks = scan_area_landmarks(req.latitude, req.longitude)

    if landmarks and landmarks["total_features"] > 0:
        c = landmarks["counts"]
        s = landmarks["samples"]

        def line(label, key):
            names = f" (e.g. {', '.join(s[key])})" if s.get(key) else ""
            return f"- {label}: {c[key]}{names}"

        landmark_block = "\n".join([
            line("Shops, markets and retail areas", "shops_and_markets"),
            line("Restaurants and cafes", "restaurants_and_cafes"),
            line("Industrial sites / works", "industrial_sites"),
            line("Active construction sites", "construction_sites"),
            line("Schools and colleges", "schools_and_colleges"),
            line("Hospitals and clinics", "hospitals_and_clinics"),
            line("Fuel stations", "fuel_stations"),
            line("Bus stations", "bus_stations"),
            line("Major roads", "major_roads"),
        ])
        data_note = f"A geospatial scan of a {landmarks['radius_m']}m radius around this area found these real mapped land-use features:\n{landmark_block}"
    else:
        data_note = "No detailed land-use scan data was available for this area, so base your estimate on the AQI, wind conditions, and typical Indian urban sector characteristics."

    prompt = f"""You are an air quality source attribution analyst for {req.area}, India.
Current AQI: {req.aqi}. Wind speed: {req.wind_speed} m/s.

{data_note}

Using this evidence, estimate the pollution source contribution breakdown.
Respond ONLY with valid JSON (no markdown, no code fences) with exactly these fields:
{{"industrial_percent": number, "vehicular_percent": number, "construction_percent": number, "other_percent": number, "technical_summary": "3-4 sentences for a regulatory officer that EXPLICITLY cites the specific feature counts found above and explains why each source category received its percentage — e.g. 'the high vehicular share reflects N shops/markets and N major roads driving dense local traffic'", "plain_summary": "2 simple sentences for a citizen with no technical background, mentioning the kinds of places nearby in everyday language"}}
The four percent fields must sum to exactly 100."""

    try:
        response = gemini_client.models.generate_content(
            model="gemini-3.1-flash-lite",
            contents=prompt
        )
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.lower().startswith("json"):
                text = text[4:]
        result = json.loads(text.strip())
        return {"success": True, "landmarks": landmarks, **result}
    except Exception as e:
        return {
            "success": False,
            "landmarks": landmarks,
            "industrial_percent": 25, "vehicular_percent": 45,
            "construction_percent": 15, "other_percent": 15,
            "technical_summary": "Attribution analysis is temporarily unavailable. Please review the scanned land-use features manually.",
            "plain_summary": "We couldn't complete the analysis right now — please check back shortly.",
            "error": str(e),
        }
CDSE_TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
CDSE_STATS_URL = "https://sh.dataspace.copernicus.eu/api/v1/statistics"

_cdse_token = {"value": None, "expires": 0}


def get_cdse_token():
    if _cdse_token["value"] and time.time() < _cdse_token["expires"] - 60:
        return _cdse_token["value"]
    if not COPERNICUS_CLIENT_ID or not COPERNICUS_CLIENT_SECRET:
        return None
    try:
        resp = requests.post(
            CDSE_TOKEN_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": COPERNICUS_CLIENT_ID,
                "client_secret": COPERNICUS_CLIENT_SECRET,
            },
            timeout=20,
        )
        if resp.status_code != 200:
            print("CDSE TOKEN ERROR:", resp.status_code, resp.text[:300])
            return None
        j = resp.json()
        _cdse_token["value"] = j.get("access_token")
        _cdse_token["expires"] = time.time() + j.get("expires_in", 600)
        return _cdse_token["value"]
    except Exception as e:
        print("CDSE TOKEN EXCEPTION:", e)
        return None


CITY_BBOX = {
    "Chandigarh": [76.68, 30.66, 76.85, 30.79],
    "Punjab": [73.9, 29.5, 76.9, 32.5],
    "Haryana": [74.5, 27.6, 77.6, 30.9],
}

satellite_cache = {}
SATELLITE_CACHE_TTL = 10800  # 3 hours


@app.get("/satellite-no2")
def satellite_no2(state: str = "Chandigarh"):
    cache_key = f"sat_{state}"
    if cache_key in satellite_cache:
        ts, data = satellite_cache[cache_key]
        if time.time() - ts < SATELLITE_CACHE_TTL:
            return data

    bbox = CITY_BBOX.get(state)
    if not bbox:
        return {"available": False, "reason": "No bounding box configured for this region."}

    token = get_cdse_token()
    if not token:
        return {"available": False, "reason": "Satellite service credentials not configured or authentication failed."}

    now = datetime.now()
    start = (now - timedelta(days=5)).strftime("%Y-%m-%dT00:00:00Z")
    end = now.strftime("%Y-%m-%dT23:59:59Z")

    evalscript = """
//VERSION=3
function setup() {
  return {
    input: [{bands: ["NO2", "dataMask"]}],
    output: [
      {id: "no2", bands: 1, sampleType: "FLOAT32"},
      {id: "dataMask", bands: 1}
    ]
  };
}
function evaluatePixel(sample) {
  return {no2: [sample.NO2], dataMask: [sample.dataMask]};
}
"""

    payload = {
        "input": {
            "bounds": {
                "bbox": bbox,
                "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"},
            },
            "data": [{
                "type": "sentinel-5p-l2",
                "dataFilter": {"timeRange": {"from": start, "to": end}},
            }],
        },
        "aggregation": {
            "timeRange": {"from": start, "to": end},
            "aggregationInterval": {"of": "P1D"},
            "evalscript": evalscript,
            "resx": 0.05,
            "resy": 0.05,
        },
    }

    try:
        resp = requests.post(
            CDSE_STATS_URL,
            json=payload,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            timeout=45,
        )
        if resp.status_code != 200:
            print("CDSE STATS ERROR:", resp.status_code, resp.text[:500])
            return {"available": False, "reason": f"Satellite service returned status {resp.status_code}."}
        raw = resp.json()
    except Exception as e:
        return {"available": False, "reason": f"Could not reach satellite service: {e}"}

    series = []
    for item in raw.get("data", []):
        interval = item.get("interval", {})
        stats = item.get("outputs", {}).get("no2", {}).get("bands", {}).get("B0", {}).get("stats", {})
        mean = stats.get("mean")
        if mean is None:
            continue
        series.append({
            "date": (interval.get("from") or "")[:10],
            "mean_no2": round(mean * 1e6, 3),
        })

    if not series:
        return {"available": False, "reason": "No cloud-free satellite passes over this region in the last 5 days."}

    values = [s["mean_no2"] for s in series]
    latest = series[-1]
    avg = sum(values) / len(values)

    if latest["mean_no2"] > avg * 1.15:
        trend = "Elevated"
    elif latest["mean_no2"] < avg * 0.85:
        trend = "Below average"
    else:
        trend = "Typical"

    result = {
        "available": True,
        "region": state,
        "scale_note": "Regional scale — Sentinel-5P resolution is approximately 5.5km x 3.5km per pixel, which covers an entire city district. This layer provides city-wide atmospheric context and cannot distinguish individual sectors.",
        "series": series,
        "latest": latest,
        "period_average": round(avg, 3),
        "trend": trend,
        "unit": "µmol/m² (tropospheric NO₂ column)",
        "source": "Copernicus Sentinel-5P TROPOMI",
    }
    satellite_cache[cache_key] = (time.time(), result)
    return result