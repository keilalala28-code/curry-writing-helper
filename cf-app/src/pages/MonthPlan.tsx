import { useState, useEffect, useRef } from 'react'
import { api, type MonthGoal } from '../lib/api'

const CATEGORIES = [
  { value: 'write',   label: '创作', color: '#2563eb', bg: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'health',  label: '健康', color: '#16a34a', bg: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
  { value: 'life',    label: '生活', color: '#9333ea', bg: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
  { value: 'finance', label: '财务', color: '#ca8a04', bg: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' },
  { value: 'learn',   label: '学习', color: '#ea580c', bg: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' },
]

const STATUS_CFG = {
  todo:  { label: '待开始', cls: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' },
  doing: { label: '进行中', cls: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' },
  done:  { label: '已完成 ✓', cls: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
}

function nowMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}

function prevMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  return mo === 1 ? `${y-1}-12` : `${y}-${String(mo-1).padStart(2,'0')}`
}

function nextMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  return mo === 12 ? `${y+1}-01` : `${y}-${String(mo+1).padStart(2,'0')}`
}

function fmtMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number)
  return `${y}年${mo}月`
}

type EditGoal = Partial<MonthGoal> & { isNew?: boolean }

export default function MonthPlan() {
  const [month, setMonth] = useState(nowMonth)
  const [goals, setGoals] = useState<MonthGoal[]>([])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<EditGoal | null>(null)
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = async (m: string) => {
    setLoading(true)
    try {
      const [gs, n] = await Promise.all([
        api.planning.getMonthGoals(m),
        api.planning.getNotes(`month:${m}`),
      ])
      setGoals(gs)
      setNotes(n.notes)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(month) }, [month])

  const saveNotes = (val: string) => {
    setNotes(val)
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(() => api.planning.saveNotes(`month:${month}`, val), 800)
  }

  const openAdd = () => {
    setEditing({ year_month: month, title: '', category: 'write', status: 'todo', progress_note: '', isNew: true })
    setShowModal(true)
  }

  const openEdit = (g: MonthGoal) => {
    setEditing({ ...g, isNew: false })
    setShowModal(true)
  }

  const saveGoal = async () => {
    if (!editing?.title?.trim()) return
    if (editing.isNew) {
      await api.planning.createMonthGoal(editing)
    } else if (editing.id) {
      await api.planning.updateMonthGoal(editing.id, editing)
    }
    setShowModal(false)
    setEditing(null)
    load(month)
  }

  const deleteGoal = async (id: string) => {
    if (!confirm('确认删除这条目标？')) return
    await api.planning.deleteMonthGoal(id)
    load(month)
  }

  const cycleStatus = async (g: MonthGoal) => {
    const order: MonthGoal['status'][] = ['todo', 'doing', 'done']
    const next = order[(order.indexOf(g.status) + 1) % 3]
    await api.planning.updateMonthGoal(g.id, { ...g, status: next })
    setGoals(gs => gs.map(x => x.id === g.id ? { ...x, status: next } : x))
  }

  const doneCount = goals.filter(g => g.status === 'done').length
  const doingCount = goals.filter(g => g.status === 'doing').length
  const todoCount = goals.filter(g => g.status === 'todo').length
  const pct = goals.length > 0 ? Math.round((doneCount / goals.length) * 100) : 0

  const catOf = (v: string) => CATEGORIES.find(c => c.value === v) ?? CATEGORIES[0]

  return (
    <div className="space-y-5">
      {/* Month nav */}
      <div className="flex items-center gap-2">
        <button onClick={() => setMonth(prevMonth(month))}
          className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">‹</button>
        <span className="text-base font-bold text-gray-900 dark:text-gray-100 min-w-[90px] text-center">{fmtMonth(month)}</span>
        <button onClick={() => setMonth(nextMonth(month))}
          className="w-8 h-8 rounded-lg border border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">›</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: '已完成', value: doneCount, color: 'text-green-500' },
          { label: '进行中', value: doingCount, color: 'text-orange-500' },
          { label: '待开始', value: todoCount, color: 'text-gray-400' },
          { label: '完成率', value: `${pct}%`, color: pct >= 80 ? 'text-green-500' : pct >= 50 ? 'text-yellow-500' : 'text-primary' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
            <div className="text-xs text-gray-400 mb-1">{s.label}</div>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Goal list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">本月目标</span>
          <button onClick={openAdd}
            className="text-sm text-primary hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1 rounded-lg transition-colors font-medium">
            ＋ 添加目标
          </button>
        </div>

        {loading ? (
          <div className="text-center text-sm text-gray-400 py-8">加载中…</div>
        ) : goals.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-10 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-200 dark:border-gray-600">
            还没有目标，点击右上角添加吧
          </div>
        ) : (
          <div className="space-y-2">
            {goals.map(g => {
              const cat = catOf(g.category)
              const st = STATUS_CFG[g.status] ?? STATUS_CFG.todo
              return (
                <div key={g.id} className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700 group">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{g.title}</div>
                    {g.progress_note && <div className="text-xs text-gray-400 mt-0.5">{g.progress_note}</div>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${cat.bg}`}>{cat.label}</span>
                  <button onClick={() => cycleStatus(g)} className={`text-xs px-2.5 py-0.5 rounded-full font-medium flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity ${st.cls}`}>
                    {st.label}
                  </button>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={() => openEdit(g)} className="text-xs text-gray-400 hover:text-orange-500 px-2 py-1 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/30">编辑</button>
                    <button onClick={() => deleteGoal(g.id)} className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30">删除</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700">
        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">📝 本月备忘</div>
        <textarea
          value={notes}
          onChange={e => saveNotes(e.target.value)}
          placeholder="记录本月的想法、重点提醒或复盘笔记…"
          rows={3}
          className="w-full text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-600 rounded-xl px-4 py-3 resize-none outline-none focus:border-primary dark:focus:border-red-600 transition-colors placeholder:text-gray-300 dark:placeholder:text-gray-600"
        />
      </div>

      {/* Add/Edit modal */}
      {showModal && editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20 px-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-bold text-gray-800 dark:text-gray-100">{editing.isNew ? '添加月度目标' : '编辑目标'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 text-xl leading-none">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">目标名称 *</label>
                <input type="text" value={editing.title || ''} onChange={e => setEditing(p => ({...p!, title: e.target.value}))}
                  placeholder="如：发布4篇长文"
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
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">状态</label>
                  <select value={editing.status || 'todo'} onChange={e => setEditing(p => ({...p!, status: e.target.value as MonthGoal['status']}))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-primary">
                    <option value="todo">待开始</option>
                    <option value="doing">进行中</option>
                    <option value="done">已完成</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">进度备注（可选）</label>
                <input type="text" value={editing.progress_note || ''} onChange={e => setEditing(p => ({...p!, progress_note: e.target.value}))}
                  placeholder="如：已完成 2/4 篇"
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
