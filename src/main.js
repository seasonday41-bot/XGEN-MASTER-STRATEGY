import '@fontsource-variable/noto-sans-thai'
import './style.css'
import { analyzeHistory } from './formula.js'
import { loadMarkets, loadRecentResults } from './supabase.js'

const app = document.querySelector('#app')

app.innerHTML = `
  <main class="shell">
    <header class="hero">
      <div class="brand-mark" aria-hidden="true">X</div>
      <div>
        <p class="eyebrow">RECENT-4 PAIR ENGINE</p>
        <h1>Xgen</h1>
        <p class="subtitle">วิน 6 • รูด • เจาะ 2 คัดย้อนหลังจริง</p>
      </div>
      <span class="live-pill"><i></i> LIVE DATA</span>
    </header>

    <section class="control-card">
      <label for="market">เลือกตลาด</label>
      <div class="select-row">
        <select id="market" aria-label="เลือกตลาด" disabled>
          <option>กำลังโหลดตลาด...</option>
        </select>
        <button id="refresh" class="icon-button" type="button" aria-label="โหลดข้อมูลใหม่" title="โหลดข้อมูลใหม่">↻</button>
      </div>
      <div id="status" class="status loading"><span></span>กำลังเชื่อมต่อ six-digit-thai-lao</div>
    </section>

    <section id="emptyState" class="empty-card">
      <div class="radar" aria-hidden="true"><span></span></div>
      <p>เลือกตลาดเพื่อคำนวณจากผลจริง 4 งวดล่าสุด</p>
    </section>

    <section id="result" class="result hidden" aria-live="polite">
      <div class="source-head">
        <div>
          <p class="section-kicker">แหล่งคำนวณ</p>
          <h2 id="marketName">—</h2>
        </div>
        <div class="source-number"><span id="sourceTop">—</span><b>–</b><span id="sourceBottom">—</span></div>
      </div>

      <div class="result-grid">
        <article class="result-card rud-card">
          <div class="card-label"><span>⚡</span> รูดหลัก / รอง</div>
          <div id="rud" class="rud-numbers"></div>
        </article>
        <article class="result-card win-card">
          <div class="card-label"><span>✦</span> วิน 6 ตัว</div>
          <div id="win6" class="digit-row"></div>
        </article>
      </div>

      <article class="result-card pin-card">
        <div class="pin-header">
          <div>
            <div class="card-label"><span>◎</span> เจาะ 2 คัดย้อนหลัง 4 งวด</div>
            <p>คัด 5 คู่คะแนนต่ำจากคู่ทั้งหมดในวิน 6</p>
          </div>
          <button id="copy" class="copy-button" type="button">คัดลอก</button>
        </div>
        <div id="pin2" class="pair-row"></div>
      </article>

      <article class="history-card">
        <button id="historyToggle" class="history-toggle" type="button" aria-expanded="false">
          <span>ผลย้อนหลังที่ใช้คัด</span><b>ดู 4 งวด⌄</b>
        </button>
        <div id="history" class="history-list hidden"></div>
      </article>

      <p class="note">เลขสลับตำแหน่งถือเป็นคู่เดียวกัน • ใช้ข้อมูลจริงเพื่อทดสอบสถิติ ไม่รับประกันผล</p>
    </section>
  </main>
`

const els = {
  market: document.querySelector('#market'),
  refresh: document.querySelector('#refresh'),
  status: document.querySelector('#status'),
  empty: document.querySelector('#emptyState'),
  result: document.querySelector('#result'),
  marketName: document.querySelector('#marketName'),
  sourceTop: document.querySelector('#sourceTop'),
  sourceBottom: document.querySelector('#sourceBottom'),
  rud: document.querySelector('#rud'),
  win6: document.querySelector('#win6'),
  pin2: document.querySelector('#pin2'),
  history: document.querySelector('#history'),
  historyToggle: document.querySelector('#historyToggle'),
  copy: document.querySelector('#copy'),
}

let markets = []
let current = null

function setStatus(message, type = 'ready') {
  els.status.className = `status ${type}`
  els.status.innerHTML = `<span></span>${message}`
}

function formatThaiDate(dateString) {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  }).format(new Date(`${dateString}T00:00:00+07:00`))
}

function renderResult(marketName, analysis) {
  current = { marketName, ...analysis }
  els.marketName.textContent = marketName
  els.sourceTop.textContent = analysis.source.top3
  els.sourceBottom.textContent = analysis.source.bottom2
  els.rud.innerHTML = analysis.rud.map((digit, index) => `
    <div class="rud-item"><b>${digit}</b><small>${index === 0 ? 'หลัก' : 'รอง'}</small></div>
  `).join('')
  els.win6.innerHTML = analysis.win6.map((digit, index) => `
    <span class="digit ${index < 2 ? 'locked' : ''}">${digit}</span>
  `).join('')
  els.pin2.innerHTML = analysis.pin2.map((item, index) => `
    <div class="pair ${index === 0 ? 'primary' : ''}">
      <b>${item.pair}</b><small>คะแนน ${item.score}</small>
    </div>
  `).join('')
  els.history.innerHTML = analysis.recent.map((draw, index) => `
    <div class="history-row">
      <span><i>${index + 1}</i>${formatThaiDate(draw.draw_date)}</span>
      <strong>${draw.top3}<b>–</b>${draw.bottom2}</strong>
    </div>
  `).join('')
  els.empty.classList.add('hidden')
  els.result.classList.remove('hidden')
}

async function calculate() {
  const marketKey = els.market.value
  if (!marketKey) return
  const selected = markets.find((item) => item.market_key === marketKey)
  els.market.disabled = true
  els.refresh.disabled = true
  setStatus('กำลังอ่าน 4 งวดล่าสุด...', 'loading')
  try {
    const history = await loadRecentResults(marketKey, 4)
    const analysis = analyzeHistory(history)
    renderResult(selected.market_name, analysis)
    setStatus(`เชื่อมต่อแล้ว • อัปเดตถึง ${formatThaiDate(analysis.source.draw_date)}`, 'ready')
  } catch (error) {
    console.error(error)
    setStatus(error.message || 'โหลดข้อมูลไม่สำเร็จ', 'error')
  } finally {
    els.market.disabled = false
    els.refresh.disabled = false
  }
}

async function initialize() {
  try {
    markets = await loadMarkets()
    if (!markets.length) throw new Error('ไม่พบตลาดที่เปิดอ่านได้')
    const placeholder = document.createElement('option')
    placeholder.value = ''
    placeholder.textContent = 'เลือกตลาด...'
    const options = markets.map((item) => {
      const option = document.createElement('option')
      option.value = item.market_key
      option.textContent = item.market_name
      return option
    })
    els.market.replaceChildren(placeholder, ...options)
    const lao = markets.find((item) => item.market_name === 'ลาวพัฒนา')
    if (lao) els.market.value = lao.market_key
    els.market.disabled = false
    setStatus(`พร้อมใช้งาน • ${markets.length} ตลาด`, 'ready')
    if (lao) await calculate()
  } catch (error) {
    console.error(error)
    els.market.innerHTML = '<option>เชื่อมต่อข้อมูลไม่สำเร็จ</option>'
    setStatus(error.message || 'เชื่อมต่อข้อมูลไม่สำเร็จ', 'error')
  }
}

els.market.addEventListener('change', calculate)
els.refresh.addEventListener('click', calculate)
els.historyToggle.addEventListener('click', () => {
  const opened = els.historyToggle.getAttribute('aria-expanded') === 'true'
  els.historyToggle.setAttribute('aria-expanded', String(!opened))
  els.history.classList.toggle('hidden', opened)
  els.historyToggle.querySelector('b').textContent = opened ? 'ดู 4 งวด⌄' : 'ซ่อน⌃'
})
els.copy.addEventListener('click', async () => {
  if (!current) return
  const text = [
    `Xgen • ${current.marketName}`,
    `ผลตั้งต้น ${current.source.top3}-${current.source.bottom2}`,
    `รูด ${current.rud.join(' • ')}`,
    `วิน 6: ${current.win6.join('')}`,
    `เจาะ 2: ${current.pin2.map((item) => item.pair).join(' • ')}`,
    'คัดจากผลย้อนหลัง 4 งวด • กลับได้',
  ].join('\n')
  try {
    await navigator.clipboard.writeText(text)
    els.copy.textContent = 'คัดลอกแล้ว ✓'
    window.setTimeout(() => { els.copy.textContent = 'คัดลอก' }, 1600)
  } catch {
    window.prompt('คัดลอกข้อความนี้', text)
  }
})

initialize()
