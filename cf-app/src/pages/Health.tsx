import { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { api, type HealthWeight, type HealthMeasurement, type HealthExercise } from '../lib/api'

type Tab = 'weight' | 'measure' | 'exercise'

const EXERCISE_TYPES = [
  { emoji: '🧘', name: '普拉提' },
  { emoji: '🚶', name: '散步' },
  { emoji: '🏃', name: '跑步' },
  { emoji: '🏊', name: '游泳' },
  { emoji: '💃', name: '跳操' },
  { emoji: '🏋️', name: '力量训练' },
  { emoji: '🚴', name: '骑行' },
  { emoji: '🧗', name: '爬山' },
  { emoji: '🤸', name: '瑜伽' },
]

const MEASURE_FIELDS: { key: keyof HealthMeasurement; label: string }[] = [
  { key: 'chest', label: '胸围' },
  { key: 'waist', label: '腰围' },
  { key: 'hips', label: '臀围' },
  { key: 'thigh', label: '大腿围' },
  { key: 'arm', label: '臂围' },
  { key: 'calf', label: '小腿围' },
  { key: 'wrist', label: '手腕围' },
]

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function Health() {
  const [tab, setTab] = useState<Tab>('weight')

  // Weight state
  const [weights, setWeights] = useState<HealthWeight[]>([])
  const [goal, setGoal] = useState<number | null>(null)
  const [wDays, setWDays] = useState(30)
  const [showWModal, setShowWModal] = useState(false)
  const [wDate, setWDate] = useState(today())
  const [wValue, setWValue] = useState('')
  const [wNote, setWNote] = useState('')
  const [wSaving, setWSaving] = useState(false)
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [wGoalInput, setWGoalInput] = useState('')
  const [goalSaving, setGoalSaving] = useState(false)

  // Measurement state
  const [measurements, setMeasurements] = useState<HealthMeasurement[]>([])
  const [showMModal, setShowMModal] = useState(false)
  const [mDate, setMDate] = useState(today())
  const [mValues, setMValues] = useState<Record<string, string>>({})
  const [mSaving, setMSaving] = useState(false)

  // Exercise state
  const [exercises, setExercises] = useState<HealthExercise[]>([])
  const [showEModal, setShowEModal] = useState(false)
  const [eDate, setEDate] = useState(today())
  const [eType, setEType] = useState('普拉提')
  const [eCustom, setECustom] = useState('')
  const [eDuration, setEDuration] = useState('')
  const [eCalories, setECalories] = useState('')
  const [eNote, setENote] = useState('')
  const [eCustomMode, setECustomMode] = useState(false)
  const [eSaving, setESaving] = useState(false)

  const loadWeight = useCallback(async () => {
    const res = await api.health.getWeight(wDays)
    setWeights(res.records)
    setGoal(res.goal)
    if (res.goal) setWGoalInput(String(res.goal))
  }, [wDays])

  const loadMeasurements = useCallback(async () => {
    setMeasurements(await api.health.getMeasurements())
  }, [])

  const loadExercise = useCallback(async () => {
    setExercises(await api.health.getExercise())
  }, [])

  useEffect(() => { loadWeight() }, [loadWeight])
  useEffect(() => { loadMeasurements() }, [loadMeasurements])
  useEffect(() => { loadExercise() }, [loadExercise])

  // Weight helpers
  const sortedWeights = [...weights].sort((a, b) => a.date.localeCompare(b.date))
  const latestWeight = sortedWeights[sortedWeights.length - 1]
  const prevWeight = sortedWeights[sortedWeights.length - 2]
  const weightDiff = latestWeight && prevWeight ? (latestWeight.weight - prevWeight.weight) : null
  const monthStart = weights.filter(w => w.date >= today().slice(0, 7) + '-01')
  const monthFirst = monthStart.length > 0 ? monthStart[monthStart.length - 1] : null
  const monthDiff = latestWeight && monthFirst ? (latestWeight.weight - monthFirst.weight) : null

  const chartData = sortedWeights.map(w => ({
    date: w.date.slice(5),
    weight: w.weight,
  }))

  const handleSaveWeight = async () => {
    if (!wValue) return
    setWSaving(true)
    try {
      await api.health.saveWeight(wDate, parseFloat(wValue), wNote)
      await loadWeight()
      setShowWModal(false)
      setWValue(''); setWNote('')
    } finally { setWSaving(false) }
  }

  const handleSaveGoal = async () => {
    if (!wGoalInput) return
    setGoalSaving(true)
    try {
      await api.health.saveGoal(parseFloat(wGoalInput))
      await loadWeight()
      setShowGoalModal(false)
    } finally { setGoalSaving(false) }
  }

  const handleDeleteWeight = async (date: string) => {
    if (!confirm('删除这条记录？')) return
    await api.health.deleteWeight(date)
    await loadWeight()
  }

  // Measurement helpers
  const latestM = measurements[0]
  const prevM = measurements[1]

  const handleSaveMeasure = async () => {
    setMSaving(true)
    try {
      const data: Record<string, unknown> = { date: mDate }
      MEASURE_FIELDS.forEach(({ key }) => {
        const v = mValues[key as string]
        data[key as string] = v ? parseFloat(v) : null
      })
      await api.health.saveMeasurement(data as Partial<HealthMeasurement>)
      await loadMeasurements()
      setShowMModal(false)
      setMValues({})
    } finally { setMSaving(false) }
  }

  const handleDeleteMeasure = async (date: string) => {
    if (!confirm('删除这条记录？')) return
    await api.health.deleteMeasurement(date)
    await loadMeasurements()
  }

  // Exercise helpers
  const thisWeek = exercises.filter(e => {
    const d = new Date(e.date), now = new Date()
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay())
    return d >= weekStart
  })
  const thisMonth = exercises.filter(e => e.date.startsWith(today().slice(0, 7)))
  const monthCalories = thisMonth.reduce((s, e) => s + (e.calories ?? 0), 0)

  const exerciseEmoji = (type: string) => EXERCISE_TYPES.find(t => t.name === type)?.emoji ?? '🏅'

  const handleSaveExercise = async () => {
    const type = eCustomMode ? eCustom : eType
    if (!type) return
    setESaving(true)
    try {
      await api.health.saveExercise({
        date: eDate,
        type,
        duration: eDuration ? parseInt(eDuration) : undefined,
        calories: eCalories ? parseInt(eCalories) : undefined,
        note: eNote,
      })
      await loadExercise()
      setShowEModal(false)
      setEDuration(''); setECalories(''); setENote(''); setECustom('')
    } finally { setESaving(false) }
  }

  const handleDeleteExercise = async (id: string) => {
    if (!confirm('删除这条记录？')) return
    await api.health.deleteExercise(id)
    await loadExercise()
  }

  const diffColor = (v: number | null) => {
    if (v === null) return 'text-gray-400'
    if (v < 0) return 'text-green-500'
    if (v > 0) return 'text-red-400'
    return 'text-gray-400'
  }
  const diffLabel = (v: number | null, reverse = false) => {
    if (v === null || v === 0) return '—'
    const arrow = v < 0 ? '▼' : '▲'
    const val = Math.abs(v).toFixed(1)
    return `${arrow} ${val}`
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-5">💪 健康管理</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit mb-6">
        {([['weight','⚖️ 体重'],['measure','📏 维度'],['exercise','🏃 运动']] as [Tab,string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ===== 体重 Tab ===== */}
      {tab === 'weight' && (
        <div>
          {/* 统计卡片 */}
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center">
              <div className="text-xs text-gray-400 mb-1">今日体重</div>
              <div className="text-3xl font-bold text-gray-800 dark:text-gray-100">
                {latestWeight ? latestWeight.weight : '—'}<span className="text-sm text-gray-400 font-normal"> kg</span>
              </div>
              <div className={`text-xs mt-1 ${diffColor(weightDiff)}`}>
                {weightDiff !== null ? `${diffLabel(weightDiff)} 较昨日` : '暂无数据'}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center">
              <div className="text-xs text-gray-400 mb-1">本月变化</div>
              <div className={`text-3xl font-bold ${diffColor(monthDiff)}`}>
                {monthDiff !== null ? `${monthDiff > 0 ? '+' : ''}${monthDiff.toFixed(1)}` : '—'}<span className="text-sm font-normal text-gray-400"> kg</span>
              </div>
              <div className="text-xs mt-1 text-gray-400">{monthDiff !== null && monthDiff < 0 ? '持续下降中 💪' : monthDiff !== null && monthDiff > 0 ? '有点涨了' : '暂无数据'}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center relative group">
              <div className="text-xs text-gray-400 mb-1">目标体重</div>
              <div className="text-3xl font-bold text-gray-800 dark:text-gray-100">
                {goal ?? '—'}<span className="text-sm text-gray-400 font-normal"> kg</span>
              </div>
              <div className="text-xs mt-1 text-gray-400">
                {goal && latestWeight ? `还差 ${Math.abs(latestWeight.weight - goal).toFixed(1)} kg` : '未设置目标'}
              </div>
              <button
                onClick={() => { setWGoalInput(goal ? String(goal) : ''); setShowGoalModal(true) }}
                className="absolute top-2 right-2 text-xs text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
              >✎</button>
            </div>
          </div>

          {/* 趋势图 */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">📈 体重趋势</span>
              <div className="flex gap-2">
                {[30, 90, 365].map(d => (
                  <button key={d} onClick={() => setWDays(d)}
                    className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
                      wDays === d ? 'border-blue-400 text-blue-400 bg-blue-50 dark:bg-blue-950/30' : 'border-gray-200 dark:border-gray-600 text-gray-400 hover:border-gray-400'
                    }`}>
                    {d === 365 ? '1年' : `${d}天`}
                  </button>
                ))}
              </div>
            </div>
            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11, fill: '#9ca3af' }} unit="kg" width={50} />
                  <Tooltip
                    contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 13 }}
                    labelStyle={{ color: '#9ca3af' }}
                    formatter={(v: number) => [`${v} kg`, '体重']}
                  />
                  <Line type="monotone" dataKey="weight" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3, fill: '#60a5fa' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">记录多几天就能看到趋势图了～</div>
            )}
          </div>

          {/* 历史记录 */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">📋 历史记录</span>
              <button onClick={() => setShowWModal(true)}
                className="text-sm px-4 py-1.5 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity">
                + 记录体重
              </button>
            </div>
            {weights.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">还没有记录，点上面按钮开始吧～</p>
            ) : (
              <div className="space-y-2">
                {[...weights].sort((a,b) => b.date.localeCompare(a.date)).map((w, i, arr) => {
                  const prev = arr[i + 1]
                  const diff = prev ? w.weight - prev.weight : null
                  return (
                    <div key={w.id} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-900 rounded-lg group">
                      <span className="text-xs text-gray-400 w-16">{w.date.slice(5)}</span>
                      <span className="font-semibold text-gray-800 dark:text-gray-100">{w.weight} kg</span>
                      {w.note && <span className="text-xs text-gray-400 flex-1">{w.note}</span>}
                      {!w.note && <span className="flex-1" />}
                      <span className={`text-xs w-14 text-right ${diffColor(diff)}`}>{diffLabel(diff)}</span>
                      <button onClick={() => handleDeleteWeight(w.date)}
                        className="text-xs text-gray-300 dark:text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== 维度 Tab ===== */}
      {tab === 'measure' && (
        <div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 mb-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                最新测量{latestM ? <span className="text-gray-400 font-normal ml-2">（{latestM.date}）</span> : ''}
              </span>
              <button onClick={() => setShowMModal(true)}
                className="text-sm px-4 py-1.5 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity">
                + 记录维度
              </button>
            </div>
            {latestM ? (
              <div className="grid grid-cols-4 gap-3">
                {MEASURE_FIELDS.map(({ key, label }) => {
                  const val = latestM[key] as number | null
                  const prev = prevM ? prevM[key] as number | null : null
                  const diff = val !== null && prev !== null ? val - prev : null
                  return (
                    <div key={key} className="bg-gray-50 dark:bg-gray-900 rounded-xl p-3 text-center">
                      <div className="text-xs text-gray-400 mb-1">{label}</div>
                      <div className="text-xl font-bold text-gray-800 dark:text-gray-100">
                        {val ?? '—'}<span className="text-xs text-gray-400 font-normal"> cm</span>
                      </div>
                      <div className={`text-xs mt-0.5 ${diffColor(diff)}`}>
                        {diff !== null ? diffLabel(diff) : '—'}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-6">还没有维度记录，点上面按钮开始吧～</p>
            )}
          </div>

          {measurements.length > 0 && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">📋 测量历史</div>
              <div className="space-y-2">
                {measurements.map(m => (
                  <div key={m.id} className="flex items-start gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-900 rounded-lg group">
                    <span className="text-xs text-gray-400 w-16 pt-0.5">{m.date}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex-1 leading-5">
                      {MEASURE_FIELDS.filter(({ key }) => m[key] !== null).map(({ key, label }) => `${label}${m[key]}`).join(' · ')}
                    </span>
                    <button onClick={() => handleDeleteMeasure(m.date)}
                      className="text-xs text-gray-300 dark:text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== 运动 Tab ===== */}
      {tab === 'exercise' && (
        <div>
          <div className="grid grid-cols-3 gap-4 mb-5">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center">
              <div className="text-xs text-gray-400 mb-1">本周运动</div>
              <div className="text-3xl font-bold text-gray-800 dark:text-gray-100">{thisWeek.length}<span className="text-sm text-gray-400 font-normal"> 次</span></div>
              <div className="text-xs mt-1 text-gray-400">{thisWeek.length >= 3 ? '坚持得不错 🔥' : '加油多动动'}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center">
              <div className="text-xs text-gray-400 mb-1">本月运动</div>
              <div className="text-3xl font-bold text-gray-800 dark:text-gray-100">{thisMonth.length}<span className="text-sm text-gray-400 font-normal"> 次</span></div>
              <div className="text-xs mt-1 text-gray-400">本月累计</div>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center">
              <div className="text-xs text-gray-400 mb-1">本月消耗</div>
              <div className="text-3xl font-bold text-gray-800 dark:text-gray-100">{monthCalories > 0 ? monthCalories.toLocaleString() : '—'}<span className="text-sm text-gray-400 font-normal"> kcal</span></div>
              <div className="text-xs mt-1 text-gray-400">有记录的累计</div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">🏃 运动记录</span>
              <button onClick={() => setShowEModal(true)}
                className="text-sm px-4 py-1.5 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity">
                + 记录运动
              </button>
            </div>
            {exercises.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">还没有运动记录，动起来～</p>
            ) : (
              <div className="space-y-2">
                {exercises.map(e => (
                  <div key={e.id} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-900 rounded-lg group">
                    <span className="text-xl w-8 text-center">{exerciseEmoji(e.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-100">{e.type}</div>
                      <div className="text-xs text-gray-400">
                        {[e.duration ? `${e.duration}分钟` : null, e.calories ? `${e.calories} kcal` : null, e.note || null].filter(Boolean).join(' · ') || '无详情'}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">{e.date.slice(5)}</span>
                    <button onClick={() => handleDeleteExercise(e.id)}
                      className="text-xs text-gray-300 dark:text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== 记录体重弹窗 ===== */}
      {showWModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowWModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-80 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4">⚖️ 记录体重</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">日期</label>
                <input type="date" value={wDate} onChange={e => setWDate(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">体重（kg）</label>
                <input type="number" step="0.1" value={wValue} onChange={e => setWValue(e.target.value)} placeholder="例：57.3" autoFocus
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">备注（可选）</label>
                <input type="text" value={wNote} onChange={e => setWNote(e.target.value)} placeholder="晨起空腹、聚餐后…"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-primary" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowWModal(false)} className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-lg py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">取消</button>
              <button onClick={handleSaveWeight} disabled={wSaving || !wValue}
                className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-medium hover:opacity-90 disabled:opacity-40">
                {wSaving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 设置目标体重弹窗 ===== */}
      {showGoalModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowGoalModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-72 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4">🎯 设置目标体重</h3>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">目标体重（kg）</label>
              <input type="number" step="0.1" value={wGoalInput} onChange={e => setWGoalInput(e.target.value)} placeholder="例：54.0" autoFocus
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-primary" />
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowGoalModal(false)} className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-lg py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">取消</button>
              <button onClick={handleSaveGoal} disabled={goalSaving || !wGoalInput}
                className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-medium hover:opacity-90 disabled:opacity-40">
                {goalSaving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 记录维度弹窗 ===== */}
      {showMModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowMModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-96 shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4">📏 记录维度</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">日期</label>
                <input type="date" value={mDate} onChange={e => setMDate(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-primary" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {MEASURE_FIELDS.map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">{label} (cm)</label>
                    <input type="number" step="0.5" value={mValues[key as string] ?? ''} onChange={e => setMValues(v => ({ ...v, [key]: e.target.value }))}
                      placeholder={latestM?.[key] ? String(latestM[key]) : '—'}
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-primary" />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowMModal(false)} className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-lg py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">取消</button>
              <button onClick={handleSaveMeasure} disabled={mSaving}
                className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-medium hover:opacity-90 disabled:opacity-40">
                {mSaving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 记录运动弹窗 ===== */}
      {showEModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowEModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-96 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4">🏃 记录运动</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">日期</label>
                <input type="date" value={eDate} onChange={e => setEDate(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">运动类型</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {EXERCISE_TYPES.map(({ emoji, name }) => (
                    <button key={name} onClick={() => { setEType(name); setECustomMode(false) }}
                      className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                        !eCustomMode && eType === name ? 'border-blue-400 text-blue-400 bg-blue-50 dark:bg-blue-950/30' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400'
                      }`}>
                      {emoji} {name}
                    </button>
                  ))}
                  <button onClick={() => setECustomMode(true)}
                    className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                      eCustomMode ? 'border-blue-400 text-blue-400 bg-blue-50 dark:bg-blue-950/30' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400'
                    }`}>
                    ✏️ 自定义
                  </button>
                </div>
                {eCustomMode && (
                  <input type="text" value={eCustom} onChange={e => setECustom(e.target.value)} placeholder="输入运动名称" autoFocus
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-primary" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">时长（分钟，可选）</label>
                  <input type="number" value={eDuration} onChange={e => setEDuration(e.target.value)} placeholder="45"
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">消耗（kcal，可选）</label>
                  <input type="number" value={eCalories} onChange={e => setECalories(e.target.value)} placeholder="180"
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">备注（可选）</label>
                <input type="text" value={eNote} onChange={e => setENote(e.target.value)} placeholder="今天状态不错…"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-primary" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowEModal(false)} className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-lg py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">取消</button>
              <button onClick={handleSaveExercise} disabled={eSaving || (!eCustomMode && !eType) || (eCustomMode && !eCustom)}
                className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-medium hover:opacity-90 disabled:opacity-40">
                {eSaving ? '保存中…' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
