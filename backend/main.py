import os
import time
import requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from google import genai
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime

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
    response = requests.get(CPCB_BASE_URL, params=params)
    data = response.json()
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
        avg_value = row.get("pollutant_avg")

        if pollutant_id and avg_value and avg_value != "NA":
            stations[station_name]["pollutants"][pollutant_id] = {
                "min": row.get("pollutant_min"),
                "max": row.get("pollutant_max"),
                "avg": avg_value
            }

    result = {"count": len(stations), "stations": list(stations.values())}
    set_cache(cache_key, result)
    return result


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
    description: str
    state: str
    district: Optional[str] = None
    area: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

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
        "description": report.description,
        "state": report.state,
        "district": report.district,
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

