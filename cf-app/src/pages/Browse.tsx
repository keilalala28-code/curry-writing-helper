import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api, type Article, type Category } from '../lib/api'
import ArticleCard from '../components/ArticleCard'

const PAGE_SIZE = 10

export default function Browse() {
  const [sp, setSp] = useSearchParams()
  const cat = sp.get('category') || ''
  const page = Math.max(1, parseInt(sp.get('page') || '1'))

  const [categories, setCategories] = useState<Category[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)

  const [batchMode, setBatchMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [batchCategory, setBatchCategory] = useState('')
  const [batchBusy, setBatchBusy] = useState(false)

  useEffect(() => { api.categories.list().then(setCategories) }, [])

  useEffect(() => {
    setLoading(true)
    setSelected(new Set())
    api.articles.list({ category: cat || undefined, page, limit: PAGE_SIZE }).then((d) => {
      setArticles(d.articles)
      setTotal(d.total)
      setTotalPages(d.totalPages)
      setLoading(false)
    })
  }, [cat, page])

  const go = (c: string, p = 1) => setSp(c ? { category: c, page: String(p) } : { page: String(p) })

  const handleDelete = async (id: string) => {
    await api.articles.delete(id)
    setArticles(prev => prev.filter(a => a.id !== id))
    setTotal(prev => prev - 1)
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selected.size === articles.length) setSelected(new Set())
    else setSelected(new Set(articles.map(a => a.id)))
  }

  const batchDelete = async () => {
    if (!selected.size || !confirm(`确定删除选中的 ${selected.size} 篇文章？`)) return
    setBatchBusy(true)
    await Promise.all([...selected].map(id => api.articles.delete(id)))
    setArticles(prev => prev.filter(a => !selected.has(a.id)))
    setTotal(prev => prev - selected.size)
    setSelected(new Set())
    setBatchBusy(false)
  }

  const batchSetCategory = async () => {
    const newCat = batchCategory.trim()
    if (!selected.size || !newCat) return
    setBatchBusy(true)
    await Promise.all([...selected].map(id =>
      fetch(`/api/articles/${id}/analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-token': localStorage.getItem('session_token') || '' },
        credentials: 'include',
        body: JSON.stringify({ category: newCat, hooks: [], tags: [] }),
      })
    ))
    setArticles(prev => prev.map(a => selected.has(a.id) ? { ...a, category: newCat } : a))
    setSelected(new Set())
    setBatchCategory('')
    setBatchBusy(false)
  }

  return (
    <div className="flex gap-6">
      <div className="w-44 flex-shrink-0 sticky top-6 self-start max-h-[calc(100vh-3rem)] overflow-y-auto">
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">分类</p>
        <div className="space-y-0.5">
          <button
            onClick={() => go('')}
            className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${!cat ? 'bg-red-50 dark:bg-blue-950/50 text-primary font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            全部
            <span className="float-right text-gray-400 dark:text-gray-500 text-xs">{total}</span>
          </button>
          {categories.map(({ category, count }) => (
            <button
              key={category}
              onClick={() => go(category)}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${cat === category ? 'bg-red-50 dark:bg-blue-950/50 text-primary font-medium' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              <span className="truncate block pr-6">{category}</span>
              <span className="float-right text-gray-400 dark:text-gray-500 text-xs -mt-5">{count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{cat || '全部文章'}</h2>
          <span className="text-sm text-gray-400 dark:text-gray-500">共 {total} 篇</span>
          <button
            onClick={() => { setBatchMode(m => !m); setSelected(new Set()) }}
            className={`ml-auto text-xs px-3 py-1.5 rounded-lg border transition-colors ${batchMode ? 'bg-gray-800 dark:bg-gray-600 text-white border-gray-800 dark:border-gray-600' : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'}`}
          >
            {batchMode ? '退出批量管理' : '批量管理'}
          </button>
        </div>

        {batchMode && (
          <div className="flex items-center gap-3 mb-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 flex-wrap">
            <button onClick={selectAll} className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 underline-offset-2 hover:underline">
              {selected.size === articles.length ? '取消全选' : `全选本页 (${articles.length})`}
            </button>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span className="text-sm text-gray-500 dark:text-gray-400">已选 <b className="text-gray-800 dark:text-gray-200">{selected.size}</b> 篇</span>
            {selected.size > 0 && (
              <>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <div className="flex items-center gap-1.5">
                  <input
                    value={batchCategory}
                    onChange={e => setBatchCategory(e.target.value)}
                    placeholder="修改分类…"
                    className="text-sm px-2.5 py-1 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:border-primary bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 w-28"
                  />
                  <button
                    onClick={batchSetCategory}
                    disabled={batchBusy || !batchCategory.trim()}
                    className="text-sm px-3 py-1 bg-blue-50 dark:bg-blue-950/50 text-blue-600 rounded-lg hover:bg-blue-100 disabled:opacity-40"
                  >确定</button>
                </div>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <button
                  onClick={batchDelete}
                  disabled={batchBusy}
                  className="text-sm px-3 py-1.5 bg-red-50 dark:bg-blue-950/50 text-red-500 rounded-lg hover:bg-red-100 disabled:opacity-40 font-medium"
                >
                  🗑 删除选中 ({selected.size})
                </button>
              </>
            )}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-gray-400">加载中…</div>
        ) : (
          <>
            <div className="space-y-3">
              {articles.map((a) => (
                <div key={a.id} className="flex items-center gap-3">
                  {batchMode && (
                    <input
                      type="checkbox"
                      checked={selected.has(a.id)}
                      onChange={() => toggleSelect(a.id)}
                      className="w-4 h-4 accent-primary flex-shrink-0 cursor-pointer"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <ArticleCard article={a} onDelete={!batchMode ? handleDelete : undefined} />
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button disabled={page <= 1} onClick={() => go(cat, page - 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700">上一页</button>
                <span className="text-sm text-gray-500 dark:text-gray-400 px-2">{page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => go(cat, page + 1)} className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700">下一页</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
