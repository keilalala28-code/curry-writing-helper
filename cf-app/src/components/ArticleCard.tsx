import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Article } from '../lib/api'

interface Props {
  article: Article
  onDelete?: (id: string) => void
}

export default function ArticleCard({ article: a, onDelete }: Props) {
  const [hovered, setHovered] = useState(false)

  const preview = a.content?.trim().slice(0, 120)

  return (
    <div
      className="relative"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link
        to={`/articles/${a.id}`}
        className="block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:border-primary hover:shadow-sm transition-all"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-800 dark:text-gray-100 mb-2 truncate">{a.title}</h4>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs bg-red-50 dark:bg-blue-950/50 text-primary px-2 py-0.5 rounded-full">{a.category}</span>
              {a.hooks?.filter(h => h !== '待分析').slice(0, 3).map((h) => (
                <span key={h} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">#{h}</span>
              ))}
              {a.tags?.slice(0, 2).map((t) => (
                <span key={t} className="text-xs bg-blue-50 dark:bg-blue-950/50 text-blue-500 px-2 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-sm text-gray-400 dark:text-gray-500">{a.word_count?.toLocaleString()} 字</div>
            <div className="text-xs text-gray-300 dark:text-gray-600 mt-0.5">{a.source}</div>
          </div>
        </div>
      </Link>

      {hovered && onDelete && (
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (confirm(`确定删除「${a.title.slice(0, 20)}…」？`)) onDelete(a.id)
          }}
          className="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-white dark:bg-gray-800 border border-red-200 dark:border-blue-800 text-red-400 hover:bg-red-50 dark:hover:bg-blue-950/50 hover:text-red-600 shadow-sm transition-colors text-sm"
          title="删除"
        >
          🗑
        </button>
      )}

      {hovered && (preview || a.hooks?.length > 0) && (
        <div className="absolute left-0 right-0 z-20 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-4 pointer-events-none">
          {preview ? (
            <p
              className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-2"
              style={{ textIndent: '2em' }}
            >
              {preview}
              {a.content.length > 120 && <span className="text-gray-300 dark:text-gray-600">…</span>}
            </p>
          ) : (
            <p className="text-xs text-gray-400 mb-2 italic">暂无正文摘要</p>
          )}
          {a.hooks?.filter(h => h !== '待分析').length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-50 dark:border-gray-700">
              {a.hooks.filter(h => h !== '待分析').map(h => (
                <span key={h} className="text-xs bg-orange-50 dark:bg-orange-950/50 text-orange-500 px-2 py-0.5 rounded-full">#{h}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
