import SunCalc from 'suncalc'

export interface Location {
  lat: number
  lng: number
  name: string  // display name (e.g. "Tokyo", "35.68, 139.77")
}

export interface SolarTimes {
  sunrise: Date
  sunset: Date
  solarNoon: Date
  dawn: Date        // civil dawn
  dusk: Date        // civil dusk
  nauticalDawn: Date
  nauticalDusk: Date
  goldenHour: Date
  goldenHourEnd: Date
  night: Date
  nightEnd: Date
}

export interface MoonInfo {
  phase: number       // 0=new, 0.25=first quarter, 0.5=full, 0.75=last quarter
  illumination: number // 0.0 to 1.0
  emoji: string        // moon phase emoji
}

export const DEFAULT_LOCATION: Location = {
  lat: 35.6762,
  lng: 139.6503,
  name: 'Tokyo',
}

/** Get solar times for a given date and location */
export function getSolarTimes(date: Date, loc: Location): SolarTimes {
  const times = SunCalc.getTimes(date, loc.lat, loc.lng)
  return {
    sunrise: times.sunrise,
    sunset: times.sunset,
    solarNoon: times.solarNoon,
    dawn: times.dawn,
    dusk: times.dusk,
    nauticalDawn: times.nauticalDawn,
    nauticalDusk: times.nauticalDusk,
    goldenHour: times.goldenHour,
    goldenHourEnd: times.goldenHourEnd,
    night: times.night,
    nightEnd: times.nightEnd,
  }
}

/** Convert a Date to 24h angle (0° = midnight, 90° = 6AM, 180° = noon, 270° = 6PM) */
export function timeToAngle(date: Date): number {
  const h = date.getHours()
  const m = date.getMinutes()
  const s = date.getSeconds()
  return ((h + m / 60 + s / 3600) / 24) * 360
}

/** Get moon phase info for a given date */
export function getMoonInfo(date: Date): MoonInfo {
  const illum = SunCalc.getMoonIllumination(date)
  const phase = illum.phase

  // Moon phase emoji
  let emoji: string
  if (phase < 0.0625) emoji = '🌑'       // new moon
  else if (phase < 0.1875) emoji = '🌒'  // waxing crescent
  else if (phase < 0.3125) emoji = '🌓'  // first quarter
  else if (phase < 0.4375) emoji = '🌔'  // waxing gibbous
  else if (phase < 0.5625) emoji = '🌕'  // full moon
  else if (phase < 0.6875) emoji = '🌖'  // waning gibbous
  else if (phase < 0.8125) emoji = '🌗'  // last quarter
  else if (phase < 0.9375) emoji = '🌘'  // waning crescent
  else emoji = '🌑'                       // new moon

  return {
    phase,
    illumination: illum.fraction,
    emoji,
  }
}

/** Get day length in hours */
export function getDayLength(date: Date, loc: Location): number {
  const times = SunCalc.getTimes(date, loc.lat, loc.lng)
  return (times.sunset.getTime() - times.sunrise.getTime()) / (1000 * 60 * 60)
}
