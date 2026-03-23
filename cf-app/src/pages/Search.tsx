import { useState, useEffect } from 'react'
import { api, type Article, type Category, type Hook } from '../lib/api'
import ArticleCard from '../components/ArticleCard'

export default function Search() {
  const [query, setQuery] = useState('')
  const [hook, setHook] = useState('')
  const [source, setSource] = useState('')
  const [category, setCategory] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [hooks, setHooks] = useState<Hook[]>([])
  const [results, setResults] = useState<Article[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    Promise.all([api.categories.list(), api.hooks.list()]).then(([c, h]) => {
      setCategories(c)
      setHooks(h)
    })
  }, [])

  const search = async () => {
    setLoading(true)
    setSearched(true)
    try {
      const d = await api.articles.list({
        search: query || undefined,
        category: category || undefined,
        hook: hook || undefined,
        source: source || undefined,
        limit: 50,
      })
      setResults(d.articles)
      setTotal(d.total)
    } finally {
      setLoading(false)
    }
  }

  const selectCls = "w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:border-primary bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">🔍 搜索文章</h2>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6 space-y-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="搜索标题、分类…"
            className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:border-primary bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
          <button onClick={search} className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">搜索</button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">分类</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls}>
              <option value="">全部分类</option>
              {categories.map(({ category: c, count }) => (
                <option key={c} value={c}>{c} ({count})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">爆点</label>
            <select value={hook} onChange={(e) => setHook(e.target.value)} className={selectCls}>
              <option value="">全部爆点</option>
              {hooks.map(({ hook: h, count }) => (
                <option key={h} value={h}>{h} ({count})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">来源</label>
            <select value={source} onChange={(e) => setSource(e.target.value)} className={selectCls}>
              <option value="">全部来源</option>
              <option value="11月">11月爆款</option>
              <option value="1月">1月爆款</option>
            </select>
          </div>
        </div>
      </div>

      {loading && <div className="text-center py-12 text-gray-400">搜索中…</div>}
      {!loading && searched && (
        <div>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">找到 {total} 篇文章（显示前 50 篇）</p>
          <div className="space-y-3">
            {results.map((a) => <ArticleCard key={a.id} article={a} />)}
          </div>
        </div>
      )}
    </div>
  )
}
