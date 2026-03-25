import { useState, useEffect, useCallback } from 'react'
import { api, DiaryEntry } from '../lib/api'

const YEARS = [2026, 2027, 2028, 2029, 2030]
const MOODS = ['😊', '😌', '😔', '😤', '😴', '🥰', '😰', '🤩']
const WEATHERS = ['☀️', '⛅', '🌧️', '❄️', '🌪️', '🌈', '🌫️']

function toMMDD(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${m}-${day}`
}

function formatDate(mmdd: string) {
  const [m, d] = mmdd.split('-')
  return `${parseInt(m)}月${parseInt(d)}日`
}

export default function FiveYearDiary() {
  const today = new Date()
  const currentYear = today.getFullYear()
  const [selectedDate, setSelectedDate] = useState(toMMDD(today))
  const [entries, setEntries] = useState<Record<number, DiaryEntry>>({})
  const [editing, setEditing] = useState<Record<number, { content: string; wish_content: string; mood: string; weather: string }>>({})
  const [saving, setSaving] = useState<number | null>(null)
  const [stats, setStats] = useState<{ total_entries: number; current_year_days: number; recent: { date: string; year: number; preview: string }[] } | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [calendarYear, setCalendarYear] = useState(currentYear)
  const [calendarDates, setCalendarDates] = useState<string[]>([])
  const [calendarMonth, setCalendarMonth] = useState(today.getMonth()) // 0-based

  const loadEntries = useCallback(async (date: string) => {
    try {
      const rows = await api.diary.getEntries(date)
      const map: Record<number, DiaryEntry> = {}
      rows.forEach(e => { map[e.year] = e })
      setEntries(map)
      // init edit state from loaded data
      const edMap: Record<number, { content: string; wish_content: string; mood: string; weather: string }> = {}
      YEARS.forEach(y => {
        edMap[y] = {
          content: map[y]?.content ?? '',
          wish_content: map[y]?.wish_content ?? '',
          mood: map[y]?.mood ?? '',
          weather: map[y]?.weather ?? '',
        }
      })
      setEditing(edMap)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadEntries(selectedDate) }, [selectedDate, loadEntries])

  useEffect(() => {
    api.diary.getStats().then(setStats).catch(() => {})
  }, [])

  useEffect(() => {
    if (!calendarOpen) return
    api.diary.getCalendar(calendarYear).then(setCalendarDates).catch(() => {})
  }, [calendarOpen, calendarYear])

  const handleSave = async (year: number) => {
    const data = editing[year]
    if (!data) return
    setSaving(year)
    try {
      await api.diary.saveEntry({ date: selectedDate, year, ...data })
      await loadEntries(selectedDate)
      const s = await api.diary.getStats()
      setStats(s)
    } finally {
      setSaving(null)
    }
  }

  const isFuture = (year: number) => year > currentYear
  const isPast = (year: number) => year < currentYear

  // Navigate dates
  const changeDate = (delta: number) => {
    const [m, d] = selectedDate.split('-').map(Number)
    const dt = new Date(currentYear, m - 1, d + delta)
    setSelectedDate(toMMDD(dt))
  }

  // Calendar grid for a given month
  const buildCalendarMonth = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells: (number | null)[] = Array(firstDay).fill(null)
    for (let i = 1; i <= daysInMonth; i++) cells.push(i)
    return cells
  }

  const selectFromCalendar = (day: number) => {
    const mmdd = `${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    setSelectedDate(mmdd)
    setCalendarOpen(false)
  }

  const calendarCells = buildCalendarMonth(calendarYear, calendarMonth)
  const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">📓 五年日记</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">同一天，五年的故事</p>
        </div>
        <button
          onClick={() => { setCalendarOpen(true); setCalendarMonth(today.getMonth()) }}
          className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          📅 选择日期
        </button>
      </div>

      {/* Stats Banner */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700 text-center">
            <div className="text-2xl font-bold text-primary">{stats.current_year_days}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{currentYear} 年已记 {currentYear - 2026 === 0 ? '' : ''}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700 text-center">
            <div className="text-2xl font-bold text-amber-500">{stats.total_entries}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">五年总记录</div>
          </div>
        </div>
      )}

      {/* Date Navigator */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 flex items-center justify-between">
        <button onClick={() => changeDate(-1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors">‹</button>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{formatDate(selectedDate)}</div>
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">点击右上角选择任意日期</div>
        </div>
        <button onClick={() => changeDate(1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors">›</button>
      </div>

      {/* Year Cards */}
      <div className="space-y-4">
        {YEARS.map(year => {
          const entry = entries[year]
          const ed = editing[year] ?? { content: '', wish_content: '', mood: '', weather: '' }
          const isCur = year === currentYear
          const hasPrevWish = isCur && entry?.wish_content

          return (
            <div key={year}
              className={`bg-white dark:bg-gray-800 rounded-xl border-2 transition-colors ${
                isCur ? 'border-primary shadow-sm' : 'border-gray-100 dark:border-gray-700'
              }`}
            >
              {/* Card Header */}
              <div className={`flex items-center justify-between px-4 py-3 rounded-t-xl ${
                isCur ? 'bg-red-50 dark:bg-blue-950/30' : isPast(year) ? 'bg-gray-50 dark:bg-gray-750' : 'bg-amber-50 dark:bg-amber-950/20'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-700 dark:text-gray-200">{year} 年</span>
                  {isCur && <span className="text-xs bg-primary text-white px-2 py-0.5 rounded-full">今年</span>}
                  {isPast(year) && <span className="text-xs bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">往年</span>}
                  {isFuture(year) && <span className="text-xs bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-200 px-2 py-0.5 rounded-full">未来</span>}
                </div>
                {/* Mood + Weather */}
                <div className="flex items-center gap-1">
                  {(isCur || isPast(year)) && (
                    <>
                      <select
                        value={ed.mood}
                        onChange={e => setEditing(prev => ({ ...prev, [year]: { ...prev[year], mood: e.target.value } }))}
                        className="text-sm bg-transparent border-none outline-none cursor-pointer"
                      >
                        <option value="">心情</option>
                        {MOODS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <select
                        value={ed.weather}
                        onChange={e => setEditing(prev => ({ ...prev, [year]: { ...prev[year], weather: e.target.value } }))}
                        className="text-sm bg-transparent border-none outline-none cursor-pointer"
                      >
                        <option value="">天气</option>
                        {WEATHERS.map(w => <option key={w} value={w}>{w}</option>)}
                      </select>
                    </>
                  )}
                </div>
              </div>

              <div className="p-4 space-y-3">
                {/* If current year AND has previous wish — show yellow block */}
                {hasPrevWish && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-lg px-4 py-3">
                    <div className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">✨ 过去的你的心愿</div>
                    <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed whitespace-pre-wrap">{entry.wish_content}</p>
                  </div>
                )}

                {/* Future year — wish textarea */}
                {isFuture(year) && (
                  <div>
                    <label className="text-xs text-amber-600 dark:text-amber-400 font-medium block mb-1">
                      💭 写下你对 {year} 年这一天的期许…
                    </label>
                    <textarea
                      value={ed.wish_content}
                      onChange={e => setEditing(prev => ({ ...prev, [year]: { ...prev[year], wish_content: e.target.value } }))}
                      rows={3}
                      placeholder={`希望 ${year} 年的今天，我正在…`}
                      className="w-full text-sm border border-amber-200 dark:border-amber-700 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-amber-400 bg-amber-50/50 dark:bg-amber-950/20 text-gray-700 dark:text-gray-200 placeholder-amber-300 dark:placeholder-amber-700"
                    />
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={() => handleSave(year)}
                        disabled={saving === year}
                        className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 disabled:opacity-40 transition-colors"
                      >
                        {saving === year ? '保存中…' : '保存心愿'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Current and past years — content textarea */}
                {(isCur || isPast(year)) && (
                  <div>
                    <textarea
                      value={ed.content}
                      onChange={e => setEditing(prev => ({ ...prev, [year]: { ...prev[year], content: e.target.value } }))}
                      rows={4}
                      placeholder={isPast(year) ? `记录 ${year} 年这一天发生了什么…` : '记录今天发生了什么…'}
                      className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-primary bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-600"
                    />
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={() => handleSave(year)}
                        disabled={saving === year}
                        className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-40 transition-colors"
                      >
                        {saving === year ? '保存中…' : '保存'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Empty state for future years with no wish */}
                {isFuture(year) && !ed.wish_content && !entry?.wish_content && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-1">还没有许下心愿</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Recent Entries */}
      {stats && stats.recent.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">🕐 最近记录</h3>
          <div className="space-y-2">
            {stats.recent.map((r, i) => (
              <button
                key={i}
                onClick={() => setSelectedDate(r.date)}
                className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <span className="text-xs font-medium text-primary w-20 flex-shrink-0">{formatDate(r.date)} · {r.year}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{r.preview}…</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Calendar Modal */}
      {calendarOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setCalendarOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 w-full max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
            {/* Month nav */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => {
                if (calendarMonth === 0) { setCalendarMonth(11); setCalendarYear(y => y - 1) }
                else setCalendarMonth(m => m - 1)
              }} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">‹</button>
              <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{calendarYear}年 {MONTH_NAMES[calendarMonth]}</span>
              <button onClick={() => {
                if (calendarMonth === 11) { setCalendarMonth(0); setCalendarYear(y => y + 1) }
                else setCalendarMonth(m => m + 1)
              }} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">›</button>
            </div>
            {/* Year tabs */}
            <div className="flex gap-1 mb-3">
              {YEARS.map(y => (
                <button key={y} onClick={() => setCalendarYear(y)}
                  className={`flex-1 text-xs py-1 rounded-lg transition-colors ${calendarYear === y ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                  {y}
                </button>
              ))}
            </div>
            {/* Day grid */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['日', '一', '二', '三', '四', '五', '六'].map(d => (
                <div key={d} className="text-center text-xs text-gray-400 dark:text-gray-500 py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {calendarCells.map((day, i) => {
                if (day === null) return <div key={i} />
                const mmdd = `${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const hasEntry = calendarDates.includes(mmdd)
                const isSelected = mmdd === selectedDate
                return (
                  <button key={i} onClick={() => selectFromCalendar(day)}
                    className={`text-xs py-1.5 rounded-lg transition-colors relative ${
                      isSelected ? 'bg-primary text-white font-bold' :
                      hasEntry ? 'bg-red-50 dark:bg-blue-950/30 text-primary font-medium' :
                      'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}>
                    {day}
                    {hasEntry && !isSelected && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />}
                  </button>
                )
              })}
            </div>
            <button onClick={() => setCalendarOpen(false)} className="mt-4 w-full text-xs text-gray-400 dark:text-gray-500 py-2 hover:text-gray-600 dark:hover:text-gray-300">关闭</button>
          </div>
        </div>
      )}
    </div>
  )
}
