import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'
import Home from './pages/Home'
import Browse from './pages/Browse'
import Search from './pages/Search'
import Detail from './pages/Detail'
import Tags from './pages/Tags'
import Stats from './pages/Stats'
import Import from './pages/Import'
import Framework from './pages/Framework'
import BatchAnalysis from './pages/BatchAnalysis'
import Writing from './pages/Writing'
import Routine from './pages/Routine'
import Media from './pages/Media'
import Health from './pages/Health'
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
        <Route path="/browse" element={<Browse />} />
        <Route path="/search" element={<Search />} />
        <Route path="/articles/:id" element={<Detail />} />
        <Route path="/tags" element={<Tags />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/import" element={<Import />} />
        <Route path="/framework" element={<Framework />} />
        <Route path="/batch-analysis" element={<BatchAnalysis />} />
        <Route path="/writing" element={<Writing />} />
        <Route path="/routine" element={<Routine />} />
        <Route path="/media" element={<Media />} />
        <Route path="/health" element={<Health />} />
      </Routes>
    </Layout>
  )
}
