import '@fontsource-variable/noto-sans-thai'
import './style.css'
import { analyzeHistory } from './formula.js'
import { formatCopyText } from './copy.js'
import { loadMarkets, loadRecentResults } from './supabase.js'

const app = document.querySelector('#app')

app.innerHTML = `
  <main class="shell">
    <div class="ambient-lights" aria-hidden="true">
      <i></i><i></i><i></i><i></i><i></i>
    </div>
    <header class="hero">
      <div class="hero-rings" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="brand-mark" aria-hidden="true"><b>X</b><small>GEN</small></div>
      <div class="hero-copy">
        <p class="eyebrow"><i></i> PREMIUM LUCK ENGINE</p>
        <h1>Xgen <em>ELITE</em></h1>
        <p class="subtitle">วิน 6 • รูด • เจาะ 2 คัดย้อนหลังจริง</p>
      </div>
      <div class="hero-seal">
        <span><i></i> LIVE</span>
        <strong data-market-total>—</strong>
        <small>ตลาด</small>
      </div>
      <div class="hero-footer">
        <span>◆ XGEN ELITE ANALYTICS</span>
        <span>REAL DATA • SUPABASE</span>
      </div>
    </header>

    <section id="controlCard" class="control-card">
      <button id="marketToggle" class="control-heading" type="button" aria-expanded="true" aria-controls="marketPicker">
        <div class="control-symbol" aria-hidden="true">⌕</div>
        <div><p>MARKET SELECTOR</p><h2 id="pickerTitle">ค้นหาและเลือกตลาด</h2></div>
        <span class="heading-meta">
          <span class="market-count"><b data-market-total>—</b><span> ตลาดพร้อมใช้</span></span>
          <i class="collapse-chevron" aria-hidden="true"></i>
        </span>
      </button>
      <div id="marketPicker" class="market-picker">
        <label class="sr-only" for="marketSearch">ค้นหาตลาด</label>
        <div class="search-field">
          <span aria-hidden="true">⌕</span>
          <input id="marketSearch" type="search" inputmode="search" autocomplete="off" placeholder="พิมพ์ชื่อตลาด เช่น ลาวพัฒนา" aria-controls="searchResults" aria-expanded="false" disabled>
          <button id="clearSearch" class="clear-search" type="button" aria-label="ล้างคำค้นหา" hidden>×</button>
        </div>
        <div id="searchResults" class="search-results hidden" role="listbox" aria-label="ผลการค้นหาตลาด"></div>
        <div class="select-label"><span>หรือเลือกจากทั้งหมด</span></div>
        <div class="select-row">
          <div class="select-wrap">
            <select id="market" aria-label="เลือกตลาด" disabled>
              <option>กำลังโหลดตลาด...</option>
            </select>
          </div>
          <button id="refresh" class="icon-button" type="button" aria-label="โหลดข้อมูลใหม่" title="โหลดข้อมูลใหม่">↻</button>
        </div>
      </div>
      <div id="status" class="status loading"><span></span>กำลังเชื่อมต่อ six-digit-thai-lao</div>
    </section>

    <section id="emptyState" class="empty-card">
      <div class="radar" aria-hidden="true"><span></span></div>
      <strong>พร้อมเปิดชุดวิเคราะห์</strong>
      <p>เลือกตลาดเพื่อคำนวณจากผลจริง 4 งวดล่าสุด</p>
    </section>

    <section id="result" class="result hidden" aria-live="polite">
      <div class="source-head">
        <div class="market-identity">
          <span aria-hidden="true">◆</span>
          <div><p class="section-kicker">สนามวิเคราะห์</p><h2 id="marketName">—</h2></div>
        </div>
        <div class="source-result">
          <small>ผลล่าสุด</small>
          <div class="source-number"><span id="sourceTop">—</span><b>–</b><span id="sourceBottom">—</span></div>
        </div>
      </div>

      <div class="result-grid">
        <article class="result-card rud-card">
          <div class="card-label"><span>⚡</span><div><b>รูดหลัก / รอง</b><small>RUD POWER</small></div></div>
          <div id="rud" class="rud-numbers"></div>
        </article>
        <article class="result-card win-card">
          <div class="card-label"><span>✦</span><div><b>วิน 6 ตัว</b><small>WIN6 GEMS</small></div></div>
          <div id="win6" class="digit-row"></div>
        </article>
      </div>

      <article class="result-card double-card">
        <div class="double-analysis">
          <div class="card-label"><span>↻</span><div><b>วิเคราะห์เบิ้ล / หาม</b><small>DOUBLE PATTERN</small></div></div>
          <strong id="doublePattern">—</strong>
          <p id="doubleMessage">—</p>
        </div>
        <div class="double-picks">
          <small>เลขเบิ้ลจากสูตร</small>
          <div id="doubleNumbers" class="double-numbers"></div>
        </div>
      </article>

      <article class="strong-card">
        <div class="strong-orbits" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="strong-copy">
          <p class="section-kicker">◆ MASTER LUCKY PICK</p>
          <h3>ตัวแรงจากเจาะ 2</h3>
          <p>เลขที่มีแรงสนับสนุนซ้ำมากที่สุดใน 5 คู่คัด</p>
        </div>
        <div class="strong-medallion">
          <span>MASTER</span>
          <b id="strongDigit">—</b>
          <small id="strongSupport">—</small>
        </div>
      </article>

      <article class="result-card pin-card">
        <div class="pin-header">
          <div>
            <div class="card-label"><span>◎</span><div><b>เจาะ 2 ชุดคัดพิเศษ</b><small>PIN-2 SELECTION • 5 ชุด</small></div></div>
            <p>เรียงชุดเด่นจากคะแนนคัดของระบบ</p>
          </div>
          <button id="copy" class="copy-button" type="button" aria-label="คัดลอกรูด วิน 6 เลขเบิ้ล เจาะ 2 และตัวแรง">คัดลอกชุด</button>
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
  marketTotals: document.querySelectorAll('[data-market-total]'),
  controlCard: document.querySelector('#controlCard'),
  marketToggle: document.querySelector('#marketToggle'),
  pickerTitle: document.querySelector('#pickerTitle'),
  marketSearch: document.querySelector('#marketSearch'),
  clearSearch: document.querySelector('#clearSearch'),
  searchResults: document.querySelector('#searchResults'),
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
  doublePattern: document.querySelector('#doublePattern'),
  doubleMessage: document.querySelector('#doubleMessage'),
  doubleNumbers: document.querySelector('#doubleNumbers'),
  strongDigit: document.querySelector('#strongDigit'),
  strongSupport: document.querySelector('#strongSupport'),
  pin2: document.querySelector('#pin2'),
  history: document.querySelector('#history'),
  historyToggle: document.querySelector('#historyToggle'),
  copy: document.querySelector('#copy'),
}

let markets = []
let current = null
let matchedMarkets = []

function setPickerExpanded(expanded) {
  els.controlCard.classList.toggle('is-collapsed', !expanded)
  els.marketToggle.setAttribute('aria-expanded', String(expanded))
  els.pickerTitle.textContent = expanded
    ? 'ค้นหาและเลือกตลาด'
    : (current?.marketName || els.market.selectedOptions[0]?.textContent || 'เลือกตลาด')
  if (!expanded) closeSearchResults()
}

function normalizeMarketName(value) {
  return value.normalize('NFC').toLocaleLowerCase('th-TH').replace(/\s+/g, '')
}

function closeSearchResults() {
  els.searchResults.classList.add('hidden')
  els.marketSearch.setAttribute('aria-expanded', 'false')
}

function renderSearchResults(query) {
  const normalizedQuery = normalizeMarketName(query.trim())
  els.clearSearch.hidden = normalizedQuery.length === 0

  if (!normalizedQuery) {
    matchedMarkets = []
    closeSearchResults()
    return
  }

  matchedMarkets = markets
    .filter((item) => normalizeMarketName(item.market_name).includes(normalizedQuery))
    .slice(0, 10)

  els.searchResults.replaceChildren()

  if (!matchedMarkets.length) {
    const empty = document.createElement('p')
    empty.className = 'search-empty'
    empty.textContent = 'ไม่พบตลาดที่ค้นหา'
    els.searchResults.append(empty)
  } else {
    matchedMarkets.forEach((item) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'search-result'
      button.dataset.marketKey = item.market_key
      button.setAttribute('role', 'option')

      const name = document.createElement('span')
      name.textContent = item.market_name
      const action = document.createElement('small')
      action.textContent = 'เลือก ›'
      button.append(name, action)
      els.searchResults.append(button)
    })
  }

  els.searchResults.classList.remove('hidden')
  els.marketSearch.setAttribute('aria-expanded', 'true')
}

function selectSearchedMarket(marketKey) {
  if (!markets.some((item) => item.market_key === marketKey)) return
  els.market.value = marketKey
  els.marketSearch.value = ''
  els.clearSearch.hidden = true
  closeSearchResults()
  calculate()
}

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
    <div class="rud-item ${index === 0 ? 'main' : 'secondary'}"><i aria-hidden="true"></i><b>${digit}</b><small>${index === 0 ? 'รูดหลัก' : 'รูดรอง'}</small></div>
  `).join('')
  els.win6.innerHTML = analysis.win6.map((digit) => `
    <span class="digit ${analysis.rud.includes(digit) ? 'locked' : ''}">${digit}</span>
  `).join('')
  els.doublePattern.textContent = analysis.doubleAnalysis.pattern
  els.doubleMessage.textContent = analysis.doubleAnalysis.message
  els.doubleNumbers.innerHTML = analysis.doubleAnalysis.doubles
    .map((number) => `<b>${number}</b>`)
    .join('')
  els.strongDigit.textContent = analysis.strongDigit.digit
  els.strongSupport.textContent = `อยู่ใน ${analysis.strongDigit.appearances}/5 คู่`
  els.pin2.innerHTML = analysis.pin2.map((item, index) => `
    <div class="pair ${index === 0 ? 'primary' : ''}">
      <i>${String(index + 1).padStart(2, '0')}</i><b>${item.pair}</b><small>คะแนน ${item.score}</small>
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
  els.result.classList.remove('result-reveal')
  void els.result.offsetWidth
  els.result.classList.add('result-reveal')
  setPickerExpanded(false)
}

async function calculate() {
  const marketKey = els.market.value
  if (!marketKey) return
  const selected = markets.find((item) => item.market_key === marketKey)
  els.market.disabled = true
  els.refresh.disabled = true
  setStatus('กำลังวิเคราะห์ข้อมูลย้อนหลัง...', 'loading')
  try {
    const history = await loadRecentResults(marketKey, 30)
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
    els.marketTotals.forEach((element) => { element.textContent = markets.length })
    const lao = markets.find((item) => item.market_name === 'ลาวพัฒนา')
    if (lao) els.market.value = lao.market_key
    els.marketSearch.disabled = false
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
els.marketToggle.addEventListener('click', () => {
  setPickerExpanded(els.marketToggle.getAttribute('aria-expanded') !== 'true')
})
els.marketSearch.addEventListener('input', (event) => renderSearchResults(event.target.value))
els.marketSearch.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && matchedMarkets[0]) {
    event.preventDefault()
    selectSearchedMarket(matchedMarkets[0].market_key)
  }
  if (event.key === 'Escape') closeSearchResults()
})
els.searchResults.addEventListener('click', (event) => {
  const button = event.target.closest('[data-market-key]')
  if (button) selectSearchedMarket(button.dataset.marketKey)
})
els.clearSearch.addEventListener('click', () => {
  els.marketSearch.value = ''
  els.marketSearch.focus()
  renderSearchResults('')
})
document.addEventListener('click', (event) => {
  if (!event.target.closest('.control-card')) closeSearchResults()
})
els.historyToggle.addEventListener('click', () => {
  const opened = els.historyToggle.getAttribute('aria-expanded') === 'true'
  els.historyToggle.setAttribute('aria-expanded', String(!opened))
  els.history.classList.toggle('hidden', opened)
  els.historyToggle.querySelector('b').textContent = opened ? 'ดู 4 งวด⌄' : 'ซ่อน⌃'
})
els.copy.addEventListener('click', async () => {
  if (!current) return
  const text = formatCopyText(current)
  try {
    await navigator.clipboard.writeText(text)
    els.copy.textContent = 'คัดลอกแล้ว ✓'
    navigator.vibrate?.(25)
    window.setTimeout(() => { els.copy.textContent = 'คัดลอกชุด' }, 1600)
  } catch {
    window.prompt('คัดลอกข้อความนี้', text)
  }
})

initialize()
