import { useState, useEffect } from 'react'
import Login from './pages/Login'
import Routine from './pages/Routine'

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')

  useEffect(() => {
    // Check session
    fetch('/api/auth/check', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then((d: unknown) => setAuthed((d as { authenticated?: boolean } | null)?.authenticated ?? false))
      .catch(() => setAuthed(false))
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  if (authed === null) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-gray-400 text-sm">加载中…</div>
  }

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-orange-500">📅 每日日程 SOP</h1>
            <p className="text-xs text-gray-400 mt-0.5">固定事项减少决策，让生活轻松有规律</p>
          </div>
          <button onClick={() => setDark(d => !d)} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            {dark ? '☀️' : '🌙'}
          </button>
        </div>
        <Routine />
      </div>
    </div>
  )
}
