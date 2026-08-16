import './market-intelligence.css'
import { loadRecentResults } from './supabase.js'
import { analyzeMarketIntelligence } from './market-intelligence.js'
import { buildNextDrawSignals } from './market-signal-interpreter.js'

const stateLabels = {
  STABLE: 'STABLE • ทรงตัว',
  FLOW: 'FLOW • กำลังไหล',
  ROTATION: 'ROTATION • กำลังหมุน',
  COMPRESSION: 'COMPRESSION • กำลังบีบ',
  RESET: 'RESET • เปลี่ยนโครงสร้าง',
  UNKNOWN: 'UNKNOWN • ข้อมูลยังบาง',
}

const patternLabels = {
  double: 'เบิ้ล',
  ham: 'หาม',
  sibling: 'พี่น้อง',
  repeat: 'ซ้ำ/Repeat',
}

let runToken = 0

function arrow(value) {
  if (value >= 4) return '↑'
  if (value <= -4) return '↓'
  return '→'
}

function gapLabel(value) {
  if (value === null) return 'ยังไม่พบในช่วงข้อมูล'
  if (value === 0) return 'เกิดในงวดล่าสุด'
  return `ห่าง ${value} งวด`
}

function ensureCard() {
  if (document.querySelector('#marketIntelligence')) return document.querySelector('#marketIntelligence')
  const result = document.querySelector('#result')
  const anchor = result?.querySelector('.double-card')
  if (!result || !anchor) return null

  const card = document.createElement('article')
  card.id = 'marketIntelligence'
  card.className = 'intel-card'
  card.innerHTML = `
    <div class="intel-head">
      <div>
        <p class="intel-kicker">◈ XGEN MARKET RADAR</p>
        <h3>Market Intelligence <span>V2</span></h3>
        <p class="intel-sub">อ่านการเปลี่ยนตลาดก่อนสูตร • Multi-window 3/5/10/20/30</p>
      </div>
      <div class="intel-mode"><i></i> SHADOW</div>
    </div>

    <div class="intel-state-row">
      <div class="intel-state">
        <small>MARKET STATE</small>
        <strong id="intelState">—</strong>
        <span id="intelConfidence">—</span>
      </div>
      <div class="intel-gauge-wrap">
        <div class="intel-gauge" id="intelShiftGauge" style="--intel-value:0"><b id="intelShift">0</b><small>SHIFT</small></div>
        <div class="intel-gauge" id="intelCompressionGauge" style="--intel-value:0"><b id="intelCompression">0</b><small>PRESS</small></div>
      </div>
    </div>

    <section class="intel-next-signals">
      <div class="intel-panel-head intel-alert-head">
        <b>🚨 สัญญาณงวดถัดไป</b>
        <small>NEXT DRAW SIGNALS • SCORE ไม่ใช่เปอร์เซ็นต์</small>
      </div>
      <div id="intelNextSignals" class="intel-signal-list"></div>
      <p class="intel-signal-note">Signal แปล Pattern ปัจจุบันเป็นคำเตือนล่วงหน้า • Transition ย้อนหลังใช้เป็นหลักฐานประกอบเท่านั้น</p>
    </section>

    <div class="intel-grid">
      <section class="intel-panel">
        <div class="intel-panel-head"><b>ความอิ่มตัว</b><small>SATURATION</small></div>
        <div class="intel-meter-row"><span>สูง 5–9</span><b id="intelHigh">—</b><i id="intelHighMomentum">—</i></div>
        <div class="intel-meter"><span id="intelHighBar"></span></div>
        <div class="intel-meter-row"><span>คู่</span><b id="intelEven">—</b><i id="intelEvenMomentum">—</i></div>
        <div class="intel-meter"><span id="intelEvenBar"></span></div>
        <div class="intel-window" id="intelHighWindows"></div>
      </section>

      <section class="intel-panel">
        <div class="intel-panel-head"><b>เลขกำลังกระจุก</b><small>DIGIT CONCENTRATION</small></div>
        <div class="intel-digits" id="intelDigits"></div>
        <p class="intel-caption">ดูสัดส่วนฝั่งล่าง 5 งวดเทียบ Momentum ฐาน 20 งวด</p>
      </section>
    </div>

    <section class="intel-patterns">
      <div class="intel-panel-head"><b>แรง Pattern</b><small>PRESSURE INDEX • ไม่ใช่ความน่าจะเป็น</small></div>
      <div class="intel-pattern-grid" id="intelPatterns"></div>
    </section>

    <section class="intel-experts">
      <div class="intel-panel-head"><b>Expert Mix</b><small>SHADOW WEIGHT • ยังไม่แก้ WIN6 เดิม</small></div>
      <div id="intelExperts" class="intel-expert-list"></div>
    </section>

    <section class="intel-reasons">
      <div class="intel-panel-head"><b>เหตุผลที่ Radar เห็น</b><small>LIVE EVIDENCE</small></div>
      <ul id="intelReasons"></ul>
    </section>

    <p class="intel-foot">โหมดทดลอง: Radar ใช้เพื่อจับ Market Shift และ Pattern State เท่านั้น ผล WIN6 / รูด / เจาะเดิมยังคงสูตรเดิม</p>
  `

  anchor.before(card)
  return card
}

function renderSignals(analysis) {
  const signals = buildNextDrawSignals(analysis)
  const target = document.querySelector('#intelNextSignals')
  if (!target) return

  target.innerHTML = signals.map((signal) => `
    <article class="intel-signal ${signal.level.toLowerCase()}">
      <div class="intel-signal-top">
        <span><i>${signal.icon}</i>${signal.title}</span>
        <em>${signal.levelLabel}</em>
      </div>
      <div class="intel-signal-body">
        <div class="intel-signal-score"><b>${signal.score}</b><small>แรง</small></div>
        <ul>${signal.reasons.map((reason) => `<li>${reason}</li>`).join('')}</ul>
      </div>
      ${signal.evidence ? `<p class="intel-signal-evidence">${signal.evidence}</p>` : ''}
    </article>
  `).join('')
}

function render(analysis) {
  const card = ensureCard()
  if (!card) return

  card.classList.remove('intel-loading')
  card.dataset.state = analysis.state
  document.querySelector('#intelState').textContent = stateLabels[analysis.state] || analysis.state
  const coverage = Math.round(Math.min(100, (analysis.sampleSize / 30) * 100))
  document.querySelector('#intelConfidence').textContent = `ข้อมูล ${analysis.sampleSize}/30 งวด • สะสม ${coverage}%`
  document.querySelector('#intelShift').textContent = analysis.shiftScore
  document.querySelector('#intelCompression').textContent = analysis.compressionScore
  document.querySelector('#intelShiftGauge').style.setProperty('--intel-value', analysis.shiftScore)
  document.querySelector('#intelCompressionGauge').style.setProperty('--intel-value', analysis.compressionScore)

  renderSignals(analysis)

  const high = analysis.saturation.high
  const even = analysis.saturation.even
  document.querySelector('#intelHigh').textContent = `${high.value}%`
  document.querySelector('#intelHighMomentum').textContent = `${arrow(high.momentum)} ${high.momentum > 0 ? '+' : ''}${high.momentum}`
  document.querySelector('#intelHighBar').style.width = `${high.value}%`
  document.querySelector('#intelEven').textContent = `${even.value}%`
  document.querySelector('#intelEvenMomentum').textContent = `${arrow(even.momentum)} ${even.momentum > 0 ? '+' : ''}${even.momentum}`
  document.querySelector('#intelEvenBar').style.width = `${even.value}%`
  document.querySelector('#intelHighWindows').innerHTML = Object.entries(high.windows)
    .map(([window, value]) => `<span><small>${window}</small><b>${value}%</b></span>`)
    .join('')

  document.querySelector('#intelDigits').innerHTML = analysis.saturation.leadingDigits
    .map((item, index) => `
      <div class="intel-digit ${index === 0 ? 'lead' : ''}">
        <b>${item.digit}</b>
        <span>${item.share}%</span>
        <small>${arrow(item.momentum)} ${item.momentum > 0 ? '+' : ''}${item.momentum}</small>
      </div>
    `).join('')

  document.querySelector('#intelPatterns').innerHTML = Object.entries(patternLabels)
    .map(([key, label]) => {
      const item = analysis.patterns[key]
      const current = key === 'repeat'
        ? (item.currentExact ? 'ซ้ำตรง' : item.currentOverlap > 0 ? `ซ้ำ ${item.currentOverlap} หลัก` : 'ไม่ซ้ำ')
        : gapLabel(item.gap)
      return `
        <div class="intel-pattern ${item.pressure >= 65 ? 'hot' : item.pressure >= 45 ? 'warm' : ''}">
          <span>${label}</span><b>${item.pressure}</b><small>${current}</small>
        </div>
      `
    }).join('')

  const expertLabels = { momentum: 'Momentum', transition: 'Transition', frequency: 'Frequency', pattern: 'Pattern' }
  document.querySelector('#intelExperts').innerHTML = Object.entries(analysis.expertWeights)
    .sort((left, right) => right[1] - left[1])
    .map(([key, value]) => `
      <div class="intel-expert"><span>${expertLabels[key] || key}</span><div><i style="width:${value}%"></i></div><b>${value}%</b></div>
    `).join('')

  document.querySelector('#intelReasons').innerHTML = analysis.reasons
    .slice(0, 4)
    .map((reason) => `<li>${reason}</li>`)
    .join('')
}

function setLoading() {
  const card = ensureCard()
  if (card) card.classList.add('intel-loading')
}

async function refreshIntelligence() {
  const market = document.querySelector('#market')
  const sourceTop = document.querySelector('#sourceTop')?.textContent
  if (!market?.value || !/^\d{3}$/.test(sourceTop || '')) return

  const token = ++runToken
  setLoading()
  try {
    const history = await loadRecentResults(market.value, 30)
    if (token !== runToken) return
    render(analyzeMarketIntelligence(history))
  } catch (error) {
    console.error('Xgen Market Intelligence:', error)
    const card = ensureCard()
    if (card) {
      card.classList.remove('intel-loading')
      card.querySelector('#intelState').textContent = 'RADAR ERROR'
      card.querySelector('#intelConfidence').textContent = error.message || 'โหลด Radar ไม่สำเร็จ'
    }
  }
}

function boot() {
  ensureCard()
  const source = document.querySelector('#sourceTop')
  const market = document.querySelector('#market')
  const refresh = document.querySelector('#refresh')

  if (source) {
    const observer = new MutationObserver(() => queueMicrotask(refreshIntelligence))
    observer.observe(source, { childList: true, characterData: true, subtree: true })
  }
  market?.addEventListener('change', () => setTimeout(refreshIntelligence, 0))
  refresh?.addEventListener('click', () => setTimeout(refreshIntelligence, 0))
  refreshIntelligence()
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true })
else boot()
