import { useState } from 'react'
import { api, type OutlineResult } from '../lib/api'

const PERSPECTIVE_OPTIONS = ['女主视角', '男主视角', '双主视角']

// ─── Preview table ────────────────────────────────────────────────────────────

function PreviewTable({ result }: { result: OutlineResult }) {
  const thGreen = 'bg-emerald-600 dark:bg-emerald-700 text-white text-xs font-bold text-center px-2 py-1.5 border border-gray-300 dark:border-gray-600'
  const thSub = 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 text-xs font-semibold text-center px-2 py-1.5 border border-gray-300 dark:border-gray-600'
  const thTurn = 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-semibold text-center px-2 py-1.5 border border-gray-300 dark:border-gray-600'
  const thEmot = 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 text-xs font-semibold text-center px-2 py-1.5 border border-gray-300 dark:border-gray-600'
  const td = 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs px-2 py-2 border border-gray-300 dark:border-gray-600 align-top whitespace-pre-wrap'
  const tdTurn = td + ' text-red-600 dark:text-red-400'
  const tdEmot = td + ' text-yellow-700 dark:text-yellow-300'

  const [s1, s2, s3] = result.outline

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs min-w-[1400px]">
        <tbody>
          <tr>
            <td rowSpan={2} className={thGreen + ' w-14'}>细纲</td>
            <th className={thSub}>铺垫情节（第一阶段）</th>
            <th className={thTurn}>转折点</th>
            <th className={thEmot}>情绪点①</th>
            <th className={thSub}>铺垫情节（第二阶段）</th>
            <th className={thTurn}>转折点</th>
            <th className={thEmot}>情绪点②</th>
            <th className={thSub}>铺垫情节（第三阶段）</th>
            <th className={thTurn}>转折点</th>
            <th className={thEmot}>情绪点③</th>
          </tr>
          <tr>
            <td className={td} style={{ minWidth: 280, maxWidth: 400 }}>{s1?.setup || ''}</td>
            <td className={tdTurn} style={{ minWidth: 120 }}>{s1?.turning || ''}</td>
            <td className={tdEmot} style={{ minWidth: 120 }}>{s1?.emotion || ''}</td>
            <td className={td} style={{ minWidth: 280, maxWidth: 400 }}>{s2?.setup || ''}</td>
            <td className={tdTurn} style={{ minWidth: 120 }}>{s2?.turning || ''}</td>
            <td className={tdEmot} style={{ minWidth: 120 }}>{s2?.emotion || ''}</td>
            <td className={td} style={{ minWidth: 280, maxWidth: 400 }}>{s3?.setup || ''}</td>
            <td className={tdTurn} style={{ minWidth: 120 }}>{s3?.turning || ''}</td>
            <td className={tdEmot} style={{ minWidth: 120 }}>{s3?.emotion || ''}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function IdeaOutline() {
  const [idea, setIdea] = useState('')
  const [perspective, setPerspective] = useState(PERSPECTIVE_OPTIONS[0])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<OutlineResult | null>(null)
  const [error, setError] = useState('')

  const generate = async () => {
    if (!idea.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const data = await api.outline.generate({ idea: idea.trim(), perspective })
      setResult(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1">💡 生成细纲</h1>
      <p className="text-sm text-gray-500 mb-6">输入一个模糊的点子，AI 帮你生成情绪结构细纲</p>

      {/* 输入区 */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 mb-5">
        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-2">
          你的点子（可以很模糊，一句话到一段话都行）
        </label>
        <textarea
          value={idea}
          onChange={e => setIdea(e.target.value)}
          placeholder="比如：看到一个故事说女主一直默默付出，男主娶了别人，多年后男主后悔了……&#10;或者：想写一个隐藏大佬设定，女主表面很普通但其实……&#10;或者只是：想写一个很虐的先婚后爱"
          rows={5}
          className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-800 dark:text-gray-100 text-sm leading-relaxed resize-none focus:outline-none focus:border-primary placeholder-gray-400 dark:placeholder-gray-600"
        />
        <div className="flex flex-wrap items-end gap-3 mt-3">
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">视角</label>
            <select
              value={perspective}
              onChange={e => setPerspective(e.target.value)}
              className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:border-primary cursor-pointer"
            >
              {PERSPECTIVE_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
          </div>
          <button
            onClick={generate}
            disabled={loading || !idea.trim()}
            className="px-6 py-2 bg-primary hover:opacity-90 disabled:opacity-40 text-white rounded-xl text-sm font-semibold transition-opacity flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="inline-flex gap-1">
                  {[0, 0.2, 0.4].map((d, i) => (
                    <span key={i} style={{ animationDelay: `${d}s` }}
                      className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" />
                  ))}
                </span>
                生成中…
              </>
            ) : '✨ 生成细纲'}
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-600 mt-2">爆款公式：情绪 × 节奏 × 创新</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      {/* 结果区 */}
      {result && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">预览</h2>
            <button
              onClick={generate}
              className="text-xs px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
            >
              🔄 重新生成
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
            <PreviewTable result={result} />
          </div>
        </div>
      )}
    </div>
  )
}
