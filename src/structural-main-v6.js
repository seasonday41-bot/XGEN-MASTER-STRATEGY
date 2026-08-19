import '@fontsource-variable/noto-sans-thai'
import './style.css'
import './structural.css'
import { analyzeStructuralProbabilityV6 } from './structural-probability-v6.js'
import { loadMarkets, loadRecentResults } from './supabase.js'

const app = document.querySelector('#app')

app.innerHTML = `
  <main class="struct-shell">
    <header class="struct-hero">
      <div>
        <p class="struct-kicker">XGEN • STRUCTURAL PATTERN CORE</p>
        <h1>Xgen <em>WIN6 PATTERN</em></h1>
        <p>Frequency 5 งวด • WIN6 • Pattern • Position • Walk-forward</p>
      </div>
      <span class="struct-badge">NO RANDOM</span>
    </header>

    <section class="struct-control">
      <div class="struct-control-row">
        <label for="marketSearch">ค้นหาตลาด</label>
        <input id="marketSearch" type="search" placeholder="เช่น ฮั่งเส็งบ่าย" autocomplete="off" />
      </div>
      <div class="struct-control-row inline">
        <select id="market"><option value="">กำลังโหลดตลาด...</option></select>
        <button id="refresh" type="button">คำนวณใหม่</button>
      </div>
      <div id="status" class="struct-status">กำลังเชื่อมต่อข้อมูล...</div>
    </section>

    <section id="result" class="struct-result hidden" aria-live="polite">
      <article class="struct-source">
        <div><small>ตลาด</small><h2 id="marketName">—</h2></div>
        <div><small>ผลล่าสุด</small><strong><span id="sourceTop">—</span>-<span id="sourceBottom">—</span></strong></div>
        <div><small>ข้อมูล</small><strong><span id="sampleSize">—</span> งวด</strong></div>
      </article>

      <article class="struct-card pattern-card">
        <div class="struct-card-head"><small>🚨 Pattern งวดถัดไป</small><span id="patternForecast">—</span></div>
        <div id="patternSignals" class="pattern-signal-grid"></div>
        <div id="patternEvidence" class="pattern-evidence"></div>
      </article>

      <article class="struct-card accent">
        <small>🔥 ตัวเด่น / รูด</small>
        <div id="rud" class="struct-big-digits"></div>
      </article>

      <article class="struct-card accent">
        <div class="struct-card-head"><small>✨ WIN6 ฐานคัดเจาะ</small><span>ชุดจาก Ranking เดิม</span></div>
        <div id="win6" class="struct-big-digits"></div>
      </article>

      <article class="struct-card">
        <div class="struct-card-head"><small>🎯 เจาะ 2 บน</small><span>คัดจาก WIN6 • Position</span></div>
        <div id="pin2Top" class="struct-picks"></div>
      </article>

      <article class="struct-card">
        <div class="struct-card-head"><small>🎯 เจาะ 2 ล่าง</small><span>คัดจาก WIN6 • Position</span></div>
        <div id="pin2Bottom" class="struct-picks"></div>
      </article>

      <article class="struct-card pattern-card">
        <div class="struct-card-head"><small>👯 เบิ้ล 2 ตัว</small><span>จากตัวเด่น / รูด</span></div>
        <div id="pin2Double" class="struct-picks"></div>
      </article>

      <article class="struct-card pattern-card">
        <div class="struct-card-head"><small id="pin3Title">🔮 เจาะ 3 ตาม Pattern</small><span id="pin3PatternMeta">—</span></div>
        <div id="pin3Pattern" class="struct-picks triples"></div>
        <div class="pattern-evidence"><span>สร้างเฉพาะจากเลขใน <b>WIN6</b> แล้วคัดรูปทรงตาม Pattern</span></div>
      </article>

      <div class="struct-grid two">
        <article class="struct-card">
          <small>🔍 Structural Evidence</small>
          <div id="evidence" class="struct-evidence"></div>
        </article>
        <article class="struct-card">
          <small>📈 Walk-forward</small>
          <div id="backtest" class="struct-backtest"></div>
        </article>
      </div>

      <button id="copy" class="struct-copy" type="button">คัดลอกชุด</button>
      <p class="struct-note">WIN6 เป็นฐานเดียวของชุดเจาะ • เจาะ 3 ใช้ Pattern ที่ระบบจัดอันดับได้ • เจาะ 2 ใช้ WIN6 ร่วมกับคะแนนตำแหน่ง • Frequency ใช้เฉพาะ 5 งวดล่าสุด</p>
    </section>
  </main>
`

const els = Object.fromEntries([
  'marketSearch', 'market', 'refresh', 'status', 'result', 'marketName', 'sourceTop', 'sourceBottom', 'sampleSize',
  'patternForecast', 'patternSignals', 'patternEvidence', 'rud', 'win6', 'pin2Top', 'pin2Bottom', 'pin2Double',
  'pin3Title', 'pin3PatternMeta', 'pin3Pattern', 'evidence', 'backtest', 'copy',
].map((id) => [id, document.querySelector(`#${id}`)]))

const PATTERN_LABELS = {
  DOUBLE: 'เบิ้ล',
  HAM: 'หาม',
  TRIPLE: 'ตอง',
  SIBLING: 'พี่น้อง',
  NORMAL: 'ปกติ',
}

let markets = []
let current = null

function setStatus(text, type = 'ready') {
  els.status.textContent = text
  els.status.dataset.type = type
}

function renderMarketOptions(query = '') {
  const normalized = query.trim().toLocaleLowerCase('th-TH')
  const selected = els.market.value
  const filtered = normalized
    ? markets.filter((item) => item.market_name.toLocaleLowerCase('th-TH').includes(normalized))
    : markets

  els.market.innerHTML = '<option value="">เลือกตลาด...</option>' + filtered
    .map((item) => `<option value="${item.market_key}">${item.market_name}</option>`)
    .join('')
  if (filtered.some((item) => item.market_key === selected)) els.market.value = selected
}

function renderDigits(target, digits) {
  target.innerHTML = digits.map((digit) => `<b class="hot">${digit}</b>`).join('')
}

function renderPicks(target, items, key) {
  target.innerHTML = items.map((item, index) => `
    <span class="struct-pick ${index === 0 ? 'primary' : ''}">
      <b>${item[key]}</b><small>${item.score}</small>
    </span>
  `).join('')
}

function twoDigitDoubles(analysis) {
  const scores = new Map(analysis.rankings.fusion.map((item) => [item.digit, item.score]))
  return analysis.rud.map((digit) => ({ pair: `${digit}${digit}`, score: scores.get(digit) ?? 0 }))
}

function renderPatterns(analysis) {
  const selected = analysis.pickPattern
  const label = PATTERN_LABELS[selected.type] || selected.type
  els.patternForecast.textContent = `${label} • ${selected.score ?? 0}% • ${selected.status || '—'}`
  els.patternSignals.innerHTML = analysis.patternSignals.map((signal) => `
    <div class="pattern-signal" data-status="${signal.status}">
      <span>${PATTERN_LABELS[signal.type] || signal.type}</span>
      <strong>${signal.score}%</strong>
      <b>${signal.status}</b>
      <small>ฐาน ${signal.baselineRate}% • Transition ${signal.transitionRate ?? '—'}% • Mirror ${signal.mirrorRate ?? '—'}%</small>
    </div>
  `).join('')
  els.patternEvidence.innerHTML = `<span>Pattern ที่ใช้คัดเจาะ 3: <b>${label}</b> • ${selected.source === 'FORECAST' ? 'Forecast' : 'อันดับสัญญาณ'}</span>`
  els.pin3Title.textContent = `🔮 เจาะ 3 • ${label}`
  els.pin3PatternMeta.textContent = `${selected.score ?? 0}% • จาก WIN6`
}

function renderEvidence(analysis) {
  const p = analysis.currentPattern
  els.evidence.innerHTML = `
    <p><b>คู่/คี่บน</b><span>${p.topParity}</span></p>
    <p><b>สูง/ต่ำบน</b><span>${p.topHighLow}</span></p>
    <p><b>คู่/คี่ล่าง</b><span>${p.bottomParity}</span></p>
    <p><b>สูง/ต่ำล่าง</b><span>${p.bottomHighLow}</span></p>
    <p><b>Transition</b><span>${analysis.transition.samples} sample</span></p>
    <p><b>Mirror</b><span>${analysis.mirror.samples} sample</span></p>
  `
}

function metric(label, value, samples) {
  return `<p><b>${label}</b><span>${value ?? 0}% • ${samples} งวด</span></p>`
}

function renderBacktest(backtest) {
  if (!backtest?.samples) {
    els.backtest.innerHTML = '<p><b>สถานะ</b><span>ข้อมูลยังไม่พอ</span></p>'
    return
  }
  const m = backtest.metrics
  els.backtest.innerHTML = [
    metric('WIN6 ครบ 3 บน', m.win6TopFull, backtest.samples),
    metric('WIN6 ครบ 2 ล่าง', m.win6BottomFull, backtest.samples),
    metric('เจาะ 2 บน', m.pin2TopPair, backtest.samples),
    metric('เจาะ 2 ล่าง', m.pin2BottomPair, backtest.samples),
    metric('เจาะ 3 ตาม Pattern', m.pin3PatternPermutation, backtest.samples),
    metric('Pattern ตรงรูปทรง', m.patternTypeHit, backtest.samples),
  ].join('')
}

function renderResult(marketName, analysis) {
  current = { marketName, ...analysis }
  els.marketName.textContent = marketName
  els.sourceTop.textContent = analysis.source.top3
  els.sourceBottom.textContent = analysis.source.bottom2
  els.sampleSize.textContent = analysis.sampleSize
  renderPatterns(analysis)
  renderDigits(els.rud, analysis.rud)
  renderDigits(els.win6, analysis.win6)
  renderPicks(els.pin2Top, analysis.pin2Top, 'pair')
  renderPicks(els.pin2Bottom, analysis.pin2Bottom, 'pair')
  renderPicks(els.pin2Double, twoDigitDoubles(analysis), 'pair')
  renderPicks(els.pin3Pattern, analysis.pin3Pattern, 'triple')
  renderEvidence(analysis)
  renderBacktest(analysis.backtest)
  els.result.classList.remove('hidden')
}

async function calculate() {
  const marketKey = els.market.value
  if (!marketKey) return
  const selected = markets.find((item) => item.market_key === marketKey)
  els.market.disabled = true
  els.refresh.disabled = true
  setStatus('กำลังคำนวณ WIN6 และคัดเจาะตาม Pattern...', 'loading')

  try {
    const history = await loadRecentResults(marketKey, 30)
    const analysis = analyzeStructuralProbabilityV6(history, { includeBacktest: true, maxBacktest: 10 })
    renderResult(selected?.market_name || marketKey, analysis)
    setStatus(`พร้อม • WIN6 + Pattern • Frequency ${analysis.frequencyWindow} งวด • v6.0`, 'ready')
  } catch (error) {
    console.error(error)
    setStatus(error.message || 'คำนวณไม่สำเร็จ', 'error')
  } finally {
    els.market.disabled = false
    els.refresh.disabled = false
  }
}

function copyText() {
  if (!current) return ''
  const pattern = PATTERN_LABELS[current.pickPattern.type] || current.pickPattern.type
  return [
    `📊 Xgen | ${current.marketName}`,
    `${current.source.top3}-${current.source.bottom2}`,
    '',
    `🔥 ตัวเด่น / รูด: ${current.rud.join(' • ')}`,
    `✨ WIN6: ${current.win6.join(' • ')}`,
    `🚨 Pattern: ${pattern} ${current.pickPattern.score ?? 0}% • ${current.pickPattern.status || '—'}`,
    '',
    `🎯 เจาะ 2 บน: ${current.pin2Top.map((item) => item.pair).join(' • ')}`,
    `🎯 เจาะ 2 ล่าง: ${current.pin2Bottom.map((item) => item.pair).join(' • ')}`,
    `👯 เบิ้ล 2 ตัว: ${current.rud.map((digit) => `${digit}${digit}`).join(' • ')}`,
    `🔮 เจาะ 3 ${pattern}: ${current.pin3Pattern.map((item) => item.triple).join(' • ')}`,
  ].join('\n')
}

async function initialize() {
  try {
    markets = await loadMarkets()
    renderMarketOptions()
    const preferred = markets.find((item) => item.market_name === 'ฮั่งเส็งบ่าย')
      || markets.find((item) => item.market_name === 'ลาว Extra')
      || markets[0]
    if (preferred) {
      els.market.value = preferred.market_key
      await calculate()
    }
    setStatus(`พร้อมใช้งาน • ${markets.length} ตลาด`, 'ready')
  } catch (error) {
    console.error(error)
    setStatus(error.message || 'เชื่อมต่อข้อมูลไม่สำเร็จ', 'error')
  }
}

els.marketSearch.addEventListener('input', (event) => renderMarketOptions(event.target.value))
els.market.addEventListener('change', calculate)
els.refresh.addEventListener('click', calculate)
els.copy.addEventListener('click', async () => {
  const text = copyText()
  if (!text) return
  await navigator.clipboard.writeText(text)
  const original = els.copy.textContent
  els.copy.textContent = 'คัดลอกแล้ว ✓'
  setTimeout(() => { els.copy.textContent = original }, 1200)
})

initialize()
