import { useState, useEffect, useCallback } from 'react'
import { api, type WeekGoal, type DayLog, type RoutineItem } from '../lib/api'

// Get ISO week number
function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

// Get start date of a week
function getWeekStart(year: number, week: number): Date {
  const jan1 = new Date(year, 0, 1)
  const days = (week - 1) * 7 - jan1.getDay() + 1
  return new Date(year, 0, days + 1)
}

// Format date like "3/24"
function formatShortDate(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// Format date like "2026-03-24"
function formatDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

export default function WeekPlan() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [week, setWeek] = useState(getWeekNumber(today))
  const [goals, setGoals] = useState<WeekGoal[]>([])
  const [newGoal, setNewGoal] = useState('')
  const [loading, setLoading] = useState(true)
  const [dayTasks, setDayTasks] = useState<Map<string, { preset: RoutineItem[]; log: DayLog[] }>>(new Map())

  const weekStart = getWeekStart(year, week)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })
  const weekEnd = weekDays[6]
  const todayStr = formatDateStr(today)

  const loadGoals = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.planning.getWeekGoals(year, week)
      setGoals(data)
    } finally {
      setLoading(false)
    }
  }, [year, week])

  const loadDayTasks = useCallback(async () => {
    // Load preset once
    const preset = await api.routine.getPreset()
    const enabledPreset = preset.filter(p => p.enabled)

    // Load logs for each day of the week
    const newMap = new Map<string, { preset: RoutineItem[]; log: DayLog[] }>()
    await Promise.all(weekDays.map(async (d) => {
      const dateStr = formatDateStr(d)
      try {
        const logData = await api.routine.getLog(dateStr)
        newMap.set(dateStr, { preset: enabledPreset, log: logData.log })
      } catch {
        newMap.set(dateStr, { preset: enabledPreset, log: [] })
      }
    }))
    setDayTasks(newMap)
  }, [year, week])

  useEffect(() => {
    loadGoals()
    loadDayTasks()
  }, [loadGoals, loadDayTasks])

  const addGoal = async () => {
    if (!newGoal.trim()) return
    await api.planning.createWeekGoal({ year, week, title: newGoal.trim() })
    setNewGoal('')
    loadGoals()
  }

  const toggleGoal = async (goal: WeekGoal) => {
    await api.planning.updateWeekGoal(goal.id, { done: !goal.done })
    loadGoals()
  }

  const deleteGoal = async (id: string) => {
    if (!confirm('确定删除？')) return
    await api.planning.deleteWeekGoal(id)
    loadGoals()
  }

  const goToThisWeek = () => {
    setYear(today.getFullYear())
    setWeek(getWeekNumber(today))
  }

  const prevWeek = () => {
    if (week === 1) {
      setYear(year - 1)
      setWeek(52)
    } else {
      setWeek(week - 1)
    }
  }

  const nextWeek = () => {
    if (week >= 52) {
      setYear(year + 1)
      setWeek(1)
    } else {
      setWeek(week + 1)
    }
  }

  const isThisWeek = year === today.getFullYear() && week === getWeekNumber(today)
  const doneCount = goals.filter(g => g.done).length
  const totalGoals = goals.length

  // Calculate day tasks stats
  let totalDayTasks = 0
  let doneDayTasks = 0
  dayTasks.forEach(({ preset, log }) => {
    totalDayTasks += preset.length
    const logMap = new Map(log.map(l => [l.item_id, l]))
    preset.forEach(p => {
      if (logMap.get(p.id)?.completed) doneDayTasks++
    })
  })
  const overallProgress = totalGoals + totalDayTasks > 0
    ? Math.round(((doneCount + doneDayTasks) / (totalGoals + totalDayTasks)) * 100)
    : 0

  if (loading) return <div className="text-center text-gray-400 py-12">加载中…</div>

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <button onClick={prevWeek} className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">‹</button>
            <div>
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">第{week}周</span>
              <span className="text-sm text-gray-400 ml-2">{formatShortDate(weekStart)} - {formatShortDate(weekEnd)}</span>
            </div>
            <button onClick={nextWeek} className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">›</button>
          </div>
          {!isThisWeek && (
            <button onClick={goToThisWeek} className="text-xs px-3 py-1.5 rounded-lg border border-[#FF6B6B] text-[#FF6B6B] hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
              回到本周
            </button>
          )}
        </div>

        {/* Week goals */}
        <div className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 rounded-xl p-4 mb-5">
          <div className="text-sm font-semibold text-[#FF6B6B] mb-3">🎯 本周目标</div>
          <div className="space-y-2">
            {goals.map(goal => (
              <div key={goal.id} className="flex items-center gap-2 group">
                <button
                  onClick={() => toggleGoal(goal)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    goal.done ? 'bg-[#FF6B6B] border-[#FF6B6B] text-white' : 'border-gray-300 dark:border-gray-500 hover:border-[#FF6B6B]'
                  }`}
                >
                  {goal.done && <span className="text-xs">✓</span>}
                </button>
                <span className={`flex-1 text-sm ${goal.done ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-300'}`}>
                  {goal.title}
                </span>
                <button
                  onClick={() => deleteGoal(goal.id)}
                  className="text-gray-300 dark:text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-sm"
                >×</button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <input
              type="text"
              value={newGoal}
              onChange={e => setNewGoal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addGoal()}
              placeholder="添加周目标…"
              className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-[#FF6B6B]"
            />
            <button
              onClick={addGoal}
              disabled={!newGoal.trim()}
              className="px-3 py-1.5 bg-[#FF6B6B] text-white rounded-lg text-sm font-medium hover:bg-[#e55555] disabled:opacity-40 transition-colors"
            >
              添加
            </button>
          </div>
        </div>

        {/* Week days grid */}
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((d, i) => {
            const dateStr = formatDateStr(d)
            const isToday = dateStr === todayStr
            const dayData = dayTasks.get(dateStr)
            const logMap = new Map((dayData?.log || []).map(l => [l.item_id, l]))
            const tasks = (dayData?.preset || []).slice(0, 4) // Show max 4 tasks

            return (
              <div
                key={i}
                className={`rounded-xl p-3 min-h-[140px] border transition-colors ${
                  isToday
                    ? 'bg-red-50 dark:bg-red-900/20 border-[#FF6B6B]'
                    : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700'
                }`}
              >
                <div className="text-center mb-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                  <div className="text-[10px] text-gray-400">{WEEKDAYS[i]}</div>
                  <div className={`text-lg font-bold ${isToday ? 'text-[#FF6B6B]' : 'text-gray-700 dark:text-gray-300'}`}>
                    {d.getDate()}
                  </div>
                </div>
                <div className="space-y-1">
                  {tasks.map(task => {
                    const done = logMap.get(task.id)?.completed
                    return (
                      <div key={task.id} className="flex items-start gap-1 text-[10px]">
                        <span className={`w-1 h-1 rounded-full mt-1.5 flex-shrink-0 ${done ? 'bg-green-400' : 'bg-gray-300 dark:bg-gray-500'}`} />
                        <span className={done ? 'text-gray-400 line-through' : 'text-gray-600 dark:text-gray-400'}>
                          {task.title}
                        </span>
                      </div>
                    )
                  })}
                  {(dayData?.preset?.length || 0) > 4 && (
                    <div className="text-[10px] text-gray-400">+{(dayData?.preset?.length || 0) - 4} 更多</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Week stats */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-[#FF6B6B]">{doneCount}/{totalGoals}</div>
            <div className="text-xs text-gray-400 mt-1">周目标完成</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-[#FF6B6B]">{doneDayTasks}/{totalDayTasks}</div>
            <div className="text-xs text-gray-400 mt-1">日任务完成</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-[#FF6B6B]">{overallProgress}%</div>
            <div className="text-xs text-gray-400 mt-1">本周进度</div>
          </div>
        </div>
      </div>
    </div>
  )
}
