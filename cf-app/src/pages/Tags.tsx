import { useEffect, useState } from 'react'
import { api, type Tag, type Hook } from '../lib/api'

export default function Tags() {
  const [tags, setTags] = useState<Tag[]>([])
  const [hooks, setHooks] = useState<Hook[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.tags.list(), api.hooks.list()]).then(([t, h]) => {
      setTags(t)
      setHooks(h)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="text-center py-24 text-gray-400">加载中…</div>

  const maxTagCount = Math.max(...tags.map((t) => t.count), 1)
  const maxHookCount = Math.max(...hooks.map((h) => h.count), 1)

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">🏷️ 标签管理</h2>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-4">
            用户标签
            <span className="text-sm font-normal text-gray-400 dark:text-gray-500 ml-2">({tags.length})</span>
          </h3>
          {tags.length === 0 ? (
            <p className="text-sm text-gray-400">暂无标签，在文章详情页添加</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map(({ name, count }) => {
                const size = 12 + Math.round((count / maxTagCount) * 8)
                return (
                  <span key={name} className="bg-blue-50 dark:bg-blue-950/50 text-blue-500 px-3 py-1 rounded-full" style={{ fontSize: `${size}px` }}>
                    {name}
                    <span className="text-blue-300 ml-1 text-xs">({count})</span>
                  </span>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-4">
            爆点类型
            <span className="text-sm font-normal text-gray-400 dark:text-gray-500 ml-2">({hooks.length})</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {hooks.map(({ hook, count }) => {
              const size = 12 + Math.round((count / maxHookCount) * 8)
              return (
                <span key={hook} className="bg-orange-50 dark:bg-orange-950/50 text-orange-500 px-3 py-1 rounded-full" style={{ fontSize: `${size}px` }}>
                  #{hook}
                  <span className="text-orange-300 ml-1 text-xs">({count})</span>
                </span>
              )
            })}
          </div>
          <div className="mt-6 space-y-2">
            {hooks.slice(0, 15).map(({ hook, count }) => (
              <div key={hook} className="flex items-center gap-3">
                <span className="w-16 text-sm text-gray-600 dark:text-gray-400 text-right flex-shrink-0">{hook}</span>
                <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                  <div className="bg-orange-400 h-2 rounded-full transition-all" style={{ width: `${(count / maxHookCount) * 100}%` }} />
                </div>
                <span className="w-8 text-xs text-gray-400 dark:text-gray-500 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
