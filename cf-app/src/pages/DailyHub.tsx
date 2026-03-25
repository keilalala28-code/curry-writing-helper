import { useState } from 'react'
import Routine from './Routine'
import Health from './Health'

type Tab = 'routine' | 'health'

export default function DailyHub() {
  const [active, setActive] = useState<Tab>('routine')

  return (
    <div className="space-y-4">
      <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1">
        <button
          onClick={() => setActive('routine')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
            active === 'routine'
              ? 'bg-white dark:bg-gray-700 text-primary shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          📅 个人规划
        </button>
        <button
          onClick={() => setActive('health')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
            active === 'health'
              ? 'bg-white dark:bg-gray-700 text-primary shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          💪 健康管理
        </button>
      </div>

      <div>
        {active === 'routine' && <Routine />}
        {active === 'health' && <Health />}
      </div>
    </div>
  )
}
