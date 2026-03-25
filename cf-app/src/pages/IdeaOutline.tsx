import { useState } from 'react'
import { api, type OutlineResult } from '../lib/api'
import { generateOutlineExcel } from '../lib/generateOutlineExcel'

const PERSPECTIVE_OPTIONS = ['女主视角', '男主视角', '双主视角']

// ─── Preview table ────────────────────────────────────────────────────────────

function nl(s: string) {
  return (s || '').replace(/\\n/g, '\n')
}

function PreviewTable({ result }: { result: OutlineResult }) {
  const th = 'bg-blue-600 dark:bg-blue-700 text-white text-xs font-bold text-center px-2 py-1.5 border border-gray-300 dark:border-gray-600'
  const thSub = 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 text-xs font-semibold text-center px-2 py-1.5 border border-gray-300 dark:border-gray-600'
  const td = 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs px-2 py-2 border border-gray-300 dark:border-gray-600 align-top whitespace-pre-wrap'
  const thPurple = 'bg-purple-600 dark:bg-purple-700 text-white text-xs font-bold text-center px-2 py-1.5 border border-gray-300 dark:border-gray-600'
  const thPurpleSub = 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 text-xs font-semibold text-center px-2 py-1.5 border border-gray-300 dark:border-gray-600'
  const thTeal = 'bg-emerald-600 dark:bg-emerald-700 text-white text-xs font-bold text-center px-2 py-1.5 border border-gray-300 dark:border-gray-600'
  const thTealSub = 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 text-xs font-semibold text-center px-2 py-1.5 border border-gray-300 dark:border-gray-600'
  const thGreen = 'bg-green-800 dark:bg-green-900 text-white text-xs font-bold text-center px-2 py-1.5 border border-gray-300 dark:border-gray-600'

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-xs min-w-[700px]">
        {/* Row 1: Title */}
        <tbody>
          <tr>
            <td colSpan={10} className="bg-blue-800 dark:bg-blue-900 text-white text-center font-bold py-3 text-sm border border-gray-300 dark:border-gray-600">
              情绪结构思路拆解
            </td>
          </tr>

          {/* Row 2: Summary */}
          <tr>
            <td colSpan={10} className="bg-blue-50 dark:bg-blue-900/20 text-gray-800 dark:text-gray-100 font-semibold px-3 py-2.5 border border-gray-300 dark:border-gray-600">
              一句话梗概：<span className="text-yellow-600 dark:text-yellow-300">{result.summary}</span>
            </td>
          </tr>

          {/* Row 3–4: 结构 */}
          <tr>
            <td rowSpan={2} className={th}>结构</td>
            <td colSpan={3} className={thSub}>起</td>
            <td colSpan={3} className={thSub}>承</td>
            <td colSpan={2} className={thSub}>转</td>
            <td className={thSub}>合</td>
          </tr>
          <tr>
            <td colSpan={3} className={td}>{result.structure.qi}</td>
            <td colSpan={3} className={td}>{result.structure.cheng}</td>
            <td colSpan={2} className={td}>{result.structure.zhuan}</td>
            <td className={td}>{result.structure.he}</td>
          </tr>

          {/* Row 5–6: 事件流程 */}
          <tr>
            <td rowSpan={2} className={th}>事件流程</td>
            <td colSpan={3} className={thSub}>欲望</td>
            <td colSpan={3} className={thSub}>阻碍</td>
            <td colSpan={2} className={thSub}>行动</td>
            <td className={thSub}>达成</td>
          </tr>
          <tr>
            <td colSpan={3} className={td}>{result.event_flow.desire}</td>
            <td colSpan={3} className={td}>{nl(result.event_flow.obstacle)}</td>
            <td colSpan={2} className={td}>{nl(result.event_flow.action)}</td>
            <td className={td}>{result.event_flow.achieve}</td>
          </tr>

          {/* Row 7–10: 爽点元素 */}
          <tr>
            <td rowSpan={4} className={thPurple}>爽点元素</td>
            <td rowSpan={3} className={thPurple}>人物</td>
            <td colSpan={2} className={thPurpleSub}>主角势力</td>
            <td colSpan={6} className={td}>{result.characters.protagonist}</td>
          </tr>
          <tr>
            <td colSpan={2} className={thPurpleSub}>反派势力</td>
            <td colSpan={6} className={td}>{result.characters.antagonist}</td>
          </tr>
          <tr>
            <td colSpan={2} className={thPurpleSub}>围观群众</td>
            <td colSpan={6} className={td}>{result.characters.bystanders}</td>
          </tr>
          <tr>
            <td colSpan={3} className={thPurple}>情绪点要素、转折点</td>
            <td colSpan={6} className={td}>{nl(result.emotion_elements)}</td>
          </tr>

          {/* Row 11–12: 细纲 */}
          <tr>
            <td rowSpan={2} className={thTeal}>细纲</td>
            <td className={thTealSub}>铺垫情节（第一阶段）</td>
            <td className={thTealSub}>转折点</td>
            <td className={thTealSub}>情绪点①</td>
            <td className={thTealSub}>铺垫情节（第二阶段）</td>
            <td className={thTealSub}>转折点</td>
            <td className={thTealSub}>情绪点②</td>
            <td className={thTealSub}>铺垫情节（第三阶段）</td>
            <td className={thTealSub}>转折点</td>
            <td className={thTealSub}>情绪点③</td>
          </tr>
          <tr>
            {result.outline.flatMap((seg, i) => [
              <td key={`s${i}`} className={td}>{nl(seg.setup)}</td>,
              <td key={`t${i}`} className={`${td} text-red-600 dark:text-red-400`}>{nl(seg.turning)}</td>,
              <td key={`e${i}`} className={`${td} text-emerald-700 dark:text-emerald-400`}>{nl(seg.emotion)}</td>,
            ])}
          </tr>

          {/* Row 13–14: 情绪折线 */}
          <tr>
            <td rowSpan={2} className={thGreen}>情绪</td>
            <td colSpan={6} className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 text-xs font-semibold text-center px-2 py-1.5 border border-gray-300 dark:border-gray-600">
              主线情绪折线图
            </td>
            <td colSpan={2} className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 text-xs font-semibold text-center px-2 py-1.5 border border-gray-300 dark:border-gray-600">
              上行情绪
            </td>
            <td className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-semibold text-center px-2 py-1.5 border border-gray-300 dark:border-gray-600">
              下行情绪
            </td>
          </tr>
          <tr>
            <td colSpan={6} className={`${td} text-center text-gray-400 dark:text-gray-600 italic`}>（折线图）</td>
            <td colSpan={2} className={`${td} text-yellow-700 dark:text-yellow-300`}>{nl(result.emotion_arc.up)}</td>
            <td className={`${td} text-red-600 dark:text-red-400`}>{nl(result.emotion_arc.down)}</td>
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
  const [downloading, setDownloading] = useState(false)

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

  const handleDownload = async () => {
    if (!result) return
    setDownloading(true)
    try {
      await generateOutlineExcel(result)
    } catch (e) {
      setError('Excel 生成失败：' + (e as Error).message)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1">💡 生成细纲</h1>
      <p className="text-sm text-gray-500 mb-6">输入一个模糊的点子，AI 帮你生成情绪结构细纲，支持导出 Excel 表格</p>

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
            <div className="flex gap-2">
              <button
                onClick={generate}
                className="text-xs px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
              >
                🔄 重新生成
              </button>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="text-xs px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg font-semibold transition-colors"
              >
                {downloading ? '生成中…' : '⬇️ 下载 Excel'}
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
            <PreviewTable result={result} />
          </div>
        </div>
      )}
    </div>
  )
}
