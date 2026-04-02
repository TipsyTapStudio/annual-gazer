import type { TimeFormat, SpectrumDensity } from './AnnualGauge'

interface SettingsPanelProps {
  variant: 'desktop' | 'mobile'
  isOpen: boolean
  onClose: () => void
  startMonth: number
  onStartMonthChange: (m: number) => void
  timeFormat: TimeFormat
  onTimeFormatChange: (f: TimeFormat) => void
  spectrumDensity: SpectrumDensity
  onSpectrumDensityChange: (d: SpectrumDensity) => void
  debugMode: boolean
  onDebugModeChange: (on: boolean) => void
  debugDate: string
  onDebugDateChange: (d: string) => void
  debugTime: string
  onDebugTimeChange: (t: string) => void
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const sectionLine = 'border-t border-white/[0.08] mt-6 pt-4'
const sectionTitle = 'text-[10px] tracking-[3px] uppercase text-white/30 mb-4'
const labelStyle = 'text-[11px] text-white/50 mb-1.5'
const selectStyle = [
  'w-full bg-white/[0.06] border border-white/[0.08] rounded px-2.5 py-1.5',
  'text-[12px] text-white/70 outline-none',
  'focus:border-white/20',
  'appearance-none cursor-pointer',
].join(' ')
const radioLabel = 'flex items-center gap-2 text-[12px] text-white/60 cursor-pointer py-0.5'
const radioInput = 'accent-[#c0785a] w-3 h-3'
const disabledBadge = 'ml-1.5 text-[9px] tracking-[1px] text-white/20 uppercase'

export default function SettingsPanel({
  variant,
  isOpen,
  onClose,
  startMonth,
  onStartMonthChange,
  timeFormat,
  onTimeFormatChange,
  spectrumDensity,
  onSpectrumDensityChange,
  debugMode,
  onDebugModeChange,
  debugDate,
  onDebugDateChange,
  debugTime,
  onDebugTimeChange,
}: SettingsPanelProps) {
  const isDesktop = variant === 'desktop'

  // Desktop: static inside flex container, always rendered at 300px (parent clips)
  // Mobile: fixed full-screen overlay with slide transition
  const containerClass = isDesktop
    ? 'w-[300px] h-full bg-[rgba(8,8,8,0.95)] border-l border-white/[0.06] flex flex-col'
    : [
        'fixed inset-0 z-50',
        'bg-[rgba(8,8,8,0.98)]',
        'flex flex-col',
        'transition-transform duration-300 ease-in-out',
        isOpen ? 'translate-x-0' : 'translate-x-full',
      ].join(' ')

  const content = (
    <div
      className={containerClass}
      style={{ fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <span className="text-[10px] tracking-[3px] uppercase text-white/30">
          Settings
        </span>
        <button
          onClick={onClose}
          className="text-white/30 hover:text-white/60 transition-opacity text-[18px] leading-none cursor-pointer"
        >
          ×
        </button>
      </div>

      {/* Content — scrollable */}
      <div className="flex-1 overflow-y-auto px-5 py-4">

        {/* ── SETTINGS ── */}
        <div>
          <div className={sectionTitle}>Settings</div>

          <div className="mb-4">
            <div className={labelStyle}>Start month</div>
            <select
              className={selectStyle}
              value={startMonth}
              onChange={(e) => onStartMonthChange(Number(e.target.value))}
            >
              {MONTHS.map((name, i) => (
                <option key={i} value={i + 1}>{name}</option>
              ))}
            </select>
          </div>

          <div className="mb-4 opacity-40">
            <div className={labelStyle}>
              Theme<span className={disabledBadge}>v2</span>
            </div>
            <select className={selectStyle} disabled value="dark">
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>

          <div className="mb-4 opacity-40">
            <div className={labelStyle}>
              Time display<span className={disabledBadge}>v2</span>
            </div>
            <select className={selectStyle} disabled value="24h">
              <option value="24h">24 hour</option>
              <option value="12h">12 hour AM/PM</option>
            </select>
          </div>

          <div className="mb-2">
            <div className={labelStyle}>Seconds display</div>
            <div className="flex flex-col gap-1">
              <label className={radioLabel}>
                <input
                  type="radio"
                  name={`timeFormat-${variant}`}
                  className={radioInput}
                  checked={timeFormat === 'HH:MM:SS'}
                  onChange={() => onTimeFormatChange('HH:MM:SS')}
                />
                HH:MM:SS
              </label>
              <label className={radioLabel}>
                <input
                  type="radio"
                  name={`timeFormat-${variant}`}
                  className={radioInput}
                  checked={timeFormat === 'HH:MM'}
                  onChange={() => onTimeFormatChange('HH:MM')}
                />
                HH:MM
              </label>
              <label className={radioLabel}>
                <input
                  type="radio"
                  name={`timeFormat-${variant}`}
                  className={radioInput}
                  checked={timeFormat === 'HH:MM:blink'}
                  onChange={() => onTimeFormatChange('HH:MM:blink')}
                />
                HH:MM (blink colon)
              </label>
            </div>
          </div>

          {/* Spectrum bar density */}
          <div className="mb-2">
            <div className={labelStyle}>Spectrum bars</div>
            <select
              className={selectStyle}
              value={spectrumDensity}
              onChange={(e) => onSpectrumDensityChange(Number(e.target.value) as SpectrumDensity)}
            >
              <option value={96}>96 (15 min)</option>
              <option value={144}>144 (10 min)</option>
              <option value={288}>288 (5 min)</option>
              <option value={480}>480 (3 min)</option>
              <option value={1440}>1440 (1 min)</option>
            </select>
          </div>
        </div>

        {/* ── DEBUG ── */}
        <div className={sectionLine}>
          <div className={sectionTitle}>Debug</div>

          <label className="flex items-center gap-2.5 cursor-pointer mb-3">
            <input
              type="checkbox"
              className="accent-[#c0785a] w-3.5 h-3.5 cursor-pointer"
              checked={debugMode}
              onChange={(e) => onDebugModeChange(e.target.checked)}
            />
            <span className="text-[12px] text-white/60">Debug mode</span>
          </label>

          {debugMode && (
            <div className="flex flex-col gap-3 pl-1">
              <div>
                <div className={labelStyle}>Date</div>
                <input
                  type="date"
                  className={selectStyle}
                  value={debugDate}
                  onChange={(e) => onDebugDateChange(e.target.value)}
                />
              </div>
              <div>
                <div className={labelStyle}>
                  Time<span className="text-white/20 text-[10px] ml-1.5">(empty = realtime)</span>
                </div>
                <input
                  type="time"
                  className={selectStyle}
                  value={debugTime}
                  onChange={(e) => onDebugTimeChange(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── ABOUT ── */}
        <div className={sectionLine}>
          <div className={sectionTitle}>About</div>
          <div className="text-[11px] text-white/40 leading-relaxed">
            <div className="text-white/60 text-[13px] tracking-[1px] mb-1">ANNUAL-GAZER</div>
            <div className="mb-0.5">Tipsy Tap Studio</div>
            <div className="mb-2">v0.1.0</div>
            <a
              href="https://github.com/TipsyTapStudio/annual-gazer"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#c0785a]/60 hover:text-[#c0785a]/90 transition-colors"
            >
              GitHub →
            </a>
          </div>
        </div>
      </div>
    </div>
  )

  return content
}
