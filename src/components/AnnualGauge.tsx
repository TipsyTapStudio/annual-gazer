import React, { useEffect, useState, useMemo } from 'react'
import {
  daysInYear,
  daysInMonth,
  monthStartAngles,
  getDayOfWeek,
  dayOfYear,
  formatDate,
  calcHandAngles,
} from '../utils/dateUtils'
import { getSolarTimes, timeToAngle, DEFAULT_LOCATION } from '../utils/solarUtils'
import type { Location } from '../utils/solarUtils'

const SIZE = 600
const CX = SIZE / 2
const CY = SIZE / 2

// ── Outer ring: baguette-cut segment cells ──
const OUTER_R = 288
const CELL_H = 48
const CELL_W = 16
const CHAMFER = 4
const TOTAL_SLOTS = 31

// ── Spectrum analyzer band ──
const SPEC_OUTER_R = 228   // gap after cells (OUTER_R - CELL_H - 14)
const SPEC_LINE_LEN = 14
const SPEC_INNER_R = SPEC_OUTER_R - SPEC_LINE_LEN // 221
// const SPEC_LINE_COUNT_DEFAULT = 288
const SPEC_R_MID = (SPEC_OUTER_R + SPEC_INNER_R) / 2 - 3  // centered vertically in spectrum band

// ── Inner ring: analog gauge ──
const INNER_R = 199        // gap after spectrum
const TICK_L1 = 18
const TICK_L2 = 10
const TICK_L3 = 5
const TICK_W1 = 1.6
const TICK_W2 = 0.8
const TICK_W3 = 0.4

// ── Needle ──
const LABEL_R = INNER_R - TICK_L1 - 14  // 177
const HAND_LEN = LABEL_R - 14           // 163

// ── Colors ──
const FG = '#e8e8e8'
const ACCENT = '#c0785a'
// ACCENT_SUN removed — weekends distinguished by cell brightness, not text color
const MUTED = '#555555'
const DIM = '#3a3a3a'
const BG = '#0a0a0a'

const ACCENT_NIGHT = '#5a7a9a' // cool blue-gray for nighttime spectrum bars
const TRANSITION = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
const FONT_ENGRAVE = "'Barlow Condensed', 'Arial Narrow', sans-serif"
const FONT_MONO = "'SF Mono', 'Consolas', monospace"
const FONT_SANS = "'Inter', 'Helvetica Neue', Arial, sans-serif"
const FONT_7SEG = "'DSEG7 Classic', monospace"
const FONT_DIAL = "'Chakra Petch', 'Arial Black', sans-serif"  // square-proportioned dial font

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

const BEVEL_W = 2.5  // facet border width (inner side)
const FLARE = 1.5    // extra width spread on outer (top) edge of bevel

// Tapered baguette path — wider at outer (top), narrower at inner (bottom)
// ox, oy = top-left of the untapered cell at 12 o'clock
// flare = half the width difference: top is +flare, bottom is -flare per side
function baguettePath(ox: number, oy: number, w: number, h: number, c: number, flare: number): string {
  const cx = ox + w / 2
  const ht = w / 2 + flare   // half-width at top (outer)
  const hb = w / 2 - flare   // half-width at bottom (inner)
  return [
    `M ${cx - ht + c} ${oy}`,    `L ${cx + ht - c} ${oy}`,       // top edge
    `L ${cx + ht} ${oy + c}`,                                      // top-right chamfer
    `L ${cx + hb} ${oy + h - c}`,                                  // right side (tapers)
    `L ${cx + hb - c} ${oy + h}`, `L ${cx - hb + c} ${oy + h}`,  // bottom edge
    `L ${cx - hb} ${oy + h - c}`,                                  // bottom-left chamfer
    `L ${cx - ht} ${oy + c}`,                                      // left side (tapers)
    `Z`,
  ].join(' ')
}

// Facet paths for tapered baguette
function facetPaths(ox: number, oy: number, w: number, h: number, c: number, b: number, flare: number) {
  const cx = ox + w / 2
  const ht = w / 2 + flare
  const hb = w / 2 - flare
  // Outer vertices
  const oTL = `${cx - ht} ${oy + c}`
  const oT1 = `${cx - ht + c} ${oy}`
  const oT2 = `${cx + ht - c} ${oy}`
  const oTR = `${cx + ht} ${oy + c}`
  const oBR = `${cx + hb} ${oy + h - c}`
  const oB2 = `${cx + hb - c} ${oy + h}`
  const oB1 = `${cx - hb + c} ${oy + h}`
  const oBL = `${cx - hb} ${oy + h - c}`
  // Inner bevel vertices (also tapered)
  const iht = ht - b
  const ihb = hb - b
  const iTL = `${cx - iht} ${oy + b}`
  const iTR = `${cx + iht} ${oy + b}`
  const iBR = `${cx + ihb} ${oy + h - b}`
  const iBL = `${cx - ihb} ${oy + h - b}`

  return {
    top:      `M ${oT1} L ${oT2} L ${iTR} L ${iTL} Z`,
    topLeft:  `M ${oTL} L ${oT1} L ${iTL} Z`,
    topRight: `M ${oT2} L ${oTR} L ${iTR} Z`,
    right:    `M ${oTR} L ${oBR} L ${iBR} L ${iTR} Z`,
    bottom:   `M ${oBR} L ${oB2} L ${oB1} L ${oBL} L ${iBL} L ${iBR} Z`,
    left:     `M ${oBL} L ${oTL} L ${iTL} L ${iBL} Z`,
    center:   `M ${iTL} L ${iTR} L ${iBR} L ${iBL} Z`,
    // Outer contour edges only
    edgeTop:      `M ${oT1} L ${oT2}`,
    edgeRight:    `M ${oTR} L ${oBR}`,
    edgeLeft:     `M ${oTL} L ${oBL}`,
    edgeTopLeft:  `M ${oTL} L ${oT1}`,
    edgeTopRight: `M ${oT2} L ${oTR}`,
  }
}

/** Calculate facet brightness based on light angle relative to cell */
function facetOpacity(
  facetNormal: number, // 0=top, 90=right, 180=bottom, 270=left
  lightAngle: number,  // dayAngle - cellAngle (relative light direction)
  baseOpacity: number, // state base (today/lit/unlit)
  isTop?: boolean,     // C: top facet gets extra boost
): number {
  const diff = ((lightAngle - facetNormal + 360) % 360) * Math.PI / 180
  const cosine = Math.cos(diff)
  // Map cosine [-1,1] to multiplier [0.4, 2.0]
  let multiplier = 0.4 + 1.6 * Math.max(0, (cosine + 1) / 2)
  // C: Top facet (flare) catches more light — boost when facing light
  if (isTop && cosine > 0) multiplier *= 1.5
  return baseOpacity * multiplier
}

/** Calculate edge highlight opacity — bright where facet catches light */
function edgeOpacity(
  facetNormal: number,
  lightAngle: number,
): number {
  const diff = ((lightAngle - facetNormal + 360) % 360) * Math.PI / 180
  const cosine = Math.cos(diff)
  return Math.max(0, cosine) * 0.25 // 0 to 0.25
}

export type TimeFormat = 'HH:MM:SS' | 'HH:MM' | 'HH:MM:blink'
export type HourFormat = '24h' | '12h'

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_ABBR = ['SUN','MON','TUE','WED','THU','FRI','SAT']

function formatTimeDisplay(date: Date, format: TimeFormat, hourFormat: HourFormat = '24h'): string {
  let hours = date.getHours()
  if (hourFormat === '12h') {
    hours = hours % 12 || 12
  }
  const h = hourFormat === '12h' ? String(hours) : String(hours).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  if (format === 'HH:MM:SS') {
    return `${h}:${m}:${String(date.getSeconds()).padStart(2, '0')}`
  }
  if (format === 'HH:MM:blink') {
    return `${h}${date.getSeconds() % 2 === 0 ? ':' : ' '}${m}`
  }
  return `${h}:${m}`
}

export type SpectrumDensity = 96 | 144 | 288 | 480 | 1440

interface AnnualGaugeProps {
  overrideDate?: Date | null
  overrideDateOnly?: Date | null
  timeFormat?: TimeFormat
  hourFormat?: HourFormat
  spectrumDensity?: SpectrumDensity
  location?: Location
}

export default function AnnualGauge({
  overrideDate,
  overrideDateOnly,
  timeFormat = 'HH:MM:SS',
  hourFormat = '24h',
  location: locationProp,
  spectrumDensity = 288,
}: AnnualGaugeProps) {
  const [now, setNow] = useState(() => new Date())

  const [subPage, setSubPage] = useState(0)

  useEffect(() => {
    if (overrideDate) return
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [overrideDate])

  // Auto-cycle sub-display pages
  useEffect(() => {
    const interval = setInterval(() => {
      setSubPage(p => (p + 1) % 3)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const dateSource = overrideDate ?? overrideDateOnly ?? now
  const timeSource = overrideDate ?? now
  const loc = locationProp ?? DEFAULT_LOCATION

  // Solar times for spectrum bar day/night coloring
  const solar = useMemo(() => getSolarTimes(dateSource, loc), [dateSource, loc])
  const sunriseAngle = timeToAngle(solar.sunrise)
  const sunsetAngle = timeToAngle(solar.sunset)

  const year = dateSource.getFullYear()
  const month = dateSource.getMonth() + 1
  const today = dateSource.getDate()
  const totalDays = daysInYear(year)
  const monthDays = daysInMonth(year, month)
  const angles = monthStartAngles(year)
  const { yearAngle } = calcHandAngles(dateSource)
  const { dayAngle } = calcHandAngles(timeSource)
  const { dateStr: _dateStr, dayOfWeekStr, progressPercent } = formatDate(dateSource)
  const timeStr = formatTimeDisplay(timeSource, timeFormat, hourFormat)
  const isAM = timeSource.getHours() < 12

  // Remaining days
  const todayDoy = dayOfYear(dateSource)
  const remainingDays = totalDays - todayDoy
  const monthStr = String(dateSource.getMonth() + 1).padStart(2, '0')
  const dayStr = String(dateSource.getDate()).padStart(2, '0')

  // ────────────────────────────────────────────
  // 1. Outer ring: monochrome baguette-cut cells
  // ────────────────────────────────────────────
  const slotAngle = 360 / TOTAL_SLOTS
  const outerCells: React.JSX.Element[] = []
  const cellOX = CX - CELL_W / 2
  const cellOY = CY - OUTER_R
  const cellPath = baguettePath(cellOX, cellOY, CELL_W, CELL_H, CHAMFER, FLARE)
  const facets = facetPaths(cellOX, cellOY, CELL_W, CELL_H, CHAMFER, BEVEL_W, FLARE)
  const textCX = CX
  const textCY = CY - OUTER_R + CELL_H * 0.42  // slightly above center → visual centroid of tapered shape

  for (let d = 1; d <= monthDays; d++) {
    const cellAngle = (d - 1) * slotAngle
    const date = new Date(year, month - 1, d)
    const dow = date.getDay()
    const isSaturday = dow === 6
    const isSunday = dow === 0
    const needsFlip = cellAngle > 90 && cellAngle < 270

    const isWeekend = isSaturday || isSunday

    // Light direction relative to this cell
    const relLight = ((dayAngle - cellAngle) % 360 + 360) % 360

    // Base opacity per state — weekends get slightly brighter cells
    let base: number, numOpacity: number
    const weekendBoost = isWeekend ? 1.25 : 1.0

    if (d === today) {
      base = 0.22 * weekendBoost
      numOpacity = 1.0
    } else if (d < today) {
      base = 0.14 * weekendBoost
      numOpacity = 0.85
    } else {
      base = 0.04 * weekendBoost
      numOpacity = 0.12
    }

    // Dynamic facet opacities based on light angle
    const opTop = facetOpacity(0, relLight, base, true)      // C: top boost
    const opTopLeft = facetOpacity(315, relLight, base)       // left ear (~NW facing)
    const opTopRight = facetOpacity(45, relLight, base)       // right ear (~NE facing)
    const opRight = facetOpacity(90, relLight, base)
    const opBottom = facetOpacity(180, relLight, base)
    const opLeft = facetOpacity(270, relLight, base)

    // Edge highlight opacities — outer contour edges only
    const edgeTopOp = edgeOpacity(0, relLight)
    const edgeLeftOp = edgeOpacity(270, relLight)
    const edgeRightOp = edgeOpacity(90, relLight)
    const edgeEarLeftOp = edgeOpacity(315, relLight)
    const edgeEarRightOp = edgeOpacity(45, relLight)

    // Center gradient direction: light to dark following light angle
    const gradAngle = relLight
    const centerGradId = `cgrad-${d}`
    // Ambient reflection gradient (top-to-bottom)
    const ambientGradId = `amb-${d}`

    outerCells.push(
      <g key={`cell-${d}`} transform={`rotate(${cellAngle}, ${CX}, ${CY})`}>
        {/* Bevel facet faces — light-responsive, boosted for edge highlight effect */}
        <path d={facets.top} fill="#ffffff" opacity={opTop * 1.3} />
        <path d={facets.topLeft} fill="#ffffff" opacity={opTopLeft * 1.3} />
        <path d={facets.topRight} fill="#ffffff" opacity={opTopRight * 1.3} />
        <path d={facets.left} fill="#ffffff" opacity={opLeft * 1.2} />
        <path d={facets.right} fill="#ffffff" opacity={opRight * 1.2} />
        <path d={facets.bottom} fill="#ffffff" opacity={opBottom} />

        {/* Edge highlights — outer contour lines only */}
        <path d={facets.edgeTop} fill="none" stroke="#ffffff" strokeWidth={0.8} opacity={edgeTopOp * 1.3} />
        <path d={facets.edgeTopLeft} fill="none" stroke="#ffffff" strokeWidth={0.6} opacity={edgeEarLeftOp * 1.2} />
        <path d={facets.edgeTopRight} fill="none" stroke="#ffffff" strokeWidth={0.6} opacity={edgeEarRightOp * 1.2} />
        <path d={facets.edgeLeft} fill="none" stroke="#ffffff" strokeWidth={0.5} opacity={edgeLeftOp * 0.8} />
        <path d={facets.edgeRight} fill="none" stroke="#ffffff" strokeWidth={0.5} opacity={edgeRightOp * 0.8} />

        {/* Center face — uniform directional gradient, no specular streak */}
        <defs>
          <linearGradient id={centerGradId} gradientUnits="objectBoundingBox"
            gradientTransform={`rotate(${gradAngle}, 0.5, 0.5)`}>
            <stop offset="0%" stopColor="#ffffff" stopOpacity={base * 2.2} />
            <stop offset="100%" stopColor="#ffffff" stopOpacity={base * 0.8} />
          </linearGradient>
          {/* Ambient reflection — top brighter, bottom darker */}
          <linearGradient id={ambientGradId} gradientUnits="objectBoundingBox"
            x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={base * 0.6} />
            <stop offset="60%" stopColor="#ffffff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={facets.center} fill={`url(#${centerGradId})`} />

        {/* Ambient reflection overlay */}
        <path d={cellPath} fill={`url(#${ambientGradId})`} />

        {/* Intaglio engraved text — shadow + base + highlight */}
        <text
          x={textCX} y={textCY} fill="#000000" opacity={numOpacity * 0.9}
          fontSize="13" fontFamily={FONT_ENGRAVE} fontWeight="600"
          textAnchor="middle" dominantBaseline="central" letterSpacing="0.5"
          filter="url(#engrave-bevel)"
          transform={needsFlip ? `rotate(180, ${textCX}, ${textCY})` : undefined}
        >{d}</text>
        {/* Highlight edge: light catching the bottom-right lip of the groove */}
        <text
          x={textCX} y={textCY} fill="#ffffff" opacity={numOpacity * 0.25}
          fontSize="13" fontFamily={FONT_ENGRAVE} fontWeight="600"
          textAnchor="middle" dominantBaseline="central" letterSpacing="0.5"
          filter="url(#engrave-light)"
          transform={needsFlip ? `rotate(180, ${textCX}, ${textCY})` : undefined}
        >{d}</text>
      </g>
    )
  }

  // ────────────────────────────────────────────
  // 2. Spectrum analyzer band — gradient lit bars
  // ────────────────────────────────────────────
  const specCount = spectrumDensity
  const specBarWidth = specCount <= 144 ? 1.2 : specCount <= 480 ? 0.7 : 0.3
  const specLines: React.JSX.Element[] = []

  // Helper: determine if an angle is in daytime
  const isDaytime = (a: number) => a >= sunriseAngle && a <= sunsetAngle

  for (let i = 0; i < specCount; i++) {
    const angle = (i / specCount) * 360
    const outer = polarToXY(CX, CY, SPEC_OUTER_R, angle)
    const inner = polarToXY(CX, CY, SPEC_INNER_R, angle)
    const isLit = angle <= dayAngle

    // Day/night color for lit bars — sharp boundary at sunrise/sunset
    const daytime = isDaytime(angle)
    let barColor: string
    if (!isLit) {
      barColor = '#ffffff'
    } else if (daytime) {
      barColor = ACCENT           // warm copper for daylight
    } else {
      barColor = ACCENT_NIGHT     // cool blue-gray for night
    }

    // Uniform brightness for lit bars — no gradient to keep sunrise/sunset boundary clear
    let opacity: number
    if (isLit) {
      opacity = 0.55
    } else {
      opacity = 0.03
    }

    specLines.push(
      <line
        key={`spec-${i}`}
        x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y}
        stroke={barColor}
        strokeWidth={specBarWidth}
        strokeLinecap="butt"
        opacity={opacity}
        style={{ transition: 'opacity 0.3s ease, stroke 0.3s ease' }}
      />
    )
  }

  // ── Sunrise/Sunset markers on spectrum band ──
  const sunriseTimeStr = `${String(solar.sunrise.getHours()).padStart(2, '0')}:${String(solar.sunrise.getMinutes()).padStart(2, '0')}`
  const sunsetTimeStr = `${String(solar.sunset.getHours()).padStart(2, '0')}:${String(solar.sunset.getMinutes()).padStart(2, '0')}`

  // Marker + time in the gap between inner ticks (365-day) and spectrum band (24h)
  const SOLAR_GAP_R = (INNER_R + SPEC_INNER_R) / 2  // midpoint of gap between day bar and 24h bar
  const SOLAR_MARKER_OFFSET = 5  // degrees offset for time text next to marker
  const sunriseMarkerPos = polarToXY(CX, CY, SOLAR_GAP_R, sunriseAngle)
  const sunriseTextPos = polarToXY(CX, CY, SOLAR_GAP_R, sunriseAngle + SOLAR_MARKER_OFFSET)
  const sunsetMarkerPos = polarToXY(CX, CY, SOLAR_GAP_R, sunsetAngle)
  const sunsetTextPos = polarToXY(CX, CY, SOLAR_GAP_R, sunsetAngle + SOLAR_MARKER_OFFSET)

  // ── Time text (HH:MM:SS) curved along spectrum arc ──
  // Right half (0-180°): text reads outward (clockwise arc)
  // Left half (180-360°): text reads inward (arc drawn in reverse so text flips)
  const TIME_OFFSET_DEG = 2
  const TIME_ARC_SPAN = 40
  const textStartDeg = dayAngle + TIME_OFFSET_DEG
  // Use bottom half for the flip boundary (text upside-down threshold)
  const needsFlipText = dayAngle > 90 && dayAngle < 270
  let timeArcD: string
  if (!needsFlipText) {
    // Top half: clockwise arc, text reads left-to-right
    const s = polarToXY(CX, CY, SPEC_R_MID, textStartDeg)
    const e = polarToXY(CX, CY, SPEC_R_MID, textStartDeg + TIME_ARC_SPAN)
    timeArcD = `M ${s.x} ${s.y} A ${SPEC_R_MID} ${SPEC_R_MID} 0 0 1 ${e.x} ${e.y}`
  } else {
    // Bottom half: reverse arc so text flips to stay readable
    const s = polarToXY(CX, CY, SPEC_R_MID, textStartDeg + TIME_ARC_SPAN)
    const e = polarToXY(CX, CY, SPEC_R_MID, textStartDeg)
    timeArcD = `M ${s.x} ${s.y} A ${SPEC_R_MID} ${SPEC_R_MID} 0 0 0 ${e.x} ${e.y}`
  }
  const needsZabuton = dayAngle > 340 || dayAngle < 20
  const zabutonPos = polarToXY(CX, CY, SPEC_R_MID, textStartDeg + TIME_ARC_SPAN / 2)
  const zabutonAngle = textStartDeg + TIME_ARC_SPAN / 2

  // ────────────────────────────────────────────
  // 3. Inner ring: analog gauge (inward-facing ticks)
  // ────────────────────────────────────────────
  const ticks: React.JSX.Element[] = []
  for (let d = 1; d <= totalDays; d++) {
    const angle = ((d - 1) / totalDays) * 360
    const dow = getDayOfWeek(year, d)
    const isWeekend = dow === 0 || dow === 6
    let cumDays = 0, dayInMonth = d
    for (let m = 1; m <= 12; m++) {
      const dim = daysInMonth(year, m)
      if (d <= cumDays + dim) { dayInMonth = d - cumDays; break }
      cumDays += dim
    }
    const isMonthStart = dayInMonth === 1
    const isDecade = dayInMonth === 10 || dayInMonth === 20
    let len: number, width: number, color: string
    if (isMonthStart) { len = TICK_L1; width = TICK_W1; color = FG }
    else if (isDecade) { len = TICK_L2; width = TICK_W2; color = isWeekend ? ACCENT : MUTED }
    else { len = TICK_L3; width = TICK_W3; color = isWeekend ? ACCENT : DIM }
    const outer = polarToXY(CX, CY, INNER_R, angle)
    const inner = polarToXY(CX, CY, INNER_R - len, angle)
    ticks.push(
      <line key={`tick-${d}`} x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y}
        stroke={color} strokeWidth={width} strokeLinecap="butt" />
    )
  }

  // ── Today marker ──
  const todayAngle = ((todayDoy - 1) / totalDays) * 360
  const todayPos = polarToXY(CX, CY, INNER_R + 5, todayAngle)

  // ── Month labels — dominant clock-face numbers, beveled relief ──
  const MONTH_FONT_SIZE = 40
  const MONTH_R = LABEL_R - 18  // generous clearance from tick marks
  const monthLabels = angles.map((a, i) => {
    const pos = polarToXY(CX, CY, MONTH_R, a)
    const num = i + 1
    // Past / current / future month dimming
    const isPast = num < month
    const isCurrent = num === month
    const baseOp = isPast ? 0.22 : isCurrent ? 0.75 : 0.65
    const shadowOp = isPast ? 0.2 : isCurrent ? 0.7 : 0.6
    const highlightOp = isPast ? 0.06 : isCurrent ? 0.25 : 0.2

    const commonProps = {
      x: pos.x,
      y: pos.y,
      fontSize: MONTH_FONT_SIZE,
      fontFamily: FONT_DIAL,
      fontWeight: '600' as const,
      textAnchor: 'middle' as const,
      dominantBaseline: 'central' as const,
      letterSpacing: num >= 10 ? '-1.5' : '0',
    }
    return (
      <g key={`month-${num}`}
        transform={`translate(${pos.x}, ${pos.y}) scale(1.1, 0.88) translate(${-pos.x}, ${-pos.y})`}>
        {/* Shadow layer: depth behind the relief */}
        <text {...commonProps}
          fill="#000000" opacity={shadowOp}
          filter="url(#dial-bevel)"
        >{num}</text>
        {/* Base: the number itself */}
        <text {...commonProps}
          fill={FG} opacity={baseOp}
        >{num}</text>
        {/* Highlight: light catching the bottom-right relief edge */}
        <text {...commonProps}
          fill="#ffffff" opacity={highlightOp}
          filter="url(#dial-highlight)"
        >{num}</text>
      </g>
    )
  })

  // ── Center display: 5-layer layout ──
  const LAYER_H = 224 / 5  // ~45px per layer

  // Layer 1 & 2: year windows + date windows, tightly spaced
  const WIN_H = 28
  const WIN_GAP = 6
  // Year windows: 4 cells for digits
  const YWIN_W = 40       // slightly narrower than date windows
  const YWIN_TOTAL = YWIN_W * 4 + WIN_GAP * 3
  const YWIN_X0 = CX - YWIN_TOTAL / 2
  // Date windows: 3 cells
  const WIN_W = 55
  const WIN_TOTAL = WIN_W * 3 + WIN_GAP * 2
  const WIN_X0 = CX - WIN_TOTAL / 2

  // Position layers: L1 and L2 close together, L3 centered
  const L1_Y = CY - 68     // year windows center
  const L2_Y = L1_Y + WIN_H + WIN_GAP  // date windows right below (gap = same as cell gap)
  const L3_Y = CY + 10     // time display — lower center

  // Layer 4-5: sub-display area
  const SUB_TOP = L3_Y + 22     // below time display
  const SUB_BOTTOM = CY + 105   // near bottom of guide circle, can exceed
  const SUB_H = SUB_BOTTOM - SUB_TOP
  const SUB_W = WIN_TOTAL       // same width as date windows (177px)
  const SUB_X = CX - SUB_W / 2
  const SUB_PAGES = 3           // number of info pages
  const DOT_Y = SUB_BOTTOM + 8  // page dots below sub-display

  // Ghost text for 7-seg
  const seg7Ghost = timeFormat === 'HH:MM:SS' ? '88:88:88' : '88:88'
  const yearDigits = String(year).split('')  // ['2','0','2','6']
  const monthAbbr = MONTH_ABBR[dateSource.getMonth()]
  const dayNum = String(dateSource.getDate())
  const dowAbbr = DAY_ABBR[dateSource.getDay()]

  return (
    <div className="flex items-center justify-center w-full h-full">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full h-full max-w-[min(90vw,90vh)] max-h-[min(90vw,90vh)]"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <path id="time-arc" d={timeArcD} fill="none" />
          {/* Inner bevel filter for engraved text */}
          <filter id="engrave-bevel" x="-30%" y="-30%" width="160%" height="160%">
            {/* Shadow on top-left: light blocked by groove wall */}
            <feOffset in="SourceAlpha" dx={-0.5} dy={-0.5} result="shadowOff" />
            <feGaussianBlur in="shadowOff" stdDeviation="0.4" result="shadowBlur" />
            {/* Highlight on bottom-right: light hitting groove floor edge */}
            <feOffset in="SourceAlpha" dx={0.4} dy={0.4} result="lightOff" />
            <feGaussianBlur in="lightOff" stdDeviation="0.3" result="lightBlur" />
            {/* Combine: dark shadow + light highlight + original shape */}
            <feMerge>
              <feMergeNode in="shadowBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Separate highlight filter composited after */}
          <filter id="engrave-light" x="-30%" y="-30%" width="160%" height="160%">
            <feOffset in="SourceAlpha" dx={0.5} dy={0.5} result="lightOff" />
            <feGaussianBlur in="lightOff" stdDeviation="0.3" result="lightBlur" />
            <feFlood floodColor="#ffffff" floodOpacity="0.3" result="white" />
            <feComposite in="white" in2="lightBlur" operator="in" result="lightShape" />
            <feMerge>
              <feMergeNode in="lightShape" />
            </feMerge>
          </filter>
          {/* Large bevel filter for dial numbers (month labels) */}
          <filter id="dial-bevel" x="-10%" y="-10%" width="120%" height="120%">
            {/* Shadow: top-left offset, dark */}
            <feOffset in="SourceAlpha" dx={-1.2} dy={-1.2} result="shadowOff" />
            <feGaussianBlur in="shadowOff" stdDeviation="1.0" result="shadowBlur" />
            <feMerge>
              <feMergeNode in="shadowBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="dial-highlight" x="-10%" y="-10%" width="120%" height="120%">
            {/* Highlight: bottom-right offset, white */}
            <feOffset in="SourceAlpha" dx={1.0} dy={1.0} result="lightOff" />
            <feGaussianBlur in="lightOff" stdDeviation="0.8" result="lightBlur" />
            <feFlood floodColor="#ffffff" floodOpacity="0.4" result="white" />
            <feComposite in="white" in2="lightBlur" operator="in" result="lightShape" />
            <feMerge>
              <feMergeNode in="lightShape" />
            </feMerge>
          </filter>
          {/* DEBUG: test background for translucency check */}
          <radialGradient id="dbg-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2a1a0a" />
            <stop offset="50%" stopColor="#0a1a2a" />
            <stop offset="100%" stopColor="#1a0a1a" />
          </radialGradient>
        </defs>

        {/* DEBUG: background pattern to verify translucency — offset to left */}
        <rect x={-150} y="0" width={SIZE} height={SIZE} fill="url(#dbg-bg)" />
        {Array.from({ length: 8 }, (_, i) => (
          <circle key={`dbg-${i}`} cx={CX - 150} cy={CY} r={40 + i * 40}
            fill="none" stroke="#ffffff" strokeWidth={0.5} opacity={0.06} />
        ))}

        {/* Outer ring: monochrome baguette-cut cells */}
        {outerCells}

        {/* Spectrum analyzer band */}
        {specLines}

        {/* Sunrise marker ▲ + time */}
        <text
          x={sunriseMarkerPos.x} y={sunriseMarkerPos.y}
          fill={ACCENT} opacity={0.7} fontSize="8"
          fontFamily={FONT_SANS} textAnchor="middle" dominantBaseline="central"
          transform={`rotate(${sunriseAngle}, ${sunriseMarkerPos.x}, ${sunriseMarkerPos.y})`}
        >▲</text>
        <text
          x={sunriseTextPos.x} y={sunriseTextPos.y}
          fill={ACCENT} opacity={0.6} fontSize="8"
          fontFamily={FONT_MONO} fontWeight="400" textAnchor="middle" dominantBaseline="central"
          transform={`rotate(${sunriseAngle + SOLAR_MARKER_OFFSET}, ${sunriseTextPos.x}, ${sunriseTextPos.y})`}
        >{sunriseTimeStr}</text>

        {/* Sunset marker ▼ + time */}
        <text
          x={sunsetMarkerPos.x} y={sunsetMarkerPos.y}
          fill={ACCENT_NIGHT} opacity={0.7} fontSize="8"
          fontFamily={FONT_SANS} textAnchor="middle" dominantBaseline="central"
          transform={`rotate(${sunsetAngle}, ${sunsetMarkerPos.x}, ${sunsetMarkerPos.y})`}
        >▼</text>
        <text
          x={sunsetTextPos.x} y={sunsetTextPos.y}
          fill={ACCENT_NIGHT} opacity={0.6} fontSize="8"
          fontFamily={FONT_MONO} fontWeight="400" textAnchor="middle" dominantBaseline="central"
          transform={`rotate(${sunsetAngle + SOLAR_MARKER_OFFSET}, ${sunsetTextPos.x}, ${sunsetTextPos.y})`}
        >{sunsetTimeStr}</text>

        {/* Time text zabuton */}
        {needsZabuton && (
          <rect x={zabutonPos.x - 28} y={zabutonPos.y - 7} width={56} height={14}
            rx={2.5} ry={2.5} fill={BG}
            transform={`rotate(${zabutonAngle}, ${zabutonPos.x}, ${zabutonPos.y})`} />
        )}

        {/* Time text curved along spectrum arc — color follows day/night */}
        <text fontSize="10" fontFamily={FONT_MONO} fontWeight="400"
          fill={isDaytime(dayAngle) ? ACCENT : ACCENT_NIGHT}
          opacity={0.85} letterSpacing="1">
          <textPath href="#time-arc" startOffset={!needsFlipText ? '0%' : '100%'} textAnchor={!needsFlipText ? 'start' : 'end'}>
            {timeStr}
          </textPath>
        </text>

        {/* Inner ring ticks */}
        {ticks}

        {/* Today marker */}
        <circle cx={todayPos.x} cy={todayPos.y} r={2.5} fill={ACCENT} />

        {/* Month labels (numbers 1-12) */}
        {monthLabels}

        {/* Year progress needle */}
        <line x1={CX} y1={CY} x2={CX} y2={CY - HAND_LEN}
          stroke={FG} strokeWidth={1.8} strokeLinecap="round"
          style={{ transition: TRANSITION, transform: `rotate(${yearAngle}deg)`, transformOrigin: `${CX}px ${CY}px` }}
        />

        {/* Center pivot — breathing animation */}
        <circle cx={CX} cy={CY} r={2.5} fill={FG} opacity={0.5}>
          {!overrideDate && (
            <animate attributeName="opacity" values="0.3;0.6;0.3" dur="5s" repeatCount="indefinite" />
          )}
        </circle>
        <circle cx={CX} cy={CY} r={1} fill={BG} />

        {/* ── Center display boundary guide ── */}
        <circle cx={CX} cy={CY} r={112} fill="none" stroke="#ffffff" strokeWidth={0.5} opacity={0.15} strokeDasharray="3 3" />

        {/* ══════ Layer 1: Year — 4 windowed digits ══════ */}
        {yearDigits.map((digit, idx) => {
          const wx = YWIN_X0 + idx * (YWIN_W + WIN_GAP)
          const wy = L1_Y - WIN_H / 2
          return (
            <g key={`ywin-${idx}`}>
              <rect x={wx} y={wy} width={YWIN_W} height={WIN_H} rx={2}
                fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} />
              <rect x={wx} y={wy} width={YWIN_W} height={WIN_H} rx={2}
                fill="url(#cyclops-lens)" />
              <text x={wx + YWIN_W / 2} y={L1_Y + 1}
                fill={FG} opacity={0.7} fontSize="18" fontFamily={FONT_DIAL}
                fontWeight="700" textAnchor="middle" dominantBaseline="central"
              >{digit}</text>
            </g>
          )
        })}

        {/* ══════ Layer 2: Date sub-windows ══════ */}
        <defs>
          <radialGradient id="cyclops-lens" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        {[
          { label: monthAbbr, idx: 0 },
          { label: dayNum, idx: 1 },
          { label: dowAbbr, idx: 2 },
        ].map(({ label, idx }) => {
          const wx = WIN_X0 + idx * (WIN_W + WIN_GAP)
          const wy = L2_Y - WIN_H / 2
          return (
            <g key={`win-${idx}`}>
              {/* Window frame */}
              <rect x={wx} y={wy} width={WIN_W} height={WIN_H} rx={2}
                fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth={0.5} />
              {/* Cyclops lens effect */}
              <rect x={wx} y={wy} width={WIN_W} height={WIN_H} rx={2}
                fill="url(#cyclops-lens)" />
              {/* Text */}
              <text x={wx + WIN_W / 2} y={L2_Y + 1}
                fill={FG} opacity={0.7} fontSize="14" fontFamily={FONT_SANS}
                fontWeight="600" textAnchor="middle" dominantBaseline="central"
                letterSpacing="0.5"
              >{label}</text>
            </g>
          )
        })}

        {/* ══════ Layer 3: Time — large, wide ══════ */}
        {hourFormat === '12h' ? (
          <>
            {/* AM/PM indicator — left side */}
            <text x={CX - 70} y={L3_Y - 7}
              fill={FG} opacity={isAM ? 0.6 : 0.15} fontSize="8"
              fontFamily={FONT_SANS} fontWeight="700" textAnchor="end" dominantBaseline="central"
              letterSpacing="0.5"
            >AM</text>
            <text x={CX - 70} y={L3_Y + 7}
              fill={FG} opacity={!isAM ? 0.6 : 0.15} fontSize="8"
              fontFamily={FONT_SANS} fontWeight="700" textAnchor="end" dominantBaseline="central"
              letterSpacing="0.5"
            >PM</text>
            {/* Time ghost */}
            <g transform={`translate(${CX + 8}, ${L3_Y}) scale(1.15, 1) translate(${-(CX + 8)}, ${-L3_Y})`}>
              <text x={CX + 8} y={L3_Y} fill={FG} opacity={0.04}
                fontSize="28" fontFamily={FONT_7SEG} textAnchor="middle" dominantBaseline="central"
              >{seg7Ghost}</text>
              <text x={CX + 8} y={L3_Y} fill={FG} opacity={0.7}
                fontSize="28" fontFamily={FONT_7SEG} textAnchor="middle" dominantBaseline="central"
              >{timeStr}</text>
            </g>
          </>
        ) : (
          <>
            {/* 24h: Time — horizontally stretched */}
            <g transform={`translate(${CX}, ${L3_Y}) scale(1.15, 1) translate(${-CX}, ${-L3_Y})`}>
              <text x={CX} y={L3_Y} fill={FG} opacity={0.04}
                fontSize="28" fontFamily={FONT_7SEG} textAnchor="middle" dominantBaseline="central"
              >{seg7Ghost}</text>
              <text x={CX} y={L3_Y} fill={FG} opacity={0.7}
                fontSize="28" fontFamily={FONT_7SEG} textAnchor="middle" dominantBaseline="central"
              >{timeStr}</text>
            </g>
          </>
        )}

        {/* ══════ Layer 4-5: Sub-display ══════ */}
        <rect x={SUB_X} y={SUB_TOP} width={SUB_W} height={SUB_H} rx={3}
          fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />
        <rect x={SUB_X} y={SUB_TOP} width={SUB_W} height={SUB_H} rx={3}
          fill="url(#cyclops-lens)" />

        {/* Sub-display content placeholder */}
        <text x={CX} y={SUB_TOP + SUB_H / 2}
          fill={DIM} opacity={0.3} fontSize="9" fontFamily={FONT_SANS}
          fontWeight="400" textAnchor="middle" dominantBaseline="central"
          letterSpacing="1"
        >{subPage === 0 ? 'LOCATION · SUNRISE · SUNSET' : subPage === 1 ? 'TEMPERATURE · HIGH · LOW' : 'WEATHER'}</text>

        {/* Page indicator dots */}
        {Array.from({ length: SUB_PAGES }, (_, i) => (
          <circle key={`dot-${i}`}
            cx={CX + (i - 1) * 8} cy={DOT_Y} r={1.5}
            fill={FG} opacity={i === subPage ? 0.5 : 0.12}
            style={{ transition: 'opacity 0.3s ease' }}
          />
        ))}
      </svg>
    </div>
  )
}
