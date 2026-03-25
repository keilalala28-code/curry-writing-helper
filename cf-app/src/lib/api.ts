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

export interface MediaTodo {
  text: string
  done: boolean
}

export interface MediaContent {
  id: string
  title: string
  status: string
  platform: string
  publish_date: string
  publish_note: string
  likes: number
  todos: MediaTodo[]
  start_date: string
  end_date: string
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

export interface MonthGoal {
  id: string
  year_month: string
  title: string
  category: string
  status: 'todo' | 'doing' | 'done'
  progress_note: string
  sort_order: number
}

export interface YearGoal {
  id: string
  year: number
  title: string
  category: string
  progress: number
  quarter: string
  description: string
  sort_order: number
}

export interface WeekGoal {
  id: string
  year: number
  week: number
  title: string
  done: boolean
  sort_order: number
}

export interface YearHeatmapMonth {
  month: string
  pct: number
  days: number
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
  planning: {
    getMonthGoals: (month: string) => get<MonthGoal[]>('/planning/month-goals', { month }),
    createMonthGoal: (data: Partial<MonthGoal>) => post<{ id: string; success: boolean }>('/planning/month-goals', data),
    updateMonthGoal: (id: string, data: Partial<MonthGoal>) => put<{ success: boolean }>(`/planning/month-goals/${id}`, data),
    deleteMonthGoal: (id: string) => del(`/planning/month-goals/${id}`),
    getYearGoals: (year: number) => get<YearGoal[]>('/planning/year-goals', { year }),
    createYearGoal: (data: Partial<YearGoal>) => post<{ id: string; success: boolean }>('/planning/year-goals', data),
    updateYearGoal: (id: string, data: Partial<YearGoal>) => put<{ success: boolean }>(`/planning/year-goals/${id}`, data),
    deleteYearGoal: (id: string) => del(`/planning/year-goals/${id}`),
    getNotes: (scope: string) => get<{ scope: string; notes: string }>('/planning/notes', { scope }),
    saveNotes: (scope: string, notes: string) => put<{ success: boolean }>('/planning/notes', { scope, notes }),
    getYearHeatmap: (year: number) => get<{ year: number; heatmap: YearHeatmapMonth[] }>('/planning/year-heatmap', { year }),
    getWeekGoals: (year: number, week: number) => get<WeekGoal[]>('/planning/week-goals', { year, week }),
    createWeekGoal: (data: { year: number; week: number; title: string }) => post<{ id: string; success: boolean }>('/planning/week-goals', data),
    updateWeekGoal: (id: string, data: Partial<WeekGoal>) => put<{ success: boolean }>(`/planning/week-goals/${id}`, data),
    deleteWeekGoal: (id: string) => del(`/planning/week-goals/${id}`),
  },
  health: {
    getWeight: (days?: number) => get<{ records: HealthWeight[]; goal: number | null }>('/health/weight', days ? { days } : undefined),
    saveWeight: (date: string, weight: number, note?: string) => post<{ success: boolean }>('/health/weight', { date, weight, note }),
    deleteWeight: (date: string) => del(`/health/weight/${date}`),
    saveGoal: (weight_goal: number) => post<{ success: boolean }>('/health/goal', { weight_goal }),
    getMeasurements: () => get<HealthMeasurement[]>('/health/measurements'),
    saveMeasurement: (data: Partial<HealthMeasurement>) => post<{ success: boolean }>('/health/measurements', data),
    deleteMeasurement: (date: string) => del(`/health/measurements/${date}`),
    getExercise: () => get<HealthExercise[]>('/health/exercise'),
    saveExercise: (data: { date: string; type: string; duration?: number; calories?: number; note?: string }) => post<{ id: string; success: boolean }>('/health/exercise', data),
    deleteExercise: (id: string) => del(`/health/exercise/${id}`),
  },
  outline: {
    generate: (data: { idea: string; perspective?: string }) =>
      post<OutlineResult>('/generate-outline', data),
  },
  diary: {
    getEntries: (date: string) => get<DiaryEntry[]>('/diary/entries', { date }),
    saveEntry: (data: { date: string; year: number; content?: string; wish_content?: string; mood?: string; weather?: string }) =>
      put<{ success: boolean }>('/diary/entry', data),
    getCalendar: (year: number) => get<string[]>('/diary/calendar', { year }),
    getStats: () => get<{ total_entries: number; current_year_days: number; recent: { date: string; year: number; preview: string }[] }>('/diary/stats'),
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

export interface HealthWeight {
  id: string
  date: string
  weight: number
  note: string
  created_at: number
}

export interface HealthMeasurement {
  id: string
  date: string
  chest: number | null
  waist: number | null
  hips: number | null
  thigh: number | null
  arm: number | null
  calf: number | null
  wrist: number | null
  created_at: number
}

export interface HealthExercise {
  id: string
  date: string
  type: string
  duration: number | null
  calories: number | null
  note: string
  created_at: number
}

export interface OutlineResult {
  summary: string
  structure: { qi: string; cheng: string; zhuan: string; he: string }
  event_flow: { desire: string; obstacle: string; action: string; achieve: string }
  characters: { protagonist: string; antagonist: string; bystanders: string }
  emotion_elements: string
  outline: { segment: string; setup: string; turning: string; emotion: string }[]
  emotion_arc: { up: string; down: string }
}

export interface DiaryEntry {
  date: string
  year: number
  content: string
  wish_content: string
  mood: string
  weather: string
  updated_at: number
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
