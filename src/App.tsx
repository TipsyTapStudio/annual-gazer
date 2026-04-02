import { useState, useEffect, useCallback, useRef } from 'react'
import AnnualGauge from './components/AnnualGauge'
import type { TimeFormat, SpectrumDensity } from './components/AnnualGauge'
import GearIcon from './components/GearIcon'
import SettingsPanel from './components/SettingsPanel'
import { usePersistedState } from './hooks/usePersistedState'
import { DEFAULT_LOCATION } from './utils/solarUtils'
import type { Location } from './utils/solarUtils'

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

  // Persisted settings
  const [startMonth, setStartMonth] = usePersistedState('ag-startMonth', 1)
  const [timeFormat, setTimeFormat] = usePersistedState<TimeFormat>('ag-timeFormat', 'HH:MM:SS')
  const [spectrumDensity, setSpectrumDensity] = usePersistedState<SpectrumDensity>('ag-spectrumDensity', 288)
  const [location, setLocation] = usePersistedState<Location>('ag-location', DEFAULT_LOCATION)

  // Debug (not persisted)
  const [debugMode, setDebugMode] = useState(false)
  const [debugDate, setDebugDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [debugTime, setDebugTime] = useState('')

  // Gear icon visibility
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

  // Geolocation: auto-detect on first visit (if no saved location)
  const [geoRequested, setGeoRequested] = usePersistedState('ag-geoRequested', false)
  useEffect(() => {
    if (geoRequested) return
    if (!navigator.geolocation) return
    setGeoRequested(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: Math.round(pos.coords.latitude * 100) / 100,
          lng: Math.round(pos.coords.longitude * 100) / 100,
          name: `${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)}`,
        })
      },
      () => { /* user denied or error — keep default */ },
      { timeout: 5000 }
    )
  }, [geoRequested, setGeoRequested, setLocation])

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
    location,
    onLocationChange: setLocation,
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
          location={location}
        />
      </div>

      {isDesktop ? (
        <div
          className="h-full shrink-0 transition-[width] duration-300 ease-in-out overflow-hidden"
          style={{ width: settingsOpen ? '300px' : '0px' }}
        >
          <SettingsPanel variant="desktop" {...panelProps} />
        </div>
      ) : (
        <SettingsPanel variant="mobile" {...panelProps} />
      )}

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

      {debugMode && (
        <div className="fixed top-6 right-16 z-[60] text-[9px] tracking-[2px] uppercase text-white/40">
          DEBUG
        </div>
      )}
    </div>
  )
}

export default App
