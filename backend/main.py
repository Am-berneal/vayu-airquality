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