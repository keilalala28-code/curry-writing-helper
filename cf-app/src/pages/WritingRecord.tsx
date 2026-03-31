import { useEffect, useRef, useState } from 'react'
import { Workbook } from '@fortune-sheet/react'
import '@fortune-sheet/react/dist/index.css'
import { getRole } from '../lib/auth'

const API = import.meta.env.VITE_API_URL || ''
const defaultSheetData = [
  {
    name: '写作记录',
    celldata: [
      { r: 0, c: 0, v: { v: '日期', ct: { fa: 'General', t: 'g' }, bg: '#f3f4f6', fc: '#1f2937', bl: 1 } },
      { r: 0, c: 1, v: { v: '作品名', ct: { fa: 'General', t: 'g' }, bg: '#f3f4f6', fc: '#1f2937', bl: 1 } },
      { r: 0, c: 2, v: { v: '今日字数', ct: { fa: 'General', t: 'g' }, bg: '#f3f4f6', fc: '#1f2937', bl: 1 } },
      { r: 0, c: 3, v: { v: '累计字数', ct: { fa: 'General', t: 'g' }, bg: '#f3f4f6', fc: '#1f2937', bl: 1 } },
      { r: 0, c: 4, v: { v: '备注', ct: { fa: 'General', t: 'g' }, bg: '#f3f4f6', fc: '#1f2937', bl: 1 } },
    ],
    config: {
      columnlen: { 0: 100, 1: 150, 2: 100, 3: 100, 4: 200 },
    },
  },
]

export default function WritingRecord() {
  const [data, setData] = useState<typeof defaultSheetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const workbookRef = useRef<typeof defaultSheetData>(defaultSheetData)
  const isOwner = getRole() === 'owner'

  // Load saved data
  useEffect(() => {
    fetch(`${API}/api/writing-record`)
      .then(r => r.json())
      .then(res => {
        if (res.data && Array.isArray(res.data) && res.data.length > 0) {
          setData(res.data)
          workbookRef.current = res.data
        } else {
          setData(defaultSheetData)
          workbookRef.current = defaultSheetData
        }
        if (res.updated_at) setLastSaved(res.updated_at)
      })
      .catch(() => {
        setData(defaultSheetData)
        workbookRef.current = defaultSheetData
      })
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!isOwner) return
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/writing-record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ data: workbookRef.current }),
      })
      if (res.ok) {
        setLastSaved(new Date().toLocaleString('zh-CN'))
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {lastSaved && <span>上次保存: {lastSaved}</span>}
        </div>
        {isOwner && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? '保存中...' : '保存表格'}
          </button>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-900" style={{ height: '600px' }}>
        {data && (
          <Workbook
            data={data}
            onChange={(d: typeof defaultSheetData) => {
              workbookRef.current = d
            }}
            showToolbar
            showFormulaBar
            showSheetTabs
            allowEdit={isOwner}
          />
        )}
      </div>

      <div className="text-xs text-gray-400 dark:text-gray-500 space-y-1">
        <p>支持 Excel 常用功能：公式计算、单元格格式、字体样式、合并单元格等</p>
        <p>常用公式：SUM(求和)、AVERAGE(平均)、COUNT(计数)、MAX/MIN(最大最小值)</p>
      </div>
    </div>
  )
}
