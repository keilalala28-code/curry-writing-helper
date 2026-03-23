import { useState, useRef } from 'react'
import { getToken } from '../lib/auth'

interface ArticleStub {
  id: string
  title: string
  category: string
  word_count: number
}

type Status = 'idle' | 'running' | 'paused' | 'done'

interface Result {
  id: string
  title: string
  ok: boolean
  error?: string
}

async function fetchUnanalyzed(): Promise<ArticleStub[]> {
  const res = await fetch('/api/articles/unanalyzed', {
    credentials: 'include',
    headers: { 'x-session-token': getToken() },
  })
  const d = await res.json() as { articles: ArticleStub[] }
  return d.articles
}

async function analyzeOne(id: string, title: string): Promise<{ category: string; hooks: string[]; tags: string[] }> {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'x-session-token': getToken() },
    body: JSON.stringify({ title, content: '' }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function saveAnalysis(id: string, data: { category: string; hooks: string[]; tags: string[] }) {
  await fetch(`/api/articles/${id}/analysis`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'x-session-token': getToken() },
    body: JSON.stringify(data),
  })
}

export default function BatchAnalysis() {
  const [articles, setArticles] = useState<ArticleStub[]>([])
  const [loaded, setLoaded] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [current, setCurrent] = useState<string>('')
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<Result[]>([])
  const pausedRef = useRef(false)

  const load = async () => {
    const list = await fetchUnanalyzed()
    setArticles(list)
    setLoaded(true)
    setResults([])
    setProgress(0)
  }

  const start = async () => {
    pausedRef.current = false
    setStatus('running')
    setResults([])
    setProgress(0)

    for (let i = 0; i < articles.length; i++) {
      if (pausedRef.current) {
        setStatus('paused')
        return
      }

      const a = articles[i]
      setCurrent(a.title)
      setProgress(i)

      try {
        const result = await analyzeOne(a.id, a.title)
        await saveAnalysis(a.id, result)
        setResults(prev => [{ id: a.id, title: a.title, ok: true }, ...prev.slice(0, 49)])
      } catch (e) {
        setResults(prev => [{ id: a.id, title: a.title, ok: false, error: String(e) }, ...prev.slice(0, 49)])
      }
    }

    setProgress(articles.length)
    setCurrent('')
    setStatus('done')
  }

  const pause = () => {
    pausedRef.current = true
  }

  const resume = () => {
    const remaining = articles.slice(progress)
    if (remaining.length === 0) return
    setArticles(remaining)
    setProgress(0)
    start()
  }

  const succeeded = results.filter(r => r.ok).length
  const failed = results.filter(r => !r.ok).length
  const pct = articles.length > 0 ? Math.round((progress / articles.length) * 100) : 0

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">🤖 批量 AI 分析</h2>
      <p className="text-sm text-gray-400 mb-6">对库中「待分析」的文章逐一调用 AI，自动提取爆点和标签</p>

      {/* Load step */}
      {!loaded ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center">
          <p className="text-gray-500 mb-4">点击下方按钮检查有多少篇文章尚未分析</p>
          <button
            onClick={load}
            className="px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            检查未分析文章
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Stats bar */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 flex items-center justify-between">
            <div className="flex gap-8">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{articles.length}</div>
                <div className="text-xs text-gray-400">待分析</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">{succeeded}</div>
                <div className="text-xs text-gray-400">已完成</div>
              </div>
              {failed > 0 && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-400">{failed}</div>
                  <div className="text-xs text-gray-400">失败</div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {status === 'idle' && articles.length > 0 && (
                <button onClick={start} className="px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">
                  开始分析
                </button>
              )}
              {status === 'idle' && articles.length === 0 && (
                <span className="text-sm text-green-500 font-medium">✅ 全部已分析</span>
              )}
              {status === 'running' && (
                <button onClick={pause} className="px-5 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 text-sm font-medium">
                  暂停
                </button>
              )}
              {status === 'paused' && (
                <button onClick={resume} className="px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium">
                  继续
                </button>
              )}
              {status === 'done' && (
                <button onClick={load} className="px-5 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-sm">
                  重新检查
                </button>
              )}
            </div>
          </div>

          {/* Progress */}
          {(status === 'running' || status === 'paused' || status === 'done') && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex justify-between text-sm text-gray-500 mb-2">
                <span>{status === 'done' ? '分析完成' : status === 'paused' ? '已暂停' : `正在分析：${current}`}</span>
                <span>{progress} / {articles.length}（{pct}%）</span>
              </div>
              <div className="bg-gray-100 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${status === 'done' ? 'bg-green-500' : 'bg-purple-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          {/* Recent results */}
          {results.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">最近处理</p>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {results.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-sm">
                    <span>{r.ok ? '✅' : '❌'}</span>
                    <span className={`flex-1 truncate ${r.ok ? 'text-gray-600' : 'text-red-400'}`}>{r.title}</span>
                    {r.error && <span className="text-xs text-red-400 flex-shrink-0">{r.error}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
