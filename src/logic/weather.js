export function weatherType(code) {
  if (code === 0 || code === 1) return 'klar';
  if (code === 2 || code === 3) return 'bewoelkt';
  if (code === 45 || code === 48) return 'nebel';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'regen';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'schnee';
  if (code >= 95) return 'gewitter';
  return 'bewoelkt';
}

export const WEATHER_LABEL = {
  klar: 'Klar',
  bewoelkt: 'Bewölkt',
  nebel: 'Nebel',
  regen: 'Regen',
  schnee: 'Schnee',
  gewitter: 'Gewitter'
};

export const WEATHER_ICON = { klar: '☀️', bewoelkt: '⛅', nebel: '🌫️', regen: '🌧️', schnee: '❄️', gewitter: '⛈️' };

export function parseWeather(json) {
  const c = json?.current;
  if (!c || typeof c.weather_code !== 'number') return null;
  return {
    typ: weatherType(c.weather_code),
    code: c.weather_code,
    temp: Math.round(c.temperature_2m),
    wind: Math.round(c.wind_speed_10m || 0),
    wolken: Math.round(c.cloud_cover ?? 50),
    tag: c.is_day === 1,
    zeit: c.time
  };
}

export const roundCoord = (v) => Math.round(v * 100) / 100;

export function season(month) {
  if (month === 11 || month <= 1) return 'winter';
  if (month <= 4) return 'fruehling';
  if (month <= 7) return 'sommer';
  return 'herbst';
}

export const SEASON_LABEL = { winter: 'Winter', fruehling: 'Frühling', sommer: 'Sommer', herbst: 'Herbst' };

export const GEAR = [
  { level: 2, id: 'rucksack', icon: '🎒', name: 'Rucksack' },
  { level: 3, id: 'kopflampe', icon: '🔦', name: 'Kopflampe' },
  { level: 4, id: 'eispickel', icon: '⛏️', name: 'Eispickel' },
  { level: 6, id: 'seil', icon: '🪢', name: 'Seil' },
  { level: 8, id: 'goldhelm', icon: '⛑️', name: 'Goldhelm' }
];

export const gearFor = (level) => GEAR.filter((g) => level >= g.level);

export const nextGear = (level) => GEAR.find((g) => level < g.level) || null;
