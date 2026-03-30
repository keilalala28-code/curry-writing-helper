import { useState } from 'react'
import { getRole } from '../lib/auth'
import Writing from './Writing'
import Browse from './Browse'
import Search from './Search'
import Tags from './Tags'
import Stats from './Stats'
import Import from './Import'
import Framework from './Framework'
import IdeaOutline from './IdeaOutline'
import BatchAnalysis from './BatchAnalysis'
import ChawenAnalysis from './ChawenAnalysis'

type Tab = 'writing' | 'browse' | 'search' | 'tags' | 'stats' | 'import' | 'framework' | 'outline' | 'chawen' | 'batch'

const ALL_TABS: { id: Tab; label: string; icon: string; ownerOnly: boolean }[] = [
  { id: 'writing', label: '码字计划', icon: '✍️', ownerOnly: false },
  { id: 'browse', label: '分类浏览', icon: '📂', ownerOnly: false },
  { id: 'search', label: '搜索文章', icon: '🔍', ownerOnly: false },
  { id: 'tags', label: '标签管理', icon: '🏷️', ownerOnly: false },
  { id: 'stats', label: '数据统计', icon: '📊', ownerOnly: false },
  { id: 'import', label: '导入文章', icon: '📥', ownerOnly: true },
  { id: 'framework', label: '故事框架', icon: '🎬', ownerOnly: false },
  { id: 'outline', label: '生成细纲', icon: '💡', ownerOnly: false },
  { id: 'chawen', label: '拆文分析', icon: '📖', ownerOnly: false },
  { id: 'batch', label: '批量分析', icon: '🤖', ownerOnly: true },
]

export default function WritingHub() {
  const isOwner = getRole() === 'owner'
  const tabs = ALL_TABS.filter(t => !t.ownerOnly || isOwner)
  const [active, setActive] = useState<Tab>('writing')

  return (
    <div className="space-y-4">
      {/* Tab Bar — scrollable on mobile */}
      <div className="overflow-x-auto">
        <div className="flex gap-1 min-w-max bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                active === t.id
                  ? 'bg-white dark:bg-gray-700 text-primary shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {active === 'writing' && <Writing />}
        {active === 'browse' && <Browse />}
        {active === 'search' && <Search />}
        {active === 'tags' && <Tags />}
        {active === 'stats' && <Stats />}
        {active === 'import' && <Import />}
        {active === 'framework' && <Framework />}
        {active === 'outline' && <IdeaOutline />}
        {active === 'chawen' && <ChawenAnalysis />}
        {active === 'batch' && <BatchAnalysis />}
      </div>
    </div>
  )
}
