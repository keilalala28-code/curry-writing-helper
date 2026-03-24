import { useState, useEffect, useCallback, useRef } from 'react'
import { api, type RoutineItem, type DayLog, type CalendarDay } from '../lib/api'

type View = 'today' | 'calendar'
type Category = 'morning' | 'afternoon' | 'evening'

const CATEGORY_CONFIG: Record<Category, { label: string; emoji: string; range: [number, number] }> = {
  morning:   { label: '晨间', emoji: '☀️', range: [0, 12] },
  afternoon: { label: '午间', emoji: '🌿', range: [12, 18] },
  evening:   { label: '晚间', emoji: '🌙', range: [18, 25] },
}

function timeToMinutes(t: string): number {
  if (!t) return -1
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function formatTime(t: string): string { return t || '' }

export default function DayPlan() {
  const [view, setView] = useState<View>('today')
  const [preset, setPreset] = useState<RoutineItem[]>([])
  const [logMap, setLogMap] = useState<Map<string, DayLog>>(new Map())
  const [notes, setNotes] = useState('')
  const [notesTimer, setNotesTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [today] = useState(todayStr())
  const [now, setNow] = useState(new Date())
  const [calYear, setCalYear] = useState(new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(new Date().getMonth() + 1)
  const [calDays, setCalDays] = useState<CalendarDay[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedDayData, setSelectedDayData] = useState<{ log: DayLog[]; notes: string } | null>(null)
  const [showPresetModal, setShowPresetModal] = useState(false)
  const [editingItem, setEditingItem] = useState<Partial<RoutineItem> | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [toast, setToast] = useState<{ title: string; desc: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const alerted = useRef<Set<string>>(new Set())

  const loadData = useCallback(async () => {
    try {
      const [items, logData] = await Promise.all([
        api.routine.getPreset(),
        api.routine.getLog(today),
      ])
      setPreset(items)
      const map = new Map<string, DayLog>()
      logData.log.forEach(l => map.set(l.item_id, l))
      setLogMap(map)
      setNotes(logData.notes)
    } finally {
      setLoading(false)
    }
  }, [today])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const check = () => {
      const nowMin = now.getHours() * 60 + now.getMinutes()
      preset.forEach(item => {
        if (!item.enabled || !item.reminder_minutes) return
        const itemMin = timeToMinutes(item.time_start)
        if (itemMin < 0) return
        const key = `${today}-${item.id}-${itemMin}`
        const diff = itemMin - nowMin
        if (diff >= 0 && diff <= item.reminder_minutes && !alerted.current.has(key)) {
          alerted.current.add(key)
          setToast({ title: item.title, desc: `${diff === 0 ? '现在开始' : `还有 ${diff} 分钟`} · ${item.time_start}` })
          setTimeout(() => setToast(null), 6000)
        }
      })
    }
    check()
    const t = setInterval(check, 60000)
    return () => clearInterval(t)
  }, [now, preset, today])

  useEffect(() => {
    if (view !== 'calendar') return
    api.routine.getCalendar(calYear, calMonth).then(d => setCalDays(d.days))
  }, [view, calYear, calMonth])

  useEffect(() => {
    if (!selectedDate) return
    api.routine.getLog(selectedDate).then(d => setSelectedDayData({ log: d.log, notes: d.notes }))
  }, [selectedDate])

  const toggleItem = async (itemId: string) => {
    const cur = logMap.get(itemId)
    const newCompleted = !(cur?.completed)
    await api.routine.toggleLog(today, itemId, newCompleted)
    setLogMap(m => {
      const nm = new Map(m)
      nm.set(itemId, { item_id: itemId, completed: newCompleted ? 1 : 0, completed_at: newCompleted ? Date.now()/1000 : null })
      return nm
    })
  }

  const saveNotes = (val: string) => {
    setNotes(val)
    if (notesTimer) clearTimeout(notesTimer)
    setNotesTimer(setTimeout(() => api.routine.updateNotes(today, val), 800))
  }

  const enabledPreset = preset.filter(p => p.enabled)
  const completedCount = enabledPreset.filter(p => logMap.get(p.id)?.completed).length
  const totalCount = enabledPreset.length
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  const nowMin = now.getHours() * 60 + now.getMinutes()
  const currentItem = enabledPreset.find(item => {
    const start = timeToMinutes(item.time_start)
    const end = item.time_end ? timeToMinutes(item.time_end) : start + 30
    return start <= nowMin && nowMin < end
  })
  const nextItem = enabledPreset.find(item => {
    const start = timeToMinutes(item.time_start)
    return start > nowMin
  })

  const categorized = (cat: Category) => enabledPreset.filter(item => item.category === cat)

  const itemStatus = (item: RoutineItem): 'done' | 'current' | 'upcoming' | 'pending' => {
    if (logMap.get(item.id)?.completed) return 'done'
    if (currentItem?.id === item.id) return 'current'
    const start = timeToMinutes(item.time_start)
    if (start < nowMin) return 'pending'
    return 'upcoming'
  }

  const calDayMap = new Map(calDays.map(d => [d.date, d]))

  function getDaysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate() }
  function getFirstDayOfWeek(y: number, m: number) { return new Date(y, m - 1, 1).getDay() }

  const MONTHS = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月']
  const todayFull = todayStr()

  const savePreset = async () => {
    if (!editingItem?.title || !editingItem?.time_start) return
    if (isEditing && editingItem.id) {
      await api.routine.updatePreset(editingItem.id, editingItem)
    } else {
      await api.routine.createPreset(editingItem)
    }
    setEditingItem(null)
    setIsEditing(false)
    loadData()
  }

  const deletePreset = async (id: string) => {
    if (!confirm('确认删除这条事项？')) return
    await api.routine.deletePreset(id)
    loadData()
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">加载中…</div>
  }

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-white dark:bg-gray-800 rounded-2xl px-5 py-4 shadow-2xl border-l-4 border-orange-500 max-w-xs">
          <div className="text-xs text-gray-400 mb-1">🔔 日程提醒</div>
          <div className="font-bold text-gray-800 dark:text-gray-100 text-sm">{toast.title}</div>
          <div className="text-xs text-gray-500 mt-1">{toast.desc}</div>
        </div>
      )}

      {/* Sub controls */}
      <div className="flex items-center gap-2">
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          {(['today', 'calendar'] as View[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${view === v ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
              {v === 'today' ? '今日' : '月历'}
            </button>
          ))}
        </div>
        <button onClick={() => setShowPresetModal(true)}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-orange-300 transition-colors">
          ✏️ 编辑预设
        </button>
      </div>

      {view === 'today' ? (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: '今日完成', value: `${completedCount}/${totalCount}`, color: 'text-orange-500' },
              { label: '完成率', value: `${pct}%`, color: pct >= 80 ? 'text-green-500' : pct >= 50 ? 'text-yellow-500' : 'text-red-400' },
              { label: '日期', value: today.slice(5).replace('-', '/'), color: 'text-gray-700 dark:text-gray-300' },
              { label: '下个提醒', value: nextItem ? nextItem.time_start : '–', color: 'text-blue-500' },
            ].map(s => (
              <div key={s.label} className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
                <div className="text-xs text-gray-400 mb-1">{s.label}</div>
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Progress */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">⏳ 今日进度</span>
              <span className="text-sm font-bold text-orange-500">{pct}% · 还剩 {totalCount - completedCount} 项</span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-orange-500 to-orange-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex gap-3 mt-3">
              {(Object.entries(CATEGORY_CONFIG) as [Category, typeof CATEGORY_CONFIG[Category]][]).map(([cat, cfg]) => {
                const items = categorized(cat)
                const done = items.filter(i => logMap.get(i.id)?.completed).length
                const colors: Record<Category, string> = {
                  morning: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                  afternoon: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                  evening: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                }
                return (
                  <span key={cat} className={`text-xs px-3 py-1 rounded-full font-medium ${colors[cat]}`}>
                    {cfg.emoji} {cfg.label} {done}/{items.length}
                  </span>
                )
              })}
            </div>
          </div>

          {/* Current Task Banner */}
          {(currentItem || nextItem) && (
            <div className="bg-gradient-to-r from-orange-500 to-orange-400 rounded-2xl p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 bg-white rounded-full opacity-90 animate-pulse" />
                <div>
                  <div className="text-xs opacity-80">{currentItem ? '📍 正在进行' : '⏭ 即将开始'}</div>
                  <div className="font-bold text-base">{(currentItem || nextItem)!.title}</div>
                  <div className="text-xs opacity-75">{(currentItem || nextItem)!.time_start}{(currentItem || nextItem)!.time_end ? ` – ${(currentItem || nextItem)!.time_end}` : ''}</div>
                </div>
              </div>
              {currentItem && nextItem && (
                <div className="text-right">
                  <div className="text-xs opacity-75">⏭ 下一项</div>
                  <div className="font-semibold text-sm">{nextItem.title}</div>
                  <div className="text-xs opacity-75">{nextItem.time_start}</div>
                </div>
              )}
            </div>
          )}

          {/* Timeline Sections */}
          {(Object.entries(CATEGORY_CONFIG) as [Category, typeof CATEGORY_CONFIG[Category]][]).map(([cat, cfg]) => {
            const items = categorized(cat)
            if (items.length === 0) return null
            const done = items.filter(i => logMap.get(i.id)?.completed).length
            const headerColors: Record<Category, string> = {
              morning: 'bg-amber-50 dark:bg-amber-900/20',
              afternoon: 'bg-green-50 dark:bg-green-900/20',
              evening: 'bg-purple-50 dark:bg-purple-900/20',
            }
            const badgeColors: Record<Category, string> = {
              morning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
              afternoon: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
              evening: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
            }
            return (
              <div key={cat} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className={`flex items-center gap-2 px-5 py-3 border-b border-gray-100 dark:border-gray-700 ${headerColors[cat]}`}>
                  <span className="text-lg">{cfg.emoji}</span>
                  <span className="font-bold text-gray-800 dark:text-gray-200">{cfg.label}事项</span>
                  <span className={`ml-auto text-xs px-2.5 py-0.5 rounded-full font-medium ${badgeColors[cat]}`}>{done}/{items.length} 已完成</span>
                </div>
                {items.map((item, idx) => {
                  const status = itemStatus(item)
                  const rowBg = status === 'upcoming' ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''
                  const dotColor = status === 'done' ? 'bg-green-500 border-green-500' : status === 'current' ? 'bg-orange-500 border-orange-500 shadow-[0_0_0_3px_rgba(249,115,22,0.25)]' : 'bg-white border-gray-300 dark:border-gray-600'
                  return (
                    <div key={item.id} className={`flex items-start border-b border-gray-50 dark:border-gray-700/50 last:border-0 ${rowBg} hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors`}>
                      <div className="w-24 px-5 pt-4 flex-shrink-0">
                        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 tabular-nums">{formatTime(item.time_start)}</div>
                        {item.time_end && <div className="text-xs text-gray-400 mt-0.5">~ {formatTime(item.time_end)}</div>}
                      </div>
                      <div className="flex flex-col items-center w-5 pt-[18px] flex-shrink-0">
                        <div className={`w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 ${dotColor}`} />
                        {idx < items.length - 1 && <div className="w-0.5 flex-1 bg-gray-100 dark:bg-gray-700 mt-1 min-h-[16px]" />}
                      </div>
                      <div className="flex-1 px-3 py-3">
                        <div className={`text-sm font-semibold flex items-center gap-2 ${status === 'done' ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>
                          {item.title}
                          {status === 'current' && <span className="text-xs bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 px-2 py-0.5 rounded-full font-medium no-underline">进行中</span>}
                          {item.reminder_minutes > 0 && <span className="text-xs bg-purple-50 text-purple-500 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-0.5 rounded-full no-underline">🔔 提前{item.reminder_minutes}分钟</span>}
                        </div>
                        {item.description && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{item.description}</div>}
                      </div>
                      <div className="w-12 flex items-center justify-center pt-3.5 flex-shrink-0">
                        <button onClick={() => toggleItem(item.id)}
                          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center text-xs transition-all ${
                            status === 'done' ? 'bg-green-500 border-green-500 text-white' : status === 'current' ? 'border-orange-400 hover:bg-orange-50' : 'border-gray-200 dark:border-gray-600 hover:border-gray-400'
                          }`}>
                          {status === 'done' && '✓'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* Notes */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700">
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">💡 今日优化记录</div>
            <textarea
              value={notes}
              onChange={e => saveNotes(e.target.value)}
              placeholder="记录执行过程中的优化提升事项…"
              rows={3}
              className="w-full text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 rounded-xl px-4 py-3 resize-none outline-none focus:border-orange-300 dark:focus:border-orange-600 transition-colors placeholder:text-gray-300 dark:placeholder:text-gray-600"
            />
          </div>
        </>
      ) : (
        /* Calendar View */
        <div className="grid grid-cols-[1fr_280px] gap-4 items-start">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-gray-800 dark:text-gray-100">{MONTHS[calMonth-1]}</span>
                <span className="text-sm text-gray-400">{calYear}</span>
              </div>
              <div className="flex items-center gap-3">
                {calDays.length > 0 && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    本月均完成率 <span className="font-bold text-orange-500">{Math.round(calDays.reduce((a,d)=>a+d.pct,0)/calDays.length)}%</span>
                  </span>
                )}
                <div className="flex gap-1">
                  {[[-1, '‹'], [1, '›']].map(([d, label]) => (
                    <button key={label as string} onClick={() => {
                      let m = calMonth + (d as number), y = calYear
                      if (m < 1) { m = 12; y-- }
                      if (m > 12) { m = 1; y++ }
                      setCalMonth(m); setCalYear(y)
                    }} className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-7 px-3 pt-2 pb-1">
              {['日','一','二','三','四','五','六'].map((d, i) => (
                <div key={d} className={`text-center text-xs font-semibold py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 px-3 pb-3">
              {(() => {
                const firstDay = getFirstDayOfWeek(calYear, calMonth)
                const daysInMonth = getDaysInMonth(calYear, calMonth)
                const prevDays = getDaysInMonth(calYear, calMonth === 1 ? 12 : calMonth - 1)
                const cells: { day: number; type: 'prev' | 'cur' | 'next' }[] = []
                for (let i = 0; i < firstDay; i++) cells.push({ day: prevDays - firstDay + 1 + i, type: 'prev' })
                for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, type: 'cur' })
                const remaining = 42 - cells.length
                for (let d = 1; d <= remaining; d++) cells.push({ day: d, type: 'next' })
                return cells.map((cell, idx) => {
                  if (cell.type !== 'cur') {
                    return <div key={idx} className="aspect-square rounded-xl flex items-center justify-center opacity-20"><span className="text-xs text-gray-400">{cell.day}</span></div>
                  }
                  const dateStr = `${calYear}-${String(calMonth).padStart(2,'0')}-${String(cell.day).padStart(2,'0')}`
                  const dayData = calDayMap.get(dateStr)
                  const isToday = dateStr === todayFull
                  const isFuture = dateStr > todayFull
                  const isSelected = dateStr === selectedDate
                  let bg = 'bg-gray-50 dark:bg-gray-700/30'
                  let textColor = 'text-gray-400'
                  let pctColor = 'text-gray-400'
                  if (isToday) { bg = 'bg-orange-500 shadow-md shadow-orange-200 dark:shadow-orange-900/40'; textColor = 'text-white'; pctColor = 'text-orange-100' }
                  else if (isFuture) { bg = 'bg-gray-50 dark:bg-gray-700/30'; textColor = 'text-gray-400' }
                  else if (dayData) {
                    if (dayData.pct >= 80) { bg = 'bg-green-100 dark:bg-green-900/30'; textColor = 'text-green-800 dark:text-green-300'; pctColor = 'text-green-600 dark:text-green-400' }
                    else if (dayData.pct >= 50) { bg = 'bg-yellow-100 dark:bg-yellow-900/30'; textColor = 'text-yellow-800 dark:text-yellow-300'; pctColor = 'text-yellow-600 dark:text-yellow-400' }
                    else { bg = 'bg-red-100 dark:bg-red-900/30'; textColor = 'text-red-800 dark:text-red-300'; pctColor = 'text-red-500 dark:text-red-400' }
                  }
                  return (
                    <button key={idx} onClick={() => { if (!isFuture) setSelectedDate(selectedDate === dateStr ? null : dateStr) }}
                      className={`aspect-square rounded-xl flex flex-col items-center justify-center transition-all ${bg} ${isSelected && !isToday ? 'ring-2 ring-orange-400' : ''} ${!isFuture ? 'cursor-pointer hover:scale-105' : 'cursor-default'}`}>
                      <span className={`text-sm font-bold ${textColor}`}>{cell.day}</span>
                      {dayData && <span className={`text-[9px] font-bold ${pctColor}`}>{dayData.pct}%</span>}
                    </button>
                  )
                })
              })()}
            </div>
            <div className="flex gap-4 px-5 py-3 border-t border-gray-50 dark:border-gray-700 flex-wrap">
              {[
                { color: 'bg-green-200', label: '优秀 ≥80%' },
                { color: 'bg-yellow-200', label: '良好 50-79%' },
                { color: 'bg-red-200', label: '待提升 <50%' },
                { color: 'bg-orange-500', label: '今天', round: true },
                { color: 'bg-gray-200', label: '未来' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <div className={`w-3 h-3 ${l.round ? 'rounded-full' : 'rounded-sm'} ${l.color}`} />
                  {l.label}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {calDays.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
                <div className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">📊 本月数据</div>
                {[
                  { label: '已记录天数', value: `${calDays.length} 天` },
                  { label: '平均完成率', value: `${Math.round(calDays.reduce((a,d)=>a+d.pct,0)/calDays.length)}%`, highlight: true },
                  { label: '满分天数', value: `${calDays.filter(d=>d.pct===100).length} 天`, green: true },
                  { label: '最佳单日', value: calDays.reduce((a,d)=>d.pct>a.pct?d:a, calDays[0]).date.slice(5).replace('-','/') },
                ].map(s => (
                  <div key={s.label} className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700 last:border-0">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{s.label}</span>
                    <span className={`text-sm font-bold ${s.highlight ? 'text-orange-500' : s.green ? 'text-green-500' : 'text-gray-800 dark:text-gray-200'}`}>{s.value}</span>
                  </div>
                ))}
              </div>
            )}

            {selectedDate && selectedDayData && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
                <div className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
                  📋 {selectedDate.slice(5).replace('-','/')} 详情
                </div>
                {preset.filter(p=>p.enabled).map(item => {
                  const log = selectedDayData.log.find(l => l.item_id === item.id)
                  const done = log?.completed
                  return (
                    <div key={item.id} className="flex items-center gap-2 py-1.5 border-b border-gray-50 dark:border-gray-700 last:border-0">
                      <div className={`w-4 h-4 rounded flex items-center justify-center text-[10px] flex-shrink-0 ${done ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
                        {done ? '✓' : '○'}
                      </div>
                      <span className={`text-xs flex-1 ${done ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-300'}`}>{item.title}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{item.time_start}</span>
                    </div>
                  )
                })}
                {selectedDayData.notes && (
                  <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <div className="text-xs text-gray-400 mb-1">备注</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{selectedDayData.notes}</div>
                  </div>
                )}
              </div>
            )}

            {calDays.length === 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 text-center text-gray-400 text-sm">
                本月暂无记录
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preset Modal */}
      {showPresetModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-16 px-4" onClick={() => { setShowPresetModal(false); setEditingItem(null) }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-bold text-gray-800 dark:text-gray-100">✏️ 日程预设管理</h3>
              <button onClick={() => { setShowPresetModal(false); setEditingItem(null) }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {editingItem ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">开始时间 *</label>
                      <input type="time" value={editingItem.time_start || ''} onChange={e => setEditingItem(p => ({...p!, time_start: e.target.value}))}
                        className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-orange-400" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">结束时间</label>
                      <input type="time" value={editingItem.time_end || ''} onChange={e => setEditingItem(p => ({...p!, time_end: e.target.value}))}
                        className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-orange-400" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">事项名称 *</label>
                    <input type="text" value={editingItem.title || ''} onChange={e => setEditingItem(p => ({...p!, title: e.target.value}))} placeholder="如：晨间运动30分钟"
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-orange-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">描述（可选）</label>
                    <textarea value={editingItem.description || ''} onChange={e => setEditingItem(p => ({...p!, description: e.target.value}))} rows={2} placeholder="补充说明…"
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-orange-400 resize-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">时段</label>
                      <select value={editingItem.category || 'morning'} onChange={e => setEditingItem(p => ({...p!, category: e.target.value}))}
                        className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-orange-400">
                        <option value="morning">☀️ 晨间</option>
                        <option value="afternoon">🌿 午间</option>
                        <option value="evening">🌙 晚间</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">提前提醒（分钟）</label>
                      <input type="number" min="0" max="60" value={editingItem.reminder_minutes ?? 0} onChange={e => setEditingItem(p => ({...p!, reminder_minutes: parseInt(e.target.value)||0}))}
                        className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-orange-400" />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => { setEditingItem(null); setIsEditing(false) }}
                      className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-xl py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">取消</button>
                    <button onClick={savePreset}
                      className="flex-1 bg-orange-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-orange-600">保存事项</button>
                  </div>
                </div>
              ) : (
                <>
                  <button onClick={() => { setEditingItem({ time_start: '', time_end: '', title: '', description: '', category: 'morning', reminder_minutes: 0, enabled: 1 }); setIsEditing(false) }}
                    className="w-full border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl py-3 text-sm text-gray-400 hover:border-orange-300 hover:text-orange-400 transition-colors">
                    + 添加事项
                  </button>
                  {preset.map(item => (
                    <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-gray-500 dark:text-gray-400 flex-shrink-0">{item.time_start}</span>
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{item.title}</span>
                          {item.reminder_minutes > 0 && <span className="text-xs text-purple-500 flex-shrink-0">🔔{item.reminder_minutes}min</span>}
                        </div>
                        {item.description && <div className="text-xs text-gray-400 mt-0.5 truncate">{item.description}</div>}
                      </div>
                      <button onClick={() => { setEditingItem({...item}); setIsEditing(true) }}
                        className="text-xs text-gray-400 hover:text-orange-500 px-2 py-1 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/30 transition-colors flex-shrink-0">编辑</button>
                      <button onClick={() => deletePreset(item.id)}
                        className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors flex-shrink-0">删除</button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
