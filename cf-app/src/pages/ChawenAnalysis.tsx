import { useState, useRef } from 'react'
import { api } from '../lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Character {
  name: string
  role_type: string
  role_position: string
  identity: string
  personality: string
  motivation: string
  obstacles: string
}

interface EmotionPoint {
  label: string
  chapter_range: string
  intensity: number
  description: string
}

interface ChawenResult {
  overview: {
    theme_type: string
    summary: string
    core_conflicts: string[]
    attraction_hooks: string[]
    background: string
    characters: Character[]
    emotion_curve: EmotionPoint[]
  }
  storyline: {
    main_line: {
      title: string
      stages: { stage: string; chapter_range: string; description: string }[]
    }
    sub_lines: { index: number; title: string; description: string }[]
  }
  prologue: {
    hook_design: string
    background_info: string
    narrative_tone: string
  }
  chapters: {
    chapter_num: number
    chapter_title: string
    core_event: string
    emotion_change: string
    task_dynamic: string
    chapter_role: string
    conflict_progress: string
    suspense_foreshadow: string
  }[]
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, { bg: string; border: string; badge: string; avatar: string }> = {
  '女主': { bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-200 dark:border-rose-800', badge: 'bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300', avatar: 'bg-rose-200 dark:bg-rose-800' },
  '男主': { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', badge: 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300', avatar: 'bg-blue-200 dark:bg-blue-800' },
  '反派': { bg: 'bg-gray-50 dark:bg-gray-800/50', border: 'border-gray-200 dark:border-gray-700', badge: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300', avatar: 'bg-gray-200 dark:bg-gray-700' },
}
const defaultColor = { bg: 'bg-purple-50 dark:bg-purple-950/30', border: 'border-purple-200 dark:border-purple-800', badge: 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-300', avatar: 'bg-purple-200 dark:bg-purple-800' }

const ROLE_EMOJIS: Record<string, string> = { '女主': '👧', '男主': '👨‍💼', '反派': '🦹', '配角': '👤' }

const STAGE_COLORS = [
  'bg-rose-50 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800',
  'bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800',
  'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800',
  'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800',
]
const STAGE_LABEL_COLORS = ['text-rose-500', 'text-orange-500', 'text-red-500', 'text-emerald-600']

const SUB_LINE_COLORS = [
  'bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800',
  'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',
  'bg-teal-50 border-teal-200 dark:bg-teal-950/30 dark:border-teal-800',
  'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800',
]
const SUB_PILL_COLORS = [
  'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-300',
  'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300',
  'bg-teal-100 text-teal-600 dark:bg-teal-900/50 dark:text-teal-300',
  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
]

const HOOK_COLORS = [
  'bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-300',
  'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300',
  'bg-pink-50 text-pink-600 dark:bg-pink-950/50 dark:text-pink-300',
  'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-300',
  'bg-green-50 text-green-600 dark:bg-green-950/50 dark:text-green-300',
  'bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-300',
]

// ─── Emotion Curve SVG ────────────────────────────────────────────────────────

function EmotionCurve({ points }: { points: EmotionPoint[] }) {
  if (!points.length) return null
  const W = 560, H = 130, PAD_L = 28, PAD_R = 10, PAD_T = 20, PAD_B = 30
  const chartW = W - PAD_L - PAD_R
  const chartH = H - PAD_T - PAD_B

  const xs = points.map((_, i) => PAD_L + (i / Math.max(points.length - 1, 1)) * chartW)
  const ys = points.map(p => PAD_T + (1 - p.intensity) * chartH)

  // smooth bezier
  const pathD = xs.reduce((acc, x, i) => {
    if (i === 0) return `M${x},${ys[i]}`
    const prev_x = xs[i - 1], prev_y = ys[i - 1]
    const cp1x = prev_x + (x - prev_x) * 0.4, cp1y = prev_y
    const cp2x = prev_x + (x - prev_x) * 0.6, cp2y = ys[i]
    return `${acc} C${cp1x},${cp1y} ${cp2x},${cp2y} ${x},${ys[i]}`
  }, '')

  const fillD = `${pathD} L${xs[xs.length - 1]},${PAD_T + chartH} L${PAD_L},${PAD_T + chartH} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <defs>
        <linearGradient id="cwGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF6B6B" />
          <stop offset="100%" stopColor="#FF6B6B" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* grid */}
      {[0.25, 0.5, 0.75].map(t => (
        <line key={t} x1={PAD_L} y1={PAD_T + t * chartH} x2={W - PAD_R} y2={PAD_T + t * chartH}
          stroke="#f3f4f6" strokeWidth="1" className="dark:stroke-gray-700" />
      ))}
      <text x="4" y={PAD_T + 4} fontSize="8" fill="#9ca3af">高</text>
      <text x="4" y={PAD_T + chartH / 2 + 4} fontSize="8" fill="#9ca3af">中</text>
      <text x="4" y={PAD_T + chartH + 4} fontSize="8" fill="#9ca3af">低</text>
      {/* fill */}
      <path d={fillD} fill="url(#cwGrad)" opacity="0.15" />
      {/* line */}
      <path d={pathD} fill="none" stroke="#FF6B6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* dots + labels */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={xs[i]} cy={ys[i]} r="3.5" fill="#FF6B6B" />
          <text
            x={xs[i]}
            y={p.intensity > 0.5 ? ys[i] - 6 : ys[i] + 14}
            fontSize="8"
            fill={p.intensity > 0.5 ? '#FF6B6B' : '#6b7280'}
            textAnchor="middle"
          >
            {p.label}
          </text>
          <text x={xs[i]} y={H - 4} fontSize="7.5" fill="#9ca3af" textAnchor="middle">
            {p.chapter_range}
          </text>
        </g>
      ))}
    </svg>
  )
}

// ─── Article Source Picker (modal) ───────────────────────────────────────────

function ArticlePicker({ onSelect, onClose }: { onSelect: (id: string, title: string, content: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [articles, setArticles] = useState<{ id: string; title: string; category: string; word_count: number }[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const search = async () => {
    if (!query.trim()) return
    setLoading(true)
    try {
      const res = await api.articles.list({ search: query.trim(), limit: 20 })
      setArticles(res.articles)
      setSearched(true)
    } finally {
      setLoading(false)
    }
  }

  const pick = async (id: string, title: string) => {
    const full = await api.articles.get(id)
    onSelect(id, full.title, full.content)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 dark:text-gray-100">从文章库选择</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg">×</button>
        </div>
        <div className="flex gap-2 mb-3">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="搜索文章标题…"
            className="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary text-gray-800 dark:text-gray-100 placeholder-gray-400"
          />
          <button
            onClick={search}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-xl text-white disabled:opacity-50"
            style={{ background: 'var(--primary)' }}
          >
            {loading ? '…' : '搜索'}
          </button>
        </div>
        {!searched && (
          <p className="text-xs text-gray-400 text-center py-6">输入关键词搜索文章库</p>
        )}
        {searched && articles.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-6">没有找到相关文章</p>
        )}
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {articles.map(a => (
            <button
              key={a.id}
              onClick={() => pick(a.id, a.title)}
              className="w-full text-left p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-orange-50 dark:hover:bg-orange-900/20 border border-gray-200 dark:border-gray-700 hover:border-orange-200 dark:hover:border-orange-700 transition-colors"
            >
              <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{a.title}</div>
              <div className="text-xs text-gray-400 mt-0.5">{a.category} · {a.word_count?.toLocaleString()} 字</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

type InnerTab = 'overview' | 'storyline' | 'chapters'

export default function ChawenAnalysis() {
  const [articleTitle, setArticleTitle] = useState('')
  const [articleContent, setArticleContent] = useState('')
  const [wordCount, setWordCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ChawenResult | null>(null)
  const [error, setError] = useState('')
  const [innerTab, setInnerTab] = useState<InnerTab>('overview')
  const [showPicker, setShowPicker] = useState(false)
  const [uploadMode, setUploadMode] = useState(false)
  const [expandedChars, setExpandedChars] = useState(false)
  const [openChapters, setOpenChapters] = useState<Set<number>>(new Set([1]))
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleContentChange = (text: string) => {
    setArticleContent(text)
    setWordCount(text.replace(/\s/g, '').length)
    setResult(null)
    setError('')
  }

  const handleSelectArticle = (_id: string, title: string, content: string) => {
    setArticleTitle(title)
    setArticleContent(content)
    setWordCount(content.replace(/\s/g, '').length)
    setResult(null)
    setError('')
    setUploadMode(false)
    setShowPicker(false)
  }

  const analyze = async () => {
    if (!articleContent.trim() || articleContent.trim().length < 100) {
      setError('文章内容太短，至少需要100字')
      return
    }
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const data = await api.chawen.analyze({ content: articleContent, title: articleTitle })
      setResult(data)
      setInnerTab('overview')
    } catch (e) {
      setError((e as Error).message || '分析失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const toggleChapter = (n: number) => {
    setOpenChapters(prev => {
      const next = new Set(prev)
      next.has(n) ? next.delete(n) : next.add(n)
      return next
    })
  }

  const hasContent = articleContent.trim().length >= 100

  // ── Empty / Input state ──────────────────────────────────────────────────────
  if (!hasContent || uploadMode) {
    return (
      <>
        {showPicker && <ArticlePicker onSelect={handleSelectArticle} onClose={() => setShowPicker(false)} />}
        <div className="space-y-4">
          {/* Action row */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">选择文章来源：</span>
            <button
              onClick={() => setShowPicker(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500 transition-colors bg-white dark:bg-gray-800"
            >
              📂 从库里选
            </button>
            <button
              onClick={() => setUploadMode(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-white font-medium"
              style={{ background: 'var(--primary)' }}
            >
              ✍️ 手动粘贴
            </button>
          </div>

          {/* Paste area */}
          {uploadMode && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
              <div className="mb-3 flex items-center justify-between">
                <label className="text-xs text-gray-500 dark:text-gray-400">文章标题（可选）</label>
              </div>
              <input
                value={articleTitle}
                onChange={e => setArticleTitle(e.target.value)}
                placeholder="输入文章标题…"
                className="w-full mb-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-primary"
              />
              <label className="text-xs text-gray-500 dark:text-gray-400 block mb-2">粘贴文章正文</label>
              <textarea
                ref={textareaRef}
                value={articleContent}
                onChange={e => handleContentChange(e.target.value)}
                placeholder="将文章内容粘贴到这里，至少100字…"
                rows={12}
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-800 dark:text-gray-100 leading-relaxed resize-none focus:outline-none focus:border-primary placeholder-gray-400 dark:placeholder-gray-600"
              />
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-gray-400">{wordCount > 0 ? `${wordCount.toLocaleString()} 字` : '输入文章内容'}</span>
                <div className="flex gap-2">
                  <button onClick={() => { setUploadMode(false); setArticleContent(''); setWordCount(0) }} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">取消</button>
                  <button
                    onClick={analyze}
                    disabled={!hasContent || loading}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg text-white font-medium disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg, #FF6B6B, #ff8e53)' }}
                  >
                    {loading ? '分析中…' : '✨ 开始拆文'}
                  </button>
                </div>
              </div>
              {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
            </div>
          )}

          {/* Empty illustration */}
          {!uploadMode && (
            <div className="bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 rounded-2xl py-16 text-center">
              <div className="text-4xl mb-3">📖</div>
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-1">选择一篇文章开始拆解</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500">AI 帮你深度分析故事结构、人物、情绪曲线和章节</p>
            </div>
          )}
        </div>
      </>
    )
  }

  // ── Has content, not yet analyzed ────────────────────────────────────────────
  if (!result && !loading) {
    return (
      <>
        {showPicker && <ArticlePicker onSelect={handleSelectArticle} onClose={() => setShowPicker(false)} />}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-800 dark:text-gray-100 mb-0.5 truncate">{articleTitle || '（未命名文章）'}</div>
                <div className="text-xs text-gray-400">{wordCount.toLocaleString()} 字</div>
              </div>
              <button onClick={() => { setArticleContent(''); setWordCount(0); setArticleTitle('') }} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">重新选择</button>
              <button
                onClick={() => setShowPicker(true)}
                className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:border-gray-400 bg-white dark:bg-gray-800"
              >
                📂 换一篇
              </button>
              <button
                onClick={analyze}
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg text-white font-semibold"
                style={{ background: 'linear-gradient(135deg, #FF6B6B, #ff8e53)' }}
              >
                ✨ 开始拆文
              </button>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-xl p-3 max-h-32 overflow-y-auto leading-relaxed">
              {articleContent.slice(0, 300)}{articleContent.length > 300 ? '…' : ''}
            </div>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </>
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-10 h-10 border-2 border-gray-200 dark:border-gray-700 border-t-primary rounded-full animate-spin" style={{ borderTopColor: 'var(--primary)' }} />
        <div className="text-sm text-gray-500 dark:text-gray-400">AI 正在深度拆解文章，请稍候…</div>
        <div className="text-xs text-gray-400 dark:text-gray-500">通常需要 20-40 秒</div>
      </div>
    )
  }

  // ── Results ───────────────────────────────────────────────────────────────────
  if (!result) return null

  return (
    <>
      {showPicker && <ArticlePicker onSelect={handleSelectArticle} onClose={() => setShowPicker(false)} />}

      <div className="flex gap-3 h-full" style={{ minHeight: 0 }}>

        {/* ── Left: 原文 ─────────────────────────────────────────────────────── */}
        <div className="w-[250px] flex-shrink-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100vh - 140px)' }}>
          <div className="px-3 py-2.5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">原文</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-orange-500 bg-orange-50 dark:bg-orange-950/50 px-2 py-0.5 rounded-full">已选</span>
              <button onClick={() => { setArticleContent(''); setWordCount(0); setArticleTitle(''); setResult(null) }} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">换</button>
            </div>
          </div>
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex-shrink-0">
            <div className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate">{articleTitle || '（未命名）'}</div>
            <div className="text-xs text-gray-400 mt-0.5">{wordCount.toLocaleString()} 字</div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 text-xs text-gray-600 dark:text-gray-400 leading-[1.9] text-justify scrollbar-thin"
            style={{ scrollbarWidth: 'thin' }}>
            {articleContent.split('\n').filter(Boolean).map((p, i) => (
              <p key={i} className="mb-2" style={{ textIndent: '2em' }}>{p}</p>
            ))}
          </div>
          <div className="px-3 py-2.5 border-t border-gray-100 dark:border-gray-700 flex gap-2 flex-shrink-0">
            <button onClick={() => setShowPicker(true)} className="flex-1 text-xs py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-500 dark:text-gray-400 hover:border-gray-400 bg-white dark:bg-gray-800">📂 换文章</button>
            <button onClick={analyze} disabled={loading} className="flex-1 text-xs py-1.5 rounded-lg text-white font-medium" style={{ background: 'var(--primary)' }}>♻️ 重新拆</button>
          </div>
        </div>

        {/* ── Right: Analysis ────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Status bar */}
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl mb-2 flex-shrink-0">
            <span className="text-sm">✅</span>
            <span className="text-xs text-emerald-700 dark:text-emerald-300">拆文完成，共分析 <strong>{result.chapters.length} 章</strong></span>
          </div>

          {/* Inner tabs */}
          <div className="flex gap-1 mb-2 flex-shrink-0">
            {([['overview', '🔍 文章概览'], ['storyline', '🧵 故事线'], ['chapters', '📋 章节拆解']] as [InnerTab, string][]).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setInnerTab(id)}
                className={`px-3 py-2 text-xs font-medium rounded-xl transition-colors ${
                  innerTab === id
                    ? 'bg-orange-50 dark:bg-orange-950/50 text-primary font-semibold'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 bg-white dark:bg-gray-800'
                }`}
                style={innerTab === id ? { color: 'var(--primary)' } : {}}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1" style={{ scrollbarWidth: 'thin', maxHeight: 'calc(100vh - 210px)' }}>

            {/* ═══ TAB: 文章概览 ═══════════════════════════════════════════ */}
            {innerTab === 'overview' && (
              <>
                {/* 1. 主题概述 */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center flex-shrink-0 font-bold" style={{ background: 'var(--primary)' }}>1</span>
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-200">主题概述</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-xl p-2.5">
                      <div className="text-xs text-orange-400 dark:text-orange-500 mb-1 font-semibold">主题类型</div>
                      <div className="text-xs font-bold text-orange-600 dark:text-orange-300">{result.overview.theme_type}</div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl p-2.5">
                      <div className="text-xs text-gray-400 mb-1 font-semibold">一句话梗概</div>
                      <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{result.overview.summary}</div>
                    </div>
                  </div>
                </div>

                {/* 2. 核心冲突 & 吸引机制 */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center flex-shrink-0 font-bold" style={{ background: 'var(--primary)' }}>2</span>
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-200">核心冲突 & 吸引机制</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-gray-400 font-semibold mb-2 uppercase tracking-wide">核心冲突</div>
                      <div className="space-y-1.5">
                        {result.overview.core_conflicts.map((c, i) => (
                          <div key={i} className="flex gap-2 text-xs text-gray-700 dark:text-gray-300">
                            <span className="text-red-400 flex-shrink-0 mt-0.5">⚡</span>
                            <span>{c}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 font-semibold mb-2 uppercase tracking-wide">吸引机制</div>
                      <div className="flex flex-wrap gap-1">
                        {result.overview.attraction_hooks.map((h, i) => (
                          <span key={i} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${HOOK_COLORS[i % HOOK_COLORS.length]}`}>{h}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. 故事背景 */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center flex-shrink-0 font-bold" style={{ background: 'var(--primary)' }}>3</span>
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-200">故事背景</span>
                  </div>
                  <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{result.overview.background}</p>
                </div>

                {/* 4. 主要人物 */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center flex-shrink-0 font-bold" style={{ background: 'var(--primary)' }}>4</span>
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-200">主要人物</span>
                  </div>
                  <div className="space-y-2">
                    {result.overview.characters.slice(0, expandedChars ? undefined : 2).map((char, i) => {
                      const colors = ROLE_COLORS[char.role_type] || defaultColor
                      const emoji = ROLE_EMOJIS[char.role_type] || '👤'
                      return (
                        <div key={i} className={`border rounded-xl overflow-hidden ${colors.border}`}>
                          <div className={`flex items-center gap-2 px-3 py-2 border-b border-opacity-50 ${colors.bg}`} style={{ borderColor: 'inherit', borderBottomWidth: 1 }}>
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm ${colors.avatar}`}>{emoji}</div>
                            <span className="text-xs font-bold text-gray-800 dark:text-gray-100">{char.name}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${colors.badge}`}>{char.role_type}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 px-3 py-2.5">
                            {([['角色定位', char.role_position], ['身份设定', char.identity], ['性格特征', char.personality], ['核心动机', char.motivation]] as [string, string][]).map(([label, val]) => (
                              <div key={label}>
                                <div className="text-xs text-gray-400 dark:text-gray-500 font-semibold mb-0.5">{label}</div>
                                <div className="text-xs text-gray-700 dark:text-gray-300 leading-snug">{val}</div>
                              </div>
                            ))}
                            <div className="col-span-2">
                              <div className="text-xs text-gray-400 dark:text-gray-500 font-semibold mb-0.5">限制阻碍</div>
                              <div className="text-xs text-gray-700 dark:text-gray-300 leading-snug">{char.obstacles}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {result.overview.characters.length > 2 && (
                      <button
                        onClick={() => setExpandedChars(!expandedChars)}
                        className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl transition-colors"
                      >
                        {expandedChars ? '收起' : `+ 还有 ${result.overview.characters.length - 2} 个人物`}
                      </button>
                    )}
                  </div>
                </div>

                {/* 5. 情绪曲线 */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-5 h-5 rounded-full text-white text-xs flex items-center justify-center flex-shrink-0 font-bold" style={{ background: 'var(--primary)' }}>5</span>
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-200">情绪曲线</span>
                  </div>
                  <EmotionCurve points={result.overview.emotion_curve} />
                </div>
              </>
            )}

            {/* ═══ TAB: 故事线 ════════════════════════════════════════════ */}
            {innerTab === 'storyline' && (
              <>
                {/* 主线 */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: 'var(--primary)' }}>主线</span>
                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{result.storyline.main_line.title}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {result.storyline.main_line.stages.map((s, i) => (
                      <div key={i} className={`border rounded-xl p-2.5 ${STAGE_COLORS[i % STAGE_COLORS.length]}`}>
                        <div className={`text-xs font-bold mb-1.5 ${STAGE_LABEL_COLORS[i % STAGE_LABEL_COLORS.length]}`}>
                          {['🌱', '🔥', '⚡', '🌅'][i]} {s.stage}
                        </div>
                        <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{s.description}</div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">{s.chapter_range}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 支线 */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
                  <div className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-3">支线分析</div>
                  <div className="space-y-2">
                    {result.storyline.sub_lines.map((sl, i) => (
                      <div key={i} className={`flex gap-2 items-start p-2.5 border rounded-xl ${SUB_LINE_COLORS[i % SUB_LINE_COLORS.length]}`}>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${SUB_PILL_COLORS[i % SUB_PILL_COLORS.length]}`}>支线{sl.index}</span>
                        <div>
                          <div className="text-xs font-semibold text-gray-800 dark:text-gray-100 mb-0.5">{sl.title}</div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{sl.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ═══ TAB: 章节拆解 ══════════════════════════════════════════ */}
            {innerTab === 'chapters' && (
              <>
                {/* 导语分析 */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
                  <div className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-3">📣 导语分析</div>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      ['bg-yellow-50 border-yellow-100 dark:bg-yellow-950/30 dark:border-yellow-800', 'text-yellow-600 dark:text-yellow-400', '🪝 钩子设计', result.prologue.hook_design],
                      ['bg-sky-50 border-sky-100 dark:bg-sky-950/30 dark:border-sky-800', 'text-sky-600 dark:text-sky-400', '🏛️ 背景信息', result.prologue.background_info],
                      ['bg-violet-50 border-violet-100 dark:bg-violet-950/30 dark:border-violet-800', 'text-violet-600 dark:text-violet-400', '🎭 叙事基调', result.prologue.narrative_tone],
                    ] as [string, string, string, string][]).map(([bg, label_c, label, text]) => (
                      <div key={label} className={`border rounded-xl p-2.5 ${bg}`}>
                        <div className={`text-xs font-semibold mb-1 ${label_c}`}>{label}</div>
                        <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{text}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 章节列表 */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
                  <div className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-3">📖 章节拆解</div>
                  <div className="space-y-1.5">
                    {result.chapters.map(ch => (
                      <div key={ch.chapter_num} className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                        <button
                          onClick={() => toggleChapter(ch.chapter_num)}
                          className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors text-left"
                        >
                          <span className={`text-xs text-gray-400 transition-transform duration-200 ${openChapters.has(ch.chapter_num) ? 'rotate-90' : ''}`}>▶</span>
                          <span className="text-xs font-bold text-gray-800 dark:text-gray-100">第 {ch.chapter_num} 章</span>
                          {ch.chapter_title && <span className="text-xs text-gray-500 dark:text-gray-400">— {ch.chapter_title}</span>}
                          <div className="ml-auto flex gap-1.5">
                            {ch.emotion_change && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 dark:bg-orange-950/50 text-orange-500">
                                {ch.emotion_change.length > 12 ? ch.emotion_change.slice(0, 12) + '…' : ch.emotion_change}
                              </span>
                            )}
                          </div>
                        </button>
                        {openChapters.has(ch.chapter_num) && (
                          <div className="grid grid-cols-3 gap-2 p-3">
                            {([
                              ['🎯 核心事件', ch.core_event],
                              ['💓 情绪变化', ch.emotion_change],
                              ['🧩 任务动态', ch.task_dynamic],
                              ['📌 章节作用', ch.chapter_role],
                              ['⚔️ 冲突进展', ch.conflict_progress],
                              ['🎣 悬念与伏笔', ch.suspense_foreshadow],
                            ] as [string, string][]).map(([label, val]) => (
                              <div key={label}>
                                <div className="text-xs text-gray-400 dark:text-gray-500 font-semibold mb-1">{label}</div>
                                <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{val}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

          </div>
        </div>

      </div>
    </>
  )
}
