import './dual-system.css'
import { analyzeHistory } from './formula.js'
import { analyzeMarketIntelligence } from './market-intelligence.js'
import { buildDualSystems } from './dual-engine.js'
import { loadRecentResults } from './supabase.js'
import { getForwardABSummary, syncAllForwardAB } from './forward-ab.js'

let runToken = 0
let lastDual = null
let forwardSyncStarted = false

function ensureCard() {
  let card = document.querySelector('#dualEngineLab')
  if (card) return card

  const result = document.querySelector('#result')
  if (!result) return null
  card = document.createElement('article')
  card.id = 'dualEngineLab'
  card.className = 'dual-engine-card'
  card.innerHTML = `
    <div class="dual-head">
      <div>
        <p>◆ XGEN DUAL ENGINE LAB</p>
        <h3>ระบบ A vs ระบบ B</h3>
      </div>
      <span>FORWARD TEST</span>
    </div>
    <p class="dual-sub">A = Xgen ปกติ • B = Xgen ปกติ + Market Radar + Statistical Motion • ทั้งสองชุดล็อกแยกเพื่อเทียบผลสด</p>
    <div class="dual-systems">
      <section id="dualSystemA" class="dual-system system-a"></section>
      <section id="dualSystemB" class="dual-system system-b"></section>
    </div>
    <section class="stat-motion-card">
      <div class="stat-motion-head"><b>📈 Statistical Motion Expert</b><span id="statMotionState">—</span></div>
      <p id="statMotionSummary" class="stat-motion-summary">กำลังคำนวณ…</p>
      <div class="stat-motion-grid">
        <div><small>MEAN SHIFT</small><b id="statMean">—</b></div>
        <div><small>MEDIAN SHIFT</small><b id="statMedian">—</b></div>
        <div><small>VOLATILITY</small><b id="statVolatility">—</b></div>
        <div><small>IQR SHIFT</small><b id="statIqr">—</b></div>
      </div>
    </section>
    <section class="forward-score">
      <div class="forward-score-head"><b>🏁 Forward A/B Scoreboard</b><small id="forwardSamples">ยังไม่มีผลหลังล็อก</small></div>
      <div id="forwardWinner" class="forward-winner">กำลังเริ่มเก็บผลสด…</div>
      <div class="forward-grid">
        <div id="forwardA" class="forward-system"></div>
        <div id="forwardB" class="forward-system"></div>
      </div>
      <p id="forwardOverall" class="forward-foot">ระบบจะล็อก A/B อัตโนมัติทุกตลาดบนเครื่องนี้ • คะแนนเป็นดัชนีเปรียบเทียบ ไม่ใช่เปอร์เซ็นต์โอกาสออก</p>
    </section>
  `

  const dataHealth = document.querySelector('#xgenDataHealth')
  const radar = document.querySelector('#marketIntelligence')
  if (dataHealth) dataHealth.after(card)
  else if (radar) radar.before(card)
  else {
    const anchor = result.querySelector('.double-card')
    if (anchor) anchor.before(card)
    else result.append(card)
  }
  return card
}

function signed(value) {
  if (value === null || value === undefined) return '—'
  return `${value > 0 ? '+' : ''}${value}`
}

function systemMarkup(system, label, title) {
  if (!system) return '<p>ข้อมูลยังไม่พอ</p>'
  return `
    <div class="dual-system-head">
      <div><span>${label}</span><b>${title}</b></div>
      <button type="button" data-copy-system="${system.key}">COPY</button>
    </div>
    <div class="dual-master">
      <div><small>ตัวแรง</small><b>${system.strongDigit}</b></div>
      <div class="dual-rud">
        <span><small>รูดหลัก</small><b>${system.rud[0]}</b></span>
        <span><small>รูดรอง</small><b>${system.rud[1]}</b></span>
      </div>
    </div>
    <div class="dual-label">✨ WIN6</div>
    <div class="dual-digits">${system.win6.map((digit) => `<b>${digit}</b>`).join('')}</div>
    <div class="dual-label">🎯 เจาะ 2 • กลับได้</div>
    <div class="dual-pairs">${system.pin2.map((item) => `<b>${item.pair}</b>`).join('')}</div>
    <div class="dual-label">🎯 เจาะ 3 • คัด 4 ชุด</div>
    <div class="dual-triples">${system.pin3.map((item) => `<b>${item.triple}</b>`).join('')}</div>
  `
}

function copySystem(system, marketName, source) {
  const text = [
    `🍀 Xgen ${system.key === 'A' ? 'SYSTEM A • ปกติ' : 'SYSTEM B • FUSION'} | ${marketName}`,
    `${source.top3}-${source.bottom2}`,
    '',
    `🔥 ตัวแรง ${system.strongDigit}`,
    `⚡ รูดหลัก ${system.rud[0]} | รูดรอง ${system.rud[1]}`,
    `✨ WIN6 ${system.win6.join(' • ')}`,
    `🎯 เจาะ 2 ${system.pin2.map((item) => item.pair).join(' • ')}`,
    `🎯 เจาะ 3 ${system.pin3.map((item) => item.triple).join(' • ')}`,
  ].join('\n')
  return navigator.clipboard.writeText(text)
}

function metricMarkup(label, metric) {
  const samples = metric.samples || 0
  const avgIndex = samples ? (metric.index / samples).toFixed(1) : '—'
  return `
    <b>${label}</b>
    <div class="forward-stats">
      <span><small>INDEX AVG</small><b>${avgIndex}</b></span>
      <span><small>WIN6 3/3</small><b>${metric.top3Full}/${samples}</b></span>
      <span><small>PIN3</small><b>${metric.pin3Top}/${samples}</b></span>
      <span><small>RUD HIT</small><b>${metric.rudHit}/${samples}</b></span>
      <span><small>PIN2 บน</small><b>${metric.pin2Top}/${samples}</b></span>
      <span><small>PIN2 ล่าง</small><b>${metric.pin2Bottom}/${samples}</b></span>
    </div>
  `
}

function renderForward(marketKey) {
  const market = getForwardABSummary(marketKey)
  const overall = getForwardABSummary()
  document.querySelector('#forwardA').innerHTML = metricMarkup('SYSTEM A', market.A)
  document.querySelector('#forwardB').innerHTML = metricMarkup('SYSTEM B', market.B)
  document.querySelector('#forwardSamples').textContent = market.samples
    ? `ตลาดนี้ ${market.samples} งวดหลังล็อก`
    : 'ตลาดนี้รอผลใหม่หลังล็อก'

  let winner = 'ยังตัดสินไม่ได้ • รอผล Forward งวดแรก'
  if (market.samples) {
    const avgA = market.A.index / market.samples
    const avgB = market.B.index / market.samples
    winner = avgB > avgA
      ? `SYSTEM B นำ • ดัชนีเฉลี่ย ${avgB.toFixed(1)} vs ${avgA.toFixed(1)}`
      : avgA > avgB
        ? `SYSTEM A นำ • ดัชนีเฉลี่ย ${avgA.toFixed(1)} vs ${avgB.toFixed(1)}`
        : `เสมอกัน • ดัชนีเฉลี่ย ${avgA.toFixed(1)}`
  }
  document.querySelector('#forwardWinner').textContent = winner
  document.querySelector('#forwardOverall').textContent = overall.samples
    ? `รวมทุกตลาดบนเครื่องนี้ ${overall.samples} งวด • A ชนะ ${overall.aWins} • B ชนะ ${overall.bWins} • เสมอ ${overall.ties} • ดัชนีเปรียบเทียบ ไม่ใช่เปอร์เซ็นต์`
    : 'ระบบกำลังล็อก A/B อัตโนมัติทุกตลาดบนเครื่องนี้ • รอผลจริงงวดถัดไปเพื่อเริ่มตัดสิน'
}

function renderDual(marketName, source, dual) {
  const card = ensureCard()
  if (!card) return
  card.classList.remove('dual-loading')
  lastDual = { marketName, source, dual }
  document.querySelector('#dualSystemA').innerHTML = systemMarkup(dual.classic, 'SYSTEM A', 'Xgen ปกติ')
  document.querySelector('#dualSystemB').innerHTML = systemMarkup(dual.fusion, 'SYSTEM B', 'Xgen Fusion')

  const motion = dual.fusion.motion
  document.querySelector('#statMotionState').textContent = motion.state
  document.querySelector('#statMotionSummary').textContent = motion.summary
  document.querySelector('#statMean').textContent = signed(motion.shifts.mean)
  document.querySelector('#statMedian').textContent = signed(motion.shifts.median)
  document.querySelector('#statVolatility').textContent = signed(motion.shifts.volatility)
  document.querySelector('#statIqr').textContent = signed(motion.shifts.iqr)

  card.querySelectorAll('[data-copy-system]').forEach((button) => {
    button.addEventListener('click', async () => {
      const system = button.dataset.copySystem === 'A' ? dual.classic : dual.fusion
      await copySystem(system, marketName, source)
      const original = button.textContent
      button.textContent = 'COPIED'
      setTimeout(() => { button.textContent = original }, 1000)
    })
  })
}

async function refreshDual() {
  const market = document.querySelector('#market')
  const sourceTop = document.querySelector('#sourceTop')?.textContent || ''
  if (!market?.value || !/^\d{3}$/.test(sourceTop)) return

  const token = ++runToken
  ensureCard()?.classList.add('dual-loading')
  try {
    const history = await loadRecentResults(market.value, 30)
    if (token !== runToken) return
    const base = analyzeHistory(history)
    const intelligence = analyzeMarketIntelligence(history)
    const dual = buildDualSystems(base, intelligence, history)
    const marketName = document.querySelector('#marketName')?.textContent || market.selectedOptions[0]?.textContent || market.value
    renderDual(marketName, base.source, dual)
    renderForward(market.value)
  } catch (error) {
    console.error('Xgen Dual Engine:', error)
    const card = ensureCard()
    if (card) {
      card.classList.remove('dual-loading')
      document.querySelector('#dualSystemB').innerHTML = `<p>${error.message || 'Dual Engine error'}</p>`
    }
  }
}

async function startForwardSync() {
  if (forwardSyncStarted) return
  forwardSyncStarted = true
  try {
    await syncAllForwardAB()
    const marketKey = document.querySelector('#market')?.value
    if (marketKey) renderForward(marketKey)
  } catch (error) {
    console.warn('Xgen Forward A/B sync:', error)
  }
}

function boot() {
  const result = document.querySelector('#result')
  if (result) {
    new MutationObserver(() => {
      if (!document.querySelector('#dualEngineLab') && !result.classList.contains('hidden')) ensureCard()
    }).observe(result, { childList: true, subtree: true, attributes: true })
  }

  const source = document.querySelector('#sourceTop')
  if (source) new MutationObserver(() => queueMicrotask(refreshDual)).observe(source, { childList: true, characterData: true, subtree: true })
  document.querySelector('#market')?.addEventListener('change', () => setTimeout(refreshDual, 0))
  document.querySelector('#refresh')?.addEventListener('click', () => setTimeout(refreshDual, 0))

  refreshDual()
  setTimeout(startForwardSync, 600)
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true })
else boot()
