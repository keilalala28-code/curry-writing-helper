/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono'
import { handle } from 'hono/cloudflare-pages'
import { cors } from 'hono/cors'
import { getCookie, setCookie } from 'hono/cookie'

type Env = {
  DB: D1Database
  AUTH_USERNAME: string
  AUTH_PASSWORD: string
}

type Variables = { username: string; role: string }

const app = new Hono<{ Bindings: Env; Variables: Variables }>().basePath('/api')

app.use('*', cors({ origin: '*', credentials: true }))

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Auth middleware
app.use('*', async (c, next) => {
  if (c.req.path.startsWith('/api/auth/')) return next()
  const token = getCookie(c, 'session') || c.req.header('x-session-token') || ''
  if (!token) return c.json({ error: 'Unauthorized' }, 401)
  const now = Math.floor(Date.now() / 1000)
  const row = await c.env.DB.prepare(
    'SELECT username FROM sessions WHERE token = ? AND expires_at > ?'
  ).bind(token, now).first<{ username: string }>()
  if (!row) return c.json({ error: 'Unauthorized' }, 401)
  c.set('username', row.username)
  c.set('role', row.username === (c.env.AUTH_USERNAME || 'carly') ? 'owner' : 'visitor')
  return next()
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ownerOnly = async (c: any, next: () => Promise<void>) => {
  if (c.get('role') !== 'owner') return c.json({ error: '权限不足' }, 403)
  return next()
}

app.post('/auth/login', async (c) => {
  const { username, password } = await c.req.json()
  const ownerUser = c.env.AUTH_USERNAME || 'carly'
  const ownerPass = c.env.AUTH_PASSWORD || 'carly'

  const hash = await sha256(password)
  const userRow = await c.env.DB.prepare('SELECT password_hash FROM users WHERE username = ?').bind(username).first<{ password_hash: string }>()

  let authenticated = false
  if (userRow) {
    authenticated = userRow.password_hash === hash
  } else {
    authenticated = username === ownerUser && password === ownerPass
  }
  if (!authenticated) return c.json({ error: '用户名或密码错误' }, 401)

  const token = await sha256(crypto.randomUUID() + Date.now())
  const now = Math.floor(Date.now() / 1000)
  await c.env.DB.prepare('INSERT INTO sessions (token, username, created_at, expires_at) VALUES (?, ?, ?, ?)').bind(token, username, now, now + 7 * 24 * 3600).run()
  setCookie(c, 'session', token, { httpOnly: true, secure: true, sameSite: 'Lax', maxAge: 7 * 24 * 3600, path: '/' })
  return c.json({ success: true, token })
})

app.get('/auth/check', async (c) => {
  const token = getCookie(c, 'session') || c.req.header('x-session-token') || ''
  if (!token) return c.json({ authenticated: false })
  const now = Math.floor(Date.now() / 1000)
  const row = await c.env.DB.prepare('SELECT username FROM sessions WHERE token = ? AND expires_at > ?').bind(token, now).first<{ username: string }>()
  if (!row) return c.json({ authenticated: false })
  return c.json({ authenticated: true })
})

// Routine Preset
app.get('/routine/preset', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM routine_preset ORDER BY sort_order ASC, time_start ASC').all()
  return c.json(results)
})

app.post('/routine/preset', ownerOnly, async (c) => {
  const { time_start, time_end = '', title, description = '', category = 'morning', reminder_minutes = 0, enabled = 1 } = await c.req.json()
  if (!time_start || !title) return c.json({ error: 'time_start and title required' }, 400)
  const id = crypto.randomUUID()
  const { results: existing } = await c.env.DB.prepare('SELECT MAX(sort_order) as max_order FROM routine_preset').all()
  const maxOrder = (existing[0] as { max_order: number | null })?.max_order ?? -1
  await c.env.DB.prepare('INSERT INTO routine_preset (id, sort_order, time_start, time_end, title, description, category, reminder_minutes, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, maxOrder + 1, time_start, time_end, title, description, category, reminder_minutes, enabled ? 1 : 0).run()
  return c.json({ id, success: true })
})

app.put('/routine/preset/:id', ownerOnly, async (c) => {
  const id = c.req.param('id')
  const { time_start, time_end, title, description, category, reminder_minutes, enabled, sort_order } = await c.req.json()
  await c.env.DB.prepare('UPDATE routine_preset SET time_start=?, time_end=?, title=?, description=?, category=?, reminder_minutes=?, enabled=?, sort_order=? WHERE id=?').bind(time_start, time_end ?? '', title, description ?? '', category, reminder_minutes ?? 0, enabled ? 1 : 0, sort_order ?? 0, id).run()
  return c.json({ success: true })
})

app.delete('/routine/preset/:id', ownerOnly, async (c) => {
  await c.env.DB.prepare('DELETE FROM routine_preset WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ success: true })
})

// Routine Daily Log
app.get('/routine/log', async (c) => {
  const date = c.req.query('date') || new Date().toISOString().slice(0, 10)
  const { results: log } = await c.env.DB.prepare('SELECT item_id, completed, completed_at FROM routine_daily_log WHERE date = ?').bind(date).all()
  const noteRow = await c.env.DB.prepare('SELECT notes FROM routine_notes WHERE date = ?').bind(date).first<{ notes: string }>()
  return c.json({ date, log, notes: noteRow?.notes ?? '' })
})

app.post('/routine/log', async (c) => {
  const { date, item_id, completed } = await c.req.json()
  if (!date || !item_id) return c.json({ error: 'date and item_id required' }, 400)
  const completed_at = completed ? Math.floor(Date.now() / 1000) : null
  await c.env.DB.prepare('INSERT INTO routine_daily_log (date, item_id, completed, completed_at) VALUES (?, ?, ?, ?) ON CONFLICT(date, item_id) DO UPDATE SET completed=excluded.completed, completed_at=excluded.completed_at').bind(date, item_id, completed ? 1 : 0, completed_at).run()
  return c.json({ success: true })
})

app.put('/routine/notes', async (c) => {
  const { date, notes } = await c.req.json()
  if (!date) return c.json({ error: 'date required' }, 400)
  await c.env.DB.prepare('INSERT INTO routine_notes (date, notes) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET notes=excluded.notes').bind(date, notes ?? '').run()
  return c.json({ success: true })
})

app.get('/routine/calendar', async (c) => {
  const year = parseInt(c.req.query('year') || String(new Date().getFullYear()))
  const month = parseInt(c.req.query('month') || String(new Date().getMonth() + 1))
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  const totalItems = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM routine_preset WHERE enabled = 1').first<{ cnt: number }>()
  const total = totalItems?.cnt ?? 1
  const { results } = await c.env.DB.prepare('SELECT date, SUM(completed) as done FROM routine_daily_log WHERE date LIKE ? GROUP BY date').bind(`${prefix}%`).all()
  const days = (results as { date: string; done: number }[]).map(r => ({
    date: r.date,
    completed: r.done,
    total,
    pct: total > 0 ? Math.round((r.done / total) * 100) : 0,
  }))
  return c.json({ year, month, days })
})

export const onRequest = handle(app)
