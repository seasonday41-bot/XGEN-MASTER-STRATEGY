import '@fontsource-variable/noto-sans-thai'
import './style.css'
import { analyzePercentCore } from './formula.js'
import { formatCopyText } from './copy.js'
import { loadLatestResult, loadMarkets } from './supabase.js'

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
        <p class="eyebrow"><i></i> FG HISTORY CORE</p>
        <h1>Xgen <em>ELITE</em></h1>
        <p class="subtitle">MOD10 F/G • Historical Match • Digit Frequency</p>
      </div>
      <div class="hero-seal">
        <span><i></i> LIVE</span>
        <strong data-market-total>—</strong>
        <small>ตลาด</small>
      </div>
      <div class="hero-footer">
        <span>◆ FG HISTORY WIN6</span>
        <span>F + G MUST MATCH</span>
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
          <input id="marketSearch" type="search" inputmode="search" autocomplete="off"
            placeholder="พิมพ์ชื่อตลาด เช่น ลาวพัฒนา" aria-controls="searchResults" aria-expanded="false" disabled>
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
          <button id="refresh" class="icon-button" type="button" aria-label="คำนวณใหม่" title="คำนวณใหม่">↻</button>
        </div>
      </div>
      <div id="status" class="status loading"><span></span>กำลังเชื่อมต่อข้อมูลย้อนหลัง</div>
    </section>

    <section id="emptyState" class="empty-card">
      <div class="radar" aria-hidden="true"><span></span></div>
      <strong>พร้อมเปิด FG HISTORY CORE</strong>
      <p>เลือกตลาดเพื่อหา F/G จากผลล่าสุด แล้วคัดงวดย้อนหลังที่มี F และ G ครบทั้งคู่</p>
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
          <div class="card-label"><span>⚡</span><div><b>รูด FG</b><small>(บน 2 ตัว + ล่าง 2 ตัว) MOD10</small></div></div>
          <div id="fgDigits" class="rud-numbers"></div>
        </article>

        <article class="result-card win-card">
          <div class="card-label"><span>✦</span><div><b>WIN6 + สำรอง</b><small>FG LOCK • MATCH FREQUENCY</small></div></div>
          <div id="win6" class="digit-row"></div>
          <p id="seventh" class="note"></p>
        </article>
      </div>

      <article class="result-card double-card">
        <div class="double-analysis">
          <div class="card-label"><span>📚</span><div><b>ชุดย้อนหลังที่ผ่าน FG</b><small>ต้องมี F และ G พร้อมกัน</small></div></div>
          <strong id="matchCount">—</strong>
          <p id="matchPreview">—</p>
        </div>
        <div class="double-picks">
          <small>รองสถิติ</small>
          <div id="secondary" class="double-numbers"></div>
        </div>
      </article>

      <article class="result-card pin-card">
        <div class="pin-header">
          <div>
            <div class="card-label"><span>◎</span><div><b>เจาะ 2</b><small>FG + WIN6</small></div></div>
            <p>เรียงจากจำนวนงวดที่คู่เลขอยู่ร่วมกันในชุด FG ที่ผ่าน</p>
          </div>
          <button id="copy" class="copy-button" type="button" aria-label="คัดลอกผล FG HISTORY CORE">คัดลอกชุด</button>
        </div>
        <div id="pin2" class="pair-row"></div>
      </article>

      <article class="result-card pin-card">
        <div class="pin-header">
          <div>
            <div class="card-label"><span>🎯</span><div><b>เจาะ 3 ปกติ</b><small>เลขไม่ซ้ำ • TOP 3 + EXTRA 2</small></div></div>
            <p>คัดจาก FG + WIN6 + สำรอง โดยไม่สร้างเลขซ้ำในชุด 3 ตัว</p>
          </div>
        </div>
        <div id="pin3" class="pair-row"></div>
        <div id="pin3Extra" class="pair-row"></div>
      </article>

      <article class="result-card double-card">
        <div class="double-analysis">
          <div class="card-label"><span>↻</span><div><b>Pattern จากชุด FG ที่ผ่าน</b><small>HISTORY EVIDENCE</small></div></div>
          <strong id="doublePattern">—</strong>
          <p id="triplePattern">—</p>
        </div>
        <div class="double-picks">
          <small>พี่น้อง</small>
          <div id="siblings" class="double-numbers"></div>
        </div>
      </article>

      <p class="note">F=(หลักสิบ+หลักหน่วยของ 3 บน) mod10 • G=(2 ล่างบวกกัน) mod10 • ใช้เฉพาะงวดย้อนหลังที่มี F และ G อยู่พร้อมกัน แล้วนับความถี่เลข 0–9 เพื่อจัด WIN6</p>
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
  fgDigits: document.querySelector('#fgDigits'),
  win6: document.querySelector('#win6'),
  seventh: document.querySelector('#seventh'),
  matchCount: document.querySelector('#matchCount'),
  matchPreview: document.querySelector('#matchPreview'),
  secondary: document.querySelector('#secondary'),
  pin2: document.querySelector('#pin2'),
  pin3: document.querySelector('#pin3'),
  pin3Extra: document.querySelector('#pin3Extra'),
  doublePattern: document.querySelector('#doublePattern'),
  triplePattern: document.querySelector('#triplePattern'),
  siblings: document.querySelector('#siblings'),
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

function pairItems(items, valueKey, meta) {
  return (items || []).map((item, index) => `
    <div class="pair ${index === 0 ? 'primary' : ''}">
      <i>${String(index + 1).padStart(2, '0')}</i>
      <b>${item[valueKey]}</b>
      <small>${meta(item)}</small>
    </div>
  `).join('')
}

function renderResult(marketName, analysis) {
  current = { marketName, ...analysis }
  els.marketName.textContent = marketName
  els.sourceTop.textContent = analysis.source.top3
  els.sourceBottom.textContent = analysis.source.bottom2

  els.fgDigits.innerHTML = `
    <div class="rud-item main"><i aria-hidden="true"></i><b>${analysis.fg.join(' • ')}</b><small>⚡ F • G</small></div>
  `

  els.win6.innerHTML = analysis.win6.map((digit) => `
    <span class="digit ${analysis.strong.includes(digit) ? 'locked' : ''}">${digit}</span>
  `).join('')
  els.seventh.textContent = `สำรอง: ${analysis.seventh ?? '—'}`

  els.matchCount.textContent = `${analysis.matchCount} งวด`
  els.matchPreview.textContent = analysis.matchedHistory
    .slice(0, 4)
    .map((row) => `${row.top3}-${row.bottom2}`)
    .join(' • ')
  els.secondary.innerHTML = analysis.secondary.length
    ? analysis.secondary.map((digit) => `<b>${digit}</b>`).join('')
    : '<b>—</b>'

  els.pin2.innerHTML = pairItems(
    analysis.pin2,
    'pair',
    (item) => `ร่วม ${item.formulaHits} งวด • ${item.occurrences} ครั้ง`,
  )

  els.pin3.innerHTML = pairItems(
    analysis.pin3,
    'triple',
    (item) => `ร่วม ${item.formulaHits} งวด`,
  )

  els.pin3Extra.innerHTML = pairItems(
    analysis.pin3Extra,
    'triple',
    (item) => `เสริม • ร่วม ${item.formulaHits} งวด`,
  )

  els.doublePattern.textContent = `🔄 เบิ้ล ${analysis.patterns.doubles.length ? analysis.patterns.doubles.join(' • ') : 'ไม่มี'}`
  els.triplePattern.textContent = `👑 ตอง ${analysis.patterns.triples.length ? analysis.patterns.triples.join(' • ') : 'ไม่มี'}`
  els.siblings.innerHTML = analysis.patterns.siblings.length
    ? analysis.patterns.siblings.map((pair) => `<b>${pair}</b>`).join('')
    : '<b>ไม่มี</b>'

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
  setStatus('กำลังหา FG และคัดสถิติย้อนหลัง...', 'loading')

  try {
    const source = await loadLatestResult(marketKey)
    const analysis = analyzePercentCore(source)
    renderResult(selected?.market_name || marketKey, analysis)
    setStatus(`พร้อม • ผลล่าสุด ${formatThaiDate(source.draw_date)} • พบชุด FG ${analysis.matchCount} งวด`, 'ready')
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
    const preferred = markets.find((item) => item.market_name === 'ลาวพัฒนา') || markets[0]
    if (preferred) els.market.value = preferred.market_key
    els.marketSearch.disabled = false
    els.market.disabled = false
    setStatus(`พร้อมใช้งาน • ${markets.length} ตลาด • FG HISTORY CORE`, 'ready')
    if (preferred) await calculate()
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
