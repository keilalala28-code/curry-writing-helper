import { useState } from 'react'
import { getToken } from '../lib/auth'

const HOOK_GROUPS = [
  {
    label: '经典爆点',
    tags: ['逆袭', '重生', '复仇', '虐心', '甜宠', '霸总', '穿越', '系统', '末世', '修仙', '赘婿', '豪门', '种田', '战神', '医术'],
  },
  {
    label: '人设类型',
    tags: ['白眼狼文学', '缺陷型人设', '替身文', '马甲文', '工具人觉醒', '恋爱脑清醒', '双向奔赴', '隐藏大佬', '破镜重圆', '欢喜冤家'],
  },
  {
    label: '婚恋设定',
    tags: ['先婚后爱', '假戏真做', '闪婚', '隐婚', '契约婚姻', '相亲文', '奉子成婚', '离婚后悔', '青梅竹马', '师生恋'],
  },
  {
    label: '题材分类',
    tags: ['现代言情', '古代言情', '年代文', '宫斗', '职场逆袭', '娱乐圈', '家庭伦理', '悬疑推理', '军婚', '无限流'],
  },
]

const HOOK_OPTIONS = HOOK_GROUPS.flatMap(g => g.tags)
const GENDER_OPTIONS = ['女主视角', '男主视角', '双主视角']
const STYLE_OPTIONS = ['虐心向', '甜宠向', '爽文向', '悬疑向', '慢热深情']

interface Section {
  num: number
  title: string
  outline: string
  paywall_hook?: string
}

interface Framework {
  title_suggestions: string[]
  teaser: string
  sections: Section[]
  truth_core: string
  writing_tips: string
}

export default function FrameworkPage() {
  const [category, setCategory] = useState('')
  const [gender, setGender] = useState(GENDER_OPTIONS[0])
  const [style, setStyle] = useState(STYLE_OPTIONS[0])
  const [selectedHooks, setSelectedHooks] = useState<string[]>([])
  const [extra, setExtra] = useState('')

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Framework | null>(null)
  const [error, setError] = useState('')

  const toggleHook = (h: string) =>
    setSelectedHooks(prev => prev.includes(h) ? prev.filter(x => x !== h) : [...prev, h])

  const generate = async () => {
    if (!category) return
    setLoading(true)
    setResult(null)
    setError('')

    try {
      const res = await fetch('/api/generate-framework', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-session-token': getToken() },
        body: JSON.stringify({ category, gender, style, hooks: selectedHooks, extra }),
      })
      const d = await res.json() as Framework & { error?: string }
      if (d.error) throw new Error(d.error)
      setResult(d)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">🎬 故事框架生成器</h2>
      <p className="text-sm text-gray-400 mb-6">输入故事参数，AI 生成完整三幕结构框架</p>

      <div className="grid grid-cols-5 gap-6">
        {/* Input panel */}
        <div className="col-span-2 space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">题材 / 分类 *</label>
              <input
                type="text"
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="如：霸总言情、古代宫斗、末世重生…"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:border-primary bg-white dark:bg-gray-700 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">视角</label>
              <div className="flex gap-2">
                {GENDER_OPTIONS.map(g => (
                  <button
                    key={g}
                    onClick={() => setGender(g)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      gender === g ? 'bg-primary text-white border-primary' : 'bg-transparent border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-primary'
                    }`}
                  >{g}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">风格</label>
              <div className="flex flex-wrap gap-2">
                {STYLE_OPTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => setStyle(s)}
                    className={`py-1 px-3 rounded-full text-xs font-medium border transition-colors ${
                      style === s ? 'bg-primary text-white border-primary' : 'bg-transparent border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-primary'
                    }`}
                  >{s}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 block mb-2">爆点标签（可多选）</label>
              <div className="space-y-2">
                {HOOK_GROUPS.map(group => (
                  <div key={group.label}>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{group.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {group.tags.map(h => (
                        <button
                          key={h}
                          onClick={() => toggleHook(h)}
                          className={`py-0.5 px-2.5 rounded-full text-xs border transition-colors ${
                            selectedHooks.includes(h)
                              ? 'bg-orange-500 text-white border-orange-500'
                              : 'bg-transparent border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-primary'
                          }`}
                        >#{h}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">补充要求</label>
              <textarea
                value={extra}
                onChange={e => setExtra(e.target.value)}
                placeholder="如：男女主前期有仇恨、女主有隐藏身份…"
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:border-primary resize-none bg-white dark:bg-gray-700 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
            </div>

            <button
              onClick={generate}
              disabled={loading || !category}
              className="w-full py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-40 text-sm font-medium"
            >
              {loading ? '✨ 生成中…' : '✨ 生成故事框架'}
            </button>
          </div>
        </div>

        {/* Result panel */}
        <div className="col-span-3">
          {loading && (
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-2xl p-8 text-center text-purple-400">
              ✨ AI 正在构建故事框架，请稍候…
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-sm text-red-500">{error}</div>
          )}

          {!loading && !result && !error && (
            <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 border-dashed rounded-2xl p-8 text-center text-gray-300">
              框架将在这里显示
            </div>
          )}

          {result && !loading && (
            <div className="space-y-4">
              {/* Title suggestions */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                <p className="text-xs font-semibold text-purple-500 uppercase tracking-wide mb-2">备选标题</p>
                <div className="space-y-1.5">
                  {result.title_suggestions?.map((t, i) => (
                    <div key={i} className="text-sm font-medium text-gray-800 bg-purple-50 px-3 py-2 rounded-lg">{t}</div>
                  ))}
                </div>
              </div>

              {/* Teaser */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">📢 导语</p>
                <p className="text-sm text-gray-700 leading-relaxed italic">「{result.teaser}」</p>
              </div>

              {/* Sections 1-4: free */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">免费部分（第1–4节 · 约4500字）</p>
                  <span className="text-xs bg-green-50 text-green-500 px-2 py-0.5 rounded-full">公开</span>
                </div>
                {result.sections?.filter(s => s.num <= 4).map(s => (
                  <div key={s.num} className="border-l-2 border-gray-100 pl-3">
                    <p className="text-xs font-semibold text-gray-500 mb-0.5">第{s.num}节 · {s.title}</p>
                    <p className="text-sm text-gray-600 leading-relaxed">{s.outline}</p>
                  </div>
                ))}
              </div>

              {/* Paywall hook */}
              {result.sections?.find(s => s.num === 4)?.paywall_hook && (
                <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base">🔒</span>
                    <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">付费钩子（第4节结尾，~4500字处）</p>
                  </div>
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">{result.sections.find(s => s.num === 4)!.paywall_hook}</p>
                  <p className="text-xs text-orange-400 mt-2">↑ 读者读到这里，必须付费才能继续</p>
                </div>
              )}

              {/* Sections 5-8: paid */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    付费部分（第5–{result.sections[result.sections.length - 1]?.num}节 · 约{(result.sections.length - 4) * 1000}字）
                  </p>
                  <span className="text-xs bg-orange-50 text-orange-400 px-2 py-0.5 rounded-full">发现真相</span>
                </div>
                {result.sections?.filter(s => s.num >= 5).map(s => (
                  <div key={s.num} className="border-l-2 border-orange-100 pl-3">
                    <p className="text-xs font-semibold text-gray-500 mb-0.5">第{s.num}节 · {s.title}</p>
                    <p className="text-sm text-gray-600 leading-relaxed">{s.outline}</p>
                  </div>
                ))}
              </div>

              {/* Truth core */}
              <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
                <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">💡 核心真相</p>
                <p className="text-sm text-gray-700 leading-relaxed">{result.truth_core}</p>
              </div>

              {/* Tips */}
              <div className="bg-purple-50 rounded-2xl p-5">
                <p className="text-xs font-semibold text-purple-500 uppercase tracking-wide mb-1">写作技巧</p>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{result.writing_tips}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
