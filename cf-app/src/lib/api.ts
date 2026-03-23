import { getToken } from './auth'

const BASE = '/api'

function authHeaders(): HeadersInit {
  const t = getToken()
  return t ? { 'x-session-token': t } : {}
}

export interface MediaPlatform {
  platform: string
  followers: number
  month_change: number
  updated_at: number
}

export interface MediaContent {
  id: string
  title: string
  status: string
  platform: string
  publish_date: string
  publish_note: string
  likes: number
  created_at: number
  updated_at: number
}

export interface MediaCollab {
  id: string
  brand: string
  project: string
  amount: number
  status: string
  collab_date: string
  created_at: number
}

export interface ScriptResult {
  hook: string
  hook_tip: string
  pain_points: { scene: string; text: string }[]
  methods: { title: string; text: string }[]
  cta: string
  word_count: number
  duration_estimate: string
  style_analysis?: {
    style: string
    opening_pattern: string
    structure: string
    keywords: string[]
  }
}

export interface Article {
  id: string
  title: string
  category: string
  word_count: number
  source: string
  import_date: string
  content: string
  tags: string[]
  hooks: string[]
}

export interface ArticlesResponse {
  articles: Article[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface Category {
  category: string
  count: number
}

export interface Tag {
  name: string
  count: number
}

export interface Hook {
  hook: string
  count: number
}

export interface Stats {
  total_articles: number
  total_categories: number
  total_tags: number
  total_words: number
  source_distribution: { source: string; count: number }[]
  category_distribution: { category: string; count: number }[]
}

export interface Inspiration {
  inspirations: Article[]
}

export interface ThemeResponse {
  theme: string
  total: number
  liked: boolean
}

async function get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(BASE + path, location.origin)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v))
    }
  }
  const res = await fetch(url.toString(), { credentials: 'include', headers: authHeaders() })
  if (res.status === 401) { location.href = '/'; throw new Error('Unauthorized') }
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  if (res.status === 401) { location.href = '/'; throw new Error('Unauthorized') }
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  if (res.status === 401) { location.href = '/'; throw new Error('Unauthorized') }
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

async function del(path: string): Promise<void> {
  await fetch(BASE + path, { method: 'DELETE', credentials: 'include', headers: authHeaders() })
}

export const api = {
  articles: {
    list: (p: { category?: string; search?: string; hook?: string; source?: string; page?: number; limit?: number } = {}) =>
      get<ArticlesResponse>('/articles', p as Record<string, string | number | undefined>),
    get: (id: string) => get<Article>(`/articles/${id}`),
    create: (a: Partial<Article>) => post<{ id: string; success: boolean }>('/articles', a),
    delete: (id: string) => del(`/articles/${id}`),
    addTag: (id: string, tag: string) => post<{ success: boolean }>(`/articles/${id}/tags`, { tag }),
    removeTag: (id: string, tag: string) => del(`/articles/${id}/tags/${encodeURIComponent(tag)}`),
  },
  categories: { list: () => get<Category[]>('/categories') },
  tags: { list: () => get<Tag[]>('/tags') },
  hooks: { list: () => get<Hook[]>('/hooks') },
  stats: { get: () => get<Stats>('/stats') },
  inspiration: {
    get: (theme?: string, page?: number) =>
      get<Inspiration>('/inspiration', { theme, page }),
  },
  theme: {
    get: (random?: boolean) =>
      get<ThemeResponse>(`/theme${random ? '?random=1' : ''}`),
    like: (theme: string) => post<{ success: boolean }>('/theme/like', { theme }),
    unlike: (theme: string) => post<{ success: boolean }>('/theme/unlike', { theme }),
    generate: () => post<{ success: boolean; added: number }>('/theme/generate', {}),
  },
  writing: {
    getGoal: (year: number, month: number) =>
      get<{ year: number; month: number; monthly_target: number; daily_target: number }>(
        '/writing/goal', { year, month }
      ),
    saveGoal: (year: number, month: number, monthly_target: number, daily_target: number) =>
      post<{ success: boolean }>('/writing/goal', { year, month, monthly_target, daily_target }),
    getRecords: (year: number, month: number) =>
      get<{ date: string; actual_words: number; note: string }[]>('/writing/records', { year, month }),
    saveRecord: (date: string, actual_words: number, note = '') =>
      post<{ success: boolean; newBadges: string[] }>('/writing/records', { date, actual_words, note }),
  },
  badges: {
    list: () => get<{ badges: BadgeDef[]; total: number; unlocked_count: number }>('/badges'),
  },
  routine: {
    getPreset: () => get<RoutineItem[]>('/routine/preset'),
    createPreset: (item: Partial<RoutineItem>) => post<{ id: string; success: boolean }>('/routine/preset', item),
    updatePreset: (id: string, item: Partial<RoutineItem>) => put<{ success: boolean }>(`/routine/preset/${id}`, item),
    deletePreset: (id: string) => del(`/routine/preset/${id}`),
    getLog: (date: string) => get<{ date: string; log: DayLog[]; notes: string }>('/routine/log', { date }),
    toggleLog: (date: string, item_id: string, completed: boolean) =>
      post<{ success: boolean }>('/routine/log', { date, item_id, completed }),
    updateNotes: (date: string, notes: string) => put<{ success: boolean }>('/routine/notes', { date, notes }),
    getCalendar: (year: number, month: number) =>
      get<{ year: number; month: number; days: CalendarDay[] }>('/routine/calendar', { year, month }),
  },
  media: {
    getPlatforms: () => get<MediaPlatform[]>('/media/platforms'),
    updatePlatform: (platform: string, data: { followers: number; month_change: number }) =>
      put<{ success: boolean }>(`/media/platforms/${platform}`, data),
    getContents: (status?: string) =>
      get<MediaContent[]>('/media/contents', status ? { status } : undefined),
    createContent: (data: Partial<MediaContent>) =>
      post<{ id: string; success: boolean }>('/media/contents', data),
    updateContent: (id: string, data: Partial<MediaContent>) =>
      put<{ success: boolean }>(`/media/contents/${id}`, data),
    deleteContent: (id: string) => del(`/media/contents/${id}`),
    getCollabs: () => get<MediaCollab[]>('/media/collabs'),
    createCollab: (data: Partial<MediaCollab>) =>
      post<{ id: string; success: boolean }>('/media/collabs', data),
    updateCollab: (id: string, data: Partial<MediaCollab>) =>
      put<{ success: boolean }>(`/media/collabs/${id}`, data),
    deleteCollab: (id: string) => del(`/media/collabs/${id}`),
    generateScript: (data: { topic: string; storyline?: string; platform?: string; duration?: string }) =>
      post<ScriptResult>('/media/script/generate', data),
    imitateScript: (data: { topic: string; storyline?: string; platform?: string; reference_text: string; style_analysis?: object }) =>
      post<ScriptResult>('/media/script/imitate', data),
    transcribeVideo: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return fetch('/api/media/script/transcribe', {
        method: 'POST',
        credentials: 'include',
        headers: { 'x-session-token': (typeof window !== 'undefined' ? document.cookie.split(';').find(c => c.trim().startsWith('session='))?.split('=')?.[1] : '') ?? '' },
        body: form,
      }).then(r => r.json()) as Promise<{ transcript: string; success: boolean; error?: string }>
    },
  },
}

export interface RoutineItem {
  id: string
  sort_order: number
  time_start: string
  time_end: string
  title: string
  description: string
  category: string
  reminder_minutes: number
  enabled: number
}

export interface DayLog {
  item_id: string
  completed: number
  completed_at: number | null
}

export interface CalendarDay {
  date: string
  completed: number
  total: number
  pct: number
}

export interface BadgeDef {
  id: string
  emoji: string
  name: string
  desc: string
  category: string
  unlocked: boolean
  unlock_date: string | null
}
