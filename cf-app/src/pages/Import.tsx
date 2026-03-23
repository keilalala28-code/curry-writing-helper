import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { getToken } from '../lib/auth'

const HOOK_KEYWORDS = [
  '逆袭', '重生', '复仇', '虐心', '甜宠', '霸总', '穿越', '系统',
  '末世', '修仙', '赘婿', '豪门', '种田', '战神', '医术',
]

function extractHooks(text: string): string[] {
  return HOOK_KEYWORDS.filter((k) => text.includes(k))
}

function countChinese(text: string): number {
  return (text.match(/[\u4e00-\u9fff]/g) || []).length
}

interface AiResult {
  category: string
  hooks: string[]
  tags: string[]
  summary: string
  writing_tips: string
}

type Tab = 'paste' | 'txt'

interface TxtFile {
  name: string
  title: string
  content: string
  status: 'pending' | 'analyzing' | 'done' | 'error'
  error?: string
  category?: string
  hooks?: string[]
  tags?: string[]
}

export default function Import() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('paste')

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [source, setSource] = useState('')
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)

  const [analyzing, setAnalyzing] = useState(false)
  const [aiResult, setAiResult] = useState<AiResult | null>(null)
  const [aiError, setAiError] = useState('')

  const [txtFiles, setTxtFiles] = useState<TxtFile[]>([])
  const [txtRunning, setTxtRunning] = useState(false)
  const [txtDone, setTxtDone] = useState(0)

  // ── AI Analysis ──────────────────────────────────────────────────────────────
  const analyze = async () => {
    if (!title && !content) return
    setAnalyzing(true)
    setAiResult(null)
    setAiError('')
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-token': getToken() },
        credentials: 'include',
        body: JSON.stringify({ title, content }),
      })
      const d = await res.json() as AiResult & { error?: string }
      if (d.error) { setAiError(d.error); return }
      setAiResult(d)
      // Auto-fill category if empty
      if (!category && d.category) setCategory(d.category)
    } catch (e) {
      setAiError(String(e))
    } finally {
      setAnalyzing(false)
    }
  }

  const applyAiHooks = (hooks: string[]) => {
    // Will be included when importing
    setAiResult(prev => prev ? { ...prev, hooks } : prev)
  }

  // ── Import pasted article ─────────────────────────────────────────────────
  const importPasted = async () => {
    if (!title.trim() || busy) return
    setBusy(true)
    const localHooks = extractHooks(title + content)
    const aiHooks = aiResult?.hooks || []
    const allHooks = [...new Set([...localHooks, ...aiHooks])]
    const allTags = aiResult?.tags || []

    const result = await api.articles.create({
      title: title.trim(),
      category: category.trim() || aiResult?.category || '',
      source: source.trim(),
      content: content.trim(),
      word_count: countChinese(content),
      hooks: allHooks,
      tags: allTags,
    })
    navigate(`/articles/${result.id}`)
  }

  // ── Batch TXT import ──────────────────────────────────────────────────────
  async function readTxt(file: File): Promise<string> {
    const buf = await file.arrayBuffer()
    const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf)
    // If replacement chars are common, it's likely GBK
    const garbled = (utf8.match(/\uFFFD/g) || []).length
    if (garbled > 3) {
      return new TextDecoder('gbk', { fatal: false }).decode(buf)
    }
    return utf8
  }

  const onTxtSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const loaded: TxtFile[] = await Promise.all(files.map(async (f) => {
      const text = await readTxt(f)
      const title = f.name.replace(/\.txt$/i, '')
      return { name: f.name, title, content: text, status: 'pending' as const }
    }))
    setTxtFiles(loaded)
    setTxtDone(0)
    e.target.value = ''
  }

  const runTxtImport = async () => {
    if (txtRunning || txtFiles.length === 0) return
    setTxtRunning(true)
    setTxtDone(0)

    const files = [...txtFiles]
    for (let i = 0; i < files.length; i++) {
      // Mark as analyzing
      setTxtFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'analyzing' } : f))

      try {
        // AI analyze
        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-session-token': getToken() },
          credentials: 'include',
          body: JSON.stringify({ title: files[i].title, content: files[i].content.slice(0, 3000) }),
        })
        const aiData = await res.json() as AiResult & { error?: string }
        if (aiData.error) throw new Error(aiData.error)

        // Import article
        const localHooks = extractHooks(files[i].title + files[i].content)
        const allHooks = [...new Set([...localHooks, ...(aiData.hooks || [])])]
        await api.articles.create({
          title: files[i].title,
          category: aiData.category || '',
          content: files[i].content,
          word_count: countChinese(files[i].content),
          hooks: allHooks,
          tags: aiData.tags || [],
        })

        setTxtFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: 'done', category: aiData.category, hooks: allHooks, tags: aiData.tags } : f
        ))
      } catch (err) {
        setTxtFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: 'error', error: String(err) } : f
        ))
      }

      setTxtDone(i + 1)
    }

    setTxtRunning(false)
  }

  const detectedHooks = extractHooks(title + content)
  const wordCount = countChinese(content)

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">📥 导入文章</h2>

      <div className="flex gap-2 mb-6">
        {([
          { key: 'paste', label: '✏️ 粘贴文本' },
          { key: 'txt', label: '📄 批量上传 TXT' },
        ] as { key: Tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? 'bg-primary text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'paste' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
            {/* Basic fields */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 block mb-1">标题 *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="文章标题"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:border-primary bg-white dark:bg-gray-700 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">来源</label>
                <input
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="如：1月、11月"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:border-primary bg-white dark:bg-gray-700 dark:text-gray-100"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">分类</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="文章分类（AI 分析后可自动填入）"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:border-primary bg-white dark:bg-gray-700 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">正文内容</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="粘贴文章正文…（也可只填标题用 AI 分析）"
                rows={10}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:border-primary resize-y bg-white dark:bg-gray-700 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
              {content && (
                <p className="text-xs text-gray-400 mt-1">
                  字数：{wordCount.toLocaleString()} ｜
                  关键词爆点：{detectedHooks.length > 0 ? detectedHooks.join('、') : '无'}
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 items-center">
              <button
                onClick={analyze}
                disabled={analyzing || (!title && !content)}
                className="px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-40 text-sm font-medium"
              >
                {analyzing ? '✨ AI 分析中…' : '✨ AI 智能分析'}
              </button>
              <button
                onClick={importPasted}
                disabled={busy || !title.trim()}
                className="px-5 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-40 text-sm font-medium"
              >
                {busy ? '导入中…' : '导入文章'}
              </button>
              <span className="text-xs text-gray-400">先分析再导入，爆点和标签会自动附加</span>
            </div>
          </div>

          {/* AI Result card */}
          {analyzing && (
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-2xl p-6 text-center text-purple-400 text-sm">
              ✨ AI 正在分析文章内容，请稍候…
            </div>
          )}

          {aiError && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-sm text-red-500">
              分析失败：{aiError}
            </div>
          )}

          {aiResult && !analyzing && (
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-base font-semibold text-purple-800">✨ AI 分析结果</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-purple-500 mb-1">建议分类</p>
                  <p className="text-sm font-semibold text-gray-800">{aiResult.category}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-purple-500 mb-1">故事简介</p>
                  <p className="text-sm text-gray-700">{aiResult.summary}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-purple-500 mb-2">识别到的爆点</p>
                <div className="flex flex-wrap gap-2">
                  {aiResult.hooks.map((h) => (
                    <span key={h} className="text-xs bg-orange-100 text-orange-600 px-3 py-1 rounded-full">#{h}</span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-purple-500 mb-2">建议标签</p>
                <div className="flex flex-wrap gap-2">
                  {aiResult.tags.map((t) => (
                    <span key={t} className="text-xs bg-blue-100 text-blue-600 px-3 py-1 rounded-full">{t}</span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-purple-500 mb-1">写作建议</p>
                <p className="text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 rounded-lg px-3 py-2">{aiResult.writing_tips}</p>
              </div>

              <p className="text-xs text-purple-400">点击「导入文章」，以上分析结果将一并保存</p>
            </div>
          )}
        </div>
      )}

      {tab === 'txt' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <p className="text-sm text-gray-500 mb-1">选择一个或多个 <code className="bg-gray-100 dark:bg-gray-700 dark:text-gray-300 px-1 rounded">.txt</code> 文件，AI 自动分析后批量导入。</p>
            <p className="text-xs text-gray-400 mb-4">文件名（去掉 .txt）将作为文章标题。</p>
            <label>
              <input
                type="file"
                accept=".txt"
                multiple
                onChange={onTxtSelect}
                disabled={txtRunning}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0
                  file:text-sm file:font-medium file:bg-red-50 dark:file:bg-blue-950/50 file:text-primary dark:text-gray-400
                  hover:file:bg-red-100 cursor-pointer disabled:opacity-40"
              />
            </label>
          </div>

          {txtFiles.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
              {/* Header + progress */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">已选 {txtFiles.length} 个文件</p>
                {!txtRunning && txtDone === 0 && (
                  <button
                    onClick={runTxtImport}
                    className="px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
                  >
                    ✨ 开始 AI 分析并导入
                  </button>
                )}
                {(txtRunning || txtDone > 0) && (
                  <span className="text-sm text-gray-500">{txtDone} / {txtFiles.length}</span>
                )}
              </div>

              {(txtRunning || txtDone > 0) && (
                <div className="bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${txtDone === txtFiles.length && !txtRunning ? 'bg-green-500' : 'bg-purple-500'}`}
                    style={{ width: `${(txtDone / txtFiles.length) * 100}%` }}
                  />
                </div>
              )}

              {/* File list */}
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {txtFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm py-2 border-b border-gray-50 last:border-0">
                    <span className="text-base flex-shrink-0">
                      {f.status === 'pending' && '⏳'}
                      {f.status === 'analyzing' && '✨'}
                      {f.status === 'done' && '✅'}
                      {f.status === 'error' && '❌'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">{f.title}</p>
                      {f.status === 'done' && (
                        <p className="text-xs text-gray-400 truncate">
                          [{f.category}] {f.hooks?.slice(0, 3).map(h => `#${h}`).join(' ')}
                        </p>
                      )}
                      {f.status === 'error' && (
                        <p className="text-xs text-red-400 truncate">{f.error}</p>
                      )}
                      {f.status === 'analyzing' && (
                        <p className="text-xs text-purple-400">AI 分析中…</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-300 flex-shrink-0">
                      {countChinese(f.content).toLocaleString()} 字
                    </span>
                  </div>
                ))}
              </div>

              {!txtRunning && txtDone === txtFiles.length && txtFiles.length > 0 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-sm text-green-600 font-medium">
                    ✅ 完成 {txtFiles.filter(f => f.status === 'done').length} 篇
                    {txtFiles.filter(f => f.status === 'error').length > 0 &&
                      `，❌ 失败 ${txtFiles.filter(f => f.status === 'error').length} 篇`}
                  </p>
                  <button
                    onClick={() => navigate('/browse')}
                    className="px-4 py-1.5 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark"
                  >
                    查看文章库 →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
