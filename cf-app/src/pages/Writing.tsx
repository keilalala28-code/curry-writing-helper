import { useEffect, useState, useCallback } from 'react'
import { api, type BadgeDef } from '../lib/api'

interface Goal {
  year: number
  month: number
  monthly_target: number
  daily_target: number
}

interface DayRecord {
  date: string
  actual_words: number
  note: string
}

function getTodayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  const d = new Date(year, month - 1, 1).getDay()
  return (d + 6) % 7 // Mon=0
}

const CATEGORY_LABELS: Record<string, string> = {
  milestone: '🏆 里程碑',
  streak: '🔥 连续打卡',
  monthly: '📅 月度达标',
  daily: '✍️ 单日爆发',
  volume: '📚 累计字数',
  consistency: '🎯 坚持不懈',
  speed: '⚡ 速度挑战',
  special: '🌟 特殊成就',
  rare: '👑 稀有荣耀',
  hidden: '🎭 隐藏彩蛋',
}

export default function Writing() {
  const today = getTodayStr()
  const todayDate = new Date()
  const [year, setYear] = useState(todayDate.getFullYear())
  const [month, setMonth] = useState(todayDate.getMonth() + 1)

  const [goal, setGoal] = useState<Goal>({ year, month, monthly_target: 100000, daily_target: 3000 })
  const [records, setRecords] = useState<DayRecord[]>([])

  const [todayWords, setTodayWords] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const [showGoalModal, setShowGoalModal] = useState(false)
  const [editMonthly, setEditMonthly] = useState('')
  const [editDaily, setEditDaily] = useState('')

  const [editDay, setEditDay] = useState<string | null>(null)
  const [editDayWords, setEditDayWords] = useState('')

  const [badges, setBadges] = useState<BadgeDef[]>([])
  const [badgeFilter, setBadgeFilter] = useState<string>('all')
  const [badgeToast, setBadgeToast] = useState<BadgeDef[]>([])
  const [showBadges, setShowBadges] = useState(false)

  const load = useCallback(async (y: number, m: number) => {
    const [g, r] = await Promise.all([
      api.writing.getGoal(y, m),
      api.writing.getRecords(y, m),
    ])
    setGoal(g)
    setRecords(r)
    const isCurrentMonth = y === todayDate.getFullYear() && m === todayDate.getMonth() + 1
    if (isCurrentMonth) {
      const todayRec = r.find((rec: DayRecord) => rec.date === today)
      setTodayWords(todayRec ? String(todayRec.actual_words) : '')
    }
  }, [today])

  const loadBadges = useCallback(async () => {
    const d = await api.badges.list()
    setBadges(d.badges)
  }, [])

  useEffect(() => { load(year, month) }, [year, month, load])
  useEffect(() => { loadBadges() }, [loadBadges])

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const saveToday = async () => {
    const w = parseInt(todayWords) || 0
    setSaving(true)
    try {
      const res = await api.writing.saveRecord(today, w)
      if (res.newBadges?.length) {
        const newOnes = badges.filter(b => res.newBadges.includes(b.id))
        setBadgeToast(newOnes)
        setTimeout(() => setBadgeToast([]), 6000)
        await loadBadges()
      }
      setSaveMsg('✅ 已保存')
      await load(year, month)
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(''), 2000)
    }
  }

  const saveDayEdit = async (date: string) => {
    const w = parseInt(editDayWords) || 0
    const res = await api.writing.saveRecord(date, w)
    if (res.newBadges?.length) {
      const newOnes = badges.filter(b => res.newBadges.includes(b.id))
      setBadgeToast(newOnes)
      setTimeout(() => setBadgeToast([]), 6000)
      await loadBadges()
    }
    setEditDay(null)
    await load(year, month)
  }

  const saveGoal = async () => {
    const mt = parseInt(editMonthly) || goal.monthly_target
    const dt = parseInt(editDaily) || goal.daily_target
    await api.writing.saveGoal(year, month, mt, dt)
    setShowGoalModal(false)
    await load(year, month)
  }

  const recordMap: Record<string, number> = {}
  for (const r of records) recordMap[r.date] = r.actual_words

  const isCurrentMonth = year === todayDate.getFullYear() && month === todayDate.getMonth() + 1
  const todayRecord = recordMap[today] || 0
  const todayProgress = Math.min(100, Math.round((todayRecord / goal.daily_target) * 100))

  const monthlyTotal = records.reduce((s, r) => s + r.actual_words, 0)
  const monthlyProgress = Math.min(100, Math.round((monthlyTotal / goal.monthly_target) * 100))

  const daysInMonth = getDaysInMonth(year, month)
  const firstDow = getFirstDayOfWeek(year, month)

  const achievedDays = records.filter(r => r.actual_words >= goal.daily_target).length
  let streak = 0
  if (isCurrentMonth) {
    const todayNum = todayDate.getDate()
    for (let d = todayNum; d >= 1; d--) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      if ((recordMap[dateStr] || 0) >= goal.daily_target) streak++
      else break
    }
  }

  const dots = Array.from({ length: 31 }, (_, i) => {
    const d = i + 1
    if (d > daysInMonth) return 'empty'
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const w = recordMap[dateStr] || 0
    if (w >= goal.daily_target) return 'done'
    if (w > 0) return 'partial'
    return 'none'
  })

  const needleAngle = -90 + (todayProgress / 100) * 180

  const maxWords = Math.max(...records.map(r => r.actual_words), 0)
  const avgWords = records.length > 0
    ? Math.round(records.filter(r => r.actual_words > 0).reduce((s, r) => s + r.actual_words, 0) / Math.max(1, records.filter(r => r.actual_words > 0).length))
    : 0

  const unlockedCount = badges.filter(b => b.unlocked).length
  const categories = Object.keys(CATEGORY_LABELS)
  const filteredBadges = badgeFilter === 'all'
    ? badges
    : badgeFilter === 'unlocked'
      ? badges.filter(b => b.unlocked)
      : badges.filter(b => b.category === badgeFilter)

  return (
    <div>
      {/* Badge unlock toast */}
      {badgeToast.length > 0 && (
        <div className="fixed top-6 right-6 z-50 space-y-2">
          {badgeToast.map(b => (
            <div key={b.id} className="bg-white dark:bg-gray-800 border border-yellow-200 dark:border-yellow-700 rounded-2xl shadow-xl px-5 py-4 flex items-center gap-3 animate-bounce">
              <span className="text-3xl">{b.emoji}</span>
              <div>
                <p className="text-xs text-yellow-500 font-medium">🎉 解锁新徽章！</p>
                <p className="font-bold text-gray-800 dark:text-gray-100">{b.name}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">✍️ 码字计划</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">记录每日码字，向目标冲刺！</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBadges(b => !b)}
            className="flex items-center gap-1.5 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 text-sm rounded-lg hover:bg-yellow-100 dark:hover:bg-yellow-900/50 transition-colors border border-yellow-200 dark:border-yellow-700"
          >
            🏅 徽章 <span className="font-bold">{unlockedCount}</span>/{badges.length}
          </button>
          <button
            onClick={() => { setEditMonthly(String(goal.monthly_target)); setEditDaily(String(goal.daily_target)); setShowGoalModal(true) }}
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
          >
            ⚙ 设置目标
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1.5fr] gap-4">
        {/* ── Left column ── */}
        <div className="flex flex-col gap-4">

          {/* Today card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-1 bg-primary rounded-full" />
              <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">今日码字</span>
            </div>
            <div className="text-4xl font-bold text-gray-900 dark:text-gray-100 leading-none mb-1">
              {isCurrentMonth ? todayRecord.toLocaleString() : '—'}
              <span className="text-base font-normal text-gray-400 dark:text-gray-500 ml-1">字</span>
            </div>
            {isCurrentMonth && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
                目标 {goal.daily_target.toLocaleString()} 字
                {todayRecord < goal.daily_target
                  ? ` · 还差 ${(goal.daily_target - todayRecord).toLocaleString()} 字`
                  : ' · 🎉 已达标！'}
              </p>
            )}

            {/* Gauge */}
            <div className="relative flex justify-center items-end mb-3" style={{ height: 110 }}>
              <svg viewBox="0 0 200 110" className="w-full max-w-[200px]">
                <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#f0f0f0" strokeWidth="14" strokeLinecap="round"/>
                <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none"
                  stroke="url(#ggrad)" strokeWidth="14" strokeLinecap="round"
                  strokeDasharray="251.2"
                  strokeDashoffset={251.2 * (1 - todayProgress / 100)}
                />
                <line
                  x1="100" y1="100"
                  x2={100 + 62 * Math.cos((needleAngle - 90) * Math.PI / 180)}
                  y2={100 + 62 * Math.sin((needleAngle - 90) * Math.PI / 180)}
                  stroke="#1a1a1a" strokeWidth="3" strokeLinecap="round"
                />
                <circle cx="100" cy="100" r="6" fill="#1a1a1a"/>
                <defs>
                  <linearGradient id="ggrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f5a89a"/>
                    <stop offset="100%" stopColor="#e85d4a"/>
                  </linearGradient>
                </defs>
              </svg>
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-2xl font-bold text-gray-900 dark:text-gray-100">
                {isCurrentMonth ? `${todayProgress}%` : '—'}
              </span>
            </div>

            <div className="flex justify-between items-end mb-4">
              <div>
                <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{isCurrentMonth ? `${todayProgress}%` : '—'}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500">今日计划完成进度</div>
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 text-right">
                目标字数 <span className="text-primary font-medium">{goal.daily_target.toLocaleString()} 字</span>
              </div>
            </div>

            {isCurrentMonth && (
              <div className="flex gap-2">
                <input
                  type="number"
                  value={todayWords}
                  onChange={e => setTodayWords(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveToday()}
                  placeholder="输入今日实际字数…"
                  className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-primary focus:bg-white dark:focus:bg-gray-600"
                />
                <button
                  onClick={saveToday}
                  disabled={saving}
                  className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-40 whitespace-nowrap"
                >
                  {saving ? '…' : '保存'}
                </button>
              </div>
            )}
            {saveMsg && <p className="text-xs text-green-500 mt-1.5">{saveMsg}</p>}
          </div>

          {/* Monthly card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-1 bg-primary rounded-full" />
              <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">本月累计码字</span>
            </div>
            <div className="text-4xl font-bold text-gray-900 dark:text-gray-100 leading-none mb-1">
              {monthlyTotal.toLocaleString()}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
              本月目标 {goal.monthly_target.toLocaleString()} 字 · 已达标 <span className="text-primary font-medium">{achievedDays}</span> 天
            </p>
            <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full mb-4 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${monthlyProgress}%`, background: 'linear-gradient(90deg,#f5a89a,#e85d4a)' }}
              />
            </div>
            <div className="grid grid-cols-7 gap-1.5 mb-4">
              {dots.map((s, i) => (
                <div
                  key={i}
                  className={`aspect-square rounded-full transition-all ${
                    s === 'empty' ? 'bg-transparent' :
                    s === 'done' ? 'bg-primary' :
                    s === 'partial' ? 'bg-red-200 dark:bg-red-800' : 'bg-gray-100 dark:bg-gray-700'
                  } ${s !== 'empty' && i + 1 === todayDate.getDate() && isCurrentMonth ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                />
              ))}
            </div>
            <div className="flex justify-between items-end">
              <div>
                <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{monthlyProgress}%</div>
                <div className="text-xs text-gray-400 dark:text-gray-500">本月计划完成度</div>
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 text-right">
                目标字数 <span className="text-primary font-medium">{goal.monthly_target.toLocaleString()} 字</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: Calendar ── */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
          <div className="flex items-start justify-between mb-1">
            <div>
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{year}年{month}月</div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                本月已达标 <span className="text-primary font-medium">{achievedDays}</span> 天
                {streak > 0 && <> · 连续打卡 <span className="text-orange-400 font-medium">{streak}</span> 天 🔥</>}
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={prevMonth} className="w-7 h-7 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center">‹</button>
              <button onClick={nextMonth} className="w-7 h-7 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center">›</button>
            </div>
          </div>

          <div className="grid grid-cols-7 mt-3 mb-1">
            {['一','二','三','四','五','六','日'].map(d => (
              <div key={d} className="text-center text-xs text-gray-300 dark:text-gray-600 py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1 flex-1">
            {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1
              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
              const w = recordMap[dateStr] || 0
              const isToday = dateStr === today
              const isFuture = dateStr > today
              const isDone = w >= goal.daily_target
              const isPartial = w > 0 && !isDone

              return (
                <div
                  key={d}
                  className={`flex flex-col items-center py-1 rounded-xl cursor-pointer transition-all ${isFuture ? '' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                  onClick={() => {
                    if (isFuture) return
                    setEditDay(dateStr)
                    setEditDayWords(String(w || ''))
                  }}
                >
                  <div className={`w-6 h-6 flex items-center justify-center text-xs font-medium rounded-full mb-1 ${
                    isToday ? 'bg-primary text-white' : isFuture ? 'text-gray-200 dark:text-gray-700' : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {d}
                  </div>
                  {!isFuture && (
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                      isDone ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900' :
                      isPartial ? 'bg-red-100 dark:bg-red-900/50 text-red-400' :
                      'text-gray-200 dark:text-gray-600'
                    }`}>
                      {w > 0 ? w.toLocaleString() : '0'}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-50 dark:border-gray-700">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 text-center">
              <div className="text-base font-bold text-gray-900 dark:text-gray-100">{maxWords > 0 ? maxWords.toLocaleString() : '—'}</div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">单日最高字数</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 text-center">
              <div className="text-base font-bold text-primary">{streak > 0 ? `${streak}天` : '—'}</div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">当前连续打卡</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 text-center">
              <div className="text-base font-bold text-gray-900 dark:text-gray-100">{avgWords > 0 ? avgWords.toLocaleString() : '—'}</div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">有效日均字数</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Badges Panel ── */}
      {showBadges && (
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">🏅 成就徽章</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">已解锁 {unlockedCount} / {badges.length} 枚</p>
            </div>
            <div className="w-40">
              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${badges.length ? (unlockedCount / badges.length) * 100 : 0}%`, background: 'linear-gradient(90deg,#f5a89a,#e85d4a)' }}
                />
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 text-right">{badges.length ? Math.round((unlockedCount / badges.length) * 100) : 0}%</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-5">
            <button
              onClick={() => setBadgeFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${badgeFilter === 'all' ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              全部
            </button>
            <button
              onClick={() => setBadgeFilter('unlocked')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${badgeFilter === 'unlocked' ? 'bg-yellow-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
            >
              已解锁
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setBadgeFilter(cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${badgeFilter === cat ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-6 gap-3">
            {filteredBadges.map(b => (
              <div
                key={b.id}
                title={`${b.name}\n${b.desc}${b.unlock_date ? `\n解锁于 ${b.unlock_date}` : ''}`}
                className={`flex flex-col items-center p-3 rounded-xl border transition-all ${
                  b.unlocked
                    ? 'border-yellow-200 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20'
                    : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 opacity-40 grayscale'
                }`}
              >
                <span className="text-2xl mb-1">{b.emoji}</span>
                <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300 text-center leading-tight line-clamp-1">{b.name}</span>
                {b.unlocked && b.unlock_date && (
                  <span className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5">{b.unlock_date}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Day edit modal ── */}
      {editDay && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setEditDay(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-72 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-1">{editDay} 码字记录</h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">每日目标：{goal.daily_target.toLocaleString()} 字</p>
            <input
              type="number"
              value={editDayWords}
              onChange={e => setEditDayWords(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveDayEdit(editDay)}
              placeholder="输入当日字数"
              autoFocus
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-primary bg-white dark:bg-gray-700 dark:text-gray-100"
            />
            <div className="flex gap-2">
              <button onClick={() => setEditDay(null)} className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-lg py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">取消</button>
              <button onClick={() => saveDayEdit(editDay)} className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-medium hover:opacity-90">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Goal settings modal ── */}
      {showGoalModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowGoalModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-80 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4">设置 {year}年{month}月 码字目标</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">月度目标（字）</label>
                <input
                  type="number"
                  value={editMonthly}
                  onChange={e => setEditMonthly(e.target.value)}
                  placeholder="例如：100000"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary bg-white dark:bg-gray-700 dark:text-gray-100"
                />
                <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">= {Math.round((parseInt(editMonthly) || 0) / 10000 * 10) / 10} 万字</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">每日目标（字）</label>
                <input
                  type="number"
                  value={editDaily}
                  onChange={e => setEditDaily(e.target.value)}
                  placeholder="例如：3000"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary bg-white dark:bg-gray-700 dark:text-gray-100"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowGoalModal(false)} className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-lg py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">取消</button>
                <button onClick={saveGoal} className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-medium hover:opacity-90">保存目标</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
