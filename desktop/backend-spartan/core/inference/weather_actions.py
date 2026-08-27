"""
Core weather lookup actions for Sparta Agent model inference.
Provides live weather information using Open-Meteo API (no API key required)
with automatic IP geolocation fallback or city search.
"""

from __future__ import annotations

import json
import logging
from typing import Any
import urllib.request
import urllib.parse

logger = logging.getLogger(__name__)

# WMO Weather interpretation codes (WW) -> (Description ES, Emoji)
WMO_CODE_MAP: dict[int, tuple[str, str]] = {
    0: ("Despejado / Soleado", "☀️"),
    1: ("Mayormente despejado", "🌤️"),
    2: ("Parcialmente nublado", "⛅"),
    3: ("Nublado", "☁️"),
    45: ("Niebla", "🌫️"),
    48: ("Niebla con escarcha", "🌫️"),
    51: ("Llovizna ligera", "🌦️"),
    53: ("Llovizna moderada", "🌦️"),
    55: ("Llovizna densa", "🌧️"),
    56: ("Llovizna helada ligera", "🌧️"),
    57: ("Llovizna helada densa", "🌧️"),
    61: ("Lluvia ligera", "🌧️"),
    63: ("Lluvia moderada", "🌧️"),
    65: ("Lluvia fuerte", "🌧️"),
    66: ("Lluvia helada ligera", "🌧️"),
    67: ("Lluvia helada fuerte", "🌧️"),
    71: ("Nevada ligera", "🌨️"),
    73: ("Nevada moderada", "🌨️"),
    75: ("Nevada fuerte", "❄️"),
    77: ("Granos de nieve", "❄️"),
    80: ("Chubascos ligeros", "🌦️"),
    81: ("Chubascos moderados", "🌧️"),
    82: ("Chubascos violentos", "⛈️"),
    85: ("Chubascos de nieve ligeros", "🌨️"),
    86: ("Chubascos de nieve fuertes", "❄️"),
    95: ("Tormenta eléctrica", "⛈️"),
    96: ("Tormenta con granizo ligero", "⛈️"),
    99: ("Tormenta con granizo fuerte", "⛈️"),
}


def _http_get_json(url: str, timeout: float = 4.0) -> dict[str, Any] | list[Any] | None:
    """Execute GET request using urllib with JSON response."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "SpartaAgent/0.2.6"})
        with urllib.request.urlopen(req, timeout=timeout) as response:
            if response.status == 200:
                raw = response.read().decode("utf-8")
                return json.loads(raw)
    except Exception as exc:
        logger.debug("HTTP GET %s failed: %s", url, exc)
    return None


def _detect_location_by_ip() -> dict[str, Any] | None:
    """Detect current user coordinates and location name using public IP APIs."""
    # 1. Try ip-api.com
    data = _http_get_json("http://ip-api.com/json/", timeout=3.0)
    if isinstance(data, dict) and data.get("status") == "success":
        return {
            "name": f"{data.get('city', 'Ubicación local')}, {data.get('regionName', '')} ({data.get('country', '')})".strip(", "),
            "latitude": float(data["lat"]),
            "longitude": float(data["lon"]),
        }

    # 2. Fallback to ipinfo.io
    data2 = _http_get_json("https://ipinfo.io/json", timeout=3.0)
    if isinstance(data2, dict):
        loc = data2.get("loc", "")
        if "," in loc:
            lat, lon = loc.split(",")
            return {
                "name": f"{data2.get('city', 'Ubicación local')}, {data2.get('region', '')} ({data2.get('country', '')})".strip(", "),
                "latitude": float(lat.strip()),
                "longitude": float(lon.strip()),
            }

    return None


def _geocode_city(city_name: str) -> dict[str, Any] | None:
    """Geocode a city or place name to latitude/longitude using Open-Meteo Geocoding API."""
    encoded_city = urllib.parse.quote(city_name)
    url = f"https://geocoding-api.open-meteo.com/v1/search?name={encoded_city}&count=1&language=es&format=json"
    data = _http_get_json(url, timeout=4.0)
    if isinstance(data, dict):
        results = data.get("results")
        if results and len(results) > 0:
            first = results[0]
            name_parts = [first.get("name")]
            if first.get("admin1"):
                name_parts.append(first["admin1"])
            if first.get("country"):
                name_parts.append(first["country"])
            return {
                "name": ", ".join(filter(None, name_parts)),
                "latitude": float(first["latitude"]),
                "longitude": float(first["longitude"]),
            }
    return None


def get_weather_for_model(arguments: dict[str, Any] | str) -> str:
    """Entry point for model calling get_weather tool."""
    if isinstance(arguments, str):
        try:
            parsed = json.loads(arguments)
            arguments = parsed if isinstance(parsed, dict) else {}
        except Exception:
            arguments = {}

    location_query = (arguments.get("location") or arguments.get("city") or "").strip()

    loc_data: dict[str, Any] | None = None
    if location_query:
        loc_data = _geocode_city(location_query)
        if not loc_data:
            return f"No se pudo encontrar la ubicación especificada: '{location_query}'. Por favor verifica el nombre de la ciudad."
    else:
        loc_data = _detect_location_by_ip()
        if not loc_data:
            # Fallback default if completely offline / IP block
            loc_data = {"name": "Ubicación detectada (predeterminada)", "latitude": 40.4168, "longitude": -3.7038}

    lat = loc_data["latitude"]
    lon = loc_data["longitude"]
    loc_name = loc_data["name"]

    try:
        weather_url = (
            f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}"
            f"&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m"
            f"&timezone=auto"
        )
        data = _http_get_json(weather_url, timeout=5.0)
        if not isinstance(data, dict):
            return "Error al consultar el servicio meteorológico de Open-Meteo."

        current = data.get("current", {})
        temp = current.get("temperature_2m", "N/A")
        apparent = current.get("apparent_temperature", temp)
        humidity = current.get("relative_humidity_2m", "N/A")
        wind = current.get("wind_speed_10m", "N/A")
        precip = current.get("precipitation", 0.0)
        code = current.get("weather_code", 0)

        desc, emoji = WMO_CODE_MAP.get(code, ("Condiciones actuales", "🌡️"))

        return (
            f"📍 Clima actual en {loc_name}:\n"
            f"- Condición: {desc} {emoji}\n"
            f"- Temperatura: {temp} °C (Sensación térmica: {apparent} °C)\n"
            f"- Humedad: {humidity}%\n"
            f"- Viento: {wind} km/h\n"
            f"- Precipitación: {precip} mm"
        )
    except Exception as exc:
        logger.error("Weather query failed: %s", exc, exc_info=True)
        return f"Error de conexión al obtener el clima: {str(exc)}"
