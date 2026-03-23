/**
 * Imports articles into D1.
 * - Phase 1: metadata + tags + hooks in batches of 80
 * - Phase 2: content in batches of 10 (each statement ≤ 25k chars → ~75KB per statement)
 *
 * Usage: node scripts/batch-seed.js [--remote]
 */

import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'
import { execSync } from 'child_process'
import iconv from 'iconv-lite'
import chardet from 'chardet'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..', '..')
const dbPath = join(projectRoot, 'articles_db.json')
const MAX_CONTENT_CHARS = 25000  // ~75KB per statement, safely under D1's 100KB limit
const CONTENT_BATCH = 10         // 10 UPDATE statements per wrangler call
const META_BATCH = 80

const flag = process.argv.includes('--remote') ? '--remote' : '--local'
const db = JSON.parse(readFileSync(dbPath, 'utf-8'))
const articles = db.articles || []

function readTxt(fullPath) {
  const relative = (fullPath || '').replace(/^D:\\【AAA】claude\\咖喱小助手\\/, '').replace(/\\/g, '/')
  for (const p of [fullPath, join(projectRoot, relative)]) {
    if (p && existsSync(p)) {
      const buf = readFileSync(p)
      const enc = (chardet.detect(buf) || '').toUpperCase().includes('GB') ? 'GBK' : 'UTF-8'
      return iconv.decode(buf, enc)
    }
  }
  return null
}

const esc = (s) => String(s ?? '').replace(/'/g, "''")
const tmpFile = join(__dirname, '_tmp.sql')

function runSql(sql) {
  writeFileSync(tmpFile, sql, 'utf-8')
  execSync(`npx wrangler d1 execute curry-db ${flag} --file="${tmpFile}"`, {
    cwd: resolve(__dirname, '..'),
    stdio: 'pipe',
  })
}

// ── Phase 1: metadata (no content) ─────────────────────────────────────────
console.log(`\nPhase 1: metadata for ${articles.length} articles…`)
const totalMeta = Math.ceil(articles.length / META_BATCH)

for (let i = 0; i < articles.length; i += META_BATCH) {
  const batch = articles.slice(i, i + META_BATCH)
  const n = Math.floor(i / META_BATCH) + 1
  process.stdout.write(`  [${n}/${totalMeta}] ${i + 1}–${Math.min(i + META_BATCH, articles.length)}… `)
  let sql = ''
  for (const a of batch) {
    const id = esc(a.id)
    sql += `INSERT OR IGNORE INTO articles (id,title,category,word_count,source,import_date,content) VALUES ('${id}','${esc(a.title)}','${esc(a.category)}',${parseInt(a.word_count)||0},'${esc(a.source)}','${esc(a.import_date)}','');\n`
    for (const t of a.tags || []) {
      sql += `INSERT OR IGNORE INTO tags (name) VALUES ('${esc(t)}');\n`
      sql += `INSERT OR IGNORE INTO article_tags (article_id,tag) VALUES ('${id}','${esc(t)}');\n`
    }
    for (const h of a.hooks || []) {
      sql += `INSERT OR IGNORE INTO article_hooks (article_id,hook) VALUES ('${id}','${esc(h)}');\n`
    }
  }
  try { runSql(sql); process.stdout.write('✅\n') }
  catch (e) { process.stdout.write('❌\n'); console.error(e.stderr?.toString()); process.exit(1) }
}

// ── Phase 2: content in batches of CONTENT_BATCH ───────────────────────────
console.log(`\nPhase 2: content in batches of ${CONTENT_BATCH}…`)
const totalContent = Math.ceil(articles.length / CONTENT_BATCH)
let withContent = 0, truncated = 0, missing = 0

for (let i = 0; i < articles.length; i += CONTENT_BATCH) {
  const batch = articles.slice(i, i + CONTENT_BATCH)
  const n = Math.floor(i / CONTENT_BATCH) + 1
  process.stdout.write(`  [${n}/${totalContent}] ${i + 1}–${Math.min(i + CONTENT_BATCH, articles.length)}… `)

  let sql = ''
  let batchHasContent = 0

  for (const a of batch) {
    const text = a.full_path ? readTxt(a.full_path) : null
    if (text === null) { missing++; continue }
    const raw = text.length > MAX_CONTENT_CHARS ? (truncated++, text.slice(0, MAX_CONTENT_CHARS)) : text
    sql += `UPDATE articles SET content='${esc(raw)}' WHERE id='${esc(a.id)}';\n`
    batchHasContent++
    withContent++
  }

  if (!sql) { process.stdout.write('(no files)\n'); continue }

  try { runSql(sql); process.stdout.write(`✅ (${batchHasContent} files)\n`) }
  catch (e) { process.stdout.write('❌\n'); console.error(e.stderr?.toString()) /* non-fatal */ }
}

if (existsSync(tmpFile)) unlinkSync(tmpFile)
console.log(`\nDone! ${articles.length} articles | content: ${withContent} | truncated: ${truncated} | missing: ${missing}`)
