/** Days in each month for a given year */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/** Total days in a year */
export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/** Day of year (1-based) */
export function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date.getTime() - start.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

/** Fractional day of year including time-of-day progress */
export function fractionalDayOfYear(date: Date): number {
  const doy = dayOfYear(date)
  const hours = date.getHours()
  const minutes = date.getMinutes()
  return doy + (hours * 60 + minutes) / 1440
}

/** Start angle (degrees) for each month, based on actual day counts */
export function monthStartAngles(year: number): number[] {
  const total = daysInYear(year)
  const angles: number[] = []
  let cumDays = 0
  for (let m = 1; m <= 12; m++) {
    angles.push((cumDays / total) * 360)
    cumDays += daysInMonth(year, m)
  }
  return angles
}

/** Day of week: 0=Sun, 6=Sat */
export function getDayOfWeek(year: number, dayIndex: number): number {
  const date = new Date(year, 0, dayIndex)
  return date.getDay()
}

/** Short month labels */
export const MONTH_LABELS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
]

/** Format date for center display */
export function formatDate(date: Date): {
  dateStr: string
  dayOfWeekStr: string
  progressPercent: string
} {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const doy = dayOfYear(date)
  const total = daysInYear(date.getFullYear())
  const pct = ((doy / total) * 100).toFixed(1)

  return {
    dateStr: `${year}.${month}.${day}`,
    dayOfWeekStr: weekdays[date.getDay()],
    progressPercent: `${pct}%`,
  }
}

/** Calculate all hand angles */
export function calcHandAngles(date: Date): {
  yearAngle: number
  monthAngle: number
  dayAngle: number
} {
  const year = date.getFullYear()
  const total = daysInYear(year)
  const fDoy = fractionalDayOfYear(date)

  // Short hand: year progress
  const yearAngle = (fDoy / total) * 360

  // Long hand: month progress
  const currentMonth = date.getMonth() + 1
  const dim = daysInMonth(year, currentMonth)
  const dayInMonth = date.getDate()
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const fractionalDay = dayInMonth - 1 + (hours * 60 + minutes) / 1440
  const monthAngle = (fractionalDay / dim) * 360

  // Second hand: 24h progress
  const dayAngle = ((hours * 60 + minutes) / 1440) * 360

  return { yearAngle, monthAngle, dayAngle }
}
