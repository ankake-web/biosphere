// 依存ゼロのヘッドレス回帰チェック（Chrome DevTools Protocol を素のWebSocketで駆動）。
// 目的: 主要シナリオを実ブラウザで開き、地図初期化・データ読込・致命エラー無しを自動判定。
// 前提: 別プロセスで `node tools/serve.mjs` を起動しておく（既定 http://127.0.0.1:8799）。
// 使い方: node tools/check.mjs            … 全シナリオ検証（PNGを tools/shots/ に保存）
//          BASE=http://127.0.0.1:8799 CHROME="C:\\...\\chrome.exe" node tools/check.mjs
// 判定: DOM/観測可能な状態にのみ依存（内部グローバルに依存しない）ので、ES Modules化やデータ分割の後も同じチェックが通る。
import { spawn } from 'node:child_process'
import { mkdtempSync, existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import http from 'node:http'

const BASE = process.env.BASE || 'http://127.0.0.1:8799'
const CHROME = process.env.CHROME ||
  (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : 'google-chrome')
const SHOTDIR = process.env.OUT || join(process.cwd(), 'tools', 'shots')
const GEO = { latitude: 35.681, longitude: 139.767, accuracy: 40 } // 東京駅（#@や素起動の測位を固定）

// --- シナリオ定義（観測可能な状態だけで判定） ---
const SCENARIOS = [
  {
    name: 'deeplink-#lion',
    url: BASE + '/#lion',
    ready: `!!document.querySelector('.maplibregl-canvas')`,
    // 種ディープリンク＝地球儀＋種カード。本文にライオンが出れば選択成功。
    checks: [
      ['maplibre読込', `typeof maplibregl!=='undefined'`],
      ['地図canvas', `!!document.querySelector('.maplibregl-canvas')`],
      ['種カードにライオン', `document.body.innerText.includes('ライオン')`, 8000],
      // 詳細(desc/stats)は species-detail.json から遅延ロード。フレーバー2本立ての🌿生態ブロックに文が入れば成功。
      ['カード詳細の遅延ロード', `(document.querySelector('.flavor2 .flavtx')?.textContent.trim().length||0) > 5`, 8000],
    ],
  },
  {
    name: 'near-#@tokyo',
    url: BASE + '/#@35.681,139.767,10',
    ready: `!!document.querySelector('.maplibregl-canvas')`,
    checks: [
      ['maplibre読込', `typeof maplibregl!=='undefined'`],
      ['地図canvas', `!!document.querySelector('.maplibregl-canvas')`],
    ],
  },
  {
    name: 'boot-plain',
    url: BASE + '/',
    ready: `!!document.querySelector('.maplibregl-canvas')`,
    checks: [
      ['maplibre読込', `typeof maplibregl!=='undefined'`],
      ['地図canvas', `!!document.querySelector('.maplibregl-canvas')`],
      // データ層は内部変数に依存せず独立fetchで確認（runtime はコアを読む）
      ['species-core.json 5000種以上', `fetch('${BASE}/data/species-core.json').then(r=>r.json()).then(j=>Array.isArray(j.animals)&&j.animals.length>=5000)`, 12000, true],
    ],
  },
]

const sleep = ms => new Promise(r => setTimeout(r, ms))

function httpJson(url) {
  return new Promise((res, rej) => {
    http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)) } catch (e) { rej(e) } }) }).on('error', rej)
  })
}

// 最小CDPクライアント（flattenセッション）
function connect(wsurl) {
  const ws = new WebSocket(wsurl)
  let id = 0
  const pending = new Map()
  const listeners = []
  ws.addEventListener('message', ev => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id)
      m.error ? rej(new Error(m.error.message)) : res(m.result)
    } else if (m.method) listeners.forEach(fn => fn(m))
  })
  const ready = new Promise((res, rej) => { ws.addEventListener('open', () => res()); ws.addEventListener('error', () => rej(new Error('ws error'))) })
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
    const mid = ++id; pending.set(mid, { res, rej }); ws.send(JSON.stringify({ id: mid, method, params, sessionId }))
  })
  return { ws, ready, send, on: fn => listeners.push(fn) }
}

async function main() {
  mkdirSync(SHOTDIR, { recursive: true })
  const udd = mkdtempSync(join(tmpdir(), 'biocheck-'))
  const proc = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-features=Translate,BackForwardCache', '--hide-scrollbars',
    '--remote-debugging-port=0', `--user-data-dir=${udd}`, '--window-size=430,900', 'about:blank',
  ], { stdio: 'ignore' })

  const portFile = join(udd, 'DevToolsActivePort')
  let port = null
  for (let i = 0; i < 100 && port === null; i++) {
    if (existsSync(portFile)) { const c = readFileSync(portFile, 'utf8').trim().split('\n'); if (c[0]) port = Number(c[0]) }
    else await sleep(100)
  }
  if (!port) { console.error('Chrome起動失敗（DevToolsActivePortなし）'); proc.kill(); process.exit(2) }

  const ver = await httpJson(`http://127.0.0.1:${port}/json/version`)
  const browser = connect(ver.webSocketDebuggerUrl)
  await browser.ready
  await browser.send('Browser.grantPermissions', { permissions: ['geolocation'] })

  let allPass = true
  for (const sc of SCENARIOS) {
    const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true })
    const S = (method, params) => browser.send(method, params, sessionId)

    const errors = []
    browser.on(m => {
      if (m.sessionId !== sessionId) return
      if (m.method === 'Runtime.exceptionThrown') {
        errors.push({ kind: 'exception', text: m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || 'exception' })
      } else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        errors.push({ kind: 'console.error', text: (m.params.args || []).map(a => a.value ?? a.description ?? '').join(' ') })
      } else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
        errors.push({ kind: 'log', text: m.params.entry.text + ' ' + (m.params.entry.url || '') })
      } else if (m.method === 'Network.loadingFailed') {
        errors.push({ kind: 'net', text: (m.params.errorText || 'net-fail'), url: m.params._url })
      }
    })

    await S('Page.enable', {})
    await S('Runtime.enable', {})
    await S('Log.enable', {})
    await S('Network.enable', {})
    await S('Emulation.setGeolocationOverride', GEO)

    await S('Page.navigate', { url: sc.url })

    // 準備完了まで待機（最長15s）
    let readyOk = false
    for (let i = 0; i < 75; i++) {
      const r = await S('Runtime.evaluate', { expression: sc.ready, returnByValue: true }).catch(() => null)
      if (r && r.result && r.result.value === true) { readyOk = true; break }
      await sleep(200)
    }
    await sleep(1500) // 描画・非同期の余韻

    // 各チェック評価
    const results = []
    for (const [label, expr, extraWait, isPromise] of sc.checks) {
      if (extraWait) {
        let ok = false
        const deadline = Date.now() + extraWait
        while (Date.now() < deadline) {
          const r = await S('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: !!isPromise }).catch(() => null)
          if (r && r.result && r.result.value === true) { ok = true; break }
          await sleep(300)
        }
        results.push([label, ok])
      } else {
        const r = await S('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: !!isPromise }).catch(() => null)
        results.push([label, !!(r && r.result && r.result.value === true)])
      }
    }

    // 致命エラー判定: maplibre 参照 or アプリJS(js/*.js) の例外のみFAIL。外部API失敗は警告扱い。
    const fatal = errors.filter(e =>
      /maplibre/i.test(e.text || '') ||
      (e.kind === 'exception' && /\/js\/[a-z]+\.js/i.test(e.text || ''))
    )
    const external = errors.filter(e => !fatal.includes(e))

    // スクショ
    const shot = await S('Page.captureScreenshot', { format: 'png' }).catch(() => null)
    if (shot && shot.data) writeFileSync(join(SHOTDIR, sc.name + '.png'), Buffer.from(shot.data, 'base64'))

    const checksPass = results.every(([, ok]) => ok)
    const pass = readyOk && checksPass && fatal.length === 0
    allPass = allPass && pass

    console.log(`\n[${pass ? 'PASS' : 'FAIL'}] ${sc.name}  ${sc.url}`)
    console.log(`  ready=${readyOk}`)
    for (const [label, ok] of results) console.log(`  ${ok ? '✓' : '✗'} ${label}`)
    if (fatal.length) { console.log(`  致命エラー ${fatal.length}件:`); fatal.slice(0, 5).forEach(e => console.log(`    ! [${e.kind}] ${String(e.text).slice(0, 160)}`)) }
    if (external.length) console.log(`  （外部API等の非致命エラー ${external.length}件・判定対象外）`)

    await browser.send('Target.closeTarget', { targetId }).catch(() => {})
  }

  console.log(`\n===== ${allPass ? '全シナリオ PASS ✅' : '失敗あり ❌'} =====`)
  console.log(`スクショ: ${SHOTDIR}`)
  proc.kill()
  process.exit(allPass ? 0 : 1)
}

main().catch(e => { console.error(e); process.exit(2) })
