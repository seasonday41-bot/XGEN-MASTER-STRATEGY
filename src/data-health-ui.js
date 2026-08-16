import './data-health.css'
import { loadRecentResults, getLastDataHealth } from './supabase.js'

let runToken = 0

const statusLabel = {
  HEALTHY: 'พร้อมวิเคราะห์',
  WATCH: 'ตรวจแล้ว • มีจุดเฝ้าระวัง',
  BLOCKED: 'หยุด Radar • ข้อมูลผิดปกติ',
}

function ensurePanel() {
  let panel = document.querySelector('#xgenDataHealth')
  if (panel) return panel

  const radar = document.querySelector('#marketIntelligence')
  const result = document.querySelector('#result')
  if (!result) return null

  panel = document.createElement('article')
  panel.id = 'xgenDataHealth'
  panel.className = 'data-health-card'
  panel.innerHTML = `
    <div class="data-health-head">
      <div>
        <p>🧪 XGEN DATA GUARD</p>
        <h3>Data Health</h3>
      </div>
      <div id="dataHealthScore" class="data-health-score">—</div>
    </div>
    <div class="data-health-status">
      <b id="dataHealthStatus">กำลังตรวจข้อมูล…</b>
      <span id="dataHealthCoverage">—</span>
    </div>
    <div class="data-health-grid">
      <div><span>ROWS</span><b id="dataHealthRows">—</b></div>
      <div><span>INVALID</span><b id="dataHealthInvalid">—</b></div>
      <div><span>DUPLICATE</span><b id="dataHealthDuplicate">—</b></div>
      <div><span>ORDER</span><b id="dataHealthOrder">—</b></div>
    </div>
    <div id="dataHealthMessages" class="data-health-messages"></div>
    <p class="data-health-foot">ตรวจรูปแบบวันที่ • 3 บน • 2 ล่าง • เลข 0 นำหน้า • งวดซ้ำ • ลำดับข้อมูล ก่อนส่งเข้า Market Radar</p>
  `

  if (radar) radar.before(panel)
  else {
    const anchor = result.querySelector('.double-card')
    if (anchor) anchor.before(panel)
    else result.append(panel)
  }
  return panel
}

function render(health) {
  const panel = ensurePanel()
  if (!panel || !health) return
  panel.dataset.status = health.status
  panel.classList.remove('data-health-loading')

  document.querySelector('#dataHealthScore').textContent = `${health.score}`
  document.querySelector('#dataHealthStatus').textContent = statusLabel[health.status] || health.status
  document.querySelector('#dataHealthCoverage').textContent = `ข้อมูล ${health.rows}/${health.targetRows} งวด • สะสม ${health.coverage}%`
  document.querySelector('#dataHealthRows').textContent = `${health.rows}/${health.targetRows}`
  document.querySelector('#dataHealthInvalid').textContent = health.invalidRows
  document.querySelector('#dataHealthDuplicate').textContent = health.duplicateDates
  document.querySelector('#dataHealthOrder').textContent = health.orderViolations === 0 ? 'OK' : `${health.orderViolations} จุด`

  const messages = [
    ...health.issues.map((item) => ({ type: item.severity, text: item.message })),
    ...health.repairs.map((text) => ({ type: 'repair', text })),
  ]

  if (!messages.length) {
    messages.push({ type: 'ok', text: 'ข้อมูลที่ส่งเข้า Radar ผ่านการตรวจครบ • ไม่พบแถวเสียหรือวันที่ซ้ำ' })
  }
  if (health.maxGapDays > 0) {
    messages.push({ type: 'info', text: `ช่วงห่างระหว่างงวดสูงสุด ${health.maxGapDays} วัน • แสดงเพื่อสังเกตเท่านั้น ไม่หักคะแนน` })
  }

  document.querySelector('#dataHealthMessages').innerHTML = messages.slice(0, 4)
    .map((item) => `<div class="${item.type}"><i></i><span>${item.text}</span></div>`)
    .join('')
}

function renderError(error) {
  const panel = ensurePanel()
  if (!panel) return
  const health = error?.health
  if (health) {
    render(health)
    return
  }
  panel.dataset.status = 'BLOCKED'
  panel.classList.remove('data-health-loading')
  document.querySelector('#dataHealthScore').textContent = '—'
  document.querySelector('#dataHealthStatus').textContent = 'โหลดข้อมูลเพื่อตรวจไม่สำเร็จ'
  document.querySelector('#dataHealthMessages').innerHTML = `<div class="critical"><i></i><span>${error?.message || 'Unknown data error'}</span></div>`
}

async function refreshDataHealth() {
  const market = document.querySelector('#market')
  if (!market?.value) return
  const token = ++runToken
  const panel = ensurePanel()
  panel?.classList.add('data-health-loading')

  try {
    await loadRecentResults(market.value, 30)
    if (token !== runToken) return
    render(getLastDataHealth(market.value, 30))
  } catch (error) {
    if (token !== runToken) return
    console.error('Xgen Data Guard:', error)
    renderError(error)
  }
}

function boot() {
  const result = document.querySelector('#result')
  if (result) {
    const observer = new MutationObserver(() => {
      if (!document.querySelector('#xgenDataHealth') && document.querySelector('#marketIntelligence')) ensurePanel()
    })
    observer.observe(result, { childList: true, subtree: true })
  }

  ensurePanel()
  document.querySelector('#market')?.addEventListener('change', () => setTimeout(refreshDataHealth, 0))
  document.querySelector('#refresh')?.addEventListener('click', () => setTimeout(refreshDataHealth, 0))

  const source = document.querySelector('#sourceTop')
  if (source) {
    const sourceObserver = new MutationObserver(() => queueMicrotask(refreshDataHealth))
    sourceObserver.observe(source, { childList: true, characterData: true, subtree: true })
  }

  refreshDataHealth()
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true })
else boot()
