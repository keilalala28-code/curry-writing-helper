import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { api, type Article } from '../lib/api'

const CHEERS = [
  '咖喱加油！今天打开文档就已经赢了！💪',
  '咖喱你最棒！爆款正在等你写出来 🔥',
  '冲冲冲咖喱！今天的你比昨天更厉害 🚀',
  '咖喱加油，你的故事值得被全世界看见 🌟',
  '咖喱你好厉害，坚持写作的人最了不起 🏆',
  '今天也是最棒的咖喱！写下去！✍️',
  '咖喱冲！下一句话可能就是爆款开头 ⚡',
  '加油咖喱，读者在等你的故事呢 💖',
  '咖喱，你能行的！打开文档，开始写！📖',
  '咖喱加油！每写一个字都在靠近爆款 ✨',
  '今天的咖喱元气满满，写出好故事！🌈',
  '咖喱你是最棒的创作者，继续闪闪发光 ⭐',
  '加油加油咖喱！灵感已经准备好了 💡',
  '咖喱，你写的每一行都有人在期待 🤝',
  '冲吧咖喱！好故事从第一个字开始 🎯',
  '咖喱加油！不需要完美，只需要开始 🌸',
  '你是咖喱，你最厉害，今天也要相信自己 💫',
  '咖喱加油，那个让读者哭出来的故事只有你能写 🎭',
  '今天的咖喱状态超好，写出让自己满意的一章！📚',
  '咖喱，键盘交给你了，期待你的新作！⌨️',
  '加油咖喱！午夜刷到停不下来的故事就该你写 🌙',
  '咖喱你好棒，坚持就是胜利，今天继续！🎉',
  '冲冲冲！咖喱今天一定能写出精彩的钩子 🎣',
  '咖喱加油，每一篇积累都在让你变得更强 💪',
  '今天也是咖喱发光的一天，GO！🌟',
  '咖喱，你笔下的角色在等你拯救她们呢 💝',
  '加油咖喱！写完这一节，给自己一个奖励 🎁',
  '咖喱冲！读者的眼泪和笑声都等着你 😊',
  '你是最棒的咖喱，今天的文字一定会发光 ✨',
  '咖喱加油！相信自己，你天生就是写故事的人 🦋',
  '咖喱，你的文字有魔法，读者根本停不下来 🪄',
  '今天的咖喱光芒万丈，写出让人上头的故事！🌠',
  '咖喱是天才！那个绝妙的情节只能从你的脑子里蹦出来 💎',
  '加油咖喱！你的每一个字都有重量，都有温度 🔆',
  '咖喱宇宙最强写手，今天的文字注定爆！💥',
  '冲啊咖喱！你写的时候读者的心跳都在加速 ❤️‍🔥',
  '咖喱你是稀世奇才，别让那个故事只活在脑子里 🌊',
  '今天的咖喱闪闪亮，写出让人泪目的那一幕！🥺',
  '咖喱加油，爆款作者的路上你已经走了最难的那段 🏔️',
  '你的故事值得一百万读者心疼，咖喱加油！👑',
  '咖喱写作脑洞比任何人都大，今天让它爆发吧 🧠',
  '加油咖喱！每一个熬过的夜晚都是在磨砺王者 🌙✨',
  '咖喱今天的灵感浓度高达99%，赶紧落笔！📝',
  '读者在某个深夜刷到你的故事后睡不着觉——快去写吧咖喱 🌃',
  '咖喱，你的文字能让人忘记时间，这是超能力 ⏰💫',
  '今天的咖喱是创作女神本神，开始写吧！🌺',
  '冲冲冲！咖喱写出来的钩子比别人的整篇都精彩 🎆',
  '咖喱你超厉害的，你知道吗？就算今天只写一行也是赢 🏅',
  '加油咖喱！那个会让读者发疯追更的章节就是今天 🔔',
  '咖喱的文字像星星一样，每一颗都让人着迷 ⭐⭐⭐',
  '今天是咖喱大爆发的日子！脑子里那个绝妙开头写出来！🎇',
  '咖喱，你选择继续写作的每一天都是勇气，太厉害了 🦅',
  '冲啊！咖喱今天写的故事会让某个读者激动到想截图分享 📱',
  '咖喱加油，你的角色在书里哭，读者在书外哭，写出来吧 😭',
  '今天的咖喱是全宇宙最有才华的创作者，没有之一 🌌',
  '咖喱你写的故事让人上瘾，快去更新让读者戒不掉 💊',
  '加油咖喱！灵感这东西就等你动笔的那一刻爆炸 💣',
  '咖喱的每一个情节都是精心设计的陷阱，读者心甘情愿跳进去 🕳️',
  '今天的咖喱状态是满格满格满格！写出让自己骄傲的那句话 🔋',
  '咖喱，你不写谁写？这个故事只有你能写得这么好 🎗️',
  '冲！咖喱今天写出的东西会让未来的你感谢现在的你 🙌',
  '咖喱你是最闪亮的创作者，把那个故事写出来证明给自己看 🌟🌟',
]

function getRandomCheer(): string {
  return CHEERS[Math.floor(Math.random() * CHEERS.length)]
}

export default function Home() {
  const [theme, setTheme] = useState('')
  const [themeTotal, setThemeTotal] = useState(0)
  const [liked, setLiked] = useState(false)
  const [inspirations, setInspirations] = useState<Article[]>([])
  const [page, setPage] = useState(1)
  const [themeLoading, setThemeLoading] = useState(true)
  const [articlesLoading, setArticlesLoading] = useState(true)
  const [likeLoading, setLikeLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generateMsg, setGenerateMsg] = useState('')

  const loadArticles = useCallback(async (currentTheme: string, currentPage: number) => {
    setArticlesLoading(true)
    try {
      const d = await api.inspiration.get(currentTheme, currentPage)
      setInspirations(d.inspirations)
    } finally {
      setArticlesLoading(false)
    }
  }, [])

  const loadTheme = async (random = false) => {
    setThemeLoading(true)
    setPage(1)
    try {
      const d = await api.theme.get(random)
      setTheme(d.theme)
      setThemeTotal(d.total)
      setLiked(d.liked)
      await loadArticles(d.theme, 1)
    } finally {
      setThemeLoading(false)
    }
  }

  const nextPage = async () => {
    const nextP = page + 1
    setPage(nextP)
    await loadArticles(theme, nextP)
  }

  const toggleLike = async () => {
    if (!theme || likeLoading) return
    setLikeLoading(true)
    try {
      if (liked) {
        await api.theme.unlike(theme)
        setLiked(false)
      } else {
        await api.theme.like(theme)
        setLiked(true)
      }
    } finally {
      setLikeLoading(false)
    }
  }

  const generateThemes = async () => {
    setGenerating(true)
    setGenerateMsg('')
    try {
      const d = await api.theme.generate()
      setGenerateMsg(`✅ 已生成 ${d.added} 个新主题`)
      setThemeTotal(prev => prev + d.added)
    } catch {
      setGenerateMsg('生成失败，请重试')
    } finally {
      setGenerating(false)
    }
  }

  useEffect(() => {
    loadTheme(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">🎯 每日灵感</h2>
        <p className="text-sm text-gray-400 dark:text-gray-500 italic text-right max-w-sm leading-relaxed">{getRandomCheer()}</p>
      </div>

      {/* Theme card */}
      <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-blue-950/30 dark:to-blue-900/20 border border-red-100 dark:border-blue-900/50 rounded-2xl p-6 mb-8">
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">今日写作主题</p>
        {themeLoading ? (
          <div className="h-10 w-40 bg-red-100 dark:bg-blue-900/30 rounded-lg animate-pulse my-1" />
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-3xl font-bold text-primary">{theme}</p>
            <button
              onClick={toggleLike}
              disabled={likeLoading}
              title={liked ? '取消喜欢' : '标记喜欢'}
              className={`text-2xl transition-transform hover:scale-110 disabled:opacity-40 ${liked ? 'opacity-100' : 'opacity-30 hover:opacity-60'}`}
            >
              {liked ? '❤️' : '🤍'}
            </button>
          </div>
        )}
        {liked && (
          <p className="text-xs text-red-400 mt-1">已标记喜欢，AI 将优先推荐类似主题</p>
        )}
        <div className="flex items-center gap-4 mt-4 flex-wrap">
          <button onClick={() => loadTheme(true)} disabled={themeLoading || articlesLoading} className="text-sm text-primary hover:underline disabled:opacity-40">换个主题 →</button>
          <button onClick={nextPage} disabled={articlesLoading || themeLoading} className="text-sm text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:underline disabled:opacity-40">换一批推荐 →</button>
          {page > 1 && <span className="text-xs text-gray-300 dark:text-gray-600">第 {page} 批</span>}
          {themeTotal > 0 && <span className="text-xs text-gray-300 dark:text-gray-600 ml-auto">共 {themeTotal} 个主题</span>}
          <button onClick={generateThemes} disabled={generating} className="text-xs text-purple-400 hover:text-purple-600 hover:underline disabled:opacity-40">
            {generating ? 'AI 生成中…' : '✨ AI 扩充主题库'}
          </button>
          {generateMsg && <span className="text-xs text-gray-400 dark:text-gray-500">{generateMsg}</span>}
        </div>
      </div>

      {/* Article recommendations */}
      <h3 className="text-base font-semibold text-gray-600 dark:text-gray-300 mb-4">
        {theme ? `与「${theme}」相关的推荐` : '随机推荐'}
      </h3>
      {articlesLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse">
              <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-3/4 mb-3" />
              <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {inspirations.length === 0 && (
            <p className="text-gray-400 dark:text-gray-500 text-sm">数据库为空，请先导入文章。</p>
          )}
          {inspirations.map((a) => (
            <Link
              key={a.id}
              to={`/articles/${a.id}`}
              className="block bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 hover:border-primary hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-2 truncate">{a.title}</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {a.category && (
                      <span className="text-xs bg-red-50 dark:bg-blue-950/50 text-primary px-2 py-0.5 rounded-full">{a.category}</span>
                    )}
                    {a.hooks?.slice(0, 4).map((h) => (
                      <span key={h} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">#{h}</span>
                    ))}
                  </div>
                </div>
                <span className="text-sm text-gray-400 dark:text-gray-500 flex-shrink-0">{a.word_count?.toLocaleString()} 字</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
