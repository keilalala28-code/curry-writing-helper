import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { api, type Stats } from '../lib/api'

const COLORS = ['#FF6B6B', '#FF8E53', '#FFA726', '#66BB6A', '#42A5F5', '#7E57C2', '#EC407A', '#26C6DA', '#D4E157', '#78909C']

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.stats.get().then((d) => { setStats(d); setLoading(false) })
  }, [])

  if (loading) return <div className="text-center py-24 text-gray-400">加载中…</div>
  if (!stats) return null

  const pieData = stats.category_distribution.slice(0, 10).map(({ category, count }) => ({ name: category, value: count }))
  const maxCount = Math.max(...stats.category_distribution.map((c) => c.count), 1)

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">📊 数据统计</h2>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: '文章总数', value: stats.total_articles.toLocaleString(), unit: '篇' },
          { label: '分类数量', value: stats.total_categories.toLocaleString(), unit: '个' },
          { label: '用户标签', value: stats.total_tags.toLocaleString(), unit: '个' },
          { label: '总字数', value: (stats.total_words / 10000).toFixed(1), unit: '万字' },
        ].map(({ label, value, unit }) => (
          <div key={label} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 text-center">
            <div className="text-2xl font-bold text-primary">
              {value}
              <span className="text-sm font-normal text-gray-400 dark:text-gray-500 ml-1">{unit}</span>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-4">分类分布（Top 10）</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name }) => name} labelLine={false}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => [`${v} 篇`, '数量']} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-4">来源分布</h3>
            <div className="space-y-3">
              {stats.source_distribution.map(({ source, count }) => (
                <div key={source} className="flex items-center gap-3">
                  <span className="w-16 text-sm text-gray-600 dark:text-gray-400 text-right flex-shrink-0">{source || '未知'}</span>
                  <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-3">
                    <div className="bg-primary h-3 rounded-full" style={{ width: `${(count / stats.total_articles) * 100}%` }} />
                  </div>
                  <span className="w-10 text-sm text-gray-400 dark:text-gray-500 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300 mb-4">分类排行</h3>
            <div className="overflow-auto max-h-52 space-y-1.5">
              {stats.category_distribution.map(({ category, count }) => (
                <div key={category} className="flex items-center gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">{category}</span>
                  <div className="w-24 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                    <div className="bg-primary h-1.5 rounded-full" style={{ width: `${(count / maxCount) * 100}%` }} />
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 w-6 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
