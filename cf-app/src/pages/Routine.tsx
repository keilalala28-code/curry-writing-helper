import { useState } from 'react'
import DayPlan from './DayPlan'
import WeekPlan from './WeekPlan'
import MonthPlan from './MonthPlan'
import YearPlan from './YearPlan'

type Tab = 'day' | 'week' | 'month' | 'year'

const TABS: { value: Tab; label: string }[] = [
  { value: 'day',   label: '日计划' },
  { value: 'week',  label: '周计划' },
  { value: 'month', label: '月计划' },
  { value: 'year',  label: '年计划' },
]

const SUBTITLES: Record<Tab, string> = {
  day:   '生活 SOP · 固定事项减少决策，让生活轻松有规律',
  week:  '周度目标管理 · 七天规划，聚焦本周重点',
  month: '月度目标管理 · 宏观把控，每月复盘',
  year:  '年度规划总览 · 锚定方向，季度拆解',
}

export default function Routine() {
  const [tab, setTab] = useState<Tab>('day')

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">📅 个人规划</h1>
          <p className="text-xs text-gray-400 mt-1">{SUBTITLES[tab]}</p>
        </div>
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 flex-shrink-0">
          {TABS.map(t => (
            <button key={t.value} onClick={() => setTab(t.value)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === t.value ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === 'day'   && <DayPlan />}
      {tab === 'week'  && <WeekPlan />}
      {tab === 'month' && <MonthPlan />}
      {tab === 'year'  && <YearPlan />}
    </div>
  )
}
