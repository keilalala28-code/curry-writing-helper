import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, type Article } from '../lib/api'

export default function Detail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [newTag, setNewTag] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!id) return
    api.articles.get(id).then((a) => { setArticle(a); setLoading(false) })
  }, [id])

  const addTag = async () => {
    const tag = newTag.trim()
    if (!tag || !article || busy) return
    setBusy(true)
    await api.articles.addTag(article.id, tag)
    setArticle({ ...article, tags: [...(article.tags || []), tag] })
    setNewTag('')
    setBusy(false)
  }

  const removeTag = async (tag: string) => {
    if (!article) return
    await api.articles.removeTag(article.id, tag)
    setArticle({ ...article, tags: article.tags.filter((t) => t !== tag) })
  }

  const deleteArticle = async () => {
    if (!article || !confirm(`确定删除「${article.title}」？`)) return
    await api.articles.delete(article.id)
    navigate('/browse')
  }

  if (loading) return <div className="text-center py-24 text-gray-400">加载中…</div>
  if (!article) return <div className="text-center py-24 text-gray-400">文章不存在</div>

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 mb-6 inline-flex items-center gap-1"
      >
        ← 返回
      </button>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 mb-4">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-5 leading-relaxed">{article.title}</h2>

        <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-gray-700">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{article.word_count?.toLocaleString()}</div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">字数</div>
          </div>
          <div className="text-center">
            <div className="text-base font-semibold text-gray-700 dark:text-gray-300">{article.category || '—'}</div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">分类</div>
          </div>
          <div className="text-center">
            <div className="text-base font-semibold text-gray-700 dark:text-gray-300">{article.source || '—'}</div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">来源</div>
          </div>
        </div>

        {article.hooks?.length > 0 && (
          <div className="mb-5">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">爆点标签</p>
            <div className="flex flex-wrap gap-2">
              {article.hooks.map((h) => (
                <span key={h} className="text-sm bg-orange-50 dark:bg-orange-950/50 text-orange-500 px-3 py-1 rounded-full">#{h}</span>
              ))}
            </div>
          </div>
        )}

        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">用户标签</p>
          <div className="flex flex-wrap gap-2 items-center">
            {article.tags?.map((t) => (
              <span key={t} className="text-sm bg-blue-50 dark:bg-blue-950/50 text-blue-500 px-3 py-1 rounded-full flex items-center gap-1.5">
                {t}
                <button onClick={() => removeTag(t)} className="text-blue-300 hover:text-blue-500 leading-none">×</button>
              </span>
            ))}
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTag()}
                placeholder="添加标签…"
                className="text-sm px-3 py-1 border border-gray-200 dark:border-gray-600 rounded-full focus:outline-none focus:border-primary bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 w-28"
              />
              <button
                onClick={addTag}
                disabled={busy || !newTag.trim()}
                className="text-sm px-3 py-1 bg-blue-50 dark:bg-blue-950/50 text-blue-500 rounded-full hover:bg-blue-100 disabled:opacity-40"
              >添加</button>
            </div>
          </div>
        </div>

        {article.content ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">正文内容</p>
              <span className="text-xs text-gray-300 dark:text-gray-600">{article.word_count?.toLocaleString()} 字</span>
            </div>
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl px-8 py-6 max-h-[600px] overflow-y-auto">
              {article.content
                .split(/\n+/)
                .filter(p => p.trim())
                .map((para, i) => (
                  <p key={i} className="text-[15px] text-gray-800 dark:text-gray-300 leading-[1.95] mb-3 last:mb-0" style={{ textIndent: '2em', textAlign: 'justify' }}>
                    {para.trim()}
                  </p>
                ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">暂无正文内容（可通过导入文章时粘贴内容添加）</p>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={deleteArticle}
          className="px-4 py-2 text-sm text-red-400 border border-red-200 dark:border-blue-900 rounded-lg hover:bg-red-50 dark:hover:bg-blue-950/30 hover:text-red-600 transition-colors"
        >
          🗑️ 删除这篇文章
        </button>
      </div>
    </div>
  )
}
