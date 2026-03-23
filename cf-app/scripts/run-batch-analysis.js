#!/usr/bin/env node
// Batch analysis script — calls production API to analyze all '待分析' articles
// Usage: node scripts/run-batch-analysis.js

const BASE_URL = 'https://carly-assistant.pages.dev'
const USERNAME = 'carly'
const PASSWORD = 'carly'
const DELAY_MS = 1200  // delay between articles to avoid rate limiting
const CONCURRENCY = 1  // one at a time to be safe

let token = ''

async function login() {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  })
  const d = await res.json()
  if (!d.token) throw new Error('Login failed: ' + JSON.stringify(d))
  token = d.token
  console.log('✅ Logged in')
}

function authHeaders() {
  return { 'Content-Type': 'application/json', 'x-session-token': token }
}

async function getUnanalyzed() {
  const res = await fetch(`${BASE_URL}/api/articles/unanalyzed`, {
    headers: { 'x-session-token': token },
  })
  const d = await res.json()
  return d.articles
}

async function getArticle(id) {
  const res = await fetch(`${BASE_URL}/api/articles/${id}`, {
    headers: { 'x-session-token': token },
  })
  return res.json()
}

async function analyzeArticle(title, content) {
  const res = await fetch(`${BASE_URL}/api/analyze`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ title, content: content?.slice(0, 3000) || '' }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`analyze HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

async function saveAnalysis(id, data) {
  const res = await fetch(`${BASE_URL}/api/articles/${id}/analysis`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`save HTTP ${res.status}`)
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function main() {
  await login()

  const articles = await getUnanalyzed()
  console.log(`📋 Found ${articles.length} unanalyzed articles\n`)

  if (articles.length === 0) {
    console.log('✅ Nothing to analyze!')
    return
  }

  let success = 0
  let failed = 0
  const errors = []

  for (let i = 0; i < articles.length; i++) {
    const stub = articles[i]
    const pct = Math.round(((i + 1) / articles.length) * 100)
    process.stdout.write(`[${String(i + 1).padStart(4)}/${articles.length}] (${pct}%) ${stub.title.slice(0, 50)}… `)

    try {
      // Fetch full content for better analysis
      const full = await getArticle(stub.id)
      const result = await analyzeArticle(full.title, full.content)
      await saveAnalysis(stub.id, result)
      success++
      console.log(`✅ [${result.category}] ${(result.hooks || []).slice(0, 3).join('/')}`)
    } catch (e) {
      failed++
      const msg = String(e)
      errors.push({ title: stub.title, error: msg })
      console.log(`❌ ${msg}`)
    }

    if (i < articles.length - 1) {
      await sleep(DELAY_MS)
    }
  }

  console.log('\n' + '─'.repeat(60))
  console.log(`✅ 成功: ${success}   ❌ 失败: ${failed}`)
  if (errors.length > 0) {
    console.log('\n失败列表:')
    for (const { title, error } of errors) {
      console.log(`  • ${title}: ${error}`)
    }
  }
}

main().catch(e => { console.error(e); process.exit(1) })
