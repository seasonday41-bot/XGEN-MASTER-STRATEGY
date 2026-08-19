import '@fontsource-variable/noto-sans-thai'
import './style.css'
import './structural.css'
import { analyzeStructuralProbabilityV5 } from './structural-probability-v5.js'
import { loadMarkets, loadRecentResults } from './supabase.js'

const app = document.querySelector('#app')

app.innerHTML = `
  <main class="struct-shell">
    <header class="struct-hero">
      <div>
        <p class="struct-kicker">XGEN • MATHEMATICAL & STRUCTURAL PROBABILITY</p>
        <h1>Xgen <em>STRUCTURAL</em></h1>
        <p>Frequency 5 งวด • Position Gate • Matrix Challenger • Walk-forward</p>
      </div>
      <span class="struct-badge">NO RANDOM</span>
    </header>

    <section class="struct-control">
      <div class="struct-control-row">
        <label for="marketSearch">ค้นหาตลาด</label>
        <input id="marketSearch" type="search" placeholder="เช่น ลาว Extra" autocomplete="off" />
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
        <div class="struct-card-head"><small>🚨 วิเคราะห์แพทเทิร์น</small><span id="patternForecast">Forecast: —</span></div>
        <div id="patternSignals" class="pattern-signal-grid"></div>
        <div id="patternEvidence" class="pattern-evidence"></div>
      </article>

      <article class="struct-card accent">
        <small>🔥 ตัวเด่น / รูด</small>
        <div id="rud" class="struct-big-digits"></div>
      </article>

      <article class="struct-card">
        <div class="struct-card-head"><small>🌡️ จังหวะเลขล่าสุด</small><span>Frequency = 5 งวดล่าสุด 100% • งวดเก่าใช้ดูโครงสร้าง</span></div>
        <div id="marketPulse" class="struct-evidence"></div>
      </article>

      <article class="struct-card">
        <div class="struct-card-head"><small>🎯 เจาะ 2 บน</small><span>Champion • ไม่แสดงคู่กลับซ้ำ</span></div>
        <div id="pin2Top" class="struct-picks"></div>
      </article>

      <article class="struct-card">
        <div class="struct-card-head"><small>🎯 เจาะ 2 ล่าง</small><span>Champion • ไม่แสดงคู่กลับซ้ำ</span></div>
        <div id="pin2Bottom" class="struct-picks"></div>
      </article>

      <article class="struct-card pattern-card">
        <div class="struct-card-head"><small>👯 เบิ้ล 2 ตัว</small><span>จากตัวเด่น / รูด 2 ตัว</span></div>
        <div id="pin2Double" class="struct-picks"></div>
      </article>

      <article class="struct-card">
        <div class="struct-card-head"><small>🎯 เจาะ 3 ปกติ</small><span>Champion • 3 หลักไม่ซ้ำ</span></div>
        <div id="pin3Normal" class="struct-picks triples"></div>
      </article>

      <article class="struct-card pattern-card">
        <div class="struct-card-head"><small>👯 เจาะ 3 เบิ้ล</small><span id="doubleSignal">เบิ้ล: —</span></div>
        <div id="pin3Double" class="struct-picks triples"></div>
        <div class="pattern-evidence"><span>เฉพาะโครงสร้าง <b>AAB / ABB</b> • ไม่แสดงชุดกลับซ้ำ</span></div>
      </article>

      <article class="struct-card pattern-card">
        <div class="struct-card-head"><small>🧪 MATRIX Challenger • เจาะ 2</small><span>ทดลองเทียบ • ไม่ Hard Lock</span></div>
        <div class="pattern-evidence"><span><b>บน</b> • Position + Missing + Polarity + Gap</span></div>
        <div id="matrixPin2Top" class="struct-picks"></div>
        <div class="pattern-evidence"><span><b>ล่าง</b> • Position + Missing + Polarity + Gap</span></div>
        <div id="matrixPin2Bottom" class="struct-picks"></div>
        <div id="matrixPairModel" class="pattern-evidence"></div>
      </article>

      <article class="struct-card pattern-card">
        <div class="struct-card-head"><small>🧪 MATRIX Challenger • เจาะ 3</small><span>Position + Shape + Transition + Step</span></div>
        <div class="pattern-evidence"><span><b>ปกติ</b> • 3 ตัวต่างกัน</span></div>
        <div id="matrixPin3Normal" class="struct-picks triples"></div>
        <div class="pattern-evidence"><span><b>หาม</b> • ABA</span></div>
        <div id="matrixPin3Ham" class="struct-picks triples"></div>
        <div class="pattern-evidence"><span><b>เบิ้ล</b> • AAB / ABB</span></div>
        <div id="matrixPin3Double" class="struct-picks triples"></div>
        <div id="matrixTripleModel" class="pattern-evidence"></div>
      </article>

      <div class="struct-grid two">
        <article class="struct-card">
          <small>🔍 Structural Evidence</small>
          <div id="evidence" class="struct-evidence"></div>
        </article>
        <article class="struct-card">
          <small>📈 Walk-forward • Champion vs Matrix</small>
          <div id="backtest" class="struct-backtest"></div>
        </article>
      </div>

      <article class="struct-card rank-card">
        <div class="struct-card-head"><small>คะแนนเลข 0-9</small><span>Frequency 5 งวด + Trend + Structural Evidence</span></div>
        <div id="ranking" class="struct-ranking"></div>
      </article>

      <button id="copy" class="struct-copy" type="button">คัดลอกชุด</button>
      <p class="struct-note">ชุด Copy ยังใช้ Champion เดิม • MATRIX เป็น Challenger สำหรับเทียบ Walk-forward เท่านั้น • Frequency ใช้เฉพาะ 5 งวดล่าสุด • ข้อมูลเก่ากว่านั้นใช้กับ Pattern / Transition / Mirror / Balance / Gap</p>
    </section>
  </main>
`

const els = {
  search: document.querySelector('#marketSearch'),
  market: document.querySelector('#market'),
  refresh: document.querySelector('#refresh'),
  status: document.querySelector('#status'),
  result: document.querySelector('#result'),
  marketName: document.querySelector('#marketName'),
  sourceTop: document.querySelector('#sourceTop'),
  sourceBottom: document.querySelector('#sourceBottom'),
  sampleSize: document.querySelector('#sampleSize'),
  patternSignals: document.querySelector('#patternSignals'),
  patternForecast: document.querySelector('#patternForecast'),
  patternEvidence: document.querySelector('#patternEvidence'),
  rud: document.querySelector('#rud'),
  marketPulse: document.querySelector('#marketPulse'),
  pin2Top: document.querySelector('#pin2Top'),
  pin2Bottom: document.querySelector('#pin2Bottom'),
  pin2Double: document.querySelector('#pin2Double'),
  pin3Normal: document.querySelector('#pin3Normal'),
  pin3Double: document.querySelector('#pin3Double'),
  matrixPin2Top: document.querySelector('#matrixPin2Top'),
  matrixPin2Bottom: document.querySelector('#matrixPin2Bottom'),
  matrixPin3Normal: document.querySelector('#matrixPin3Normal'),
  matrixPin3Ham: document.querySelector('#matrixPin3Ham'),
  matrixPin3Double: document.querySelector('#matrixPin3Double'),
  matrixPairModel: document.querySelector('#matrixPairModel'),
  matrixTripleModel: document.querySelector('#matrixTripleModel'),
  doubleSignal: document.querySelector('#doubleSignal'),
  evidence: document.querySelector('#evidence'),
  backtest: document.querySelector('#backtest'),
  ranking: document.querySelector('#ranking'),
  copy: document.querySelector('#copy'),
}

const PATTERN_LABELS = {
  DOUBLE: 'เบิ้ล',
  HAM: 'หาม',
  TRIPLE: 'ตอง',
  SIBLING: 'พี่น้อง',
}

const PULSE_LABELS = {
  HOT: '🔥 HOT',
  RETURNING: '🔄 RETURNING',
  WARM: '🌤️ WARM',
  COLD: '🧊 COLD',
}

let markets = []
let current = null

function setStatus(text, type = 'ready') {
  els.status.textContent = text
  els.status.dataset.type = type
}

function optionNodes(items) {
  const placeholder = document.createElement('option')
  placeholder.value = ''
  placeholder.textContent = 'เลือกตลาด...'
  return [placeholder, ...items.map((item) => {
    const option = document.createElement('option')
    option.value = item.market_key
    option.textContent = item.market_name
    return option
  })]
}

function renderMarketOptions(query = '') {
  const normalized = query.trim().toLocaleLowerCase('th-TH')
  const selected = els.market.value
  const filtered = normalized
    ? markets.filter((item) => item.market_name.toLocaleLowerCase('th-TH').includes(normalized))
    : markets
  els.market.replaceChildren(...optionNodes(filtered))
  if (filtered.some((item) => item.market_key === selected)) els.market.value = selected
}

function renderDigits(target, digits, highlight = []) {
  const hot = new Set(highlight)
  target.innerHTML = digits.map((digit) => `<b class="${hot.has(digit) ? 'hot' : ''}">${digit}</b>`).join('')
}

function renderPicks(target, items, key) {
  target.innerHTML = items.map((item, index) => `
    <span class="struct-pick ${index === 0 ? 'primary' : ''}">
      <b>${item[key]}</b><small>${item.score}</small>
    </span>
  `).join('')
}

function twoDigitDoubles(analysis) {
  const scoreByDigit = new Map(analysis.rankings.fusion.map((item) => [item.digit, item.score]))
  return analysis.rud.map((digit) => ({
    pair: `${digit}${digit}`,
    score: scoreByDigit.get(digit) ?? 0,
  }))
}

function getSignal(analysis, type) {
  return analysis.patternSignals.find((item) => item.type === type) || null
}

function renderPatterns(analysis) {
  els.patternSignals.innerHTML = analysis.patternSignals.map((signal) => `
    <div class="pattern-signal" data-status="${signal.status}">
      <span>${PATTERN_LABELS[signal.type]}</span>
      <strong>${signal.score}%</strong>
      <b>${signal.status}</b>
      <small>ฐาน ${signal.baselineRate}%/${signal.baselineSamples} • Transition ${signal.transitionRate ?? '—'}%/${signal.transitionSamples} • Mirror ${signal.mirrorRate ?? '—'}%/${signal.mirrorSamples}</small>
    </div>
  `).join('')

  if (analysis.patternForecast) {
    const label = PATTERN_LABELS[analysis.patternForecast.type]
    els.patternForecast.textContent = `Forecast: ${label} • ${analysis.patternForecast.score}% • ${analysis.patternForecast.status}`
  } else {
    els.patternForecast.textContent = 'Forecast: หลักฐานเฉพาะสถานการณ์ยังไม่พอ'
  }

  const p = analysis.currentPattern
  const currentFlags = [
    p.doubleFront ? 'เบิ้ลหน้า' : null,
    p.doubleBack ? 'เบิ้ลท้าย' : null,
    p.ham ? 'หาม' : null,
    p.triple ? 'ตอง' : null,
    p.sibling ? 'พี่น้อง' : null,
  ].filter(Boolean)
  els.patternEvidence.innerHTML = `
    <span>ล่าสุด: <b>${currentFlags.length ? currentFlags.join(' • ') : 'ปกติ'}</b></span>
    <span>Category: <b>${p.category}</b></span>
  `

  const double = getSignal(analysis, 'DOUBLE')
  els.doubleSignal.textContent = double ? `เบิ้ล ${double.score}% • ${double.status}` : 'เบิ้ล: —'
}

function renderPulse(analysis) {
  els.marketPulse.innerHTML = ['HOT', 'RETURNING', 'WARM', 'COLD'].map((state) => {
    const items = analysis.marketPulse?.[state] || []
    const text = items.length
      ? items.map((item) => `${item.digit}(${item.score})`).join(' • ')
      : '—'
    return `<p><b>${PULSE_LABELS[state]}</b><span>${text}</span></p>`
  }).join('')
}

function renderMatrix(analysis) {
  const matrix = analysis.matrixChallenger
  renderPicks(els.matrixPin2Top, matrix.pin2Top, 'pair')
  renderPicks(els.matrixPin2Bottom, matrix.pin2Bottom, 'pair')
  renderPicks(els.matrixPin3Normal, matrix.pin3Normal, 'triple')
  renderPicks(els.matrixPin3Ham, matrix.pin3Ham, 'triple')
  renderPicks(els.matrixPin3Double, matrix.pin3Double, 'triple')
  els.matrixPairModel.innerHTML = `
    <span>Anchor บน <b>${matrix.model.topPair.missingAnchor}</b> • ขั้วคู่/คี่ผสม ${matrix.model.topPair.parityMixedRate}% • สูง/ต่ำผสม ${matrix.model.topPair.highLowMixedRate}%</span>
    <span>Anchor ล่าง <b>${matrix.model.bottomPair.missingAnchor}</b> • ขั้วคู่/คี่ผสม ${matrix.model.bottomPair.parityMixedRate}% • สูง/ต่ำผสม ${matrix.model.bottomPair.highLowMixedRate}%</span>
  `
  els.matrixTripleModel.innerHTML = `<span>Step Follow จากสถานการณ์คล้ายกัน <b>${matrix.model.stepFollowRate}%</b> • เป็นคะแนนประกอบ ไม่ใช่กฎบังคับ</span>`
}

function renderEvidence(analysis) {
  const currentPattern = analysis.currentPattern
  els.evidence.innerHTML = `
    <p><b>คู่/คี่บน</b><span>${currentPattern.topParity}</span></p>
    <p><b>สูง/ต่ำบน</b><span>${currentPattern.topHighLow}</span></p>
    <p><b>คู่/คี่ล่าง</b><span>${currentPattern.bottomParity}</span></p>
    <p><b>สูง/ต่ำล่าง</b><span>${currentPattern.bottomHighLow}</span></p>
    <p><b>Transition</b><span>${analysis.transition.samples} sample • ${analysis.transition.confidence}</span></p>
    <p><b>Mirror</b><span>${analysis.mirror.samples} sample • คล้ายเฉลี่ย ${analysis.mirror.averageSimilarity}%</span></p>
    <p><b>Data confidence</b><span>${analysis.dataConfidence}% ของฐาน 30 งวด</span></p>
  `
}

function metric(label, value, samples) {
  const display = value === null || value === undefined ? '—' : `${value}%`
  return `<p><b>${label}</b><span>${display}${samples ? ` • ${samples} งวด` : ''}</span></p>`
}

function renderBacktest(backtest) {
  if (!backtest?.samples) {
    els.backtest.innerHTML = '<p><b>สถานะ</b><span>ข้อมูลยังไม่พอ Backtest</span></p>'
    return
  }
  const m = backtest.metrics
  els.backtest.innerHTML = [
    metric('Champion 2 บน', m.pin2TopPair ?? m.pin2TopStraight, backtest.samples),
    metric('MATRIX 2 บน', m.matrixPin2TopPair, backtest.samples),
    metric('Champion 2 ล่าง', m.pin2BottomPair ?? m.pin2BottomStraight, backtest.samples),
    metric('MATRIX 2 ล่าง', m.matrixPin2BottomPair, backtest.samples),
    metric('Champion 3 ปกติ โต๊ด', m.pin3NormalPermutation, backtest.samples),
    metric('MATRIX 3 ปกติ โต๊ด', m.matrixPin3NormalPermutation, backtest.samples),
    metric('MATRIX 3 หาม โต๊ด', m.matrixPin3HamPermutation, backtest.samples),
    metric('Champion 3 เบิ้ล โต๊ด', m.pin3DoublePermutation, backtest.samples),
    metric('MATRIX 3 เบิ้ล โต๊ด', m.matrixPin3DoublePermutation, backtest.samples),
  ].join('')
}

function renderRanking(analysis) {
  els.ranking.innerHTML = analysis.rankings.fusion.map((item, index) => `
    <div class="rank-row">
      <span>${index + 1}</span>
      <b>${item.digit}</b>
      <i style="--score:${item.score}%"></i>
      <strong>${item.score}</strong>
      <small>${item.trendState} ${item.trendScore} • บน ${item.topScore} • ล่าง ${item.bottomScore} • รวม ${item.allScore}</small>
    </div>
  `).join('')
}

function renderResult(marketName, analysis) {
  current = { marketName, ...analysis }
  els.marketName.textContent = marketName
  els.sourceTop.textContent = analysis.source.top3
  els.sourceBottom.textContent = analysis.source.bottom2
  els.sampleSize.textContent = analysis.sampleSize
  renderPatterns(analysis)
  renderDigits(els.rud, analysis.rud, analysis.rud)
  renderPulse(analysis)
  renderPicks(els.pin2Top, analysis.pin2Top, 'pair')
  renderPicks(els.pin2Bottom, analysis.pin2Bottom, 'pair')
  renderPicks(els.pin2Double, twoDigitDoubles(analysis), 'pair')
  renderPicks(els.pin3Normal, analysis.pin3Normal, 'triple')
  renderPicks(els.pin3Double, analysis.pin3Double, 'triple')
  renderMatrix(analysis)
  renderEvidence(analysis)
  renderBacktest(analysis.backtest)
  renderRanking(analysis)
  els.result.classList.remove('hidden')
}

async function calculate() {
  const marketKey = els.market.value
  if (!marketKey) return
  const selected = markets.find((item) => item.market_key === marketKey)
  els.market.disabled = true
  els.refresh.disabled = true
  setStatus('กำลังวิเคราะห์ Champion และ MATRIX Challenger...', 'loading')

  try {
    const history = await loadRecentResults(marketKey, 30)
    const analysis = analyzeStructuralProbabilityV5(history, { includeBacktest: true, maxBacktest: 10 })
    renderResult(selected?.market_name || marketKey, analysis)
    setStatus(`พร้อม • Frequency ${analysis.frequencyWindow} งวด • Pattern ${analysis.sampleSize} งวด • v5.4 MATRIX`, 'ready')
  } catch (error) {
    console.error(error)
    setStatus(error.message || 'คำนวณไม่สำเร็จ', 'error')
  } finally {
    els.market.disabled = false
    els.refresh.disabled = false
  }
}

function signalStatus(type) {
  return current?.patternSignals.find((item) => item.type === type)?.status || '—'
}

function pulseDigits(state) {
  const items = current?.marketPulse?.[state] || []
  return items.map((item) => item.digit).join(' • ') || '—'
}

function copyText() {
  if (!current) return ''
  return [
    `📊 Xgen | ${current.marketName}`,
    `${current.source.top3}-${current.source.bottom2}`,
    '',
    `🔥 ตัวเด่น: ${current.rud.join(' • ')}`,
    `⚡ รูด: ${current.rud.join(' • ')}`,
    `🔥 HOT: ${pulseDigits('HOT')}`,
    `🔄 RETURNING: ${pulseDigits('RETURNING')}`,
    '',
    `🚨 เบิ้ล: ${signalStatus('DOUBLE')} • หาม: ${signalStatus('HAM')} • ตอง: ${signalStatus('TRIPLE')} • พี่น้อง: ${signalStatus('SIBLING')}`,
    '',
    `🎯 เจาะ 2 บน: ${current.pin2Top.map((item) => item.pair).join(' • ')}`,
    `🎯 เจาะ 2 ล่าง: ${current.pin2Bottom.map((item) => item.pair).join(' • ')}`,
    `👯 เบิ้ล 2 ตัว: ${current.rud.map((digit) => `${digit}${digit}`).join(' • ')}`,
    `🎯 เจาะ 3 ปกติ: ${current.pin3Normal.map((item) => item.triple).join(' • ')}`,
    `👯 เจาะ 3 เบิ้ล: ${current.pin3Double.map((item) => item.triple).join(' • ')}`,
  ].join('\n')
}

async function initialize() {
  try {
    markets = await loadMarkets()
    renderMarketOptions()
    const preferred = markets.find((item) => item.market_name === 'ลาว Extra')
      || markets.find((item) => item.market_name === 'ลาวพัฒนา')
    if (preferred) els.market.value = preferred.market_key
    setStatus(`พร้อมใช้งาน • ${markets.length} ตลาด`, 'ready')
    if (preferred) await calculate()
  } catch (error) {
    console.error(error)
    setStatus(error.message || 'เชื่อมต่อข้อมูลไม่สำเร็จ', 'error')
  }
}

els.search.addEventListener('input', (event) => renderMarketOptions(event.target.value))
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
