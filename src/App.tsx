import { useState, useEffect, useCallback, useRef } from 'react'
import AnnualGauge from './components/AnnualGauge'
import type { TimeFormat, SpectrumDensity } from './components/AnnualGauge'
import GearIcon from './components/GearIcon'
import SettingsPanel from './components/SettingsPanel'

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])
  return matches
}

function App() {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [startMonth, setStartMonth] = useState(1)
  const [timeFormat, setTimeFormat] = useState<TimeFormat>('HH:MM:SS')
  const [spectrumDensity, setSpectrumDensity] = useState<SpectrumDensity>(288)
  const [debugMode, setDebugMode] = useState(false)
  const [debugDate, setDebugDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [debugTime, setDebugTime] = useState('')
  const [gearVisible, setGearVisible] = useState(false)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseMove = useCallback(() => {
    setGearVisible(true)
    if (idleTimer.current) clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => setGearVisible(false), 3000)
  }, [])

  useEffect(() => {
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current) }
  }, [])

  let overrideDate: Date | null = null
  let overrideDateOnly: Date | null = null

  if (debugMode && debugDate) {
    if (debugTime) {
      overrideDate = new Date(`${debugDate}T${debugTime}:00`)
    } else {
      overrideDateOnly = new Date(`${debugDate}T12:00:00`)
    }
  }

  const handleDebugModeChange = (on: boolean) => {
    setDebugMode(on)
    if (!on) {
      setDebugDate('')
      setDebugTime('')
    }
  }

  const panelProps = {
    isOpen: settingsOpen,
    onClose: () => setSettingsOpen(false),
    startMonth,
    onStartMonthChange: setStartMonth,
    timeFormat,
    onTimeFormatChange: setTimeFormat,
    spectrumDensity,
    onSpectrumDensityChange: setSpectrumDensity,
    debugMode,
    onDebugModeChange: handleDebugModeChange,
    debugDate,
    onDebugDateChange: setDebugDate,
    debugTime,
    onDebugTimeChange: setDebugTime,
  }

  return (
    <div
      className="w-full h-screen bg-bg flex overflow-hidden"
      onMouseMove={handleMouseMove}
    >
      {/* Main gauge area */}
      <div className="flex-1 flex items-center justify-center min-w-0 transition-all duration-300">
        <AnnualGauge
          overrideDate={overrideDate}
          overrideDateOnly={overrideDateOnly}
          timeFormat={timeFormat}
          spectrumDensity={spectrumDensity}
        />
      </div>

      {isDesktop ? (
        /* Desktop: flex sibling that pushes gauge left */
        <div
          className="h-full shrink-0 transition-[width] duration-300 ease-in-out overflow-hidden"
          style={{ width: settingsOpen ? '300px' : '0px' }}
        >
          <SettingsPanel variant="desktop" {...panelProps} />
        </div>
      ) : (
        /* Mobile: full-screen overlay */
        <SettingsPanel variant="mobile" {...panelProps} />
      )}

      {/* Gear button — hidden when panel is open */}
      {!settingsOpen && (
        <button
          onClick={() => setSettingsOpen(true)}
          className="fixed top-5 right-5 z-[60] p-2 transition-opacity duration-500 cursor-pointer"
          style={{ opacity: gearVisible ? 0.6 : 0.2 }}
          onMouseEnter={() => setGearVisible(true)}
        >
          <GearIcon className="text-white/70" />
        </button>
      )}

      {/* DEBUG badge */}
      {debugMode && (
        <div className="fixed top-6 right-16 z-[60] text-[9px] tracking-[2px] uppercase text-white/40">
          DEBUG
        </div>
      )}
    </div>
  )
}

export default App
