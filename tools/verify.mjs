// ワンコマンド回帰チェック: 静的サーバを起動 → ヘッドレスChromeで主要シナリオ検証 → 後片付け。
// 使い方: node tools/verify.mjs
//   終了コード 0=全PASS / 1=失敗あり / 2=起動失敗。スクショは tools/shots/ に保存。
//   Chromeの場所を変えたいとき: CHROME="C:\\path\\to\\chrome.exe" node tools/verify.mjs
import { spawn } from 'node:child_process'
import http from 'node:http'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 8799)
const BASE = `http://127.0.0.1:${PORT}`
const sleep = ms => new Promise(r => setTimeout(r, ms))
const up = () => new Promise(res => { const r = http.get(BASE + '/', x => { x.resume(); res(true) }); r.on('error', () => res(false)); r.setTimeout(500, () => { r.destroy(); res(false) }) })

const run = (args) => spawn(process.execPath, args, { stdio: 'inherit' })

async function main() {
  const alreadyUp = await up()
  let serve = null
  if (!alreadyUp) {
    serve = spawn(process.execPath, [join(HERE, 'serve.mjs'), String(PORT)], { stdio: 'ignore' })
    for (let i = 0; i < 40 && !(await up()); i++) await sleep(150)
    if (!(await up())) { console.error('サーバ起動に失敗'); serve.kill(); process.exit(2) }
  } else {
    console.log(`（既存サーバ ${BASE} を利用）`)
  }
  const check = run([join(HERE, 'check.mjs')])
  const code = await new Promise(res => check.on('exit', res))
  if (serve) serve.kill()
  process.exit(code ?? 2)
}
main().catch(e => { console.error(e); process.exit(2) })
