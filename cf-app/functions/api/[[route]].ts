/// <reference types="@cloudflare/workers-types" />
import { Hono } from 'hono'
import { handle } from 'hono/cloudflare-pages'
import { cors } from 'hono/cors'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { jsonrepair } from 'jsonrepair'

type Env = {
  DB: D1Database
  AUTH_USERNAME: string
  AUTH_PASSWORD: string
  VISITOR_USERNAME: string
  VISITOR_PASSWORD: string
  AI_BASE_URL: string
  AI_API_KEY: string
  AI_MODEL: string
  AI: any
}

type Variables = { username: string; role: string }

// ─── 写作主题库（共 66 个）────────────────────────────────────────────────────
const WRITING_THEMES = [
  // 情感关系
  '虐心与救赎', '甜宠反转', '爱而不得', '破镜重圆', '青梅竹马',
  '先婚后爱', '假戏真做', '欢喜冤家', '互相救赎', '深情错付',
  // 身份逆转
  '逆袭与成长', '凤凰涅槃', '真假千金', '马甲掉落', '隐藏实力',
  '落魄贵族', '灰姑娘反击', '替身觉醒', '赘婿翻身', '弃妃归来',
  // 复仇与博弈
  '复仇与蜕变', '以牙还牙', '棋局人生', '权谋之争', '商战风云',
  '宫廷暗斗', '家族恩怨', '步步为营', '以柔克刚', '背刺与反杀',
  // 重生穿越
  '重生改命', '穿越古代', '穿书自救', '二次元穿越', '末世重生',
  '带系统重来', '穿成反派', '穿成炮灰', '时间回溯', '异世界求生',
  // 成长蜕变
  '职场风云', '校园青春', '寒门崛起', '天才觉醒', '咸鱼翻身',
  '从零开始', '逆流而上', '破茧成蝶', '低谷反弹', '卧薪尝胆',
  // 悬念烧脑
  '悬疑推理', '层层反转', '真相大白', '多重身份', '记忆迷局',
  '隐藏秘密', '双重人格', '命运操控', '阴谋与真相', '谁是幕后黑手',
  // 世界观
  '玄幻修炼', '都市异能', '末世求生', '星际文明', '灵异鬼怪',
  '古武传承', '系统流', '宗门争霸', '驯兽为王', '医毒双绝',
  // 情绪共鸣
  '治愈日常', '岁月温柔', '慢热深情', '执念与放手', '错过与相遇',
  '孤独与羁绊', '守护与被守护',
]

// ─── Robust AI JSON parser ────────────────────────────────────────────────────
// Uses jsonrepair to handle all common AI output issues:
// literal newlines in strings, unescaped quotes, trailing commas, code fences, etc.
function parseAiJson(raw: string): unknown {
  // Strip markdown code fences
  let s = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()
  // Extract the outermost {...}
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start === -1 || end === -1) throw new SyntaxError('No JSON object found')
  s = s.slice(start, end + 1)
  return JSON.parse(jsonrepair(s))
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>().basePath('/api')

app.use('*', cors({ origin: '*', credentials: true }))

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function getRole(db: D1Database, username: string, env: Env): Promise<string> {
  const row = await db.prepare('SELECT role FROM users WHERE username = ?').bind(username).first<{ role: string }>()
  if (row) return row.role
  const ownerUser = env.AUTH_USERNAME || 'carly'
  if (username === ownerUser) return 'owner'
  const visitorUser = env.VISITOR_USERNAME || 'visitor'
  if (username === visitorUser) return 'visitor'
  return 'visitor'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ownerOnly = async (c: any, next: () => Promise<void>) => {
  if (c.get('role') !== 'owner') return c.json({ error: '权限不足' }, 403)
  return next()
}

// ─── Auth middleware (protects everything except /auth/*) ─────────────────────

app.use('*', async (c, next) => {
  if (c.req.path.startsWith('/api/auth/')) return next()
  const token = getCookie(c, 'session') || c.req.header('x-session-token') || ''
  if (!token) return c.json({ error: 'Unauthorized' }, 401)
  const now = Math.floor(Date.now() / 1000)
  const row = await c.env.DB.prepare(
    'SELECT username FROM sessions WHERE token = ? AND expires_at > ?'
  ).bind(token, now).first<{ username: string }>()
  if (!row) return c.json({ error: 'Unauthorized' }, 401)
  const role = await getRole(c.env.DB, row.username, c.env)
  c.set('username', row.username)
  c.set('role', role)
  return next()
})

// ─── Auth routes ──────────────────────────────────────────────────────────────

app.post('/auth/login', async (c) => {
  const { username, password } = await c.req.json()

  let authenticated = false

  // Check users table first (allows password changes to take effect)
  const hash = await sha256(password)
  const userRow = await c.env.DB.prepare(
    'SELECT password_hash FROM users WHERE username = ?'
  ).bind(username).first<{ password_hash: string }>()

  if (userRow) {
    authenticated = userRow.password_hash === hash
  } else {
    // Fallback to env var credentials
    const ownerUser = c.env.AUTH_USERNAME || 'carly'
    const ownerPass = c.env.AUTH_PASSWORD || 'carly'
    const visitorUser = c.env.VISITOR_USERNAME || 'visitor'
    const visitorPass = c.env.VISITOR_PASSWORD || ''

    if (username === ownerUser && password === ownerPass) authenticated = true
    if (visitorPass && username === visitorUser && password === visitorPass) authenticated = true
  }

  if (!authenticated) return c.json({ error: '用户名或密码错误' }, 401)

  const role = await getRole(c.env.DB, username, c.env)
  const token = await sha256(crypto.randomUUID() + Date.now())
  const now = Math.floor(Date.now() / 1000)
  const expires = now + 7 * 24 * 3600 // 7 days

  await c.env.DB.prepare(
    'INSERT INTO sessions (token, username, created_at, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(token, username, now, expires).run()

  setCookie(c, 'session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 7 * 24 * 3600,
    path: '/',
  })

  return c.json({ success: true, token, role })
})

app.post('/auth/logout', async (c) => {
  const token = getCookie(c, 'session') || c.req.header('x-session-token') || ''
  if (token) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run()
  }
  deleteCookie(c, 'session', { path: '/' })
  return c.json({ success: true })
})

app.get('/auth/check', async (c) => {
  const token = getCookie(c, 'session') || c.req.header('x-session-token') || ''
  if (!token) return c.json({ authenticated: false })
  const now = Math.floor(Date.now() / 1000)
  const row = await c.env.DB.prepare(
    'SELECT username FROM sessions WHERE token = ? AND expires_at > ?'
  ).bind(token, now).first<{ username: string }>()
  if (!row) return c.json({ authenticated: false })
  const role = await getRole(c.env.DB, row.username, c.env)
  return c.json({ authenticated: true, username: row.username, role })
})

app.get('/auth/me', async (c) => {
  return c.json({ username: c.get('username'), role: c.get('role') })
})

app.post('/auth/change-password', async (c) => {
  const username = c.get('username')
  if (c.get('role') !== 'owner') return c.json({ error: '权限不足' }, 403)
  const { current_password, new_password } = await c.req.json()
  if (!new_password || new_password.length < 6) return c.json({ error: '新密码至少 6 位' }, 400)

  // Verify current password
  const currentHash = await sha256(current_password)
  const userRow = await c.env.DB.prepare(
    'SELECT password_hash FROM users WHERE username = ?'
  ).bind(username).first<{ password_hash: string }>()

  if (userRow) {
    if (userRow.password_hash !== currentHash) return c.json({ error: '当前密码错误' }, 401)
  } else {
    // Verify against env var
    const envPass = c.env.AUTH_PASSWORD || 'carly'
    if (current_password !== envPass) return c.json({ error: '当前密码错误' }, 401)
  }

  const newHash = await sha256(new_password)
  await c.env.DB.prepare(
    'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?) ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash'
  ).bind(username, newHash, 'owner').run()

  // Invalidate all other sessions for this user
  await c.env.DB.prepare(
    "DELETE FROM sessions WHERE username = ? AND token != ?"
  ).bind(username, getCookie(c, 'session') || c.req.header('x-session-token') || '').run()

  return c.json({ success: true })
})

// ─── Helper: attach tags & hooks to articles ────────────────────────────────

async function attachMeta(db: D1Database, articles: Record<string, unknown>[]) {
  if (articles.length === 0) return articles
  const ids = articles.map((a) => a.id as string)
  const ph = ids.map(() => '?').join(',')

  const [tagsRes, hooksRes] = await Promise.all([
    db.prepare(`SELECT article_id, tag FROM article_tags WHERE article_id IN (${ph})`).bind(...ids).all(),
    db.prepare(`SELECT article_id, hook FROM article_hooks WHERE article_id IN (${ph})`).bind(...ids).all(),
  ])

  const tagMap: Record<string, string[]> = {}
  const hookMap: Record<string, string[]> = {}

  for (const r of tagsRes.results as { article_id: string; tag: string }[]) {
    if (!tagMap[r.article_id]) tagMap[r.article_id] = []
    tagMap[r.article_id].push(r.tag)
  }
  for (const r of hooksRes.results as { article_id: string; hook: string }[]) {
    if (!hookMap[r.article_id]) hookMap[r.article_id] = []
    hookMap[r.article_id].push(r.hook)
  }

  return articles.map((a) => ({
    ...a,
    tags: tagMap[a.id as string] || [],
    hooks: hookMap[a.id as string] || [],
  }))
}

// ─── Articles ────────────────────────────────────────────────────────────────

app.get('/articles', async (c) => {
  const { category, search, hook, source, page = '1', limit = '10' } = c.req.query()
  const db = c.env.DB
  const pageNum = Math.max(1, parseInt(page))
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)))
  const offset = (pageNum - 1) * limitNum

  let where = 'WHERE 1=1'
  const params: (string | number)[] = []

  if (category) { where += ' AND category = ?'; params.push(category) }
  if (source) { where += ' AND source = ?'; params.push(source) }
  if (search) {
    where += ' AND (title LIKE ? OR category LIKE ?)'
    params.push(`%${search}%`, `%${search}%`)
  }
  if (hook) {
    where += ' AND id IN (SELECT article_id FROM article_hooks WHERE hook = ?)'
    params.push(hook)
  }

  const baseQuery = `SELECT * FROM articles ${where}`

  const [countRow, { results }] = await Promise.all([
    db.prepare(`SELECT COUNT(*) as n FROM articles ${where}`).bind(...params).first<{ n: number }>(),
    db.prepare(`${baseQuery} ORDER BY import_date DESC LIMIT ? OFFSET ?`).bind(...params, limitNum, offset).all(),
  ])

  const total = countRow?.n || 0
  const articles = await attachMeta(db, results as Record<string, unknown>[])

  return c.json({ articles, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) })
})

// ─── Unanalyzed articles list ────────────────────────────────────────────────

app.get('/articles/unanalyzed', ownerOnly, async (c) => {
  const db = c.env.DB
  const { results } = await db.prepare(`
    SELECT a.id, a.title, a.category, a.word_count
    FROM articles a
    WHERE NOT EXISTS (
      SELECT 1 FROM article_hooks ah
      WHERE ah.article_id = a.id AND ah.hook != '待分析'
    )
    ORDER BY a.import_date DESC
  `).all()
  return c.json({ articles: results, total: results.length })
})

app.get('/articles/:id', async (c) => {
  const id = c.req.param('id')
  const db = c.env.DB

  const article = await db.prepare('SELECT * FROM articles WHERE id = ?').bind(id).first()
  if (!article) return c.json({ error: 'Not found' }, 404)

  const [tagsRes, hooksRes] = await Promise.all([
    db.prepare('SELECT tag FROM article_tags WHERE article_id = ?').bind(id).all(),
    db.prepare('SELECT hook FROM article_hooks WHERE article_id = ?').bind(id).all(),
  ])

  return c.json({
    ...article,
    tags: (tagsRes.results as { tag: string }[]).map((r) => r.tag),
    hooks: (hooksRes.results as { hook: string }[]).map((r) => r.hook),
  })
})

app.post('/articles', ownerOnly, async (c) => {
  const body = await c.req.json()
  const { title, category = '', word_count = 0, source = '', content = '', tags = [], hooks = [] } = body
  if (!title) return c.json({ error: 'title required' }, 400)

  const db = c.env.DB
  const id = crypto.randomUUID()
  const importDate = new Date().toISOString().split('T')[0]

  await db.prepare(
    'INSERT INTO articles (id, title, category, word_count, source, import_date, content) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, title, category, word_count, source, importDate, content).run()

  for (const tag of tags as string[]) {
    await db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').bind(tag).run()
    await db.prepare('INSERT OR IGNORE INTO article_tags (article_id, tag) VALUES (?, ?)').bind(id, tag).run()
  }
  for (const hook of hooks as string[]) {
    await db.prepare('INSERT OR IGNORE INTO article_hooks (article_id, hook) VALUES (?, ?)').bind(id, hook).run()
  }

  return c.json({ id, success: true }, 201)
})

app.delete('/articles/:id', ownerOnly, async (c) => {
  const id = c.req.param('id')
  const db = c.env.DB
  await db.prepare('DELETE FROM article_tags WHERE article_id = ?').bind(id).run()
  await db.prepare('DELETE FROM article_hooks WHERE article_id = ?').bind(id).run()
  await db.prepare('DELETE FROM articles WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

app.post('/articles/:id/tags', ownerOnly, async (c) => {
  const id = c.req.param('id')
  const { tag } = await c.req.json()
  const db = c.env.DB
  await db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').bind(tag).run()
  await db.prepare('INSERT OR IGNORE INTO article_tags (article_id, tag) VALUES (?, ?)').bind(id, tag).run()
  return c.json({ success: true })
})

app.delete('/articles/:id/tags/:tag', ownerOnly, async (c) => {
  const id = c.req.param('id')
  const tag = c.req.param('tag')
  await c.env.DB.prepare('DELETE FROM article_tags WHERE article_id = ? AND tag = ?').bind(id, tag).run()
  return c.json({ success: true })
})

// ─── Categories ──────────────────────────────────────────────────────────────

app.get('/categories', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT category, COUNT(*) as count FROM articles WHERE category != '' GROUP BY category ORDER BY count DESC`
  ).all()
  return c.json(results)
})

// ─── Tags ────────────────────────────────────────────────────────────────────

app.get('/tags', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT t.name, COUNT(at.article_id) as count FROM tags t
     LEFT JOIN article_tags at ON t.name = at.tag
     GROUP BY t.name ORDER BY count DESC`
  ).all()
  return c.json(results)
})

// ─── Hooks ───────────────────────────────────────────────────────────────────

app.get('/hooks', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT hook, COUNT(*) as count FROM article_hooks GROUP BY hook ORDER BY count DESC`
  ).all()
  return c.json(results)
})

// ─── Theme helpers ───────────────────────────────────────────────────────────

function extractKeywords(theme: string): string[] {
  const parts = theme.split(/[与和或、·\s&]+/).filter(s => s.length >= 2)
  if (!parts.includes(theme) && theme.length >= 2) parts.push(theme)
  return [...new Set(parts)]
}

// ─── Theme ───────────────────────────────────────────────────────────────────

app.get('/theme', async (c) => {
  const { random } = c.req.query()
  const db = c.env.DB

  const [likedRes, generatedRes] = await Promise.all([
    db.prepare('SELECT theme FROM theme_likes').all(),
    db.prepare('SELECT theme FROM generated_themes').all(),
  ])

  const likedThemes = (likedRes.results as { theme: string }[]).map(r => r.theme)
  const generatedThemes = (generatedRes.results as { theme: string }[]).map(r => r.theme)
  const allThemes = [...new Set([...WRITING_THEMES, ...generatedThemes])]

  let theme: string
  if (random === '1') {
    if (likedThemes.length > 0 && Math.random() < 0.3) {
      theme = likedThemes[Math.floor(Math.random() * likedThemes.length)]
    } else {
      theme = allThemes[Math.floor(Math.random() * allThemes.length)]
    }
  } else {
    const dayIdx = Math.floor(Date.now() / 86400000) % allThemes.length
    theme = allThemes[dayIdx]
  }

  const liked = likedThemes.includes(theme)
  return c.json({ theme, total: allThemes.length, liked })
})

app.post('/theme/like', ownerOnly, async (c) => {
  const { theme } = await c.req.json()
  if (!theme) return c.json({ error: 'theme required' }, 400)
  await c.env.DB.prepare(
    'INSERT OR IGNORE INTO theme_likes (theme) VALUES (?)'
  ).bind(theme).run()
  return c.json({ success: true })
})

app.post('/theme/unlike', ownerOnly, async (c) => {
  const { theme } = await c.req.json()
  if (!theme) return c.json({ error: 'theme required' }, 400)
  await c.env.DB.prepare('DELETE FROM theme_likes WHERE theme = ?').bind(theme).run()
  return c.json({ success: true })
})

app.post('/theme/generate', ownerOnly, async (c) => {
  const db = c.env.DB
  const baseUrl = c.env.AI_BASE_URL || 'https://api.anthropic.com'
  const apiKey = c.env.AI_API_KEY
  const model = c.env.AI_MODEL || 'claude-opus-4-5-20251101'

  const [catRes, likedRes] = await Promise.all([
    db.prepare("SELECT category, COUNT(*) as count FROM articles WHERE category != '' GROUP BY category ORDER BY count DESC LIMIT 20").all(),
    db.prepare('SELECT theme FROM theme_likes').all(),
  ])

  const topCategories = (catRes.results as { category: string; count: number }[])
    .map(r => `${r.category}(${r.count}篇)`).join('、')
  const likedThemes = (likedRes.results as { theme: string }[]).map(r => r.theme).join('、')

  const prompt = `你是专业的中文网文写作导师。请根据以下库存数据，生成20个写作主题，以JSON格式返回。

库存最多的题材分布：${topCategories}
用户喜欢的主题风格：${likedThemes || '暂无'}

要求：
1. 主题要具体、有画面感，2-8个字
2. 覆盖不同情感基调（虐心、甜宠、爽文、悬疑等）
3. 结合用户喜好方向
4. 每个主题附2-4个关键词（用于文章匹配，逗号分隔）

返回JSON（不要有其他内容）：
{
  "themes": [
    {"theme": "主题名称", "keywords": "关键词1,关键词2"},
    ...
  ]
}`

  try {
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return c.json({ error: `AI API 错误: ${res.status}`, detail: err }, 502)
    }

    const data = await res.json() as { content: { type: string; text: string }[] }
    const raw = data.content?.find(b => b.type === 'text')?.text || ''
    let parsed: { themes: { theme: string; keywords: string }[] }
    try { parsed = parseAiJson(raw) as typeof parsed } catch (e) { return c.json({ error: '解析失败', raw }, 502) }
    let added = 0
    for (const { theme, keywords } of parsed.themes) {
      if (theme && theme.length >= 2) {
        await db.prepare(
          'INSERT OR IGNORE INTO generated_themes (theme, keywords) VALUES (?, ?)'
        ).bind(theme, keywords || '').run()
        added++
      }
    }
    return c.json({ success: true, added, themes: parsed.themes })
  } catch (e) {
    return c.json({ error: String(e) }, 502)
  }
})

// ─── Stats ───────────────────────────────────────────────────────────────────

app.get('/stats', async (c) => {
  const db = c.env.DB
  const [total, cats, tagCount, words, sources, catDist] = await Promise.all([
    db.prepare('SELECT COUNT(*) as n FROM articles').first<{ n: number }>(),
    db.prepare("SELECT COUNT(DISTINCT category) as n FROM articles WHERE category != ''").first<{ n: number }>(),
    db.prepare('SELECT COUNT(*) as n FROM tags').first<{ n: number }>(),
    db.prepare('SELECT SUM(word_count) as n FROM articles').first<{ n: number }>(),
    db.prepare('SELECT source, COUNT(*) as count FROM articles GROUP BY source').all(),
    db.prepare("SELECT category, COUNT(*) as count FROM articles WHERE category != '' GROUP BY category ORDER BY count DESC").all(),
  ])

  return c.json({
    total_articles: total?.n || 0,
    total_categories: cats?.n || 0,
    total_tags: tagCount?.n || 0,
    total_words: words?.n || 0,
    source_distribution: sources.results,
    category_distribution: catDist.results,
  })
})

// ─── Inspiration (theme-linked articles with pagination) ──────────────────────

app.get('/inspiration', async (c) => {
  const db = c.env.DB
  const { theme = '', page = '1' } = c.req.query()
  const pageNum = Math.max(1, parseInt(page))
  const pageSize = 6
  const offset = (pageNum - 1) * pageSize

  let articles: Record<string, unknown>[] = []

  if (theme) {
    // Build keywords from theme + look up stored keywords for generated themes
    const storedRow = await db.prepare(
      'SELECT keywords FROM generated_themes WHERE theme = ?'
    ).bind(theme).first<{ keywords: string }>()

    const themeKeywords = extractKeywords(theme)
    const storedKws = storedRow?.keywords
      ? storedRow.keywords.split(',').map(s => s.trim()).filter(s => s.length >= 2)
      : []
    const keywords = [...new Set([...themeKeywords, ...storedKws])]

    if (keywords.length > 0) {
      const conditions: string[] = []
      const params: string[] = []
      for (const kw of keywords) {
        conditions.push('EXISTS (SELECT 1 FROM article_hooks ah WHERE ah.article_id = a.id AND ah.hook LIKE ?)')
        params.push(`%${kw}%`)
        conditions.push('a.category LIKE ?')
        params.push(`%${kw}%`)
        conditions.push('EXISTS (SELECT 1 FROM article_tags at2 WHERE at2.article_id = a.id AND at2.tag LIKE ?)')
        params.push(`%${kw}%`)
      }
      const { results } = await db.prepare(
        `SELECT a.* FROM articles a WHERE (${conditions.join(' OR ')}) ORDER BY a.import_date DESC LIMIT ? OFFSET ?`
      ).bind(...params, pageSize, offset).all()
      articles = results as Record<string, unknown>[]
    }
  }

  // Fallback: fill with random articles if needed
  if (articles.length < 3) {
    const existingIds = articles.map(a => a.id as string)
    const excludeClause = existingIds.length > 0
      ? `WHERE id NOT IN (${existingIds.map(() => '?').join(',')})`
      : ''
    const needed = pageSize - articles.length
    const { results: extra } = await db.prepare(
      `SELECT * FROM articles ${excludeClause} ORDER BY RANDOM() LIMIT ?`
    ).bind(...existingIds, needed).all()
    articles = [...articles, ...extra as Record<string, unknown>[]]
  }

  const full = await attachMeta(db, articles)
  return c.json({ inspirations: full })
})

// ─── Save analysis results back to an article ────────────────────────────────

app.post('/articles/:id/analysis', ownerOnly, async (c) => {
  const id = c.req.param('id')
  const { category, hooks = [], tags = [] } = await c.req.json()
  const db = c.env.DB

  // Update category if currently empty
  if (category) {
    const art = await db.prepare('SELECT category FROM articles WHERE id = ?').bind(id).first<{ category: string }>()
    if (!art?.category || art.category === '' || art.category === '未分类') {
      await db.prepare('UPDATE articles SET category = ? WHERE id = ?').bind(category, id).run()
    }
  }

  // Replace hooks (delete '待分析' and add real ones)
  await db.prepare("DELETE FROM article_hooks WHERE article_id = ? AND hook = '待分析'").bind(id).run()
  for (const hook of hooks as string[]) {
    await db.prepare('INSERT OR IGNORE INTO article_hooks (article_id, hook) VALUES (?, ?)').bind(id, hook).run()
  }

  // Add tags
  for (const tag of tags as string[]) {
    await db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').bind(tag).run()
    await db.prepare('INSERT OR IGNORE INTO article_tags (article_id, tag) VALUES (?, ?)').bind(id, tag).run()
  }

  return c.json({ success: true })
})

// ─── Story Framework Generator ───────────────────────────────────────────────

app.post('/generate-framework', async (c) => {
  const { category, gender, style, hooks = [], extra = '' } = await c.req.json()
  if (!category) return c.json({ error: '请填写题材' }, 400)

  const baseUrl = c.env.AI_BASE_URL || 'https://api.anthropic.com'
  const apiKey  = c.env.AI_API_KEY
  const model   = c.env.AI_MODEL || 'claude-opus-4-5-20251101'

  // 根据风格注入不同的叙事节奏说明
  const styleArc: Record<string, string> = {
    '虐心向':   '开篇即虐（第1节就让读者揪心）→ 越虐越深（每节递进一层痛）→ 情绪爆发点（第4节崩溃或决裂）→ 付费后层层揭开真相 → 余韵收尾',
    '追妻火葬场': '开篇高虐已在进行时（第1节直接展示主角正在承受的伤害）→ 女主觉醒决心离开（第3-4节）→ 男主悔悟开始追妻（付费后）→ 男主代价足够大才和解',
    '甜宠向':   '开篇误会碰撞制造笑点或甜点 → 两人关系渐近 → 甜蜜升温有真实细节 → 中段一个小虐或误会 → 甜蜜收场',
    '爽文向':   '开篇直接打脸（第1节就让读者爽到）→ 主角逐级逆袭每节升一个台阶 → 反派不断作死 → 付费后大结局彻底反转爽翻',
    '悬疑向':   '开篇抛出核心谜题（第1节悬念已摆在台面）→ 线索与误导交替出现 → 第4节假真相让读者以为猜到了 → 付费后真正反转',
  }
  const arcGuide = styleArc[style] || '开篇即进入情绪现场，每节递进一层，付费后揭开核心真相'

  const prompt = `你是一个有多年经验的中文短篇网文作者，同时熟悉付费阅读平台的变现节奏。请根据以下条件，生成一份完整的故事框架。

【平台规格】
- 结构：导语（独立于正文，200-400字）+ 正文8-10节（由你根据故事复杂度决定节数）
- 正文总字数：8000-10000字（每节约900-1100字）
- 付费节点：第4节结尾（约4500字处）设置强钩子
- 第1-4节：免费阅读
- 第5节至最后一节：付费内容

【叙事节奏要求】
本篇风格为「${style || '虐心向'}」，请严格遵循以下节奏弧线：
${arcGuide}
注意：第1节不是用来交代背景的，而是直接把读者扔进情绪现场。读者第一段就要感受到主角的处境和痛点。

【故事条件】
- 题材：${category}
- 视角：${gender || '女主视角'}
- 风格：${style || '虐心向'}
- 爆点标签：${(hooks as string[]).join('、') || '不限'}
- 补充要求：${extra || '无'}

【写作风格要求】
写出来的内容（尤其是导语和付费钩子）必须像真实网文作者写的，不能有AI感。具体要求：

禁止使用：
- 特殊装饰符号（●★■▶【】等，系统界面场景除外）
- "烙印""刻入骨髓""撕裂""深渊""命运的齿轮"之类过度戏剧化的堆砌词
- 三段式排比到底的句式（"他不知道…她不知道…命运不知道…"）
- 标签式金句（"她是他心上一根刺"这类用来代替真实情绪的AI惯用句）

要做到：
- 口语化、情绪直接、有生活烟火气
- 情绪靠行为和细节传递，不靠形容词堆
- 导语和付费钩子写成真实叙述，像作者在讲故事，不是在写宣传文案
- 对白自然，不要每句都像格言

返回JSON（不要有其他内容）：
{
  "title_suggestions": ["标题1", "标题2", "标题3"],
  "teaser": "导语正文（200-400字）：开篇直接进入情绪或悬念，可以是主角某个关键时刻的内心想法、一个正在发生的场景、或者倒叙式的情绪爆发。不剧透核心真相。直接写出完整叙述文字，口语化，有真实感，不要用特殊符号",
  "section_count": 8,
  "sections": [
    {"num": 1, "title": "节标题", "outline": "本节概要（80字内）：开篇直接在情绪现场，主角正在承受什么、处境如何，让读者第一段就入戏"},
    {"num": 2, "title": "节标题", "outline": "本节概要（80字内）：情绪递进一层，主角的处境或认知发生变化"},
    {"num": 3, "title": "节标题", "outline": "本节概要（80字内）：冲突激化，主角情绪被推向临界点"},
    {"num": 4, "title": "节标题", "outline": "本节概要（80字内）：情绪爆发或关键决定，为付费钩子蓄满力", "paywall_hook": "付费钩子正文（100-150字）：第4节最后一段，用一个反转、悬念或情绪炸弹让读者必须付费。直接写出叙事文字，口语化，不用特殊符号，像真实作者在写小说"},
    {"num": 5, "title": "节标题", "outline": "本节概要（80字内）：付费后第一层真相浮现，或追妻/逆袭开始"},
    {"num": 6, "title": "节标题", "outline": "本节概要（80字内）：真相或局势深化，冲突到达新高度"},
    {"num": 7, "title": "节标题", "outline": "本节概要（80字内）：核心真相全部揭露，高潮对决或情感决裂"},
    {"num": 8, "title": "节标题", "outline": "本节概要（80字内）：结局与余韵，情绪落地（如故事复杂可继续第9、10节，格式相同）"}
  ],
  "truth_core": "核心真相（100字内）：付费部分揭示的关键秘密或情节反转",
  "writing_tips": "针对这个具体故事的3条写作建议，要具体可操作，不要泛泛而谈（分行列出）"
}

【JSON格式注意事项】
- 所有字符串值必须在同一行内，不得包含真实换行符（如需换行用 \\n 表示）
- 字符串内禁止使用英文双引号 "，改用中文引号「」或『』
- 不要在JSON之外输出任何内容`

  try {
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return c.json({ error: `AI API 错误: ${res.status}`, detail: err }, 502)
    }

    const data = await res.json() as { content: { type: string; text: string }[] }
    const raw = data.content?.find(b => b.type === 'text')?.text || ''
    try { return c.json(parseAiJson(raw)) } catch (e) { return c.json({ error: `解析失败: ${(e as Error).message}`, raw }, 502) }
  } catch (e) {
    return c.json({ error: String(e) }, 502)
  }
})

// ─── AI Analysis ─────────────────────────────────────────────────────────────

app.post('/analyze', ownerOnly, async (c) => {
  const { title = '', content = '' } = await c.req.json()
  if (!title && !content) return c.json({ error: '请提供标题或内容' }, 400)

  const baseUrl = c.env.AI_BASE_URL || 'https://api.anthropic.com'
  const apiKey  = c.env.AI_API_KEY
  const model   = c.env.AI_MODEL || 'claude-opus-4-5-20251101'

  // Send at most 3000 chars of content to keep tokens manageable
  const preview = content.slice(0, 3000)

  const prompt = `你是一位专业的中文网文分析师。请分析以下文章，提取关键信息并以JSON格式返回。

标题：${title}
${preview ? `正文（节选）：\n${preview}` : '（无正文，仅根据标题分析）'}

请返回以下JSON格式（不要有其他内容）：
{
  "category": "建议的分类（如：甜宠、逆袭、宫斗、现代言情等）",
  "hooks": ["爆点1", "爆点2"],
  "tags": ["标签1", "标签2", "标签3"],
  "summary": "一句话故事简介（30字以内）",
  "writing_tips": "针对这个故事类型的写作建议（50字以内）"
}`

  try {
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return c.json({ error: `AI API 错误: ${res.status}`, detail: err }, 502)
    }

    const data = await res.json() as {
      content: { type: string; text: string }[]
    }

    const raw = data.content?.find(b => b.type === 'text')?.text || ''

    try { return c.json(parseAiJson(raw)) } catch (e) { return c.json({ error: '解析失败', raw }, 502) }
  } catch (e) {
    return c.json({ error: String(e) }, 502)
  }
})

// ─── Badge Definitions (200 badges across 10 categories) ─────────────────────

interface BadgeDef {
  id: string; emoji: string; name: string; desc: string; category: string; hidden?: boolean
}

const BADGE_DEFS: BadgeDef[] = [
  // 🔥 连续打卡 (20)
  { id:'streak_3',   emoji:'🔥', name:'初次点火',   desc:'连续3天完成每日目标',   category:'streak' },
  { id:'streak_7',   emoji:'🔥', name:'周更达人',   desc:'连续7天完成每日目标',   category:'streak' },
  { id:'streak_14',  emoji:'🔥', name:'双周勇士',   desc:'连续14天完成每日目标',  category:'streak' },
  { id:'streak_21',  emoji:'🔥', name:'三周精英',   desc:'连续21天完成每日目标',  category:'streak' },
  { id:'streak_30',  emoji:'🔥', name:'月度勇士',   desc:'连续30天完成每日目标',  category:'streak' },
  { id:'streak_45',  emoji:'🔥', name:'铁打意志',   desc:'连续45天完成每日目标',  category:'streak' },
  { id:'streak_60',  emoji:'🔥', name:'两月不息',   desc:'连续60天完成每日目标',  category:'streak' },
  { id:'streak_90',  emoji:'🔥', name:'季度传说',   desc:'连续90天完成每日目标',  category:'streak' },
  { id:'streak_120', emoji:'🏆', name:'四月霸主',   desc:'连续120天完成每日目标', category:'streak' },
  { id:'streak_150', emoji:'🏆', name:'五月不倒',   desc:'连续150天完成每日目标', category:'streak' },
  { id:'streak_180', emoji:'👑', name:'半年无间',   desc:'连续180天完成每日目标', category:'streak' },
  { id:'streak_210', emoji:'👑', name:'七月长征',   desc:'连续210天完成每日目标', category:'streak' },
  { id:'streak_250', emoji:'👑', name:'铁人写手',   desc:'连续250天完成每日目标', category:'streak' },
  { id:'streak_300', emoji:'👑', name:'三百勇士',   desc:'连续300天完成每日目标', category:'streak' },
  { id:'streak_365', emoji:'🌟', name:'年度神话',   desc:'连续365天完成每日目标', category:'streak' },
  { id:'weekly_streak_2',  emoji:'📅', name:'两周全勤', desc:'连续2周每周达标5天以上', category:'streak' },
  { id:'weekly_streak_4',  emoji:'📅', name:'月度全勤', desc:'连续4周每周达标5天以上', category:'streak' },
  { id:'weekly_streak_8',  emoji:'📅', name:'双月全勤', desc:'连续8周每周达标5天以上', category:'streak' },
  { id:'weekly_streak_12', emoji:'📅', name:'季度全勤', desc:'连续12周每周达标5天以上',category:'streak' },
  { id:'streak_comeback',  emoji:'💪', name:'浴火重生', desc:'断签7天以上后再次连续达标7天',category:'streak' },

  // ⚡ 单日爆发 (20)
  { id:'daily_1000',  emoji:'⚡', name:'迈出第一步', desc:'单日写满1000字', category:'daily' },
  { id:'daily_1500',  emoji:'⚡', name:'小试牛刀',   desc:'单日写满1500字', category:'daily' },
  { id:'daily_2000',  emoji:'⚡', name:'稳步前行',   desc:'单日写满2000字', category:'daily' },
  { id:'daily_3000',  emoji:'⚡', name:'三千字士',   desc:'单日写满3000字', category:'daily' },
  { id:'daily_5000',  emoji:'⚡', name:'爆发一日',   desc:'单日写满5000字', category:'daily' },
  { id:'daily_8000',  emoji:'⚡', name:'八千字客',   desc:'单日写满8000字', category:'daily' },
  { id:'daily_10000', emoji:'⚡', name:'一万字侠',   desc:'单日写满10000字',category:'daily' },
  { id:'daily_15000', emoji:'⚡', name:'一万五进阶', desc:'单日写满15000字',category:'daily' },
  { id:'daily_20000', emoji:'⚡', name:'字如泉涌',   desc:'单日写满20000字',category:'daily' },
  { id:'daily_30000', emoji:'⚡', name:'三万字神',   desc:'单日写满30000字',category:'daily' },
  { id:'daily_50000', emoji:'🌟', name:'封神之日',   desc:'单日写满50000字',category:'daily' },
  { id:'daily_over150', emoji:'🚀', name:'超额完成',   desc:'单日超出目标150%', category:'daily' },
  { id:'daily_over200', emoji:'🚀', name:'双倍努力',   desc:'单日超出目标200%', category:'daily' },
  { id:'daily_over300', emoji:'🚀', name:'三倍爆发',   desc:'单日超出目标300%', category:'daily' },
  { id:'daily_over500', emoji:'🚀', name:'五倍疯魔',   desc:'单日超出目标500%', category:'daily' },
  { id:'daily_5x_over', emoji:'🎯', name:'持续超神',   desc:'连续5天超出每日目标', category:'daily' },
  { id:'daily_7x_over', emoji:'🎯', name:'七日超标',   desc:'连续7天超出每日目标', category:'daily' },
  { id:'daily_exact',   emoji:'🎯', name:'精准狙击',   desc:'恰好完成每日目标（误差≤5字）',category:'daily' },
  { id:'daily_3exact',  emoji:'🎯', name:'三连精准',   desc:'连续3天精准命中目标（误差≤5字）',category:'daily' },
  { id:'daily_monday',  emoji:'📅', name:'周一战士',   desc:'在10个不同的周一完成目标',category:'daily' },

  // 📚 累计里程碑 (20)
  { id:'first_record',   emoji:'🌱', name:'初出茅庐',   desc:'第一次记录码字',        category:'total' },
  { id:'total_5000',     emoji:'📚', name:'积少成多',   desc:'累计写满5000字',        category:'total' },
  { id:'total_10000',    emoji:'📚', name:'初尝甜头',   desc:'累计写满1万字',         category:'total' },
  { id:'total_30000',    emoji:'📚', name:'三万字路',   desc:'累计写满3万字',         category:'total' },
  { id:'total_50000',    emoji:'📚', name:'渐入佳境',   desc:'累计写满5万字',         category:'total' },
  { id:'total_100000',   emoji:'📚', name:'著作等身',   desc:'累计写满10万字',        category:'total' },
  { id:'total_200000',   emoji:'📚', name:'双十万里',   desc:'累计写满20万字',        category:'total' },
  { id:'total_300000',   emoji:'📚', name:'三十万字',   desc:'累计写满30万字',        category:'total' },
  { id:'total_500000',   emoji:'📚', name:'半部书稿',   desc:'累计写满50万字',        category:'total' },
  { id:'total_800000',   emoji:'👑', name:'八十万雄',   desc:'累计写满80万字',        category:'total' },
  { id:'total_1000000',  emoji:'👑', name:'百万作家',   desc:'累计写满100万字',       category:'total' },
  { id:'total_2000000',  emoji:'🌟', name:'双百万史诗', desc:'累计写满200万字',       category:'total' },
  { id:'total_5000000',  emoji:'🌌', name:'文字宇宙',   desc:'累计写满500万字',       category:'total' },
  { id:'records_10',     emoji:'📋', name:'十日记录',   desc:'累计记录10天',          category:'total' },
  { id:'records_30',     emoji:'📋', name:'三十日记',   desc:'累计记录30天',          category:'total' },
  { id:'records_50',     emoji:'📋', name:'五十日志',   desc:'累计记录50天',          category:'total' },
  { id:'records_100',    emoji:'📋', name:'百日书',     desc:'累计记录100天',         category:'total' },
  { id:'records_200',    emoji:'📋', name:'二百日传',   desc:'累计记录200天',         category:'total' },
  { id:'month_200k',     emoji:'⚡', name:'月产二十万', desc:'单月累计写满20万字',    category:'total' },
  { id:'month_500k',     emoji:'🌟', name:'月产五十万', desc:'单月累计写满50万字',    category:'total' },

  // 🗓️ 月度成就 (20)
  { id:'month_50pct',   emoji:'🗓️', name:'月度半程',   desc:'完成当月目标的50%',       category:'monthly' },
  { id:'month_80pct',   emoji:'🗓️', name:'接近满月',   desc:'完成当月目标的80%',       category:'monthly' },
  { id:'month_100pct',  emoji:'🗓️', name:'完美一月',   desc:'100%完成当月目标',        category:'monthly' },
  { id:'month_120pct',  emoji:'🗓️', name:'月度超越',   desc:'完成当月目标的120%',      category:'monthly' },
  { id:'month_150pct',  emoji:'🗓️', name:'月度爆表',   desc:'完成当月目标的150%',      category:'monthly' },
  { id:'month_achieved_15', emoji:'🗓️', name:'月度半',  desc:'单月达标天数≥15天',      category:'monthly' },
  { id:'month_achieved_20', emoji:'🗓️', name:'月度主力',desc:'单月达标天数≥20天',      category:'monthly' },
  { id:'month_achieved_25', emoji:'🗓️', name:'月度精英',desc:'单月达标天数≥25天',      category:'monthly' },
  { id:'month_no_zero', emoji:'🗓️', name:'月度无空',   desc:'单月每天都有记录(无0字)', category:'monthly' },
  { id:'month_full',    emoji:'🗓️', name:'全月满勤',   desc:'单月每天均完成目标',      category:'monthly' },
  { id:'month_con_2',   emoji:'📆', name:'双月连冠',   desc:'连续2个月完成月度目标',   category:'monthly' },
  { id:'month_con_3',   emoji:'📆', name:'季度三连',   desc:'连续3个月完成月度目标',   category:'monthly' },
  { id:'month_con_6',   emoji:'📆', name:'半年达标',   desc:'连续6个月完成月度目标',   category:'monthly' },
  { id:'month_con_12',  emoji:'📆', name:'年度全达',   desc:'连续12个月完成月度目标',  category:'monthly' },
  { id:'month_early',   emoji:'🗓️', name:'提前完成',   desc:'在当月20日前完成月度目标', category:'monthly' },
  { id:'month_comeback',emoji:'💪', name:'最后一搏',   desc:'在月最后3天完成月度目标', category:'monthly' },
  { id:'month_first_complete',emoji:'🎊',name:'首月完成',desc:'第一次完成月度目标',     category:'monthly' },
  { id:'month_triple_100',emoji:'📆',name:'三月百分',  desc:'3次完成月度100%目标',     category:'monthly' },
  { id:'month_open',    emoji:'🗓️', name:'开门红',     desc:'月第一天就完成每日目标',  category:'monthly' },
  { id:'month_close',   emoji:'🗓️', name:'完美收官',   desc:'月最后一天完成每日目标',  category:'monthly' },

  // 🌅 时间特质 (20)
  { id:'day_monday',    emoji:'🌅', name:'周一开炮',   desc:'在某个周一完成每日目标',  category:'time' },
  { id:'day_friday',    emoji:'🌅', name:'周五逆袭',   desc:'在某个周五完成每日目标',  category:'time' },
  { id:'day_saturday',  emoji:'🌅', name:'周末不放假', desc:'在某个周六完成每日目标',  category:'time' },
  { id:'day_sunday',    emoji:'🌅', name:'日曜写手',   desc:'在某个周日完成每日目标',  category:'time' },
  { id:'full_week',     emoji:'🌅', name:'满分一周',   desc:'某一自然周7天全部完成目标',category:'time' },
  { id:'weekday_5',     emoji:'🌅', name:'工作日全勤', desc:'某周Mon-Fri全部完成目标', category:'time' },
  { id:'weekend_4',     emoji:'🌅', name:'四周末全勤', desc:'连续4个周末(六日)均完成目标',category:'time' },
  { id:'monday_4month', emoji:'🌅', name:'周一常客',   desc:'某月所有周一均完成目标',  category:'time' },
  { id:'new_month_3',   emoji:'🌅', name:'三度开门红', desc:'3次在月第一天完成目标',   category:'time' },
  { id:'month_close_3', emoji:'🌅', name:'三度完美收', desc:'3次在月最后一天完成目标', category:'time' },
  { id:'jan_first',     emoji:'🎆', name:'元旦写手',   desc:'在1月1日完成每日目标',    category:'time' },
  { id:'may_first',     emoji:'🌸', name:'劳动节写手', desc:'在5月1日完成每日目标',    category:'time' },
  { id:'oct_first',     emoji:'🎊', name:'国庆写手',   desc:'在10月1日完成每日目标',   category:'time' },
  { id:'dec_31',        emoji:'🎇', name:'跨年一笔',   desc:'在12月31日完成每日目标',  category:'time' },
  { id:'same_day_3years',emoji:'🌅',name:'三年同日',   desc:'连续3年在同月同日完成目标',category:'time' },
  { id:'full_week_3times',emoji:'🌅',name:'三周满分',  desc:'累计3个满分自然周',       category:'time' },
  { id:'weekend_warrior_10',emoji:'🌅',name:'十次周末', desc:'累计10个周末完成目标',   category:'time' },
  { id:'holiday_writer', emoji:'🎉', name:'节日写手',  desc:'在任意节假日完成目标5次',  category:'time' },
  { id:'all_weekday_month',emoji:'🌅',name:'工作日月满',desc:'某月所有工作日均完成目标',category:'time' },
  { id:'day_14',        emoji:'💕', name:'情人节写手', desc:'在2月14日完成每日目标',   category:'time' },

  // 🚀 超额挑战 (20)
  { id:'over_150_5',    emoji:'🚀', name:'五日超速',   desc:'连续5天超出日目标150%',   category:'over' },
  { id:'over_200_3',    emoji:'🚀', name:'双倍三连',   desc:'连续3天超出日目标200%',   category:'over' },
  { id:'over_300_total_3',emoji:'🚀',name:'三倍俱乐部',desc:'累计3次超出日目标300%',   category:'over' },
  { id:'over_total_month_200pct',emoji:'🚀',name:'月度双倍',desc:'当月总字数超出月目标200%',category:'over' },
  { id:'daily_10x_over',emoji:'🚀', name:'十日超神',   desc:'连续10天超出每日目标',    category:'over' },
  { id:'total_over_10',  emoji:'🚀', name:'十连超标',  desc:'累计10次超出每日目标',    category:'over' },
  { id:'total_over_30',  emoji:'🚀', name:'三十超标',  desc:'累计30次超出每日目标',    category:'over' },
  { id:'total_over_50',  emoji:'🚀', name:'五十超标',  desc:'累计50次超出每日目标',    category:'over' },
  { id:'total_over_100', emoji:'🚀', name:'百次超标',  desc:'累计100次超出每日目标',   category:'over' },
  { id:'single_max_2x',  emoji:'🚀', name:'翻倍高手',  desc:'单日写了目标200%的字',    category:'over' },
  { id:'single_max_3x',  emoji:'🚀', name:'三倍高手',  desc:'单日写了目标300%的字',    category:'over' },
  { id:'month_extra_50k',emoji:'🚀', name:'月度赠品',  desc:'单月超出月目标5万字',     category:'over' },
  { id:'week_over_all',  emoji:'🚀', name:'满周超标',  desc:'某周7天全部超出每日目标', category:'over' },
  { id:'over_streak_14', emoji:'🚀', name:'双周超神',  desc:'连续14天超出每日目标',    category:'over' },
  { id:'over_streak_21', emoji:'🚀', name:'三周超神',  desc:'连续21天超出每日目标',    category:'over' },
  { id:'over_streak_30', emoji:'🌟', name:'月度超神',  desc:'连续30天超出每日目标',    category:'over' },
  { id:'over_double_5',  emoji:'🚀', name:'五次加倍',  desc:'累计5次写了当日目标2倍以上',category:'over' },
  { id:'over_triple_3',  emoji:'🚀', name:'三次三倍',  desc:'累计3次写了当日目标3倍以上',category:'over' },
  { id:'best_day_5k',    emoji:'🚀', name:'最佳纪录5k',desc:'单日最高字数超过5000字',  category:'over' },
  { id:'best_day_10k',   emoji:'🌟', name:'最佳纪录1w',desc:'单日最高字数超过10000字', category:'over' },

  // 💪 逆袭系列 (20)
  { id:'first_after_break_7',  emoji:'💪', name:'绝地反击',  desc:'断签7天后重新打卡',       category:'comeback' },
  { id:'month_save_last3',     emoji:'💪', name:'最后三天',  desc:'月最后3天追完当月目标',   category:'comeback' },
  { id:'comeback_streak_3',    emoji:'💪', name:'小小逆袭',  desc:'断签后连续达标3天',       category:'comeback' },
  { id:'comeback_streak_7',    emoji:'💪', name:'七日翻身',  desc:'断签后连续达标7天',       category:'comeback' },
  { id:'comeback_streak_14',   emoji:'💪', name:'双周翻身',  desc:'断签后连续达标14天',      category:'comeback' },
  { id:'zero_to_hero',         emoji:'💪', name:'零到英雄',  desc:'当月前10天全0后仍完成月目标',category:'comeback' },
  { id:'second_wind',          emoji:'💪', name:'第二春',    desc:'累计2次断签重启',         category:'comeback' },
  { id:'phoenix',              emoji:'💪', name:'涅槃重生',  desc:'累计3次断签重启',         category:'comeback' },
  { id:'underdog',             emoji:'💪', name:'黑马写手',  desc:'从最低记录(含0)到单日最高', category:'comeback' },
  { id:'monthly_comeback_3',   emoji:'💪', name:'三月逆袭',  desc:'3次在月后半段完成月目标', category:'comeback' },
  { id:'best_recovery',        emoji:'💪', name:'最强复出',  desc:'断签后首日写了5000字以上', category:'comeback' },
  { id:'consecutive_fail_3_then_30',emoji:'💪',name:'浴血30天',desc:'3天未达标后连续达标30天',category:'comeback' },
  { id:'half_month_comeback',  emoji:'💪', name:'下半月逆袭',desc:'月前15天不足目标50%但最终完成100%',category:'comeback' },
  { id:'triple_comeback',      emoji:'💪', name:'三起三落',  desc:'至少经历3次断签+重建连续',category:'comeback' },
  { id:'comeback_200pct',      emoji:'💪', name:'复出就爆发',desc:'断签后复出首日超出目标200%',category:'comeback' },
  { id:'never_give_up',        emoji:'💪', name:'永不言弃',  desc:'累计5次断签后重启',       category:'comeback' },
  { id:'last_minute_save',     emoji:'💪', name:'最后一刻',  desc:'月最后一天完成月度目标',  category:'comeback' },
  { id:'big_day_after_zero',   emoji:'💪', name:'蓄力爆发',  desc:'0字后次日写了目标200%以上',category:'comeback' },
  { id:'month_15plus_from_0',  emoji:'💪', name:'后来居上',  desc:'月前10天全0后达标天数≥15',category:'comeback' },
  { id:'come_back_10',         emoji:'💪', name:'重启十次',  desc:'断签后成功重建连续10次',  category:'comeback' },

  // 🎯 精准系列 (20)
  { id:'exact_target_3',  emoji:'🎯', name:'三连命中',  desc:'连续3天精准命中目标(误差≤10字)',category:'precise' },
  { id:'exact_target_5',  emoji:'🎯', name:'五连命中',  desc:'连续5天精准命中目标(误差≤10字)',category:'precise' },
  { id:'exact_target_7',  emoji:'🎯', name:'七连命中',  desc:'连续7天精准命中目标(误差≤10字)',category:'precise' },
  { id:'daily_zero_to_target',emoji:'🎯',name:'精打细算',desc:'当日恰好完成且昨日为0字',  category:'precise' },
  { id:'avg_100pct_week', emoji:'🎯', name:'周平均达标', desc:'某周7天平均字数≥每日目标',  category:'precise' },
  { id:'consistent_7',    emoji:'🎯', name:'稳定输出',  desc:'7天内日均波动不超过500字', category:'precise' },
  { id:'consistent_14',   emoji:'🎯', name:'极度稳定',  desc:'14天内每天都有记录且差值<1000字',category:'precise' },
  { id:'palindrome_words', emoji:'🎯', name:'回文字数',  desc:'单日字数是回文数(如1221)', category:'precise' },
  { id:'round_number',    emoji:'🎯', name:'整数达人',  desc:'单日字数恰好是整千(如3000、5000)',category:'precise' },
  { id:'fibonacci_words', emoji:'🎯', name:'斐波那契',  desc:'单日字数是斐波那契数(1597,2584,4181...)',category:'precise' },
  { id:'same_for_3',      emoji:'🎯', name:'三连相同',  desc:'连续3天写了完全相同的字数', category:'precise' },
  { id:'exactly_half',    emoji:'🎯', name:'恰好一半',  desc:'当日字数恰好是月目标的1/10', category:'precise' },
  { id:'target_plus_1',   emoji:'🎯', name:'差一点点',  desc:'当日超出目标恰好1-9字',    category:'precise' },
  { id:'weekly_avg_match',emoji:'🎯', name:'周均精准',  desc:'某周平均字数与日目标误差<50字',category:'precise' },
  { id:'double_digits_streak',emoji:'🎯',name:'两位数连续',desc:'连续天数达到某个两位整数', category:'precise' },
  { id:'month_daily_avg', emoji:'🎯', name:'月均达标',  desc:'某月日均字数≥每日目标',    category:'precise' },
  { id:'steady_3month',   emoji:'🎯', name:'三月稳产',  desc:'连续3个月每月日均字数≥目标',category:'precise' },
  { id:'no_overflow',     emoji:'🎯', name:'刚刚好',    desc:'单日字数在目标100%-110%之间5次',category:'precise' },
  { id:'ten_percent_up',  emoji:'🎯', name:'逐日递进',  desc:'连续5天每天字数比前一天多', category:'precise' },
  { id:'symmetric_week',  emoji:'🎯', name:'对称一周',  desc:'一周字数呈对称分布(中间最高)',category:'precise' },

  // 🌟 稀有成就 (20)
  { id:'day_200',   emoji:'🌟', name:'两百字日',   desc:'累计记录200天',           category:'rare' },
  { id:'day_300',   emoji:'🌟', name:'三百字日',   desc:'累计记录300天',           category:'rare' },
  { id:'day_365',   emoji:'🌟', name:'写满一年',   desc:'累计记录365天',           category:'rare' },
  { id:'day_500',   emoji:'🌟', name:'五百字日',   desc:'累计记录500天',           category:'rare' },
  { id:'day_1000',  emoji:'👑', name:'千日书写',   desc:'累计记录1000天',          category:'rare' },
  { id:'streak_500',emoji:'👑', name:'五百连胜',   desc:'连续500天完成每日目标',   category:'rare' },
  { id:'total_3m',  emoji:'👑', name:'三百万字',   desc:'累计写满300万字',         category:'rare' },
  { id:'total_10m', emoji:'🌌', name:'千万字神',   desc:'累计写满1000万字',        category:'rare' },
  { id:'year_1m',   emoji:'🌟', name:'年产百万',   desc:'某一年内累计写满100万字', category:'rare' },
  { id:'year_500k', emoji:'🌟', name:'年产五十万', desc:'某一年内累计写满50万字',  category:'rare' },
  { id:'month_full_3',emoji:'🌟',name:'三月全满',  desc:'累计3个月全月达标',       category:'rare' },
  { id:'month_full_6',emoji:'👑',name:'六月全满',  desc:'累计6个月全月达标',       category:'rare' },
  { id:'week_full_10',emoji:'🌟',name:'十周满分',  desc:'累计10个满分自然周',      category:'rare' },
  { id:'all_badges_cat_streak',emoji:'🌟',name:'连续达人',desc:'解锁全部连续打卡类徽章',category:'rare' },
  { id:'badges_50', emoji:'🌟', name:'半百勋章',   desc:'累计解锁50枚徽章',        category:'rare' },
  { id:'badges_100',emoji:'👑', name:'百章荣耀',   desc:'累计解锁100枚徽章',       category:'rare' },
  { id:'badges_150',emoji:'👑', name:'百五勋章',   desc:'累计解锁150枚徽章',       category:'rare' },
  { id:'badges_180',emoji:'🌟', name:'百八十章',   desc:'累计解锁180枚徽章',       category:'rare' },
  { id:'never_miss_week',emoji:'🌟',name:'不缺一周',desc:'累计50个每周至少打卡1次的周',category:'rare' },
  { id:'longest_gap_comeback',emoji:'🌟',name:'最强回归',desc:'断签30天以上后重新连续达标7天',category:'rare' },

  // 🎭 隐藏彩蛋 (20)
  { id:'hidden_777',    emoji:'🎭', name:'幸运数字',   desc:'单日写了777字',              category:'hidden', hidden:true },
  { id:'hidden_1314',   emoji:'🎭', name:'一生一世',   desc:'单日写了1314字',             category:'hidden', hidden:true },
  { id:'hidden_2333',   emoji:'🎭', name:'哈哈哈',     desc:'单日写了2333字',             category:'hidden', hidden:true },
  { id:'hidden_6666',   emoji:'🎭', name:'六六大顺',   desc:'单日写了6666字',             category:'hidden', hidden:true },
  { id:'hidden_8888',   emoji:'🎭', name:'发发发发',   desc:'单日写了8888字',             category:'hidden', hidden:true },
  { id:'hidden_9999',   emoji:'🎭', name:'九九归一',   desc:'单日写了9999字',             category:'hidden', hidden:true },
  { id:'hidden_520',    emoji:'💕', name:'我爱写作',   desc:'在5月20日完成每日目标',      category:'hidden', hidden:true },
  { id:'hidden_palindrome_date',emoji:'🎭',name:'回文日',desc:'在回文日期打卡(如2025-05-20→20250520)',category:'hidden',hidden:true},
  { id:'hidden_new_year',emoji:'🎭',name:'新年第一笔', desc:'在当年第1天完成目标',        category:'hidden', hidden:true },
  { id:'hidden_same_streak_day',emoji:'🎭',name:'数字重合',desc:'连续天数等于当天日期数字',category:'hidden',hidden:true},
  { id:'hidden_friday_13',emoji:'🎭',name:'黑色星期五',desc:'在13号且周五完成目标',       category:'hidden', hidden:true },
  { id:'hidden_triple_7',emoji:'🎭',name:'三个7',      desc:'连续打卡第77天',             category:'hidden', hidden:true },
  { id:'hidden_888_streak',emoji:'🎭',name:'发财连续', desc:'连续打卡第8天时写了8字的倍数',category:'hidden',hidden:true},
  { id:'hidden_midnight',emoji:'🎭', name:'深夜奇遇',  desc:'第100次打卡',                category:'hidden', hidden:true },
  { id:'hidden_1001',   emoji:'🎭', name:'一零零一',   desc:'单日写了1001字',             category:'hidden', hidden:true },
  { id:'hidden_all_week_same',emoji:'🎭',name:'完美对称',desc:'一周7天写了完全相同的字数', category:'hidden', hidden:true },
  { id:'hidden_streak_on_birthday_month',emoji:'🎭',name:'生日月达标',desc:'连续写满10天时当天总记录数是你生日月',category:'hidden',hidden:true},
  { id:'hidden_year_end_rush',emoji:'🎭',name:'年终冲刺',desc:'12月最后7天全部达标',      category:'hidden', hidden:true },
  { id:'hidden_100_day',emoji:'🎭', name:'第一百天',   desc:'第100次打卡那天',            category:'hidden', hidden:true },
  { id:'hidden_typo_words',emoji:'🎭',name:'好奇探索',  desc:'解锁了10枚以上隐藏彩蛋',   category:'hidden', hidden:true },
]

// ─── Badge check logic ─────────────────────────────────────────────────────────

function computeCurrentStreak(records: {date:string;actual_words:number}[], dailyTarget: number): number {
  const sorted = [...records].sort((a,b) => b.date.localeCompare(a.date))
  let streak = 0
  let prevDate = ''
  for (const r of sorted) {
    if (r.actual_words < dailyTarget) break
    if (prevDate) {
      const prev = new Date(prevDate)
      const cur = new Date(r.date)
      const diff = (prev.getTime() - cur.getTime()) / 86400000
      if (diff !== 1) break
    }
    streak++
    prevDate = r.date
  }
  return streak
}

function computeMaxStreak(records: {date:string;actual_words:number}[], dailyTarget: number): number {
  const sorted = [...records].sort((a,b) => a.date.localeCompare(b.date))
  let max = 0, cur = 0, prev = ''
  for (const r of sorted) {
    if (r.actual_words >= dailyTarget) {
      if (prev) {
        const d = (new Date(r.date).getTime() - new Date(prev).getTime()) / 86400000
        cur = d === 1 ? cur + 1 : 1
      } else { cur = 1 }
      max = Math.max(max, cur)
    } else { cur = 0 }
    prev = r.date
  }
  return max
}

function isPalindrome(n: number): boolean {
  const s = String(n); return s === s.split('').reverse().join('')
}

function isRoundThousand(n: number): boolean {
  return n > 0 && n % 1000 === 0
}

function isFibonacci(n: number): boolean {
  const fibs = [1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597,2584,4181,6765,10946,17711,28657,46368]
  return fibs.includes(n)
}

function shouldUnlock(
  badgeId: string,
  records: {date:string;actual_words:number}[],
  dailyTarget: number,
  monthlyTarget: number,
  unlockedCount: number
): boolean {
  const sorted = [...records].sort((a,b) => a.date.localeCompare(b.date))
  const totalWords = records.reduce((s,r) => s + r.actual_words, 0)
  const recordCount = records.length
  const achievedDays = records.filter(r => r.actual_words >= dailyTarget)
  const overDays = records.filter(r => r.actual_words > dailyTarget)
  const maxDaily = Math.max(...records.map(r=>r.actual_words), 0)
  const curStreak = computeCurrentStreak(records, dailyTarget)
  const maxStreak = computeMaxStreak(records, dailyTarget)

  // Helper: get day-of-week (1=Mon..7=Sun)
  const dow = (d: string) => { const dt = new Date(d); return ((dt.getDay()+6)%7)+1 }
  // Days in a month
  const daysInMonth = (y:number,m:number) => new Date(y,m,0).getDate()

  // Group records by month
  const byMonth: Record<string,{date:string;actual_words:number}[]> = {}
  for (const r of records) {
    const key = r.date.slice(0,7)
    if (!byMonth[key]) byMonth[key] = []
    byMonth[key].push(r)
  }
  const monthKeys = Object.keys(byMonth).sort()

  switch(badgeId) {
    // Streaks
    case 'streak_3': return maxStreak >= 3
    case 'streak_7': return maxStreak >= 7
    case 'streak_14': return maxStreak >= 14
    case 'streak_21': return maxStreak >= 21
    case 'streak_30': return maxStreak >= 30
    case 'streak_45': return maxStreak >= 45
    case 'streak_60': return maxStreak >= 60
    case 'streak_90': return maxStreak >= 90
    case 'streak_120': return maxStreak >= 120
    case 'streak_150': return maxStreak >= 150
    case 'streak_180': return maxStreak >= 180
    case 'streak_210': return maxStreak >= 210
    case 'streak_250': return maxStreak >= 250
    case 'streak_300': return maxStreak >= 300
    case 'streak_365': return maxStreak >= 365
    case 'weekly_streak_2': {
      // consecutive weeks with 5+ achieved days
      const weekMap: Record<string,number> = {}
      for (const r of achievedDays) {
        const dt = new Date(r.date)
        const weekStart = new Date(dt); weekStart.setDate(dt.getDate() - ((dt.getDay()+6)%7))
        const key = weekStart.toISOString().slice(0,10)
        weekMap[key] = (weekMap[key]||0) + 1
      }
      const weeks = Object.entries(weekMap).filter(([,v])=>v>=5).map(([k])=>k).sort()
      let maxW=0,curW=0,prevW=''
      for (const w of weeks) {
        if (prevW) {
          const d=(new Date(w).getTime()-new Date(prevW).getTime())/604800000
          curW = Math.abs(d-1)<0.1 ? curW+1 : 1
        } else curW=1
        maxW=Math.max(maxW,curW); prevW=w
      }
      return maxW>=2
    }
    case 'weekly_streak_4': return (() => {
      const weekMap: Record<string,number> = {}
      for (const r of achievedDays) {
        const dt = new Date(r.date); const ws = new Date(dt); ws.setDate(dt.getDate()-((dt.getDay()+6)%7))
        const key = ws.toISOString().slice(0,10); weekMap[key]=(weekMap[key]||0)+1
      }
      const weeks=Object.entries(weekMap).filter(([,v])=>v>=5).map(([k])=>k).sort()
      let mx=0,cx=0,pw=''
      for(const w of weeks){if(pw){const d=(new Date(w).getTime()-new Date(pw).getTime())/604800000;cx=Math.abs(d-1)<0.1?cx+1:1}else cx=1;mx=Math.max(mx,cx);pw=w}
      return mx>=4
    })()
    case 'weekly_streak_8': return (() => {
      const weekMap: Record<string,number> = {}
      for (const r of achievedDays) {
        const dt = new Date(r.date); const ws = new Date(dt); ws.setDate(dt.getDate()-((dt.getDay()+6)%7))
        const key = ws.toISOString().slice(0,10); weekMap[key]=(weekMap[key]||0)+1
      }
      const weeks=Object.entries(weekMap).filter(([,v])=>v>=5).map(([k])=>k).sort()
      let mx=0,cx=0,pw=''
      for(const w of weeks){if(pw){const d=(new Date(w).getTime()-new Date(pw).getTime())/604800000;cx=Math.abs(d-1)<0.1?cx+1:1}else cx=1;mx=Math.max(mx,cx);pw=w}
      return mx>=8
    })()
    case 'weekly_streak_12': return (() => {
      const weekMap: Record<string,number> = {}
      for (const r of achievedDays) {
        const dt = new Date(r.date); const ws = new Date(dt); ws.setDate(dt.getDate()-((dt.getDay()+6)%7))
        const key = ws.toISOString().slice(0,10); weekMap[key]=(weekMap[key]||0)+1
      }
      const weeks=Object.entries(weekMap).filter(([,v])=>v>=5).map(([k])=>k).sort()
      let mx=0,cx=0,pw=''
      for(const w of weeks){if(pw){const d=(new Date(w).getTime()-new Date(pw).getTime())/604800000;cx=Math.abs(d-1)<0.1?cx+1:1}else cx=1;mx=Math.max(mx,cx);pw=w}
      return mx>=12
    })()
    case 'streak_comeback': {
      // gap of 7+ days where all words < target, then a new streak of 7+
      let gapStart = -1
      for(let i=0;i<sorted.length;i++){
        if(sorted[i].actual_words < dailyTarget) { if(gapStart<0) gapStart=i }
        else {
          if(gapStart>=0 && i-gapStart>=7) {
            // check subsequent streak
            let s=0;for(let j=i;j<sorted.length;j++){if(sorted[j].actual_words>=dailyTarget)s++;else break}
            if(s>=7) return true
          }
          gapStart=-1
        }
      }
      return false
    }

    // Daily
    case 'daily_1000': return maxDaily >= 1000
    case 'daily_1500': return maxDaily >= 1500
    case 'daily_2000': return maxDaily >= 2000
    case 'daily_3000': return maxDaily >= 3000
    case 'daily_5000': return maxDaily >= 5000
    case 'daily_8000': return maxDaily >= 8000
    case 'daily_10000': return maxDaily >= 10000
    case 'daily_15000': return maxDaily >= 15000
    case 'daily_20000': return maxDaily >= 20000
    case 'daily_30000': return maxDaily >= 30000
    case 'daily_50000': return maxDaily >= 50000
    case 'daily_over150': return records.some(r=>r.actual_words >= dailyTarget*1.5)
    case 'daily_over200': return records.some(r=>r.actual_words >= dailyTarget*2)
    case 'daily_over300': return records.some(r=>r.actual_words >= dailyTarget*3)
    case 'daily_over500': return records.some(r=>r.actual_words >= dailyTarget*5)
    case 'daily_5x_over': {
      let cx=0,mx=0
      for(const r of sorted){if(r.actual_words>dailyTarget){cx++;mx=Math.max(mx,cx)}else cx=0}
      return mx>=5
    }
    case 'daily_7x_over': {
      let cx=0,mx=0
      for(const r of sorted){if(r.actual_words>dailyTarget){cx++;mx=Math.max(mx,cx)}else cx=0}
      return mx>=7
    }
    case 'daily_exact': return records.some(r=>Math.abs(r.actual_words-dailyTarget)<=5 && r.actual_words>=dailyTarget)
    case 'daily_3exact': {
      let cx=0,mx=0
      for(const r of sorted){if(Math.abs(r.actual_words-dailyTarget)<=10&&r.actual_words>=dailyTarget){cx++;mx=Math.max(mx,cx)}else cx=0}
      return mx>=3
    }
    case 'daily_monday': return records.filter(r=>dow(r.date)===1&&r.actual_words>=dailyTarget).length>=10

    // Total
    case 'first_record': return recordCount >= 1
    case 'total_5000': return totalWords >= 5000
    case 'total_10000': return totalWords >= 10000
    case 'total_30000': return totalWords >= 30000
    case 'total_50000': return totalWords >= 50000
    case 'total_100000': return totalWords >= 100000
    case 'total_200000': return totalWords >= 200000
    case 'total_300000': return totalWords >= 300000
    case 'total_500000': return totalWords >= 500000
    case 'total_800000': return totalWords >= 800000
    case 'total_1000000': return totalWords >= 1000000
    case 'total_2000000': return totalWords >= 2000000
    case 'total_5000000': return totalWords >= 5000000
    case 'records_10': return recordCount >= 10
    case 'records_30': return recordCount >= 30
    case 'records_50': return recordCount >= 50
    case 'records_100': return recordCount >= 100
    case 'records_200': return recordCount >= 200
    case 'month_200k': return Object.values(byMonth).some(rs=>rs.reduce((s,r)=>s+r.actual_words,0)>=200000)
    case 'month_500k': return Object.values(byMonth).some(rs=>rs.reduce((s,r)=>s+r.actual_words,0)>=500000)

    // Monthly
    case 'month_50pct': return Object.values(byMonth).some(rs=>rs.reduce((s,r)=>s+r.actual_words,0)>=monthlyTarget*0.5)
    case 'month_80pct': return Object.values(byMonth).some(rs=>rs.reduce((s,r)=>s+r.actual_words,0)>=monthlyTarget*0.8)
    case 'month_100pct': return Object.values(byMonth).some(rs=>rs.reduce((s,r)=>s+r.actual_words,0)>=monthlyTarget)
    case 'month_120pct': return Object.values(byMonth).some(rs=>rs.reduce((s,r)=>s+r.actual_words,0)>=monthlyTarget*1.2)
    case 'month_150pct': return Object.values(byMonth).some(rs=>rs.reduce((s,r)=>s+r.actual_words,0)>=monthlyTarget*1.5)
    case 'month_achieved_15': return Object.values(byMonth).some(rs=>rs.filter(r=>r.actual_words>=dailyTarget).length>=15)
    case 'month_achieved_20': return Object.values(byMonth).some(rs=>rs.filter(r=>r.actual_words>=dailyTarget).length>=20)
    case 'month_achieved_25': return Object.values(byMonth).some(rs=>rs.filter(r=>r.actual_words>=dailyTarget).length>=25)
    case 'month_no_zero': return monthKeys.some(k=>{
      const rs=byMonth[k]; return rs.length>0&&rs.every(r=>r.actual_words>0)&&rs.length>=15
    })
    case 'month_full': return monthKeys.some(k=>{
      const [y,m]=k.split('-').map(Number)
      const days=daysInMonth(y,m)
      const rs=byMonth[k]
      return rs&&rs.length>=days&&rs.every(r=>r.actual_words>=dailyTarget)
    })
    case 'month_con_2': {
      let cx=0,mx=0
      for(const k of monthKeys){if(byMonth[k].reduce((s,r)=>s+r.actual_words,0)>=monthlyTarget){cx++;mx=Math.max(mx,cx)}else cx=0}
      return mx>=2
    }
    case 'month_con_3': {
      let cx=0,mx=0
      for(const k of monthKeys){if(byMonth[k].reduce((s,r)=>s+r.actual_words,0)>=monthlyTarget){cx++;mx=Math.max(mx,cx)}else cx=0}
      return mx>=3
    }
    case 'month_con_6': {
      let cx=0,mx=0
      for(const k of monthKeys){if(byMonth[k].reduce((s,r)=>s+r.actual_words,0)>=monthlyTarget){cx++;mx=Math.max(mx,cx)}else cx=0}
      return mx>=6
    }
    case 'month_con_12': {
      let cx=0,mx=0
      for(const k of monthKeys){if(byMonth[k].reduce((s,r)=>s+r.actual_words,0)>=monthlyTarget){cx++;mx=Math.max(mx,cx)}else cx=0}
      return mx>=12
    }
    case 'month_early': return monthKeys.some(k=>{
      const rs=byMonth[k]; const sumBy20=rs.filter(r=>parseInt(r.date.slice(8))<=20).reduce((s,r)=>s+r.actual_words,0)
      return sumBy20>=monthlyTarget
    })
    case 'month_comeback': return monthKeys.some(k=>{
      const rs=byMonth[k]; const total=rs.reduce((s,r)=>s+r.actual_words,0)
      if(total<monthlyTarget) return false
      const last3=rs.filter(r=>{const d=parseInt(r.date.slice(8));const [y,m]=k.split('-').map(Number);return d>=daysInMonth(y,m)-2})
      const before=rs.filter(r=>{const d=parseInt(r.date.slice(8));const [y,m]=k.split('-').map(Number);return d<daysInMonth(y,m)-2})
      return before.reduce((s,r)=>s+r.actual_words,0)<monthlyTarget&&last3.length>0
    })
    case 'month_first_complete': return monthKeys.filter(k=>byMonth[k].reduce((s,r)=>s+r.actual_words,0)>=monthlyTarget).length>=1
    case 'month_triple_100': return monthKeys.filter(k=>byMonth[k].reduce((s,r)=>s+r.actual_words,0)>=monthlyTarget).length>=3
    case 'month_open': return records.some(r=>parseInt(r.date.slice(8))===1&&r.actual_words>=dailyTarget)
    case 'month_close': return monthKeys.some(k=>{
      const [y,m]=k.split('-').map(Number); const last=daysInMonth(y,m)
      const dateStr=`${k}-${String(last).padStart(2,'0')}`
      return byMonth[k].some(r=>r.date===dateStr&&r.actual_words>=dailyTarget)
    })

    // Time
    case 'day_monday': return records.some(r=>dow(r.date)===1&&r.actual_words>=dailyTarget)
    case 'day_friday': return records.some(r=>dow(r.date)===5&&r.actual_words>=dailyTarget)
    case 'day_saturday': return records.some(r=>dow(r.date)===6&&r.actual_words>=dailyTarget)
    case 'day_sunday': return records.some(r=>dow(r.date)===7&&r.actual_words>=dailyTarget)
    case 'full_week': return (() => {
      const weekMap: Record<string,{date:string;actual_words:number}[]> = {}
      for(const r of records){
        const dt=new Date(r.date); const ws=new Date(dt); ws.setDate(dt.getDate()-((dt.getDay()+6)%7))
        const key=ws.toISOString().slice(0,10); if(!weekMap[key])weekMap[key]=[]; weekMap[key].push(r)
      }
      return Object.values(weekMap).some(rs=>rs.length>=7&&rs.every(r=>r.actual_words>=dailyTarget))
    })()
    case 'weekday_5': return (() => {
      const weekMap: Record<string,{date:string;actual_words:number}[]> = {}
      for(const r of records){
        const dt=new Date(r.date); const ws=new Date(dt); ws.setDate(dt.getDate()-((dt.getDay()+6)%7))
        const key=ws.toISOString().slice(0,10); if(!weekMap[key])weekMap[key]=[]; weekMap[key].push(r)
      }
      return Object.values(weekMap).some(rs=>{
        const wdays=rs.filter(r=>{const d=dow(r.date);return d>=1&&d<=5&&r.actual_words>=dailyTarget})
        return wdays.length>=5
      })
    })()
    case 'weekend_4': {
      const wkends = records.filter(r=>(dow(r.date)===6||dow(r.date)===7)&&r.actual_words>=dailyTarget)
      const weekSet = new Set(wkends.map(r=>{const dt=new Date(r.date);const ws=new Date(dt);ws.setDate(dt.getDate()-((dt.getDay()+6)%7));return ws.toISOString().slice(0,10)}))
      return weekSet.size>=4
    }
    case 'monday_4month': return monthKeys.some(k=>{
      const mondays=byMonth[k].filter(r=>dow(r.date)===1&&r.actual_words>=dailyTarget)
      // need at least 4 mondays in month achieved
      return mondays.length>=4
    })
    case 'new_month_3': return records.filter(r=>parseInt(r.date.slice(8))===1&&r.actual_words>=dailyTarget).length>=3
    case 'month_close_3': return monthKeys.filter(k=>{
      const [y,m]=k.split('-').map(Number); const last=daysInMonth(y,m)
      const ds=`${k}-${String(last).padStart(2,'0')}`
      return byMonth[k].some(r=>r.date===ds&&r.actual_words>=dailyTarget)
    }).length>=3
    case 'jan_first': return records.some(r=>r.date.endsWith('-01-01')&&r.actual_words>=dailyTarget)
    case 'may_first': return records.some(r=>r.date.slice(5)==='05-01'&&r.actual_words>=dailyTarget)
    case 'oct_first': return records.some(r=>r.date.slice(5)==='10-01'&&r.actual_words>=dailyTarget)
    case 'dec_31': return records.some(r=>r.date.slice(5)==='12-31'&&r.actual_words>=dailyTarget)
    case 'same_day_3years': {
      const dayMap: Record<string,number> = {}
      for(const r of records){if(r.actual_words>=dailyTarget){const key=r.date.slice(5);dayMap[key]=(dayMap[key]||0)+1}}
      return Object.values(dayMap).some(v=>v>=3)
    }
    case 'full_week_3times': return (() => {
      const weekMap: Record<string,boolean> = {}
      for(const r of records){
        const dt=new Date(r.date);const ws=new Date(dt);ws.setDate(dt.getDate()-((dt.getDay()+6)%7))
        const key=ws.toISOString().slice(0,10); if(!weekMap[key])weekMap[key]=true
      }
      let count=0
      for(const k of Object.keys(weekMap)){
        const wStart=new Date(k); const wRecords=records.filter(r=>{const dt=new Date(r.date);return dt>=wStart&&dt<new Date(wStart.getTime()+7*86400000)&&r.actual_words>=dailyTarget})
        if(wRecords.length>=7)count++
      }
      return count>=3
    })()
    case 'weekend_warrior_10': return records.filter(r=>(dow(r.date)===6||dow(r.date)===7)&&r.actual_words>=dailyTarget).length>=10
    case 'holiday_writer': {
      const holidays=['01-01','05-01','10-01','02-14','12-31']
      return records.filter(r=>holidays.some(h=>r.date.slice(5)===h)&&r.actual_words>=dailyTarget).length>=5
    }
    case 'all_weekday_month': return monthKeys.some(k=>{
      const [y,m]=k.split('-').map(Number); const days=daysInMonth(y,m)
      for(let d=1;d<=days;d++){
        const ds=`${k}-${String(d).padStart(2,'0')}`;const dt=new Date(ds);const dw=(dt.getDay()+6)%7
        if(dw<5){const r=byMonth[k].find(x=>x.date===ds);if(!r||r.actual_words<dailyTarget)return false}
      }
      return true
    })
    case 'day_14': return records.some(r=>r.date.slice(5)==='02-14'&&r.actual_words>=dailyTarget)

    // Over
    case 'over_150_5': {let cx=0,mx=0;for(const r of sorted){if(r.actual_words>=dailyTarget*1.5){cx++;mx=Math.max(mx,cx)}else cx=0};return mx>=5}
    case 'over_200_3': {let cx=0,mx=0;for(const r of sorted){if(r.actual_words>=dailyTarget*2){cx++;mx=Math.max(mx,cx)}else cx=0};return mx>=3}
    case 'over_300_total_3': return records.filter(r=>r.actual_words>=dailyTarget*3).length>=3
    case 'over_total_month_200pct': return Object.values(byMonth).some(rs=>rs.reduce((s,r)=>s+r.actual_words,0)>=monthlyTarget*2)
    case 'daily_10x_over': {let cx=0,mx=0;for(const r of sorted){if(r.actual_words>dailyTarget){cx++;mx=Math.max(mx,cx)}else cx=0};return mx>=10}
    case 'total_over_10': return overDays.length>=10
    case 'total_over_30': return overDays.length>=30
    case 'total_over_50': return overDays.length>=50
    case 'total_over_100': return overDays.length>=100
    case 'single_max_2x': return records.some(r=>r.actual_words>=dailyTarget*2)
    case 'single_max_3x': return records.some(r=>r.actual_words>=dailyTarget*3)
    case 'month_extra_50k': return Object.values(byMonth).some(rs=>rs.reduce((s,r)=>s+r.actual_words,0)>=monthlyTarget+50000)
    case 'week_over_all': return (() => {
      const weekMap: Record<string,{date:string;actual_words:number}[]> = {}
      for(const r of records){const dt=new Date(r.date);const ws=new Date(dt);ws.setDate(dt.getDate()-((dt.getDay()+6)%7));const key=ws.toISOString().slice(0,10);if(!weekMap[key])weekMap[key]=[];weekMap[key].push(r)}
      return Object.values(weekMap).some(rs=>rs.length>=7&&rs.every(r=>r.actual_words>dailyTarget))
    })()
    case 'over_streak_14': {let cx=0,mx=0;for(const r of sorted){if(r.actual_words>dailyTarget){cx++;mx=Math.max(mx,cx)}else cx=0};return mx>=14}
    case 'over_streak_21': {let cx=0,mx=0;for(const r of sorted){if(r.actual_words>dailyTarget){cx++;mx=Math.max(mx,cx)}else cx=0};return mx>=21}
    case 'over_streak_30': {let cx=0,mx=0;for(const r of sorted){if(r.actual_words>dailyTarget){cx++;mx=Math.max(mx,cx)}else cx=0};return mx>=30}
    case 'over_double_5': return records.filter(r=>r.actual_words>=dailyTarget*2).length>=5
    case 'over_triple_3': return records.filter(r=>r.actual_words>=dailyTarget*3).length>=3
    case 'best_day_5k': return maxDaily>=5000
    case 'best_day_10k': return maxDaily>=10000

    // Comeback
    case 'first_after_break_7': {
      for(let i=1;i<sorted.length;i++){
        if(sorted[i].actual_words>=dailyTarget&&sorted[i-1].actual_words<dailyTarget){
          const d=(new Date(sorted[i].date).getTime()-new Date(sorted[i-1].date).getTime())/86400000
          if(d>=7)return true
        }
      }
      return false
    }
    case 'month_save_last3': return monthKeys.some(k=>{
      const [y,m]=k.split('-').map(Number);const last=daysInMonth(y,m)
      const total=byMonth[k].reduce((s,r)=>s+r.actual_words,0)
      if(total<monthlyTarget)return false
      const beforeLast3=byMonth[k].filter(r=>parseInt(r.date.slice(8))<=last-3).reduce((s,r)=>s+r.actual_words,0)
      return beforeLast3<monthlyTarget
    })
    case 'comeback_streak_3': return (() => {
      for(let i=0;i<sorted.length-1;i++){
        if(sorted[i].actual_words<dailyTarget){
          let s=0;for(let j=i+1;j<sorted.length;j++){if(sorted[j].actual_words>=dailyTarget)s++;else break}
          if(s>=3)return true
        }
      }
      return false
    })()
    case 'comeback_streak_7': return (() => {
      for(let i=0;i<sorted.length-1;i++){
        if(sorted[i].actual_words<dailyTarget){
          let s=0;for(let j=i+1;j<sorted.length;j++){if(sorted[j].actual_words>=dailyTarget)s++;else break}
          if(s>=7)return true
        }
      }
      return false
    })()
    case 'comeback_streak_14': return (() => {
      for(let i=0;i<sorted.length-1;i++){
        if(sorted[i].actual_words<dailyTarget){
          let s=0;for(let j=i+1;j<sorted.length;j++){if(sorted[j].actual_words>=dailyTarget)s++;else break}
          if(s>=14)return true
        }
      }
      return false
    })()
    case 'zero_to_hero': return monthKeys.some(k=>{
      const first10=byMonth[k].filter(r=>parseInt(r.date.slice(8))<=10)
      if(first10.some(r=>r.actual_words>0))return false
      return byMonth[k].reduce((s,r)=>s+r.actual_words,0)>=monthlyTarget
    })
    case 'second_wind': {
      let breaks=0;let inBreak=false
      for(const r of sorted){if(r.actual_words<dailyTarget){if(!inBreak){inBreak=true}}else{if(inBreak){breaks++;inBreak=false}}}
      return breaks>=2
    }
    case 'phoenix': {
      let breaks=0;let inBreak=false
      for(const r of sorted){if(r.actual_words<dailyTarget){if(!inBreak){inBreak=true}}else{if(inBreak){breaks++;inBreak=false}}}
      return breaks>=3
    }
    case 'underdog': return records.some(r=>r.actual_words===maxDaily&&maxDaily>=dailyTarget)&&records.some(r=>r.actual_words===0)
    case 'monthly_comeback_3': return monthKeys.filter(k=>{
      const rs=byMonth[k];const total=rs.reduce((s,r)=>s+r.actual_words,0)
      if(total<monthlyTarget)return false
      const mid=rs.filter(r=>parseInt(r.date.slice(8))<=15).reduce((s,r)=>s+r.actual_words,0)
      return mid<monthlyTarget*0.5
    }).length>=3
    case 'best_recovery': {
      for(let i=1;i<sorted.length;i++){
        const d=(new Date(sorted[i].date).getTime()-new Date(sorted[i-1].date).getTime())/86400000
        if(d>=7&&sorted[i].actual_words>=5000)return true
      }
      return false
    }
    case 'consecutive_fail_3_then_30': {
      for(let i=2;i<sorted.length;i++){
        if(sorted[i-2].actual_words<dailyTarget&&sorted[i-1].actual_words<dailyTarget&&sorted[i].actual_words<dailyTarget){
          let s=0;for(let j=i+1;j<sorted.length;j++){if(sorted[j].actual_words>=dailyTarget)s++;else break}
          if(s>=30)return true
        }
      }
      return false
    }
    case 'half_month_comeback': return monthKeys.some(k=>{
      const rs=byMonth[k];const total=rs.reduce((s,r)=>s+r.actual_words,0)
      if(total<monthlyTarget)return false
      const first15=rs.filter(r=>parseInt(r.date.slice(8))<=15).reduce((s,r)=>s+r.actual_words,0)
      return first15<monthlyTarget*0.5
    })
    case 'triple_comeback': {
      let trips=0;let inBreak=false
      for(const r of sorted){if(r.actual_words<dailyTarget){if(!inBreak)inBreak=true}else{if(inBreak){trips++;inBreak=false}}}
      return trips>=3
    }
    case 'comeback_200pct': {
      for(let i=1;i<sorted.length;i++){
        const d=(new Date(sorted[i].date).getTime()-new Date(sorted[i-1].date).getTime())/86400000
        if(d>=2&&sorted[i].actual_words>=dailyTarget*2)return true
      }
      return false
    }
    case 'never_give_up': {
      let trips=0;let inBreak=false
      for(const r of sorted){if(r.actual_words<dailyTarget){if(!inBreak)inBreak=true}else{if(inBreak){trips++;inBreak=false}}}
      return trips>=5
    }
    case 'last_minute_save': return monthKeys.some(k=>{
      const [y,m]=k.split('-').map(Number);const last=daysInMonth(y,m)
      const lastDay=`${k}-${String(last).padStart(2,'0')}`
      const total=byMonth[k].reduce((s,r)=>s+r.actual_words,0)
      return total>=monthlyTarget&&byMonth[k].some(r=>r.date===lastDay&&r.actual_words>=dailyTarget)
    })
    case 'big_day_after_zero': {
      for(let i=1;i<sorted.length;i++){
        if(sorted[i-1].actual_words===0&&sorted[i].actual_words>=dailyTarget*2)return true
      }
      return false
    }
    case 'month_15plus_from_0': return monthKeys.some(k=>{
      const rs=byMonth[k];const first10=rs.filter(r=>parseInt(r.date.slice(8))<=10)
      if(!first10.every(r=>r.actual_words===0))return false
      return rs.filter(r=>r.actual_words>=dailyTarget).length>=15
    })
    case 'come_back_10': {
      let trips=0;let inBreak=false
      for(const r of sorted){if(r.actual_words<dailyTarget){if(!inBreak)inBreak=true}else{if(inBreak){trips++;inBreak=false}}}
      return trips>=10
    }

    // Precise
    case 'exact_target_3': {let cx=0,mx=0;for(const r of sorted){if(Math.abs(r.actual_words-dailyTarget)<=10&&r.actual_words>=dailyTarget){cx++;mx=Math.max(mx,cx)}else cx=0};return mx>=3}
    case 'exact_target_5': {let cx=0,mx=0;for(const r of sorted){if(Math.abs(r.actual_words-dailyTarget)<=10&&r.actual_words>=dailyTarget){cx++;mx=Math.max(mx,cx)}else cx=0};return mx>=5}
    case 'exact_target_7': {let cx=0,mx=0;for(const r of sorted){if(Math.abs(r.actual_words-dailyTarget)<=10&&r.actual_words>=dailyTarget){cx++;mx=Math.max(mx,cx)}else cx=0};return mx>=7}
    case 'daily_zero_to_target': {
      for(let i=1;i<sorted.length;i++){
        if(sorted[i-1].actual_words===0&&sorted[i].actual_words>=dailyTarget&&sorted[i].actual_words<=dailyTarget*1.05)return true
      }
      return false
    }
    case 'avg_100pct_week': return (() => {
      const weekMap: Record<string,number[]> = {}
      for(const r of records){const dt=new Date(r.date);const ws=new Date(dt);ws.setDate(dt.getDate()-((dt.getDay()+6)%7));const key=ws.toISOString().slice(0,10);if(!weekMap[key])weekMap[key]=[];weekMap[key].push(r.actual_words)}
      return Object.values(weekMap).some(ws=>{if(ws.length<7)return false;const avg=ws.reduce((s,v)=>s+v,0)/ws.length;return avg>=dailyTarget})
    })()
    case 'consistent_7': {
      if(sorted.length<7)return false
      for(let i=6;i<sorted.length;i++){const chunk=sorted.slice(i-6,i+1).filter(r=>r.actual_words>0);if(chunk.length<7)continue;const max=Math.max(...chunk.map(r=>r.actual_words));const min=Math.min(...chunk.map(r=>r.actual_words));if(max-min<=500)return true}
      return false
    }
    case 'consistent_14': {
      if(sorted.length<14)return false
      for(let i=13;i<sorted.length;i++){const chunk=sorted.slice(i-13,i+1);if(chunk.length<14)continue;const max=Math.max(...chunk.map(r=>r.actual_words));const min=Math.min(...chunk.map(r=>r.actual_words));if(max-min<1000)return true}
      return false
    }
    case 'palindrome_words': return records.some(r=>r.actual_words>99&&isPalindrome(r.actual_words))
    case 'round_number': return records.some(r=>isRoundThousand(r.actual_words))
    case 'fibonacci_words': return records.some(r=>isFibonacci(r.actual_words))
    case 'same_for_3': {
      for(let i=2;i<sorted.length;i++){
        if(sorted[i].actual_words===sorted[i-1].actual_words&&sorted[i].actual_words===sorted[i-2].actual_words&&sorted[i].actual_words>0)return true
      }
      return false
    }
    case 'exactly_half': return records.some(r=>r.actual_words===Math.round(monthlyTarget/10))
    case 'target_plus_1': return records.some(r=>r.actual_words>=dailyTarget&&r.actual_words-dailyTarget<=9)
    case 'weekly_avg_match': return (() => {
      const weekMap: Record<string,number[]> = {}
      for(const r of records){const dt=new Date(r.date);const ws=new Date(dt);ws.setDate(dt.getDate()-((dt.getDay()+6)%7));const key=ws.toISOString().slice(0,10);if(!weekMap[key])weekMap[key]=[];weekMap[key].push(r.actual_words)}
      return Object.values(weekMap).some(ws=>{const avg=ws.reduce((s,v)=>s+v,0)/ws.length;return Math.abs(avg-dailyTarget)<=50})
    })()
    case 'double_digits_streak': return [11,22,33,44,55,66,77,88,99].some(n=>maxStreak>=n)
    case 'month_daily_avg': return monthKeys.some(k=>{const rs=byMonth[k];return rs.length>0&&rs.reduce((s,r)=>s+r.actual_words,0)/rs.length>=dailyTarget})
    case 'steady_3month': {
      let cx=0,mx=0
      for(const k of monthKeys){const rs=byMonth[k];const avg=rs.length>0?rs.reduce((s,r)=>s+r.actual_words,0)/rs.length:0;if(avg>=dailyTarget){cx++;mx=Math.max(mx,cx)}else cx=0}
      return mx>=3
    }
    case 'no_overflow': return records.filter(r=>r.actual_words>=dailyTarget&&r.actual_words<=dailyTarget*1.1).length>=5
    case 'ten_percent_up': {
      let cx=0,mx=0
      for(let i=1;i<sorted.length;i++){if(sorted[i].actual_words>sorted[i-1].actual_words){cx++;mx=Math.max(mx,cx)}else cx=0}
      return mx>=5
    }
    case 'symmetric_week': return (() => {
      const weekMap: Record<string,number[]> = {}
      for(const r of records){const dt=new Date(r.date);const ws=new Date(dt);ws.setDate(dt.getDate()-((dt.getDay()+6)%7));const key=ws.toISOString().slice(0,10);if(!weekMap[key])weekMap[key]=[];weekMap[key].push(r.actual_words)}
      return Object.values(weekMap).some(ws=>{
        if(ws.length<7)return false
        const s=ws; return s[0]<=s[3]&&s[1]<=s[3]&&s[2]<=s[3]&&s[4]<=s[3]&&s[5]<=s[3]&&s[6]<=s[3]
      })
    })()

    // Rare
    case 'day_200': return recordCount>=200
    case 'day_300': return recordCount>=300
    case 'day_365': return recordCount>=365
    case 'day_500': return recordCount>=500
    case 'day_1000': return recordCount>=1000
    case 'streak_500': return maxStreak>=500
    case 'total_3m': return totalWords>=3000000
    case 'total_10m': return totalWords>=10000000
    case 'year_1m': return (() => {
      const byYear: Record<string,number> = {}
      for(const r of records){const y=r.date.slice(0,4);byYear[y]=(byYear[y]||0)+r.actual_words}
      return Object.values(byYear).some(v=>v>=1000000)
    })()
    case 'year_500k': return (() => {
      const byYear: Record<string,number> = {}
      for(const r of records){const y=r.date.slice(0,4);byYear[y]=(byYear[y]||0)+r.actual_words}
      return Object.values(byYear).some(v=>v>=500000)
    })()
    case 'month_full_3': {
      let count=0
      for(const k of monthKeys){
        const [y,m]=k.split('-').map(Number);const days=daysInMonth(y,m)
        const rs=byMonth[k];if(rs&&rs.length>=days&&rs.every(r=>r.actual_words>=dailyTarget))count++
      }
      return count>=3
    }
    case 'month_full_6': {
      let count=0
      for(const k of monthKeys){
        const [y,m]=k.split('-').map(Number);const days=daysInMonth(y,m)
        const rs=byMonth[k];if(rs&&rs.length>=days&&rs.every(r=>r.actual_words>=dailyTarget))count++
      }
      return count>=6
    }
    case 'week_full_10': return (() => {
      const weekMap: Record<string,{date:string;actual_words:number}[]> = {}
      for(const r of records){const dt=new Date(r.date);const ws=new Date(dt);ws.setDate(dt.getDate()-((dt.getDay()+6)%7));const key=ws.toISOString().slice(0,10);if(!weekMap[key])weekMap[key]=[];weekMap[key].push(r)}
      let count=0;for(const rs of Object.values(weekMap)){if(rs.length>=7&&rs.every(r=>r.actual_words>=dailyTarget))count++}
      return count>=10
    })()
    case 'all_badges_cat_streak': {
      const streakBadges=['streak_3','streak_7','streak_14','streak_21','streak_30','streak_45','streak_60','streak_90','streak_120','streak_150','streak_180','streak_210','streak_250','streak_300','streak_365']
      return streakBadges.every(b=>shouldUnlock(b,records,dailyTarget,monthlyTarget,unlockedCount))
    }
    case 'badges_50': return unlockedCount>=50
    case 'badges_100': return unlockedCount>=100
    case 'badges_150': return unlockedCount>=150
    case 'badges_180': return unlockedCount>=180
    case 'never_miss_week': {
      const weekSet=new Set(records.map(r=>{const dt=new Date(r.date);const ws=new Date(dt);ws.setDate(dt.getDate()-((dt.getDay()+6)%7));return ws.toISOString().slice(0,10)}))
      return weekSet.size>=50
    }
    case 'longest_gap_comeback': {
      for(let i=1;i<sorted.length;i++){
        const d=(new Date(sorted[i].date).getTime()-new Date(sorted[i-1].date).getTime())/86400000
        if(d>=30){let s=0;for(let j=i;j<sorted.length;j++){if(sorted[j].actual_words>=dailyTarget)s++;else break};if(s>=7)return true}
      }
      return false
    }

    // Hidden
    case 'hidden_777': return records.some(r=>r.actual_words===777)
    case 'hidden_1314': return records.some(r=>r.actual_words===1314)
    case 'hidden_2333': return records.some(r=>r.actual_words===2333)
    case 'hidden_6666': return records.some(r=>r.actual_words===6666)
    case 'hidden_8888': return records.some(r=>r.actual_words===8888)
    case 'hidden_9999': return records.some(r=>r.actual_words===9999)
    case 'hidden_520': return records.some(r=>r.date.slice(5)==='05-20'&&r.actual_words>=dailyTarget)
    case 'hidden_palindrome_date': return records.some(r=>{const d=r.date.replace(/-/g,'');return d===d.split('').reverse().join('')})
    case 'hidden_new_year': return records.some(r=>{const dt=new Date(r.date);return dt.getMonth()===0&&dt.getDate()===1&&r.actual_words>=dailyTarget})
    case 'hidden_same_streak_day': return (() => {
      let streak=0;let prev=''
      for(const r of sorted){
        if(r.actual_words>=dailyTarget){
          if(prev){const d=(new Date(r.date).getTime()-new Date(prev).getTime())/86400000;streak=d===1?streak+1:1}else streak=1
          const dayNum=parseInt(r.date.slice(8));if(streak===dayNum)return true
        }else streak=0
        prev=r.date
      }
      return false
    })()
    case 'hidden_friday_13': return records.some(r=>{const dt=new Date(r.date);return dt.getDate()===13&&dt.getDay()===5&&r.actual_words>=dailyTarget})
    case 'hidden_triple_7': return maxStreak>=77
    case 'hidden_888_streak': return (() => {
      let streak=0;let prev=''
      for(const r of sorted){
        if(r.actual_words>=dailyTarget){
          if(prev){const d=(new Date(r.date).getTime()-new Date(prev).getTime())/86400000;streak=d===1?streak+1:1}else streak=1
          if(streak===8&&r.actual_words%8===0)return true
        }else streak=0
        prev=r.date
      }
      return false
    })()
    case 'hidden_midnight': return recordCount>=100
    case 'hidden_1001': return records.some(r=>r.actual_words===1001)
    case 'hidden_all_week_same': return (() => {
      const weekMap: Record<string,number[]> = {}
      for(const r of records){const dt=new Date(r.date);const ws=new Date(dt);ws.setDate(dt.getDate()-((dt.getDay()+6)%7));const key=ws.toISOString().slice(0,10);if(!weekMap[key])weekMap[key]=[];weekMap[key].push(r.actual_words)}
      return Object.values(weekMap).some(ws=>ws.length>=7&&ws.every(v=>v===ws[0]&&v>0))
    })()
    case 'hidden_year_end_rush': return (() => {
      const dec=records.filter(r=>r.date.slice(5,7)==='12'&&parseInt(r.date.slice(8))>=25&&r.actual_words>=dailyTarget)
      const weeks=new Set(dec.map(r=>r.date.slice(0,10)))
      return weeks.size>=7
    })()
    case 'hidden_100_day': return recordCount===100||recordCount>100
    case 'hidden_typo_words': return (() => {
      const hiddenUnlocked=BADGE_DEFS.filter(b=>b.category==='hidden'&&shouldUnlock(b.id,records,dailyTarget,monthlyTarget,unlockedCount))
      return hiddenUnlocked.length>=10
    })()
    default: return false
  }
}

async function checkAndUnlockBadges(db: D1Database, date: string, dailyTarget: number, monthlyTarget: number): Promise<string[]> {
  const [{ results: allRecords }, { results: unlockedRows }] = await Promise.all([
    db.prepare('SELECT date, actual_words FROM writing_records ORDER BY date ASC').all(),
    db.prepare('SELECT badge_id FROM user_badges').all(),
  ])
  const records = allRecords as {date:string;actual_words:number}[]
  const unlocked = new Set((unlockedRows as {badge_id:string}[]).map(r=>r.badge_id))
  const newlyUnlocked: string[] = []

  for (const badge of BADGE_DEFS) {
    if (unlocked.has(badge.id)) continue
    if (shouldUnlock(badge.id, records, dailyTarget, monthlyTarget, unlocked.size)) {
      await db.prepare('INSERT OR IGNORE INTO user_badges (badge_id, unlock_date) VALUES (?, ?)').bind(badge.id, date).run()
      newlyUnlocked.push(badge.id)
      unlocked.add(badge.id)
    }
  }
  return newlyUnlocked
}

// ─── Writing Goals & Records ──────────────────────────────────────────────────

app.get('/writing/goal', ownerOnly, async (c) => {
  const now = new Date()
  const year = parseInt(c.req.query('year') || String(now.getUTCFullYear()))
  const month = parseInt(c.req.query('month') || String(now.getUTCMonth() + 1))
  const row = await c.env.DB.prepare(
    'SELECT * FROM writing_goals WHERE year = ? AND month = ?'
  ).bind(year, month).first<{ year: number; month: number; monthly_target: number; daily_target: number }>()
  return c.json(row || { year, month, monthly_target: 100000, daily_target: 3000 })
})

app.post('/writing/goal', ownerOnly, async (c) => {
  const { year, month, monthly_target, daily_target } = await c.req.json()
  await c.env.DB.prepare(
    'INSERT INTO writing_goals (year, month, monthly_target, daily_target) VALUES (?, ?, ?, ?) ON CONFLICT(year, month) DO UPDATE SET monthly_target = excluded.monthly_target, daily_target = excluded.daily_target'
  ).bind(year, month, monthly_target, daily_target).run()
  return c.json({ success: true })
})

app.get('/writing/records', ownerOnly, async (c) => {
  const now = new Date()
  const year = parseInt(c.req.query('year') || String(now.getUTCFullYear()))
  const month = parseInt(c.req.query('month') || String(now.getUTCMonth() + 1))
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM writing_records WHERE date LIKE ? ORDER BY date ASC"
  ).bind(`${prefix}%`).all()
  return c.json(results)
})

app.post('/writing/records', ownerOnly, async (c) => {
  const { date, actual_words, note = '' } = await c.req.json()
  if (!date) return c.json({ error: 'date required' }, 400)
  await c.env.DB.prepare(
    'INSERT INTO writing_records (date, actual_words, note) VALUES (?, ?, ?) ON CONFLICT(date) DO UPDATE SET actual_words = excluded.actual_words, note = excluded.note'
  ).bind(date, actual_words || 0, note).run()

  // Get current goal for badge checks
  const now = new Date(date)
  const goal = await c.env.DB.prepare(
    'SELECT daily_target, monthly_target FROM writing_goals WHERE year = ? AND month = ?'
  ).bind(now.getFullYear(), now.getMonth() + 1).first<{ daily_target: number; monthly_target: number }>()
  const daily = goal?.daily_target ?? 3000
  const monthly = goal?.monthly_target ?? 100000

  const newBadges = await checkAndUnlockBadges(c.env.DB, date, daily, monthly)
  return c.json({ success: true, newBadges })
})

app.get('/badges', ownerOnly, async (c) => {
  const { results } = await c.env.DB.prepare('SELECT badge_id, unlock_date FROM user_badges').all()
  const unlocked = new Map((results as { badge_id: string; unlock_date: string }[]).map(r => [r.badge_id, r.unlock_date]))
  const badges = BADGE_DEFS.map(b => ({
    ...b,
    unlocked: unlocked.has(b.id),
    unlock_date: unlocked.get(b.id) ?? null,
  }))
  return c.json({ badges, total: BADGE_DEFS.length, unlocked_count: unlocked.size })
})

// ─── Routine Preset ───────────────────────────────────────────────────────────

app.get('/routine/preset', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM routine_preset ORDER BY sort_order ASC, time_start ASC'
  ).all()
  return c.json(results)
})

app.post('/routine/preset', ownerOnly, async (c) => {
  const { time_start, time_end = '', title, description = '', category = 'morning', reminder_minutes = 0, enabled = 1 } = await c.req.json()
  if (!time_start || !title) return c.json({ error: 'time_start and title required' }, 400)
  const id = crypto.randomUUID()
  const { results: existing } = await c.env.DB.prepare('SELECT MAX(sort_order) as max_order FROM routine_preset').all()
  const maxOrder = (existing[0] as { max_order: number | null })?.max_order ?? -1
  await c.env.DB.prepare(
    'INSERT INTO routine_preset (id, sort_order, time_start, time_end, title, description, category, reminder_minutes, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, maxOrder + 1, time_start, time_end, title, description, category, reminder_minutes, enabled ? 1 : 0).run()
  return c.json({ id, success: true })
})

app.put('/routine/preset/:id', ownerOnly, async (c) => {
  const id = c.req.param('id')
  const { time_start, time_end, title, description, category, reminder_minutes, enabled, sort_order } = await c.req.json()
  await c.env.DB.prepare(
    'UPDATE routine_preset SET time_start=?, time_end=?, title=?, description=?, category=?, reminder_minutes=?, enabled=?, sort_order=? WHERE id=?'
  ).bind(time_start, time_end ?? '', title, description ?? '', category, reminder_minutes ?? 0, enabled ? 1 : 0, sort_order ?? 0, id).run()
  return c.json({ success: true })
})

app.delete('/routine/preset/:id', ownerOnly, async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM routine_preset WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// ─── Routine Daily Log ────────────────────────────────────────────────────────

app.get('/routine/log', async (c) => {
  const date = c.req.query('date') || new Date().toISOString().slice(0, 10)
  const { results: log } = await c.env.DB.prepare(
    'SELECT item_id, completed, completed_at FROM routine_daily_log WHERE date = ?'
  ).bind(date).all()
  const noteRow = await c.env.DB.prepare('SELECT notes FROM routine_notes WHERE date = ?').bind(date).first<{ notes: string }>()
  return c.json({ date, log, notes: noteRow?.notes ?? '' })
})

app.post('/routine/log', async (c) => {
  const { date, item_id, completed } = await c.req.json()
  if (!date || !item_id) return c.json({ error: 'date and item_id required' }, 400)
  const completed_at = completed ? Math.floor(Date.now() / 1000) : null
  await c.env.DB.prepare(
    'INSERT INTO routine_daily_log (date, item_id, completed, completed_at) VALUES (?, ?, ?, ?) ON CONFLICT(date, item_id) DO UPDATE SET completed=excluded.completed, completed_at=excluded.completed_at'
  ).bind(date, item_id, completed ? 1 : 0, completed_at).run()
  return c.json({ success: true })
})

app.put('/routine/notes', async (c) => {
  const { date, notes } = await c.req.json()
  if (!date) return c.json({ error: 'date required' }, 400)
  await c.env.DB.prepare(
    'INSERT INTO routine_notes (date, notes) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET notes=excluded.notes'
  ).bind(date, notes ?? '').run()
  return c.json({ success: true })
})

// ─── Routine Calendar ─────────────────────────────────────────────────────────

app.get('/routine/calendar', async (c) => {
  const year = parseInt(c.req.query('year') || String(new Date().getFullYear()))
  const month = parseInt(c.req.query('month') || String(new Date().getMonth() + 1))
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  const totalItems = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM routine_preset WHERE enabled = 1').first<{ cnt: number }>()
  const total = totalItems?.cnt ?? 1
  const { results } = await c.env.DB.prepare(
    `SELECT date, SUM(completed) as done FROM routine_daily_log WHERE date LIKE ? GROUP BY date`
  ).bind(`${prefix}%`).all()
  const days = (results as { date: string; done: number }[]).map(r => ({
    date: r.date,
    completed: r.done,
    total,
    pct: total > 0 ? Math.round((r.done / total) * 100) : 0,
  }))
  return c.json({ year, month, days })
})

// ─── Planning: Month Goals ────────────────────────────────────────────────────

app.get('/planning/month-goals', async (c) => {
  const month = c.req.query('month') || new Date().toISOString().slice(0, 7)
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM month_goals WHERE year_month = ? ORDER BY sort_order ASC, rowid ASC'
  ).bind(month).all()
  return c.json(results)
})

app.post('/planning/month-goals', ownerOnly, async (c) => {
  const { year_month, title, category = 'write', status = 'todo', progress_note = '' } = await c.req.json()
  const id = crypto.randomUUID()
  const { results: existing } = await c.env.DB.prepare(
    'SELECT MAX(sort_order) as mo FROM month_goals WHERE year_month = ?'
  ).bind(year_month).all()
  const maxOrder = (existing[0] as { mo: number | null })?.mo ?? -1
  await c.env.DB.prepare(
    'INSERT INTO month_goals (id, year_month, title, category, status, progress_note, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, year_month, title, category, status, progress_note, maxOrder + 1).run()
  return c.json({ id, success: true })
})

app.put('/planning/month-goals/:id', ownerOnly, async (c) => {
  const id = c.req.param('id')
  const { title, category, status, progress_note } = await c.req.json()
  await c.env.DB.prepare(
    'UPDATE month_goals SET title=?, category=?, status=?, progress_note=? WHERE id=?'
  ).bind(title, category, status, progress_note ?? '', id).run()
  return c.json({ success: true })
})

app.delete('/planning/month-goals/:id', ownerOnly, async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM month_goals WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// ─── Planning: Year Goals ─────────────────────────────────────────────────────

app.get('/planning/year-goals', async (c) => {
  const year = parseInt(c.req.query('year') || String(new Date().getFullYear()))
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM year_goals WHERE year = ? ORDER BY sort_order ASC, rowid ASC'
  ).bind(year).all()
  return c.json(results)
})

app.post('/planning/year-goals', ownerOnly, async (c) => {
  const { year, title, category = 'write', progress = 0, quarter = 'all', description = '' } = await c.req.json()
  const id = crypto.randomUUID()
  const { results: existing } = await c.env.DB.prepare(
    'SELECT MAX(sort_order) as mo FROM year_goals WHERE year = ?'
  ).bind(year).all()
  const maxOrder = (existing[0] as { mo: number | null })?.mo ?? -1
  await c.env.DB.prepare(
    'INSERT INTO year_goals (id, year, title, category, progress, quarter, description, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, year, title, category, progress, quarter, description, maxOrder + 1).run()
  return c.json({ id, success: true })
})

app.put('/planning/year-goals/:id', ownerOnly, async (c) => {
  const id = c.req.param('id')
  const { title, category, progress, quarter, description } = await c.req.json()
  await c.env.DB.prepare(
    'UPDATE year_goals SET title=?, category=?, progress=?, quarter=?, description=? WHERE id=?'
  ).bind(title, category, progress ?? 0, quarter, description ?? '', id).run()
  return c.json({ success: true })
})

app.delete('/planning/year-goals/:id', ownerOnly, async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM year_goals WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// ─── Planning: Notes ──────────────────────────────────────────────────────────

app.get('/planning/notes', async (c) => {
  const scope = c.req.query('scope') || ''
  const row = await c.env.DB.prepare('SELECT notes FROM plan_notes WHERE scope = ?').bind(scope).first<{ notes: string }>()
  return c.json({ scope, notes: row?.notes ?? '' })
})

app.put('/planning/notes', ownerOnly, async (c) => {
  const { scope, notes } = await c.req.json()
  await c.env.DB.prepare(
    'INSERT INTO plan_notes (scope, notes) VALUES (?, ?) ON CONFLICT(scope) DO UPDATE SET notes=excluded.notes'
  ).bind(scope, notes ?? '').run()
  return c.json({ success: true })
})

// ─── Planning: Year Heatmap ───────────────────────────────────────────────────

app.get('/planning/year-heatmap', async (c) => {
  const year = parseInt(c.req.query('year') || String(new Date().getFullYear()))
  const totalItems = await c.env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM routine_preset WHERE enabled = 1'
  ).first<{ cnt: number }>()
  const total = totalItems?.cnt ?? 1
  const { results } = await c.env.DB.prepare(
    `SELECT substr(date,1,7) as month, AVG(CAST(completed AS REAL)) as avg_done, COUNT(DISTINCT date) as days
     FROM routine_daily_log WHERE date LIKE ? GROUP BY month`
  ).bind(`${year}-%`).all()
  const rows = results as { month: string; avg_done: number; days: number }[]
  const heatmap: { month: string; pct: number; days: number }[] = []
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`
    const row = rows.find(r => r.month === key)
    heatmap.push({ month: key, pct: row ? Math.round((row.avg_done / total) * 100) : 0, days: row?.days ?? 0 })
  }
  return c.json({ year, heatmap })
})

// ─── Planning: Week Goals ────────────────────────────────────────────────────

app.get('/planning/week-goals', async (c) => {
  const year = parseInt(c.req.query('year') || String(new Date().getFullYear()))
  const week = parseInt(c.req.query('week') || '1')
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM week_goals WHERE year=? AND week=? ORDER BY sort_order, created_at'
  ).bind(year, week).all()
  return c.json((results as any[]).map(r => ({ ...r, done: !!r.done })))
})

app.post('/planning/week-goals', ownerOnly, async (c) => {
  const { year, week, title } = await c.req.json()
  if (!title) return c.json({ error: 'title required' }, 400)
  const id = crypto.randomUUID()
  const { results } = await c.env.DB.prepare('SELECT MAX(sort_order) as mx FROM week_goals WHERE year=? AND week=?').bind(year, week).all()
  const maxOrder = (results[0] as any)?.mx ?? 0
  await c.env.DB.prepare(
    'INSERT INTO week_goals (id, year, week, title, sort_order) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, year, week, title, maxOrder + 1).run()
  return c.json({ id, success: true })
})

app.put('/planning/week-goals/:id', ownerOnly, async (c) => {
  const id = c.req.param('id')
  const { title, done, sort_order } = await c.req.json()
  const sets: string[] = []
  const vals: any[] = []
  if (title !== undefined) { sets.push('title=?'); vals.push(title) }
  if (done !== undefined) { sets.push('done=?'); vals.push(done ? 1 : 0) }
  if (sort_order !== undefined) { sets.push('sort_order=?'); vals.push(sort_order) }
  if (sets.length === 0) return c.json({ success: true })
  vals.push(id)
  await c.env.DB.prepare(`UPDATE week_goals SET ${sets.join(', ')} WHERE id=?`).bind(...vals).run()
  return c.json({ success: true })
})

app.delete('/planning/week-goals/:id', ownerOnly, async (c) => {
  await c.env.DB.prepare('DELETE FROM week_goals WHERE id=?').bind(c.req.param('id')).run()
  return c.json({ success: true })
})

// ─── Media: Platforms ─────────────────────────────────────────────────────────

app.get('/media/platforms', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM media_platforms').all()
  return c.json(results)
})

app.put('/media/platforms/:platform', ownerOnly, async (c) => {
  const platform = c.req.param('platform')
  const { followers, month_change } = await c.req.json()
  await c.env.DB.prepare(
    'UPDATE media_platforms SET followers=?, month_change=?, updated_at=unixepoch() WHERE platform=?'
  ).bind(followers ?? 0, month_change ?? 0, platform).run()
  return c.json({ success: true })
})

// ─── Media: Contents ──────────────────────────────────────────────────────────

app.get('/media/contents', async (c) => {
  const status = c.req.query('status')
  const { results } = status
    ? await c.env.DB.prepare('SELECT * FROM media_contents WHERE status=? ORDER BY created_at DESC').bind(status).all()
    : await c.env.DB.prepare('SELECT * FROM media_contents ORDER BY created_at DESC').all()
  // Parse todos JSON
  const parsed = (results as any[]).map(r => ({
    ...r,
    todos: r.todos ? JSON.parse(r.todos) : []
  }))
  return c.json(parsed)
})

app.post('/media/contents', ownerOnly, async (c) => {
  const { title, status = 'idea', platform = '', publish_date = '', publish_note = '', likes = 0, todos = [], start_date = '', end_date = '' } = await c.req.json()
  if (!title) return c.json({ error: 'title required' }, 400)
  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    'INSERT INTO media_contents (id, title, status, platform, publish_date, publish_note, likes, todos, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, title, status, platform, publish_date, publish_note, likes, JSON.stringify(todos), start_date, end_date).run()
  return c.json({ id, success: true })
})

app.put('/media/contents/:id', ownerOnly, async (c) => {
  const id = c.req.param('id')
  const { title, status, platform, publish_date, publish_note, likes, todos, start_date, end_date } = await c.req.json()
  await c.env.DB.prepare(
    'UPDATE media_contents SET title=?, status=?, platform=?, publish_date=?, publish_note=?, likes=?, todos=?, start_date=?, end_date=?, updated_at=unixepoch() WHERE id=?'
  ).bind(title, status, platform ?? '', publish_date ?? '', publish_note ?? '', likes ?? 0, JSON.stringify(todos ?? []), start_date ?? '', end_date ?? '', id).run()
  return c.json({ success: true })
})

app.delete('/media/contents/:id', ownerOnly, async (c) => {
  await c.env.DB.prepare('DELETE FROM media_contents WHERE id=?').bind(c.req.param('id')).run()
  return c.json({ success: true })
})

// ─── Media: Collabs ───────────────────────────────────────────────────────────

app.get('/media/collabs', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM media_collabs ORDER BY created_at DESC').all()
  return c.json(results)
})

app.post('/media/collabs', ownerOnly, async (c) => {
  const { brand, project, amount = 0, status = 'new', collab_date = '' } = await c.req.json()
  if (!brand || !project) return c.json({ error: 'brand and project required' }, 400)
  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    'INSERT INTO media_collabs (id, brand, project, amount, status, collab_date) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, brand, project, amount, status, collab_date).run()
  return c.json({ id, success: true })
})

app.put('/media/collabs/:id', ownerOnly, async (c) => {
  const id = c.req.param('id')
  const { brand, project, amount, status, collab_date } = await c.req.json()
  await c.env.DB.prepare(
    'UPDATE media_collabs SET brand=?, project=?, amount=?, status=?, collab_date=? WHERE id=?'
  ).bind(brand, project, amount ?? 0, status, collab_date ?? '', id).run()
  return c.json({ success: true })
})

app.delete('/media/collabs/:id', ownerOnly, async (c) => {
  await c.env.DB.prepare('DELETE FROM media_collabs WHERE id=?').bind(c.req.param('id')).run()
  return c.json({ success: true })
})

// ─── Media: Script Generation ─────────────────────────────────────────────────

app.post('/media/script/generate', async (c) => {
  const { topic, storyline = '', platform = '抖音', duration = '3分钟' } = await c.req.json()
  if (!topic) return c.json({ error: 'topic required' }, 400)

  const baseUrl = c.env.AI_BASE_URL || 'https://api.anthropic.com'
  const apiKey = c.env.AI_API_KEY
  const model = c.env.AI_MODEL || 'claude-opus-4-5-20251101'

  const prompt = `你是专业的短视频脚本创作者，精通${platform}爆款视频的创作逻辑。请根据以下信息生成完整视频脚本。

【视频信息】
主题：${topic}
故事线/核心卖点：${storyline || '根据主题自由发挥'}
目标平台：${platform}
视频时长：${duration}

【输出要求】
返回JSON（不要有其他内容），格式如下：
{
  "hook": "开头钩子完整台词（0-15秒，吸引用户留下来的第一句话）",
  "hook_tip": "这个钩子的设计思路（一句话）",
  "pain_points": [
    {"scene": "SCENE 01", "text": "痛点共鸣台词"},
    {"scene": "SCENE 02", "text": "台词"}
  ],
  "methods": [
    {"title": "方法01 · 标题", "text": "方法论台词"},
    {"title": "方法02 · 标题", "text": "台词"},
    {"title": "方法03 · 标题", "text": "台词"}
  ],
  "cta": "结尾CTA完整台词（引导点赞收藏或行动）",
  "word_count": 预估总字数数字,
  "duration_estimate": "时长估算字符串如'约3分钟'"
}`

  try {
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
    })
    if (!res.ok) return c.json({ error: `AI API 错误: ${res.status}` }, 502)
    const data = await res.json() as { content: { type: string; text: string }[] }
    const raw = data.content?.find(b => b.type === 'text')?.text || ''
    return c.json(parseAiJson(raw))
  } catch (e) {
    return c.json({ error: String(e) }, 502)
  }
})

app.post('/media/script/imitate', async (c) => {
  const { topic, storyline = '', platform = '抖音', reference_text, style_analysis } = await c.req.json()
  if (!topic || !reference_text) return c.json({ error: 'topic and reference_text required' }, 400)

  const baseUrl = c.env.AI_BASE_URL || 'https://api.anthropic.com'
  const apiKey = c.env.AI_API_KEY
  const model = c.env.AI_MODEL || 'claude-opus-4-5-20251101'

  const analysisContext = style_analysis
    ? `\n【已提取的风格分析】\n${JSON.stringify(style_analysis, null, 2)}\n`
    : ''

  const prompt = `你是专业的短视频脚本创作者。请分析对标视频的风格，然后为我的主题创作风格相似但内容完全原创的脚本。

【对标视频文字内容】
${reference_text}
${analysisContext}
【我的视频信息】
主题：${topic}
故事线/核心卖点：${storyline || '根据主题自由发挥'}
目标平台：${platform}

返回JSON（不要有其他内容）：
{
  "style_analysis": {
    "style": "风格标签（3-5个，逗号分隔）",
    "opening_pattern": "该视频开头惯用的句式",
    "structure": "内容结构模型（如：钩子→痛点→方法论→CTA）",
    "keywords": ["爆款关键词1", "爆款关键词2", "关键词3", "关键词4"]
  },
  "hook": "开头钩子完整台词",
  "hook_tip": "钩子设计思路",
  "pain_points": [
    {"scene": "SCENE 01", "text": "台词"},
    {"scene": "SCENE 02", "text": "台词"}
  ],
  "methods": [
    {"title": "方法01 · 标题", "text": "台词"},
    {"title": "方法02 · 标题", "text": "台词"},
    {"title": "方法03 · 标题", "text": "台词"}
  ],
  "cta": "结尾CTA台词",
  "word_count": 预估字数数字,
  "duration_estimate": "时长估算"
}`

  try {
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 3500, messages: [{ role: 'user', content: prompt }] }),
    })
    if (!res.ok) return c.json({ error: `AI API 错误: ${res.status}` }, 502)
    const data = await res.json() as { content: { type: string; text: string }[] }
    const raw = data.content?.find(b => b.type === 'text')?.text || ''
    return c.json(parseAiJson(raw))
  } catch (e) {
    return c.json({ error: String(e) }, 502)
  }
})

app.post('/media/script/transcribe', async (c) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File | null
    if (!file) return c.json({ error: '请上传视频文件' }, 400)

    const arrayBuffer = await file.arrayBuffer()
    const audioArray = [...new Uint8Array(arrayBuffer)]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (c.env as any).AI.run('@cf/openai/whisper', { audio: audioArray }) as { text: string }
    return c.json({ transcript: result.text || '', success: true })
  } catch (e) {
    return c.json({ error: `转录失败: ${String(e)}` }, 502)
  }
})

// ─── Health: Weight ───────────────────────────────────────────────────────────

app.get('/health/weight', async (c) => {
  const { days = '30' } = c.req.query()
  const limit = Math.min(365, Math.max(7, parseInt(days)))
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM health_weight ORDER BY date DESC LIMIT ?'
  ).bind(limit).all()
  const goal = await c.env.DB.prepare("SELECT value FROM health_goals WHERE key = 'weight_goal'").first<{ value: string }>()
  return c.json({ records: results, goal: goal ? parseFloat(goal.value) : null })
})

app.post('/health/weight', async (c) => {
  const { date, weight, note = '' } = await c.req.json()
  if (!date || weight == null) return c.json({ error: 'date and weight required' }, 400)
  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    'INSERT INTO health_weight (id, date, weight, note) VALUES (?, ?, ?, ?) ON CONFLICT(date) DO UPDATE SET weight=excluded.weight, note=excluded.note'
  ).bind(id, date, weight, note).run()
  return c.json({ success: true })
})

app.delete('/health/weight/:date', async (c) => {
  await c.env.DB.prepare('DELETE FROM health_weight WHERE date = ?').bind(c.req.param('date')).run()
  return c.json({ success: true })
})

app.post('/health/goal', async (c) => {
  const { weight_goal } = await c.req.json()
  if (weight_goal != null) {
    await c.env.DB.prepare(
      "INSERT INTO health_goals (key, value) VALUES ('weight_goal', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
    ).bind(String(weight_goal)).run()
  }
  return c.json({ success: true })
})

// ─── Health: Measurements ─────────────────────────────────────────────────────

app.get('/health/measurements', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM health_measurements ORDER BY date DESC LIMIT 50'
  ).all()
  return c.json(results)
})

app.post('/health/measurements', async (c) => {
  const { date, chest, waist, hips, thigh, arm, calf, wrist } = await c.req.json()
  if (!date) return c.json({ error: 'date required' }, 400)
  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    `INSERT INTO health_measurements (id, date, chest, waist, hips, thigh, arm, calf, wrist)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       chest=excluded.chest, waist=excluded.waist, hips=excluded.hips,
       thigh=excluded.thigh, arm=excluded.arm, calf=excluded.calf, wrist=excluded.wrist`
  ).bind(id, date, chest ?? null, waist ?? null, hips ?? null, thigh ?? null, arm ?? null, calf ?? null, wrist ?? null).run()
  return c.json({ success: true })
})

app.delete('/health/measurements/:date', async (c) => {
  await c.env.DB.prepare('DELETE FROM health_measurements WHERE date = ?').bind(c.req.param('date')).run()
  return c.json({ success: true })
})

// ─── Health: Exercise ─────────────────────────────────────────────────────────

app.get('/health/exercise', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM health_exercise ORDER BY date DESC, created_at DESC LIMIT 100'
  ).all()
  return c.json(results)
})

app.post('/health/exercise', async (c) => {
  const { date, type, duration, calories, note = '' } = await c.req.json()
  if (!date || !type) return c.json({ error: 'date and type required' }, 400)
  const id = crypto.randomUUID()
  await c.env.DB.prepare(
    'INSERT INTO health_exercise (id, date, type, duration, calories, note) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, date, type, duration ?? null, calories ?? null, note).run()
  return c.json({ id, success: true })
})

app.delete('/health/exercise/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM health_exercise WHERE id = ?').bind(c.req.param('id')).run()
  return c.json({ success: true })
})

// ─── 点子生成细纲 ──────────────────────────────────────────────────────────────

app.post('/generate-outline', async (c) => {
  const { idea, perspective = '女主视角' } = await c.req.json()
  if (!idea) return c.json({ error: '请输入你的点子' }, 400)

  const db = c.env.DB
  const baseUrl = c.env.AI_BASE_URL || 'https://api.anthropic.com'
  const apiKey  = c.env.AI_API_KEY
  const model   = c.env.AI_MODEL || 'claude-opus-4-5-20251101'

  // ── 从文章库提取参考：10篇 hooks 学爆点规律 + 2篇最相关正文节选示范情节密度 ─
  type ArtRow = { id: string; title: string; content: string }

  const keywords = extractKeywords(idea)
  let matchedIds: string[] = []
  let randomIds: string[] = []

  if (keywords.length > 0) {
    const conds: string[] = []
    const ps: string[] = []
    for (const kw of keywords) {
      conds.push('EXISTS (SELECT 1 FROM article_hooks ah2 WHERE ah2.article_id = a.id AND ah2.hook LIKE ?)')
      ps.push(`%${kw}%`)
      conds.push('a.category LIKE ?')
      ps.push(`%${kw}%`)
      conds.push('EXISTS (SELECT 1 FROM article_tags at2 WHERE at2.article_id = a.id AND at2.tag LIKE ?)')
      ps.push(`%${kw}%`)
      conds.push('a.title LIKE ?')
      ps.push(`%${kw}%`)
    }
    const { results } = await db.prepare(
      `SELECT a.id FROM articles a WHERE (${conds.join(' OR ')}) ORDER BY RANDOM() LIMIT 10`
    ).bind(...ps).all()
    matchedIds = (results as { id: string }[]).map(r => r.id)
  }

  // 不足 10 篇随机补足
  if (matchedIds.length < 10) {
    const excl = matchedIds.length > 0
      ? `WHERE id NOT IN (${matchedIds.map(() => '?').join(',')})`
      : ''
    const { results } = await db.prepare(
      `SELECT id FROM articles ${excl} ORDER BY RANDOM() LIMIT ?`
    ).bind(...matchedIds, 10 - matchedIds.length).all()
    randomIds = (results as { id: string }[]).map(r => r.id)
  }

  const allIds = [...matchedIds, ...randomIds].slice(0, 10)
  // 关键词匹配到的前 2 篇用于正文节选（最相关），其余只取 hooks
  const excerptIds = matchedIds.slice(0, 2)

  let refSection = ''
  if (allIds.length > 0) {
    const ph10 = allIds.map(() => '?').join(',')
    const [artRes, hookRes] = await Promise.all([
      db.prepare(
        `SELECT id, title, content FROM articles WHERE id IN (${ph10})`
      ).bind(...allIds).all(),
      db.prepare(
        `SELECT article_id, hook FROM article_hooks WHERE article_id IN (${ph10}) AND hook != '待分析'`
      ).bind(...allIds).all(),
    ])

    const hookMap: Record<string, string[]> = {}
    for (const r of hookRes.results as { article_id: string; hook: string }[]) {
      if (!hookMap[r.article_id]) hookMap[r.article_id] = []
      hookMap[r.article_id].push(r.hook)
    }

    const arts = artRes.results as ArtRow[]
    const allHooks = [...new Set(arts.flatMap(a => hookMap[a.id] || []))]

    // 正文节选：最相关的 2 篇，每篇取 300 字，展示情节密度
    const excerptParts = arts
      .filter(a => excerptIds.includes(a.id) && a.content)
      .map(a => `《${a.title}》节选：\n${a.content.slice(0, 300)}`)
      .join('\n\n')

    refSection = `
【文章库参考（${arts.length}篇，仅学习规律，情节必须全部原创）】

① 爆点组合规律（${arts.length}篇文章的爆点标签，反映读者偏好）：
${allHooks.join('、')}
${excerptParts ? `\n② 情节密度示例（最相关${excerptIds.length > 0 ? excerptIds.length : 2}篇正文节选，学习「每句话都有具体事件」的写法）：\n${excerptParts}` : ''}

学习要点：用①的爆点逻辑 + ②的情节密度，写出全新情节。`
  }

  const prompt = `你是一个擅长情绪结构的中文短篇网文策划。请根据用户提供的点子，生成一份对标爆款逻辑的情绪结构细纲。

爆款三要素：情绪（每个场景有清晰情绪目标）× 节奏（铺垫与爆发交替）× 创新（人设或情节有差异化）

用户点子（可能很模糊）：「${idea}」
视角：${perspective}
${refSection}

⚠️⚠️⚠️【故事类型强制声明——生成任何内容之前必须先理解这一条】⚠️⚠️⚠️

本次生成的是「被动受虐→心死离开→男主追妻」型虐文，绝对不是「觉醒复仇」型爽文。

两种类型对比（请判断自己写的是哪种，写错即不合格）：

❌ 觉醒复仇型（本次禁止）：女主发现真相 → 主动策划 → 假装顺从布局 → 当众揭露 → 爽
✅ 被虐离开型（本次要写）：女主一直被蒙在鼓里受伤害 → 心彻底死了 → 默默收拾离开 → 男主自己后来发现真相 → 追妻被拒

本次正确时间线（硬性规定，不能改变）：
- 付费卡点之前（铺垫1+铺垫2）：女主全程被虐，不知道任何阴谋真相，没有布局，没有调查
- 付费卡点（铺垫2的转折点）：女主只是心死了，拎包离开——不是因为发现了什么
- 付费卡点之后（铺垫3）：男主视角，他发现家空了→疯狂找→翻到遗物→自己发现真相→追妻被拒

真相揭露必须发生在女主离开之后，由男主自己找到证据或第三方告知，女主不主动揭露任何事。

用户点子只是梗概，不是完整情节。你需要围绕梗概创作4-5倍的具体场景事件，每个用户提到的大事件需要展开成2-3个具体铺垫场景。

【铺垫情节写法要求——最核心，对照示例严格执行】

【全局字数强制要求——必须达到，不达到视为不合格】
- 第一阶段铺垫：4-5个事件，每个事件不少于120字（相当于可以写成500字的场景蓝图）
- 第二阶段铺垫：4-5个事件，每个事件不少于120字
- 第一+第二阶段合计：必须是8-9个完整的虐女主事件，缺一不可
- 第三阶段铺垫：6-8个男主追妻事件，每个事件不少于80字
- 每一条不是摘要，是"事件经过"：有触发→有谁怎么反应→有女主被迫承受什么结果，读完能直接改写成500字正文
- 写不够就继续写，绝不能为了省字而压缩内容

这类故事结构：渣男/女二持续施害 → 女主承受，偶尔有情绪反应但被压得更惨 → 女主决定离开 → 付费后男主追妻火葬场。
铺垫阶段的主语永远是渣男和女二，不是女主。女主在这个阶段没有策略、没有主动调查、没有隐忍计划——她只是一个被反复伤害的人。

【写法标准：故事叙述，不是情节摘要】
铺垫不是写"发生了什么事（摘要）"，而是写"当时具体是怎么回事（叙述）"。
每一条都像截取了故事里的一个片段：有具体的人物动作、有对话、有连续的事件经过、有女主当时的状态。
一条里必须包含3-5个连续的小动作，串成一个完整的小事件，不能只写一句话。

【第一、二阶段铺垫——绝对禁止出现的内容（出现即错）】：
✗ 女主主动行为类：暗中调查 / 秘密收集证据 / 配合xxx / 开始布局 / 等待时机 / 隐忍计划
✗ 女主觉醒/察觉类：发现疑点 / 察觉异常 / 意识到真相 / 开始怀疑 / 醒悟 / 发现端倪 / 隐约感觉到
✗ 任何暗示女主「已经知道了某件事」「开始警觉」「内心有所转变」的句子
✗ 一句话摘要式表述（如「渣男偏袒女二」「女二当众羞辱女主」——太笼统，要写具体场景）
✗ 抽象行为标签式表述——以下词语出现即代表没有写具体内容，必须替换成场景：
   「冷暴力」→ 要写：他回家不说话/吃饭不看她/她叫他名字他不应/睡觉背对她，具体说了什么或不说什么
   「偏心/偏袒」→ 要写：父母当面把钱塞给女二/过生日时改成庆祝女二的事/当着邻居面夸女二从不提女主，有具体场景
   「教唆/挑拨」→ 要写：女二趁女主不在时对孩子/公婆说了什么具体的话，用了什么说辞，对方之后有什么变化
   「孤立/排斥/冷落」→ 要写：在什么场合、用什么具体行动孤立她，旁人有什么反应
   「感情破裂/关系恶化」→ 要写：哪一件具体的事让关系出现裂痕，当时谁说了什么话

第一、二阶段女主只有一种状态：不断被伤害、不断尝试相信、不断失望——但她没有察觉到任何阴谋，她以为这就是命运。真相的揭露留给转折点，不要提前泄露给女主。

【转折点——与铺垫适用同样禁令，出现即错】：
✗ 第一、二阶段转折点绝不能写：女主察觉/意识到/怀疑/发现/查到/看破任何阴谋或真相
✗ 转折点不是女主的「认知觉醒」，而是外部局势发生了变化，或女主做了一个行动
✓ 第一阶段转折点写法示例：「渣男做了某件让局势突然恶化的事，女主被彻底堵死反抗通道」——写渣男的行动，不是女主的想法
✓ 第二阶段转折点写法示例：「女主拉着行李坐飞机离开」——写她的离开行动，不是她发现了什么
✓ 第三阶段转折点写法示例：「渣男翻到触目惊心的东西（日记/B超单/旧录像），当场崩溃」——写渣男的反应

【允许写的内容】：
✓ 渣男/女二的具体行为、说的话、做的事
✓ 女主的情绪崩溃、哭泣、争吵、扇人——但结果是她被惩罚得更惨
✓ 女主被动知道了某件事（无意中听到、被迫看到），但不是主动去查

【真实示例——就是这种详细程度和写法风格】：
（以下是真实故事大纲节选，照着这个写）

第二阶段铺垫示例：
②男主问为什么不联系，我被碰瓷男主却不接电话（说女二胃痛）
③我神色平静，不哭不闹，男主觉得我变了，女二打给男主说在商场东西太多，男主拒了又去了
④女二玩狗、故意要住这里。男主让她别惹事，女二说我装大度，让狗咬我。我自己上了药，半夜着火了。男主救狗，都不救女主。女主倒在血泊中
⑤女主醒过来，对男主说没有意思指望。男主又接到女二电话，男主这次没走。那天是女主母亲忌日。出院那天，男主硬拉着我去女二生日会。女二故意和别的男人跳舞，男主捏碎酒杯把女二拉出来亲了起来。水晶吊灯掉下来，男主护住女二。
⑥女主回家收东西，女二推我，男主先救女二。男主留在了医院，说女二受了惊吓

第三阶段铺垫示例：
⑦男主打不通女主电话，质问女二。收到了民政局的离婚信息。回家发现家里空荡荡的，还有离婚协议和一封信。男主去候机大厅疯狂找女主
⑨女二打电话给男主，男主让她滚。男主疯狂找女主，变得很邋遢，找女主的闺蜜，闺蜜狠狠骂他
⑩男主回去，翻到女主当年为了结婚练习的录像，发现了女主的日记本和B超单。男主发现女主让他救他的信息和以前的短信

【三阶段分工——严格执行】：
第一阶段：渣男/女二施害，写具体事件经过，女主被反复伤害，情绪反应让处境更糟，无策略无布局
第二阶段：施害持续升级，女主继续被虐，直到某次被虐到极致后决定离开——转折点是她拎包/出门/签字/离开的那个动作，不是她发现了什么
第三阶段：⚠️女主已经离开，第三阶段全部内容从渣男/男主视角写：他发现家是空的、他疯狂找人、他翻到触目惊心的东西（遗物/日记/B超单/录音）崩溃、他被女主朋友骂/被拒见、他跪地求饶被无视。真相揭露（包括女二设局的证据）也在第三阶段。女主在第三阶段只有一种状态：冷漠、拒绝、不回头。⚠️第三阶段铺垫里绝对不能写「女主暗中准备/联系律师/收集证据」这类主动策略。

【铺垫条数强制检查——生成JSON前在脑中过一遍，不达标必须补足】
第一阶段 setup 字段：4-5个事件。写完每一条后检查：这条至少120字了吗？有触发→反应→女主状态吗？不达标必须补充。
第二阶段 setup 字段：4-5个事件。第一+第二阶段加起来必须达到8-9个事件，数一数，不够继续写。
第三阶段 setup 字段：6-8个男主追妻事件，每个展开4句以上。

⚠️ 写了 ③ 就想结尾 = 不合格，必须强制继续写。
⚠️ 铺垫不是写「发生了什么（一句话摘要）」，而是写「当时怎么回事（触发事件+多人反应+女主处境，至少4句连续叙述）」。
每一条铺垫都必须包含4个以上连续句子，包含：触发行为、其他角色反应（对话或动作）、女主的被动处境或情绪。像这样：

【合格示例——这是需要的详细程度，每条都像这样写】

✅ 合格事件④（多人连锁反应型）：
女二在家吃饭，把虾仁全部吃完后开始起红疹。男主第一个电话：「你是不是故意的？你作为她姐，你是怎么当的？」女主解释虾仁摆出来时并无异常，男主说「你总有理由」，挂了电话。十分钟后婆婆打来，语气更难听：「明明知道她过敏还放，你存心的是吗？」儿子从房间走出来，看女主一眼，不说话又进去了。女主站在厨房，一个人刷了碗，饭桌上女二吃剩的残局原封未动。

✅ 合格事件⑤（行为细节型）：
男主那阵回家从不和女主说话。女主做好饭喊他，他拿着手机直接进卧室，女主问「你怎么了」，他说「没事，累了」，反锁了门。女主在门外站了十分钟，听见里面有接电话的声音，声音低而温柔。吃饭时女主把菜推到他面前，他夹了两筷子就说吃饱了，拿上外套出门。女主坐在饭桌前，菜都还冒着热气。

✅ 合格事件⑥（挑拨连锁型）：
女二趁女主去上班，把儿子叫过来说「妈妈最近不爱你了，你看她连你的事都顾不上」，说着哭起来，「只有姨妈真心疼你」。女主下班回来，喊儿子，儿子把头转开不应。女主蹲下来问他怎么了，他把脸转向另一边说「我不想理你」。女主愣了很久，问男主，男主说「你自己反思一下，是不是最近太忽略孩子了」。

❌ 不合格写法（以下这些直接不及格）：
④女二过敏责怪女主。（一句摘要，没有完整经过）
⑤丈夫冷暴力。（「冷暴力」是标签，没有写任何具体行为）
⑥女二教唆儿子疏远女主。（「教唆」是标签，没写说了什么话、孩子怎么变化）

请按以下标签格式输出全部内容（每个标签独占一行，紧跟内容，不要输出JSON或多余文字）：

[SUMMARY]一句话梗概（30字内，写悲剧被虐感，不写觉醒复仇）
[QI]起——开篇情境（60字内）
[CHENG]承——渣男/女二施害升级（60字内，只写对她做了什么，不写她发现了什么）
[ZHUAN]转——写女主离开的动作（60字内，是行动不是发现真相）
[HE]合——男主后来发现真相，疯狂追妻（60字内）
[DESIRE]欲望——女主最初只想要什么（40字内）
[OBSTACLE]阻碍——渣男和女二怎么施害（用①②分点，80字内）
[ACTION]行动——女主做的那件事：离开（40字内，只写离开动作，不写调查）
[ACHIEVE]达成——离开后男主追悔莫及（60字内）
[PROTAGONIST]主角势力（人物名及身份，30字内）
[ANTAGONIST]反派势力（20字内）
[BYSTANDERS]围观群众（20字内，无则写「无」）
[EMOT-ELEM]情绪点要素与转折点（用1.2.分点列举，100字内）

第一阶段铺垫（女主被虐，4个事件，每个事件写4-6句完整叙述，包含触发+对话+反应+女主处境）：
[S1E1]男主明显把女二放在女主前面的场景（4-6句，含男主说的话）
[S1E2]女二设局陷害，女主被罚（4-6句，含女二和男主的对话原话）
[S1E3]公婆/儿子/家人当面指责女主（4-6句，含至少2句家人说的原话）
[S1E4]公开场合女主被严重羞辱（4-6句，有旁观者在场）
[S1TURN]第一阶段转折点——渣男/女二做了某件让局势恶化的行动（60字内，❌禁止写女主察觉任何真相）
[S1EMOT]情绪点①：①(场景→读者情绪) ②(场景→情绪) ③(场景→情绪)

第二阶段铺垫（施害升级，4个事件，每个事件写4-6句完整叙述，比第一阶段更惨）：
[S2E1]身体或精神受到更深程度伤害（4-6句，每句有具体细节）
[S2E2]女主向某人求助，被拒绝或被反骂（4-6句，含求助对话原话）
[S2E3]女主试图反抗，结果被更惨地对待（4-6句）
[S2E4]压垮骆驼——女主情感彻底死心的那件事（4-6句，❌不是发现真相，是心死了）
[S2TURN]第二阶段转折点——女主离开的那个动作（60字内，❌不写发现真相，只写离开行动）
[S2EMOT]情绪点②：①(场景→读者情绪) ②(场景→情绪) ③(场景→情绪)

第三阶段追妻（女主已离开，全程男主视角，6个事件，每个事件写4-5句完整叙述）：
[S3E1]男主回家发现空了——看到什么、第一反应、做了什么（4-5句，男主慌乱）
[S3E2]男主疯狂找人——打给谁、被骂被拒绝、他的反应（4-5句，含对方骂他的话）
[S3E3]男主外表变狼狈——状态描写，某人见到他的反应（4-5句）
[S3E4]男主翻到触目惊心的东西——日记/B超单/录音/视频内容+崩溃细节（4-6句）
[S3E5]男主找到女主——女主的冷漠态度、男主跪求、女主说的话（4-5句）
[S3E6]男主发现女二阴谋——证据内容、男主对女二的崩溃反应（4-6句）
[S3TURN]第三阶段转折点——真相在男主面前揭露（60字内）
[S3EMOT]情绪点③：①(男主追妻爽点) ②(真相大白崩溃) ③(结局最解气)
[UP]上行情绪：1.(节点) 2.(节点) 3.(节点)
[DOWN]下行情绪：1.(节点) 2.(节点) 3.(节点)`

  try {
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 16000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      return c.json({ error: `AI API 错误: ${res.status}`, detail: err }, 502)
    }

    const data = await res.json() as { content: { type: string; text: string }[] }
    const raw = data.content?.find(b => b.type === 'text')?.text || ''
    try {
      // Parse tagged output format [TAGNAME]content
      const getTag = (tag: string): string => {
        const re = new RegExp(`\\[${tag}\\]([\\s\\S]*?)(?=\\n\\[[A-Z0-9-]+\\]|$)`)
        const m = raw.match(re)
        return m ? m[1].trim() : ''
      }
      const makeSetup = (events: string[]): string =>
        events.filter(e => e && e.trim() !== '无').map((e, i) => `${'①②③④⑤⑥'[i]}${e}`).join('\n')
      const result = {
        summary: getTag('SUMMARY'),
        structure: { qi: getTag('QI'), cheng: getTag('CHENG'), zhuan: getTag('ZHUAN'), he: getTag('HE') },
        event_flow: { desire: getTag('DESIRE'), obstacle: getTag('OBSTACLE'), action: getTag('ACTION'), achieve: getTag('ACHIEVE') },
        characters: { protagonist: getTag('PROTAGONIST'), antagonist: getTag('ANTAGONIST'), bystanders: getTag('BYSTANDERS') },
        emotion_elements: getTag('EMOT-ELEM'),
        outline: [
          { segment: '前段', setup: makeSetup([getTag('S1E1'), getTag('S1E2'), getTag('S1E3'), getTag('S1E4')]), turning: getTag('S1TURN'), emotion: getTag('S1EMOT') },
          { segment: '中段', setup: makeSetup([getTag('S2E1'), getTag('S2E2'), getTag('S2E3'), getTag('S2E4')]), turning: getTag('S2TURN'), emotion: getTag('S2EMOT') },
          { segment: '后段', setup: makeSetup([getTag('S3E1'), getTag('S3E2'), getTag('S3E3'), getTag('S3E4'), getTag('S3E5'), getTag('S3E6')]), turning: getTag('S3TURN'), emotion: getTag('S3EMOT') },
        ],
        emotion_arc: { up: getTag('UP'), down: getTag('DOWN') },
      }
      if (!result.summary) return c.json({ error: '解析失败：未找到标签格式内容', raw }, 502)
      return c.json(result)
    } catch (e) { return c.json({ error: `解析失败: ${(e as Error).message}`, raw }, 502) }
  } catch (e) {
    return c.json({ error: String(e) }, 502)
  }
})

// ─── Five-Year Diary ────────────────────────────────────────────────────────

app.get('/diary/entries', async (c) => {
  const db = (c.env as Env).DB
  const date = c.req.query('date') // MM-DD
  if (!date) return c.json({ error: 'date required' }, 400)
  const rows = await db.prepare(
    'SELECT date, year, content, wish_content, mood, weather, updated_at FROM five_year_diary WHERE date = ? ORDER BY year'
  ).bind(date).all()
  return c.json(rows.results)
})

app.put('/diary/entry', async (c) => {
  const db = (c.env as Env).DB
  const body = await c.req.json() as {
    date: string; year: number; content?: string; wish_content?: string; mood?: string; weather?: string
  }
  const { date, year, content = '', wish_content = '', mood = '', weather = '' } = body
  if (!date || !year) return c.json({ error: 'date and year required' }, 400)
  await db.prepare(
    `INSERT INTO five_year_diary (date, year, content, wish_content, mood, weather, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, unixepoch())
     ON CONFLICT(date, year) DO UPDATE SET
       content = excluded.content,
       wish_content = excluded.wish_content,
       mood = excluded.mood,
       weather = excluded.weather,
       updated_at = unixepoch()`
  ).bind(date, year, content, wish_content, mood, weather).run()
  return c.json({ success: true })
})

app.get('/diary/calendar', async (c) => {
  const db = (c.env as Env).DB
  const year = parseInt(c.req.query('year') || '0')
  if (!year) return c.json({ error: 'year required' }, 400)
  const rows = await db.prepare(
    `SELECT date FROM five_year_diary WHERE year = ? AND (content != '' OR wish_content != '') ORDER BY date`
  ).bind(year).all()
  return c.json((rows.results as { date: string }[]).map(r => r.date))
})

app.get('/diary/stats', async (c) => {
  const db = (c.env as Env).DB
  const now = new Date()
  const currentYear = now.getFullYear()
  const total = await db.prepare(
    `SELECT COUNT(DISTINCT date || '-' || year) as cnt FROM five_year_diary WHERE content != '' OR wish_content != ''`
  ).first<{ cnt: number }>()
  const currentYearDays = await db.prepare(
    `SELECT COUNT(*) as cnt FROM five_year_diary WHERE year = ? AND content != ''`
  ).bind(currentYear).first<{ cnt: number }>()
  const recent = await db.prepare(
    `SELECT date, year, substr(content,1,30) as preview FROM five_year_diary WHERE content != '' ORDER BY updated_at DESC LIMIT 5`
  ).all()
  return c.json({
    total_entries: total?.cnt ?? 0,
    current_year_days: currentYearDays?.cnt ?? 0,
    recent: recent.results,
  })
})

export const onRequest = handle(app)
