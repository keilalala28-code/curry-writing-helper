import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import Home from './pages/Home'
import Detail from './pages/Detail'
import Media from './pages/Media'
import WritingHub from './pages/WritingHub'
import DailyHub from './pages/DailyHub'
import FiveYearDiary from './pages/FiveYearDiary'
import { checkAuth } from './lib/auth'
import { useTheme } from './lib/theme'

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [role, setRole] = useState<string>('')
  const { dark, toggle } = useTheme()

  useEffect(() => {
    checkAuth().then(({ authenticated, role }) => {
      setAuthed(authenticated)
      setRole(role)
    })
  }, [])

  if (authed === null) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-gray-400">加载中…</div>
  }

  if (!authed) {
    return <Login onSuccess={(r) => { setAuthed(true); setRole(r) }} />
  }

  return (
    <Layout onLogout={() => { setAuthed(false); setRole('') }} dark={dark} onToggleTheme={toggle} role={role}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/articles/:id" element={<Detail />} />
        <Route path="/write" element={<WritingHub />} />
        <Route path="/daily" element={<DailyHub />} />
        <Route path="/media" element={<Media />} />
        <Route path="/diary" element={<FiveYearDiary />} />
      </Routes>
    </Layout>
  )
}
