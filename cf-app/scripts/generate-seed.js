/**
 * Generates SQL seed statements from articles_db.json, reading actual txt file content.
 * Usage: node scripts/generate-seed.js > seed.sql
 *        wrangler d1 execute curry-db --local --file=seed.sql
 *
 * Requires: npm install (iconv-lite, chardet in devDependencies)
 */

import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join, resolve } from 'path'
import iconv from 'iconv-lite'
import chardet from 'chardet'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..', '..')  // cf-app/../.. = 咖喱小助手/
const dbPath = join(projectRoot, 'articles_db.json')

let db
try {
  db = JSON.parse(readFileSync(dbPath, 'utf-8'))
} catch {
  process.stderr.write(`ERROR: cannot read ${dbPath}\n`)
  process.exit(1)
}

const articles = db.articles || []

/** Read a txt file, auto-detecting GBK/UTF-8 encoding */
function readTxt(fullPath) {
  // Try full_path directly first; fall back to resolving file_path from project root
  const candidates = [fullPath]

  if (!existsSync(fullPath)) {
    // file_path uses Windows backslashes — normalise
    const relative = fullPath
      .replace(/^D:\\【AAA】claude\\咖喱小助手\\/, '')
      .replace(/\\/g, '/')
    candidates.push(join(projectRoot, relative))
  }

  for (const p of candidates) {
    if (existsSync(p)) {
      const buf = readFileSync(p)
      const detected = chardet.detect(buf) || 'UTF-8'
      // chardet may return 'GB-2312', 'GB18030', etc. — map to iconv name
      const enc = detected.toUpperCase().includes('GB') ? 'GBK' : 'UTF-8'
      return iconv.decode(buf, enc)
    }
  }

  return null  // file not found — content will be empty
}

/** Escape a string for SQL single-quote literals */
const esc = (s) => String(s ?? '').replace(/'/g, "''")

let found = 0
let missing = 0

process.stdout.write('BEGIN TRANSACTION;\n')

for (const article of articles) {
  const id = esc(article.id)
  const title = esc(article.title)
  const category = esc(article.category)
  const wordCount = parseInt(article.word_count) || 0
  const source = esc(article.source)
  const importDate = esc(article.import_date)

  let content = ''
  if (article.full_path) {
    const text = readTxt(article.full_path)
    if (text !== null) {
      content = esc(text)
      found++
    } else {
      missing++
      process.stderr.write(`MISSING: ${article.full_path}\n`)
    }
  }

  process.stdout.write(
    `INSERT OR IGNORE INTO articles (id, title, category, word_count, source, import_date, content) ` +
    `VALUES ('${id}', '${title}', '${category}', ${wordCount}, '${source}', '${importDate}', '${content}');\n`
  )

  for (const tag of article.tags || []) {
    const t = esc(tag)
    process.stdout.write(`INSERT OR IGNORE INTO tags (name) VALUES ('${t}');\n`)
    process.stdout.write(`INSERT OR IGNORE INTO article_tags (article_id, tag) VALUES ('${id}', '${t}');\n`)
  }

  for (const hook of article.hooks || []) {
    const h = esc(hook)
    process.stdout.write(`INSERT OR IGNORE INTO article_hooks (article_id, hook) VALUES ('${id}', '${h}');\n`)
  }
}

process.stdout.write('COMMIT;\n')
process.stderr.write(`\nDone: ${found} files read, ${missing} missing (content left empty).\n`)
