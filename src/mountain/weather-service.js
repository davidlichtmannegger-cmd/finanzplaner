import { parseWeather, roundCoord } from '../logic/weather.js';

const CACHE_KEY = 'finanzplaner:wetter';
const MAX_AGE = 30 * 60 * 1000;

export async function fetchWeather(place) {
  if (!place || !Number.isFinite(place.lat)) return null;
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (cached && cached.lat === place.lat && cached.lon === place.lon && Date.now() - cached.at < MAX_AGE) return cached.weather;
  } catch {}
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&current=weather_code,temperature_2m,is_day,wind_speed_10m,cloud_cover&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wetter: HTTP ${res.status}`);
  const weather = parseWeather(await res.json());
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ lat: place.lat, lon: place.lon, at: Date.now(), weather }));
  } catch {}
  return weather;
}

export async function searchPlace(name) {
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name, count: '5', language: 'de' })}`);
  if (!res.ok) throw new Error('Ortssuche nicht erreichbar');
  const json = await res.json();
  return (json.results || []).map((r) => ({ name: [r.name, r.admin1, r.country_code].filter(Boolean).join(', '), lat: roundCoord(r.latitude), lon: roundCoord(r.longitude) }));
}

export function currentPlace() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Standort wird nicht unterstützt'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ name: 'Mein Standort', lat: roundCoord(pos.coords.latitude), lon: roundCoord(pos.coords.longitude) }),
      () => reject(new Error('Standort wurde nicht freigegeben')),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 3600000 }
    );
  });
}
