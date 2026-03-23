import { NavLink } from 'react-router-dom'
import { useState, useEffect, type ReactNode } from 'react'
import { logout, changePassword } from '../lib/auth'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const NAV_ITEMS: { path: string; label: string; ownerOnly: boolean; external?: boolean }[] = [
  { path: '/', label: '🎯 每日灵感', ownerOnly: false },
  { path: '/writing', label: '✍️ 码字计划', ownerOnly: true },
  { path: '/routine', label: '📅 每日日程', ownerOnly: false },
  { path: '/media', label: '📱 自媒体管理', ownerOnly: false },
  { path: '/browse', label: '📂 分类浏览', ownerOnly: false },
  { path: '/search', label: '🔍 搜索文章', ownerOnly: false },
  { path: '/tags', label: '🏷️ 标签管理', ownerOnly: false },
  { path: '/stats', label: '📊 数据统计', ownerOnly: false },
  { path: '/import', label: '📥 导入文章', ownerOnly: true },
  { path: '/framework', label: '🎬 故事框架', ownerOnly: false },
  { path: '/batch-analysis', label: '🤖 批量分析', ownerOnly: true },
  { path: 'https://fitness-nutrition-4u8.pages.dev/', label: '💪 健康管理', ownerOnly: false, external: true },
]

interface Props {
  children: ReactNode
  onLogout: () => void
  dark: boolean
  onToggleTheme: () => void
  role: string
}

export default function Layout({ children, onLogout, dark, onToggleTheme, role }: Props) {
  const isOwner = role === 'owner'
  const navItems = NAV_ITEMS.filter(item => !item.ownerOnly || isOwner)

  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showSafariTip, setShowSafariTip] = useState(false)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!installPrompt) return
    await installPrompt.prompt()
    setInstallPrompt(null)
  }

  const [showChangePwd, setShowChangePwd] = useState(false)
  const [curPwd, setCurPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdMsg, setPwdMsg] = useState('')
  const [pwdError, setPwdError] = useState('')
  const [pwdLoading, setPwdLoading] = useState(false)

  const handleLogout = async () => {
    await logout()
    onLogout()
  }

  const handleChangePwd = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwdError('')
    setPwdMsg('')
    if (newPwd !== confirmPwd) { setPwdError('两次输入的新密码不一致'); return }
    if (newPwd.length < 6) { setPwdError('新密码至少 6 位'); return }
    setPwdLoading(true)
    try {
      await changePassword(curPwd, newPwd)
      setPwdMsg('✅ 密码修改成功')
      setCurPwd(''); setNewPwd(''); setConfirmPwd('')
      setTimeout(() => { setPwdMsg(''); setShowChangePwd(false) }, 1500)
    } catch (err) {
      setPwdError((err as Error).message)
    } finally {
      setPwdLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      <aside className="w-52 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col shadow-sm flex-shrink-0">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
          <h1 className="text-xl font-bold text-primary">🍛 咖喱小助手</h1>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            写作资源管理库
            {!isOwner && <span className="ml-1 text-blue-400">访客</span>}
          </p>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {navItems.map(({ path, label, external }) => (
            external ? (
              <a key={path} href={path} target="_blank" rel="noopener noreferrer"
                className="block px-3 py-2 rounded-lg text-sm font-medium transition-colors text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200">
                {label}
              </a>
            ) : (
              <NavLink
                key={path}
                to={path}
                end={path === '/'}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-red-50 dark:bg-blue-950/50 text-primary'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-gray-200'
                  }`
                }
              >
                {label}
              </NavLink>
            )
          ))}
        </nav>
        <div className="p-3 border-t border-gray-100 dark:border-gray-700 space-y-1">
          {!isStandalone && installPrompt && (
            <button
              onClick={handleInstall}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-purple-500 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
            >
              📲 安装到桌面
            </button>
          )}
          {!isStandalone && isSafari && !installPrompt && (
            <button
              onClick={() => setShowSafariTip(true)}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-purple-500 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
            >
              📲 安装到桌面
            </button>
          )}
          <button
            onClick={onToggleTheme}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex items-center gap-2"
          >
            {dark ? '☀️ 日间模式' : '🌙 夜间模式'}
          </button>
          {isOwner && (
            <button
              onClick={() => setShowChangePwd(true)}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              🔑 修改密码
            </button>
          )}
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            退出登录
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-6">{children}</div>
      </main>

      {/* Safari install tip */}
      {showSafariTip && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowSafariTip(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-72 shadow-xl" onClick={e => e.stopPropagation()}>
            <p className="font-semibold text-gray-800 dark:text-gray-100 mb-3">📲 安装到桌面（Mac Safari）</p>
            <ol className="text-sm text-gray-600 dark:text-gray-300 space-y-2 list-decimal list-inside">
              <li>顶部菜单栏点击 <span className="font-medium">「文件」</span></li>
              <li>选择 <span className="font-medium">「添加到程序坞」</span></li>
              <li>点确认，程序坞出现图标即完成</li>
            </ol>
            <button
              onClick={() => setShowSafariTip(false)}
              className="mt-4 w-full bg-purple-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-purple-700 transition-colors"
            >
              知道了
            </button>
          </div>
        </div>
      )}

      {/* Change password modal */}
      {showChangePwd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowChangePwd(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-80 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4">🔑 修改密码</h3>
            <form onSubmit={handleChangePwd} className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">当前密码</label>
                <input
                  type="password"
                  value={curPwd}
                  onChange={e => setCurPwd(e.target.value)}
                  required
                  autoFocus
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary bg-white dark:bg-gray-700 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">新密码（至少 6 位）</label>
                <input
                  type="password"
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  required
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary bg-white dark:bg-gray-700 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">确认新密码</label>
                <input
                  type="password"
                  value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                  required
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary bg-white dark:bg-gray-700 dark:text-gray-100"
                />
              </div>
              {pwdError && <p className="text-xs text-red-500 bg-red-50 dark:bg-blue-950/50 px-3 py-2 rounded-lg">{pwdError}</p>}
              {pwdMsg && <p className="text-xs text-green-600">{pwdMsg}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowChangePwd(false)} className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-lg py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">取消</button>
                <button type="submit" disabled={pwdLoading} className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-medium hover:opacity-90 disabled:opacity-40">
                  {pwdLoading ? '保存中…' : '确认修改'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
