import { useState, useEffect, useCallback } from 'react'
import { api, type MediaPlatform, type MediaContent, type MediaCollab, type ScriptResult } from '../lib/api'

type Tab = 'overview' | 'kanban' | 'collab' | 'script'
type ScriptMode = 'original' | 'upload' | 'paste'
type ContentStatus = 'idea' | 'making' | 'ready' | 'published'

const PLATFORM_CONFIG: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  xiaohongshu: { label: '小红书', emoji: '📕', color: '#ff2442', bg: '#fff0f5' },
  douyin: { label: '抖音', emoji: '🎵', color: '#FF6B6B', bg: '#f0f7ff' },
}

const STATUS_CONFIG: Record<ContentStatus, { label: string; color: string; bg: string; border: string }> = {
  idea:      { label: '确定立项', color: '#6d28d9', bg: '#ede9fe', border: '#ede9fe' },
  making:    { label: '制作中',   color: '#c2410c', bg: '#fed7aa', border: '#fed7aa' },
  ready:     { label: '定稿待发', color: '#1e40af', bg: '#bfdbfe', border: '#bfdbfe' },
  published: { label: '已发布',   color: '#166534', bg: '#bbf7d0', border: '#bbf7d0' },
}

const COLLAB_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  new:         { label: '新接触', color: '#1e40af', bg: '#dbeafe' },
  negotiating: { label: '洽谈中', color: '#92400e', bg: '#fef9c3' },
  delivered:   { label: '已交付', color: '#166534', bg: '#dcfce7' },
}

export default function Media() {
  const [tab, setTab] = useState<Tab>('overview')
  const [platforms, setPlatforms] = useState<MediaPlatform[]>([])
  const [contents, setContents] = useState<MediaContent[]>([])
  const [collabs, setCollabs] = useState<MediaCollab[]>([])
  const [loading, setLoading] = useState(true)

  // Platform edit modal
  const [editingPlatform, setEditingPlatform] = useState<MediaPlatform | null>(null)
  const [pfForm, setPfForm] = useState({ followers: 0, month_change: 0 })

  // Content modal
  const [showContentModal, setShowContentModal] = useState(false)
  const [editingContent, setEditingContent] = useState<Partial<MediaContent> | null>(null)

  // Collab modal
  const [showCollabModal, setShowCollabModal] = useState(false)
  const [editingCollab, setEditingCollab] = useState<Partial<MediaCollab> | null>(null)

  // Script workshop
  const [scriptMode, setScriptMode] = useState<ScriptMode>('original')
  const [scriptTopic, setScriptTopic] = useState('')
  const [scriptStoryline, setScriptStoryline] = useState('')
  const [scriptPlatform, setScriptPlatform] = useState('抖音')
  const [scriptDuration, setScriptDuration] = useState('3分钟（竖屏短视频）')
  const [pasteText, setPasteText] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [transcribing, setTranscribing] = useState(false)
  const [transcribeStep, setTranscribeStep] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [styleAnalysis, setStyleAnalysis] = useState<ScriptResult['style_analysis'] | null>(null)
  const [generating, setGenerating] = useState(false)
  const [scriptResult, setScriptResult] = useState<ScriptResult | null>(null)
  const [scriptError, setScriptError] = useState('')

  const loadData = useCallback(async () => {
    try {
      const [pf, ct, co] = await Promise.all([
        api.media.getPlatforms(),
        api.media.getContents(),
        api.media.getCollabs(),
      ])
      setPlatforms(pf)
      setContents(ct)
      setCollabs(co)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Platform update ──
  const savePlatform = async () => {
    if (!editingPlatform) return
    await api.media.updatePlatform(editingPlatform.platform, pfForm)
    setEditingPlatform(null)
    loadData()
  }

  // ── Content CRUD ──
  const saveContent = async () => {
    if (!editingContent?.title) return
    if (editingContent.id) {
      await api.media.updateContent(editingContent.id, editingContent)
    } else {
      await api.media.createContent(editingContent)
    }
    setShowContentModal(false)
    setEditingContent(null)
    loadData()
  }

  const deleteContent = async (id: string) => {
    if (!confirm('确认删除？')) return
    await api.media.deleteContent(id)
    loadData()
  }

  const moveContent = async (content: MediaContent, newStatus: ContentStatus) => {
    await api.media.updateContent(content.id, { ...content, status: newStatus })
    loadData()
  }

  // ── Collab CRUD ──
  const saveCollab = async () => {
    if (!editingCollab?.brand || !editingCollab?.project) return
    if (editingCollab.id) {
      await api.media.updateCollab(editingCollab.id, editingCollab)
    } else {
      await api.media.createCollab(editingCollab)
    }
    setShowCollabModal(false)
    setEditingCollab(null)
    loadData()
  }

  const deleteCollab = async (id: string) => {
    if (!confirm('确认删除？')) return
    await api.media.deleteCollab(id)
    loadData()
  }

  // ── Video transcribe ──
  const handleVideoUpload = async (file: File) => {
    setUploadFile(file)
    setTranscribing(true)
    setTranscribeStep(1)
    setTranscript('')
    setStyleAnalysis(null)
    try {
      setTranscribeStep(2)
      const res = await api.media.transcribeVideo(file)
      setTranscribeStep(3)
      if (res.error) throw new Error(res.error)
      setTranscript(res.transcript)
      setTranscribeStep(4)
    } catch (e) {
      setScriptError(`转录失败: ${String(e)}`)
      setTranscribeStep(0)
    } finally {
      setTranscribing(false)
    }
  }

  // ── Script generation ──
  const generateScript = async () => {
    setGenerating(true)
    setScriptResult(null)
    setScriptError('')
    try {
      let result: ScriptResult
      if (scriptMode === 'original') {
        result = await api.media.generateScript({
          topic: scriptTopic,
          storyline: scriptStoryline,
          platform: scriptPlatform,
          duration: scriptDuration,
        })
      } else {
        const ref = scriptMode === 'upload' ? transcript : pasteText
        result = await api.media.imitateScript({
          topic: scriptTopic,
          storyline: scriptStoryline,
          platform: scriptPlatform,
          reference_text: ref,
          style_analysis: styleAnalysis || undefined,
        })
        if (result.style_analysis) setStyleAnalysis(result.style_analysis)
      }
      setScriptResult(result)
    } catch (e) {
      setScriptError(String(e))
    } finally {
      setGenerating(false)
    }
  }

  const copyScript = () => {
    if (!scriptResult) return
    const text = [
      `【开头钩子】\n${scriptResult.hook}`,
      `\n【痛点共鸣】\n${scriptResult.pain_points.map(p => `${p.scene}: ${p.text}`).join('\n')}`,
      `\n【方法论】\n${scriptResult.methods.map(m => `${m.title}: ${m.text}`).join('\n')}`,
      `\n【结尾CTA】\n${scriptResult.cta}`,
    ].join('\n')
    navigator.clipboard.writeText(text)
  }

  const saveScriptToKanban = async () => {
    if (!scriptResult || !scriptTopic) return
    await api.media.createContent({ title: scriptTopic, status: 'idea', platform: scriptPlatform })
    loadData()
    alert('已保存到内容看板「灵感库」')
  }

  // ── Computed ──
  const byStatus = (s: ContentStatus) => contents.filter(c => c.status === s)
  const totalMonthChange = platforms.reduce((a, p) => a + p.month_change, 0)
  const publishedThisMonth = contents.filter(c => c.status === 'published').length
  const totalCollabAmount = collabs.filter(c => c.status === 'delivered').reduce((a, c) => a + c.amount, 0)

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">加载中…</div>

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">📱 自媒体管理</h1>
          <p className="text-xs text-gray-400 mt-1">内容创作 · 数据增长 · 品牌合作</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setTab('script') }}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-700 hover:bg-purple-100 transition-colors">
            🤖 AI脚本工坊
          </button>
          <button onClick={() => { setShowContentModal(true); setEditingContent({ status: 'idea' }) }}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-[#FF6B6B] text-white hover:bg-[#e55555] transition-colors">
            + 新建内容
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-1 w-fit">
        {([['overview','数据总览'],['kanban','内容看板'],['collab','品牌合作'],['script','🤖 脚本工坊']] as [Tab,string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              tab === t
                ? t === 'script' ? 'bg-purple-600 text-white' : 'bg-[#FF6B6B] text-white'
                : t === 'script' ? 'text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: 数据总览 ── */}
      {tab === 'overview' && (
        <div className="space-y-5">
          {/* Platform cards */}
          <div>
            <div className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">平台粉丝数据</div>
            <div className="grid grid-cols-2 gap-4">
              {platforms.map(pf => {
                const cfg = PLATFORM_CONFIG[pf.platform]
                return (
                  <div key={pf.platform} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0" style={{ background: cfg.bg }}>{cfg.emoji}</div>
                    <div className="flex-1">
                      <div className="text-xs text-gray-400 mb-1">{cfg.label}</div>
                      <div className="text-3xl font-black text-gray-900 dark:text-gray-100">{pf.followers.toLocaleString()}</div>
                      <div className={`text-xs mt-1 font-medium ${pf.month_change >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                        {pf.month_change >= 0 ? '▲' : '▼'} {Math.abs(pf.month_change).toLocaleString()} 本月
                      </div>
                    </div>
                    <button onClick={() => { setEditingPlatform(pf); setPfForm({ followers: pf.followers, month_change: pf.month_change }) }}
                      className="text-xs text-gray-300 dark:text-gray-600 hover:text-[#FF6B6B] border border-gray-100 dark:border-gray-700 hover:border-red-200 px-3 py-1.5 rounded-lg transition-colors">
                      ✏️ 更新
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Mini kanban */}
          <div>
            <div className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">内容制作看板</div>
            <div className="grid grid-cols-4 gap-3">
              {(['idea','making','ready','published'] as ContentStatus[]).map(status => {
                const cfg = STATUS_CONFIG[status]
                const items = byStatus(status)
                const icons: Record<ContentStatus, string> = { idea: '💡', making: '⚙️', ready: '🔍', published: '✅' }
                const colLabels: Record<ContentStatus, string> = { idea: '灵感库', making: '制作中', ready: '待发布', published: '已发布' }
                return (
                  <div key={status} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{icons[status]} {colLabels[status]}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.color }}>{items.length}</span>
                    </div>
                    {items.slice(0, 2).map(item => (
                      <div key={item.id} className="bg-white dark:bg-gray-800 rounded-lg p-2.5 mb-1.5 border border-gray-100 dark:border-gray-700">
                        <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 mb-1 leading-tight">{item.title}</div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                        {item.platform && <span className="text-[10px] text-gray-400 ml-1">{item.platform}</span>}
                      </div>
                    ))}
                    {items.length > 2 && <div className="text-xs text-gray-400 text-center mt-1">还有 {items.length - 2} 条</div>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bottom row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
              <div className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-4">📈 本月数据指标</div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: '总粉丝增长', value: `+${totalMonthChange.toLocaleString()}`, color: 'text-emerald-500' },
                  { label: '已发布内容', value: String(publishedThisMonth), color: 'text-gray-900 dark:text-gray-100' },
                  { label: '合作收入', value: `¥${totalCollabAmount.toLocaleString()}`, color: 'text-[#FF6B6B]' },
                ].map(s => (
                  <div key={s.label}>
                    <div className="text-xs text-gray-400 mb-1">{s.label}</div>
                    <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold text-gray-700 dark:text-gray-300">🤝 品牌合作</div>
              </div>
              {collabs.slice(0, 2).map(c => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-700 last:border-0">
                  <div>
                    <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">{c.brand}</div>
                    <div className="text-xs text-gray-400">{c.project}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: COLLAB_STATUS[c.status]?.bg, color: COLLAB_STATUS[c.status]?.color }}>{COLLAB_STATUS[c.status]?.label}</span>
                    {c.amount > 0 && <div className="text-sm font-bold text-[#FF6B6B] mt-0.5">¥{c.amount.toLocaleString()}</div>}
                  </div>
                </div>
              ))}
              <button onClick={() => { setShowCollabModal(true); setEditingCollab({}) }}
                className="w-full mt-2 py-2 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl text-xs text-gray-400 hover:border-red-200 hover:text-[#FF6B6B] transition-colors">
                + 新增合作
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: 内容看板 ── */}
      {tab === 'kanban' && (
        <div className="grid grid-cols-4 gap-4">
          {(['idea','making','ready','published'] as ContentStatus[]).map(status => {
            const cfg = STATUS_CONFIG[status]
            const items = byStatus(status)
            const colLabels: Record<ContentStatus, string> = { idea: '💡 灵感库', making: '⚙️ 制作中', ready: '🔍 待发布', published: '✅ 已发布' }
            const statusOrder: ContentStatus[] = ['idea','making','ready','published']
            return (
              <div key={status} className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 min-h-96">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{colLabels[status]}</span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ background: cfg.bg, color: cfg.color }}>{items.length}</span>
                </div>
                <div className="space-y-2.5">
                  {items.map(item => (
                    <div key={item.id} className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-100 dark:border-gray-700 hover:border-red-200 dark:hover:border-red-800 transition-colors cursor-pointer group">
                      <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 leading-tight">{item.title}</div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                        {item.platform && <span className="text-[10px] text-gray-400">{item.platform}</span>}
                      </div>
                      {item.publish_date && <div className="text-xs text-gray-400">{item.publish_date}</div>}
                      {item.likes > 0 && <div className="text-xs font-bold text-[#FF6B6B]">❤️ {item.likes.toLocaleString()}</div>}
                      <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingContent(item); setShowContentModal(true) }}
                          className="text-xs text-gray-400 hover:text-[#FF6B6B] px-2 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">编辑</button>
                        <button onClick={() => deleteContent(item.id)}
                          className="text-xs text-gray-400 hover:text-red-500 px-2 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">删除</button>
                        {status !== 'published' && (
                          <button onClick={() => moveContent(item, statusOrder[statusOrder.indexOf(status) + 1])}
                            className="text-xs text-gray-400 hover:text-blue-500 px-2 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">→ 推进</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => { setShowContentModal(true); setEditingContent({ status }) }}
                  className="w-full mt-3 py-2.5 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl text-xs text-gray-400 hover:border-red-200 hover:text-[#FF6B6B] transition-colors">
                  + 添加
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── TAB: 品牌合作 ── */}
      {tab === 'collab' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: '已交付收入', value: `¥${totalCollabAmount.toLocaleString()}`, color: 'text-[#FF6B6B]' },
              { label: '洽谈中项目', value: String(collabs.filter(c => c.status === 'negotiating').length), color: 'text-gray-900 dark:text-gray-100' },
              { label: '合作总数', value: String(collabs.length), color: 'text-gray-900 dark:text-gray-100' },
            ].map(s => (
              <div key={s.label} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5">
                <div className="text-xs text-gray-400 mb-2">{s.label}</div>
                <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="grid grid-cols-5 px-5 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700 text-xs font-bold text-gray-400 uppercase tracking-wide">
              <div className="col-span-2">品牌 / 项目</div><div>金额</div><div>状态</div><div>时间</div>
            </div>
            {collabs.length === 0 && (
              <div className="text-center text-sm text-gray-400 py-12">暂无合作记录</div>
            )}
            {collabs.map(c => (
              <div key={c.id} className="grid grid-cols-5 px-5 py-4 border-b border-gray-50 dark:border-gray-700 last:border-0 items-center hover:bg-gray-50 dark:hover:bg-gray-700/30 group">
                <div className="col-span-2">
                  <div className="text-sm font-semibold text-gray-800 dark:text-gray-200">{c.brand}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{c.project}</div>
                </div>
                <div className="text-sm font-bold text-[#FF6B6B]">{c.amount > 0 ? `¥${c.amount.toLocaleString()}` : '–'}</div>
                <div><span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: COLLAB_STATUS[c.status]?.bg, color: COLLAB_STATUS[c.status]?.color }}>{COLLAB_STATUS[c.status]?.label}</span></div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{c.collab_date || '待定'}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingCollab(c); setShowCollabModal(true) }} className="text-xs text-gray-400 hover:text-[#FF6B6B] px-1.5 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20">编辑</button>
                    <button onClick={() => deleteCollab(c.id)} className="text-xs text-gray-400 hover:text-red-500 px-1.5 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20">删除</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => { setShowCollabModal(true); setEditingCollab({}) }}
            className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-2xl text-sm text-gray-400 hover:border-red-200 hover:text-[#FF6B6B] transition-colors">
            + 新增合作记录
          </button>
        </div>
      )}

      {/* ── TAB: 脚本工坊 ── */}
      {tab === 'script' && (
        <div className="grid grid-cols-[360px_1fr] gap-5 items-start">
          {/* Left input panel */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 dark:border-gray-700" style={{ background: 'linear-gradient(135deg,#f5f3ff,#fdf2f8)' }}>
              <h3 className="text-sm font-bold text-gray-800">🤖 AI 脚本工坊</h3>
              <p className="text-xs text-gray-400 mt-0.5">原创扩写 · 上传视频仿写 · 文案仿写</p>
            </div>
            <div className="p-5 space-y-4">
              {/* Mode selector */}
              <div className="flex gap-1.5">
                {([['original','✍️ 原创扩写'],['upload','🎬 上传视频'],['paste','📋 文案仿写']] as [ScriptMode,string][]).map(([m, label]) => (
                  <button key={m} onClick={() => { setScriptMode(m); setScriptResult(null); setScriptError('') }}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                      scriptMode === m
                        ? m === 'upload' ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' : 'border-[#FF6B6B] bg-red-50 dark:bg-red-900/20 text-[#FF6B6B]'
                        : 'border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Common: topic */}
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1.5">
                  视频主题 <span className="text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded-full font-medium ml-1">必填</span>
                </label>
                <input type="text" value={scriptTopic} onChange={e => setScriptTopic(e.target.value)}
                  placeholder="如：外语学习30天的真实变化…"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-[#FF6B6B] transition-colors" />
              </div>

              {/* Common: storyline */}
              <div>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1.5">
                  故事线 / 核心卖点 <span className="text-[10px] text-gray-400 ml-1">可选</span>
                </label>
                <textarea value={scriptStoryline} onChange={e => setScriptStoryline(e.target.value)} rows={3}
                  placeholder="描述核心内容或故事线，留空则AI自由发挥…"
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-[#FF6B6B] transition-colors resize-none" />
              </div>

              {/* Upload mode: video upload */}
              {scriptMode === 'upload' && (
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1.5">
                    上传对标视频 <span className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded-full font-medium ml-1">AI转录分析</span>
                  </label>
                  {!uploadFile ? (
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl p-6 cursor-pointer hover:border-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all">
                      <span className="text-3xl mb-2">🎬</span>
                      <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">点击上传对标视频</span>
                      <span className="text-xs text-gray-400 mt-1">Whisper AI 自动转录，提取文案风格</span>
                      <span className="text-xs text-gray-300 dark:text-gray-600 mt-1">mp4 · mov · m4a · 最大 25MB</span>
                      <input type="file" accept="video/*,audio/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleVideoUpload(f) }} />
                    </label>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl px-4 py-3">
                        <span className="text-xl">🎬</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-purple-700 dark:text-purple-300 truncate">{uploadFile.name}</div>
                          <div className="text-xs text-gray-400">{(uploadFile.size / 1024 / 1024).toFixed(1)} MB</div>
                        </div>
                        <button onClick={() => { setUploadFile(null); setTranscript(''); setStyleAnalysis(null); setTranscribeStep(0) }}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-lg font-light">×</button>
                      </div>
                      {transcribing && (
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 space-y-2">
                          {([['视频上传完成',1],['音频提取',2],['Whisper 语音转文字中…',3],['AI 风格分析',4]] as [string, number][]).map(([label, step]) => (
                            <div key={step} className="flex items-center gap-2">
                              <div className={`w-5 h-5 rounded-full text-xs flex items-center justify-center flex-shrink-0 ${
                                transcribeStep > step ? 'bg-green-100 text-green-600' :
                                transcribeStep === step ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'
                              }`}>
                                {transcribeStep > step ? '✓' : step}
                              </div>
                              <span className={`text-xs ${transcribeStep === step ? 'text-purple-600 font-semibold' : transcribeStep > step ? 'text-gray-400 line-through' : 'text-gray-400'}`}>{label}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {transcript && !transcribing && (
                        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-3">
                          <div className="text-xs font-bold text-purple-600 dark:text-purple-400 mb-2">🤖 转录完成</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3">{transcript.slice(0, 120)}…</div>
                          <div className="text-xs text-purple-500 dark:text-purple-400 mt-1.5 font-medium">约 {transcript.length} 字</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Paste mode: reference text */}
              {scriptMode === 'paste' && (
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1.5">
                    对标视频文案 <span className="text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded-full font-medium ml-1">AI分析风格</span>
                  </label>
                  <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} rows={5}
                    placeholder="粘贴对标视频的完整文案或字幕…&#10;（抖音文案通常在评论区第一条，小红书在正文）"
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-purple-400 transition-colors resize-none" />
                </div>
              )}

              {/* Common: platform & duration */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1.5">目标平台</label>
                  <div className="flex gap-1.5">
                    {['抖音','小红书'].map(p => (
                      <button key={p} onClick={() => setScriptPlatform(p)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${scriptPlatform === p ? 'border-[#FF6B6B] bg-red-50 dark:bg-red-900/20 text-[#FF6B6B]' : 'border-gray-200 dark:border-gray-600 text-gray-400'}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                {scriptMode === 'original' && (
                  <div>
                    <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1.5">时长</label>
                    <select value={scriptDuration} onChange={e => setScriptDuration(e.target.value)}
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-2 py-1.5 text-xs bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-[#FF6B6B]">
                      <option>3分钟（竖屏）</option>
                      <option>5-8分钟（中视频）</option>
                    </select>
                  </div>
                )}
              </div>

              {scriptError && <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl">{scriptError}</div>}

              <button onClick={generateScript}
                disabled={generating || !scriptTopic || (scriptMode === 'upload' && !transcript) || (scriptMode === 'paste' && !pasteText)}
                className={`w-full py-3 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-40 flex items-center justify-center gap-2 ${
                  scriptMode === 'upload' || scriptMode === 'paste' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-[#FF6B6B] hover:bg-[#e55555]'
                }`}>
                {generating ? '✨ 生成中…' : `✨ ${scriptMode === 'original' ? 'AI 生成脚本' : '仿写生成脚本'}`}
              </button>
            </div>
          </div>

          {/* Right output panel */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            {!scriptResult && !generating && (
              <>
                <div className="px-5 py-4 border-b border-gray-50 dark:border-gray-700"><h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">脚本预览</h3></div>
                <div className="flex flex-col items-center justify-center py-24 gap-3">
                  <div className="text-5xl">✨</div>
                  <div className="text-sm text-gray-400">填写左侧信息，点击生成按钮</div>
                  <div className="text-xs text-gray-300 dark:text-gray-600 text-center leading-relaxed">✍️ 原创扩写 · 输入主题和故事线<br/>🎬 上传视频 · AI转录后自动分析仿写<br/>📋 文案仿写 · 粘贴文案快速生成</div>
                </div>
              </>
            )}
            {generating && (
              <>
                <div className="px-5 py-4 border-b border-gray-50 dark:border-gray-700"><h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">生成中…</h3></div>
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <div className="text-4xl animate-bounce">🤖</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">AI 正在创作脚本，请稍候…</div>
                </div>
              </>
            )}
            {scriptResult && !generating && (
              <>
                <div className="px-5 py-4 border-b border-gray-50 dark:border-gray-700 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">生成脚本</h3>
                  <div className="flex gap-2">
                    <button onClick={() => { setScriptResult(null); setScriptError('') }} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">♻️ 重新生成</button>
                    <button onClick={copyScript} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700">📋 复制</button>
                    <button onClick={saveScriptToKanban} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 dark:border-red-800 text-[#FF6B6B] hover:bg-red-50 dark:hover:bg-red-900/20">💾 存入看板</button>
                  </div>
                </div>
                <div className="p-5 space-y-5 max-h-[calc(100vh-220px)] overflow-y-auto">
                  {/* Meta tags */}
                  <div className="flex gap-2 flex-wrap">
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: '#fff0f5', color: '#be185d' }}>{scriptPlatform}</span>
                    {scriptResult.duration_estimate && <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">{scriptResult.duration_estimate}</span>}
                    {scriptResult.style_analysis && <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">🎯 仿写模式</span>}
                    {scriptResult.word_count > 0 && <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400">约 {scriptResult.word_count} 字</span>}
                  </div>

                  {/* Style analysis (imitate mode) */}
                  {scriptResult.style_analysis && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-4">
                      <div className="text-xs font-bold text-purple-600 dark:text-purple-400 mb-3">🤖 对标视频风格分析</div>
                      {([
                        ['内容风格', scriptResult.style_analysis.style],
                        ['开头惯用', scriptResult.style_analysis.opening_pattern],
                        ['结构模型', scriptResult.style_analysis.structure],
                        ['爆款关键词', scriptResult.style_analysis.keywords?.join(' / ')],
                      ] as [string, string | undefined][]).map(([label, val]) => val && (
                        <div key={label} className="flex gap-2 mb-2">
                          <span className="text-xs text-gray-400 w-16 flex-shrink-0 pt-0.5">{label}</span>
                          <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 leading-relaxed">{val}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Hook */}
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
                      🎣 开头钩子（0–15秒）<div className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-900/10 border-l-4 border-[#FF6B6B] pl-4 pr-3 py-3 rounded-r-xl text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{scriptResult.hook}</div>
                    {scriptResult.hook_tip && <div className="text-xs text-gray-400 mt-2 italic">💡 {scriptResult.hook_tip}</div>}
                  </div>

                  {/* Pain points */}
                  {scriptResult.pain_points?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
                        😰 痛点共鸣<div className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
                      </div>
                      <div className="space-y-2">
                        {scriptResult.pain_points.map((p, i) => (
                          <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                            <div className="text-xs font-bold text-gray-400 mb-1">{p.scene}</div>
                            <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{p.text}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Methods */}
                  {scriptResult.methods?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
                        💡 方法论<div className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
                      </div>
                      <div className="space-y-2">
                        {scriptResult.methods.map((m, i) => (
                          <div key={i} className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3">
                            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">{m.title}</div>
                            <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{m.text}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CTA */}
                  {scriptResult.cta && (
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
                        📣 结尾 CTA<div className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-4 text-sm font-semibold text-red-700 dark:text-red-300 leading-relaxed">{scriptResult.cta}</div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Platform edit ── */}
      {editingPlatform && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setEditingPlatform(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-80 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4">✏️ 更新 {PLATFORM_CONFIG[editingPlatform.platform]?.label} 数据</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">粉丝数</label>
                <input type="number" value={pfForm.followers} onChange={e => setPfForm(p => ({ ...p, followers: parseInt(e.target.value) || 0 }))}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-[#FF6B6B]" />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">本月变化（正数增长，负数减少）</label>
                <input type="number" value={pfForm.month_change} onChange={e => setPfForm(p => ({ ...p, month_change: parseInt(e.target.value) || 0 }))}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-[#FF6B6B]" />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditingPlatform(null)} className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-xl py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">取消</button>
                <button onClick={savePlatform} className="flex-1 bg-[#FF6B6B] text-white rounded-xl py-2 text-sm font-medium hover:bg-[#e55555]">保存</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Content edit ── */}
      {showContentModal && editingContent !== null && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => { setShowContentModal(false); setEditingContent(null) }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-96 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4">{editingContent.id ? '✏️ 编辑内容' : '+ 新建内容'}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">标题 *</label>
                <input type="text" value={editingContent.title || ''} onChange={e => setEditingContent(p => ({ ...p!, title: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-[#FF6B6B]" />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">状态</label>
                <select value={editingContent.status || 'idea'} onChange={e => setEditingContent(p => ({ ...p!, status: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-[#FF6B6B]">
                  <option value="idea">💡 灵感库</option>
                  <option value="making">⚙️ 制作中</option>
                  <option value="ready">🔍 待发布</option>
                  <option value="published">✅ 已发布</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">平台</label>
                  <select value={editingContent.platform || ''} onChange={e => setEditingContent(p => ({ ...p!, platform: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-[#FF6B6B]">
                    <option value="">未定</option>
                    <option value="抖音">抖音</option>
                    <option value="小红书">小红书</option>
                    <option value="抖音+小红书">双平台</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">发布日期</label>
                  <input type="date" value={editingContent.publish_date || ''} onChange={e => setEditingContent(p => ({ ...p!, publish_date: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-[#FF6B6B]" />
                </div>
              </div>
              {editingContent.status === 'published' && (
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">赞藏量</label>
                  <input type="number" value={editingContent.likes || 0} onChange={e => setEditingContent(p => ({ ...p!, likes: parseInt(e.target.value) || 0 }))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-[#FF6B6B]" />
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={() => { setShowContentModal(false); setEditingContent(null) }} className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-xl py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">取消</button>
                <button onClick={saveContent} className="flex-1 bg-[#FF6B6B] text-white rounded-xl py-2 text-sm font-medium hover:bg-[#e55555]">保存</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Collab edit ── */}
      {showCollabModal && editingCollab !== null && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => { setShowCollabModal(false); setEditingCollab(null) }}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-96 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4">{editingCollab.id ? '✏️ 编辑合作' : '+ 新增合作'}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">品牌名称 *</label>
                <input type="text" value={editingCollab.brand || ''} onChange={e => setEditingCollab(p => ({ ...p!, brand: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-[#FF6B6B]" />
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">项目内容 *</label>
                <input type="text" value={editingCollab.project || ''} onChange={e => setEditingCollab(p => ({ ...p!, project: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-[#FF6B6B]" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">金额（元）</label>
                  <input type="number" value={editingCollab.amount || 0} onChange={e => setEditingCollab(p => ({ ...p!, amount: parseInt(e.target.value) || 0 }))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-[#FF6B6B]" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">状态</label>
                  <select value={editingCollab.status || 'new'} onChange={e => setEditingCollab(p => ({ ...p!, status: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-[#FF6B6B]">
                    <option value="new">新接触</option>
                    <option value="negotiating">洽谈中</option>
                    <option value="delivered">已交付</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">合作日期</label>
                <input type="date" value={editingCollab.collab_date || ''} onChange={e => setEditingCollab(p => ({ ...p!, collab_date: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:border-[#FF6B6B]" />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => { setShowCollabModal(false); setEditingCollab(null) }} className="flex-1 border border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-xl py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700">取消</button>
                <button onClick={saveCollab} className="flex-1 bg-[#FF6B6B] text-white rounded-xl py-2 text-sm font-medium hover:bg-[#e55555]">保存</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
