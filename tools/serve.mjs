// 依存ゼロの静的HTTPサーバ（検証用）。
// 使い方: node tools/serve.mjs [port]  （既定 8799・リポジトリ直下を配信）
// このアプリは fetch を使うため file:// 直開き不可＝必ずHTTPで配信して検証する。
import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, normalize, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..') // リポジトリ直下
const PORT = Number(process.argv[2] || process.env.PORT || 8799)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
}

const server = http.createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    if (path.endsWith('/')) path += 'index.html'
    // パストラバーサル防止: 正規化して ROOT 配下だけ許可
    const full = normalize(join(ROOT, path))
    if (!full.startsWith(normalize(ROOT))) { res.writeHead(403); res.end('forbidden'); return }
    const s = await stat(full).catch(() => null)
    if (!s || !s.isFile()) { res.writeHead(404); res.end('not found'); return }
    const buf = await readFile(full)
    res.writeHead(200, { 'content-type': MIME[extname(full).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' })
    res.end(buf)
  } catch (e) {
    res.writeHead(500); res.end(String(e))
  }
})

server.listen(PORT, '127.0.0.1', () => console.log(`serve: http://127.0.0.1:${PORT}/ (root=${ROOT})`))
