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

const BASE = '/api'

function getToken(): string | null {
  return document.cookie.split(';').find(c => c.trim().startsWith('session='))?.split('=')?.[1] ?? null
}

function authHeaders(): HeadersInit {
  const t = getToken()
  return t ? { 'x-session-token': t } : {}
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
}
