import { useState, useEffect, useRef } from 'react'
import { api, type YearGoal, type YearHeatmapMonth } from '../lib/api'

const CATEGORIES = [
  { value: 'write',   label: '创作', color: '#2563eb', bg: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400', bar: 'from-blue-500 to-blue-400' },
  { value: 'health',  label: '健康', color: '#16a34a', bg: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400', bar: 'from-green-500 to-green-400' },
  { value: 'life',    label: '生活', color: '#9333ea', bg: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400', bar: 'from-purple-500 to-purple-400' },
  { value: 'finance', label: '财务', color: '#ca8a04', bg: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400', bar: 'from-yellow-500 to-yellow-400' },
  { value: 'learn',   label: '学习', color: '#ea580c', bg: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400', bar: 'from-orange-500 to-orange-400' },
]

const QUARTER_CFG = [
  { value: 'all', label: '全年', badge: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'Q1',  label: 'Q1', badge: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' },
  { value: 'Q2',  label: 'Q2', badge: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
  { value: 'Q3',  label: 'Q3', badge: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
  { value: 'Q4',  label: 'Q4', badge: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' },
]

const MONTHS_CN = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

function heatColor(pct: number, days: number) {
  if (days === 0) return 'bg-gray-100 dark:bg-gray-700/50 text-gray-400'
  if (pct >= 80) return 'bg-red-500 text-white'
  if (pct >= 60) return 'bg-red-400 text-white'
  if (pct >= 40) return 'bg-red-300 text-red-800'
  if (pct >= 20) return 'bg-red-200 text-red-700'
  return 'bg-red-100 text-red-600'
}

type EditGoal = Partial<YearGoal> & { isNew?: boolean }

export default function YearPlan() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [goals, setGoals] = useState<YearGoal[]>([])
  const [heatmap, setHeatmap] = useState<YearHeatmapMonth[]>([])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [qFilter, setQFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<EditGoal | null>(null)
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = async (y: number) => {
    setLoading(true)
    try {
      const [gs, hm, n] = await Promise.all([
        api.planning.getYearGoals(y),
        api.planning.getYearHeatmap(y),
        api.planning.getNotes(`year:${y}`),
      ])
      setGoals(gs)
      setHeatmap(hm.heatmap)
      setNotes(n.notes)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(year) }, [year])

  const saveNotes = (val: string) => {
    setNotes(val)
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => api.planning.saveNotes(`year:${year}`, val), 800)
  }

  const openAdd = () => {
    setEditing({ year, title: '', category: 'write', progress: 0, quarter: 'all', description: '', isNew: true })
    setShowModal(true)
  }

  const openEdit = (g: YearGoal) => {
    setEditing({ ...g, isNew: false })
    setShowModal(true)
  }

  const saveGoal = async () => {
    if (!editing?.title?.trim()) return
    if (editing.isNew) {
      await api.planning.createYearGoal(editing)
    } else if (editing.id) {
      await api.planning.updateYearGoal(editing.id, editing)
    }
    setShowModal(false)
    setEditing(null)
    load(year)
  }

  const deleteGoal = async (id: string) => {
    if (!confirm('确认删除这条年度目标？')) return
    await api.planning.deleteYearGoal(id)
    load(year)
  }

  const visibleGoals = qFilter === 'all' ? goals : goals.filter(g => g.quarter === qFilter || g.quarter === 'all')
  const doneCount = goals.filter(g => g.progress >= 100).length
  const avgProgress = goals.length > 0 ? Math.round(goals.reduce((a, g) => a + g.progress, 0) / goals.length) : 0

  const catOf = (v: string) => CATEGORIES.find(c => c.value === v) ?? CATEGORIES[0]
  const qOf = (v: string) => QUARTER_CFG.find(q => q.value === v) ?? QUARTER_CFG[0]

  return (
    <div className="space-y-5">
      {/* Year nav */}
      <div className="flex items-center gap-2">
        <button onClick={() => setYear(y => y - 1)}
          className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">‹</button>
        <span className="text-base font-bold text-gray-900 dark:text-gray-100 min-w-[60px] text-center">{year}年</span>
        <button onClick={() => setYear(y => y + 1)}
          className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">›</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '年度目标总数', value: goals.length, color: 'text-primary' },
          { label: '已完成 (100%)', value: doneCount, color: 'text-green-500' },
          { label: '平均进度', value: `${avgProgress}%`, color: 'text-orange-500' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="text-xs text-gray-400 mb-1">{s.label}</div>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Quarter filter */}
      <div className="flex gap-2">
        {QUARTER_CFG.map(q => (
          <button key={q.value} onClick={() => setQFilter(q.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${qFilter === q.value ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
            {q.value === 'all' ? '全部' : `${q.label} 一季度`.replace('Q1', 'Q1').replace('Q2', 'Q2').replace('Q3', 'Q3').replace('Q4', 'Q4')}
            {q.value === 'Q1' ? ' 一季度' : q.value === 'Q2' ? ' 二季度' : q.value === 'Q3' ? ' 三季度' : q.value === 'Q4' ? ' 四季度' : ''}
          </button>
        ))}
      </div>

      {/* Goal list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">年度目标</span>
          <button onClick={openAdd}
            className="text-sm text-primary hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1 rounded-lg transition-colors font-medium">
            ＋ 添加年度目标
          </button>
        </div>

        {loading ? (
          <div className="text-center text-sm text-gray-400 py-8">加载中…</div>
        ) : visibleGoals.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-600">
            还没有年度目标，点击右上角添加吧
          </div>
        ) : (
          <div className="space-y-3">
            {visibleGoals.map(g => {
              const cat = catOf(g.category)
              const qcfg = qOf(g.quarter)
              return (
                <div key={g.id} className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 group">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                    <span className="flex-1 text-sm font-semibold text-gray-800 dark:text-gray-200 min-w-0 truncate">{g.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${cat.bg}`}>{cat.label}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${qcfg.badge}`}>{qcfg.value === 'all' ? '全年' : qcfg.label}</span>
                    <span className={`text-sm font-bold flex-shrink-0 ${g.progress >= 100 ? 'text-green-500' : 'text-primary'}`}>{g.progress}%</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button onClick={() => openEdit(g)} className="text-xs text-gray-400 hover:text-orange-500 px-2 py-1 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/30">编辑</button>
                      <button onClick={() => deleteGoal(g.id)} className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30">删除</button>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-2 rounded-full bg-gradient-to-r ${cat.bar} transition-all duration-500`} style={{ width: `${g.progress}%` }} />
                  </div>
                  {g.description && <div className="text-xs text-gray-400 mt-2">{g.description}</div>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Heatmap */}
      {heatmap.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">🌡️ 全年日计划完成率热力图</div>
          <div className="grid grid-cols-12 gap-1.5 mb-2">
            {MONTHS_CN.map((m, i) => (
              <div key={m} className="text-center text-[10px] text-gray-400">{m}</div>
            ))}
          </div>
          <div className="grid grid-cols-12 gap-1.5">
            {heatmap.map((h, i) => (
              <div key={h.month} title={`${MONTHS_CN[i]}: ${h.days > 0 ? `${h.pct}% (${h.days}天)` : '暂无记录'}`}
                className={`aspect-square rounded-lg flex items-center justify-center text-[9px] font-bold cursor-default transition-transform hover:scale-110 ${heatColor(h.pct, h.days)}`}>
                {h.days > 0 ? `${h.pct}%` : '—'}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className="text-xs text-gray-400">完成率：</span>
            {[
              { cls: 'bg-gray-100 dark:bg-gray-700/50', label: '暂无' },
              { cls: 'bg-red-100', label: '<20%' },
              { cls: 'bg-red-300', label: '40%' },
              { cls: 'bg-red-400', label: '60%' },
              { cls: 'bg-red-500', label: '≥80%' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1 text-xs text-gray-400">
                <div className={`w-3 h-3 rounded ${l.cls}`} />
                {l.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700">
        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">📝 年度备忘 / 年初宣言</div>
        <textarea
          value={notes}
          onChange={e => saveNotes(e.target.value)}
          placeholder="写下今年的核心主题、年初宣言，或年底想回顾的话…"
          rows={4}
          className="w-full text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 rounded-xl px-4 py-3 resize-none outline-none focus:border-primary dark:focus:border-red-600 transition-colors placeholder:text-gray-300 dark:placeholder:text-gray-600"
        />
      </div>

      {/* Add/Edit modal */}
      {showModal && editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-16 px-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-bold text-gray-800 dark:text-gray-100">{editing.isNew ? '添加年度目标' : '编辑年度目标'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">目标名称 *</label>
                <input type="text" value={editing.title || ''} onChange={e => setEditing(p => ({...p!, title: e.target.value}))}
                  placeholder="如：全年发布48篇优质长文"
                  autoFocus
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-primary" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">分类</label>
                  <select value={editing.category || 'write'} onChange={e => setEditing(p => ({...p!, category: e.target.value}))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-primary">
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">季度范围</label>
                  <select value={editing.quarter || 'all'} onChange={e => setEditing(p => ({...p!, quarter: e.target.value}))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-primary">
                    <option value="all">全年</option>
                    <option value="Q1">Q1 一季度</option>
                    <option value="Q2">Q2 二季度</option>
                    <option value="Q3">Q3 三季度</option>
                    <option value="Q4">Q4 四季度</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">当前进度 {editing.progress ?? 0}%</label>
                <input type="range" min="0" max="100" step="5" value={editing.progress ?? 0}
                  onChange={e => setEditing(p => ({...p!, progress: parseInt(e.target.value)}))}
                  className="w-full accent-primary" />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0%</span><span>50%</span><span>100%</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">进度描述（可选）</label>
                <input type="text" value={editing.description || ''} onChange={e => setEditing(p => ({...p!, description: e.target.value}))}
                  placeholder="如：已完成 12 篇 / 目标 48 篇"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-primary" />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-500 rounded-xl py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">取消</button>
                <button onClick={saveGoal} className="flex-1 bg-primary text-white rounded-xl py-2 text-sm font-medium hover:opacity-90">保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
