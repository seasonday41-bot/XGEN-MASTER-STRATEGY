import '@fontsource-variable/noto-sans-thai'
import './analyzer.css'
import { loadMarkets, supabase } from './supabase.js'
import { normalizeResult } from './win6xgen.js'
import {
  HUNDRED_GROUP_ORDER,
  TEST_PERCENTS,
  WEEKDAY_LABELS,
  analyzePercentageHistory,
} from './percentage-analyzer.js'

const app = document.querySelector('#app')

app.innerHTML = `
  <main class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">XGEN LAB • BACKTEST</p>
        <h1>ตัวทดลองเปอร์เซ็นต์ตลาด</h1>
        <p class="hero-copy">แยกสถิติรายตลาด • รายวัน • ลักษณะหลักร้อย โดยไม่เอาบน 1 + ล่าง 1 มารวมกัน</p>
      </div>
      <a class="home-link" href="/">กลับหน้าหลัก</a>
    </header>

    <section class="panel controls">
      <label for="marketSelect">เลือกตลาด</label>
      <div class="control-row">
        <select id="marketSelect" disabled>
          <option>กำลังโหลดตลาด...</option>
        </select>
        <button id="analyzeButton" type="button" disabled>วิเคราะห์ตลาดนี้</button>
      </div>
      <p id="status" class="status">กำลังเตรียมข้อมูล...</p>
    </section>

    <section id="results" hidden></section>
  </main>
`

const marketSelect = document.querySelector('#marketSelect')
const analyzeButton = document.querySelector('#analyzeButton')
const status = document.querySelector('#status')
const results = document.querySelector('#results')

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatDate(date) {
  if (!date) return '-'
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)))
}

async function loadAnalysisRows(marketKey) {
  if (!/^market_\d{3}$/.test(String(marketKey || ''))) throw new Error('รหัสตลาดไม่ถูกต้อง')

  const { data, error } = await supabase.rpc('xgen_recent_results', {
    p_market_key: marketKey,
    p_limit: 30,
  })
  if (error) throw error

  const rows = (data || []).map(normalizeResult)
  if (rows.some((row) => !row)) throw new Error('พบผลย้อนหลังที่รูปแบบไม่ถูกต้อง')

  return rows
    .filter(Boolean)
    .sort((left, right) => right.draw_date.localeCompare(left.draw_date))
}

function sampleBadge(total) {
  if (total >= 8) return '<span class="sample good">ข้อมูลดี</span>'
  if (total >= 5) return '<span class="sample fair">พอทดลอง</span>'
  return '<span class="sample low">ข้อมูลน้อย</span>'
}

function bestLabel(best) {
  if (!best?.length) return '—'
  return best.map((percent) => `${percent}%`).join(' / ')
}

function statsCell(stats, best, percent) {
  if (!stats?.total) return '<td class="empty">—</td>'
  const selected = best.includes(percent) ? ' best' : ''
  return `
    <td class="metric${selected}">
      <strong>${stats.anyHits}/${stats.total}</strong>
      <span>${stats.rate.toFixed(0)}%</span>
      <small>บน ${stats.topHits} • ล่าง ${stats.bottomHits}${stats.bothHits ? ` • ทั้งคู่ ${stats.bothHits}` : ''}</small>
    </td>
  `
}

function dayTable(analysis) {
  const rows = WEEKDAY_LABELS.map((label, dayIndex) => {
    const group = analysis.byDay[dayIndex]
    const total = group.byPercent[7].total
    return `
      <tr>
        <th>
          <div>${label}</div>
          <small>${total} รอบ ${sampleBadge(total)}</small>
        </th>
        ${TEST_PERCENTS.map((percent) => statsCell(group.byPercent[percent], group.bestPercents, percent)).join('')}
        <td class="winner">${bestLabel(group.bestPercents)}</td>
      </tr>
    `
  }).join('')

  return `
    <section class="panel table-panel">
      <div class="section-heading">
        <div>
          <p class="eyebrow">DAY MODEL</p>
          <h2>เปอร์เซ็นต์แยกตามวัน</h2>
        </div>
        <p>นับจากวันของงวดต้นทาง → งวดถัดไปของตลาดเดียวกัน</p>
      </div>
      <div class="table-scroll">
        <table>
          <thead><tr><th>วัน</th><th>7%</th><th>8%</th><th>9%</th><th>เด่น</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `
}

function numberTable(analysis) {
  const rows = HUNDRED_GROUP_ORDER.map((key) => {
    const group = analysis.byHundreds[key]
    const total = group.byPercent[7].total
    return `
      <tr>
        <th>
          <div>${group.label}</div>
          <small>${total} รอบ ${sampleBadge(total)}</small>
        </th>
        ${TEST_PERCENTS.map((percent) => statsCell(group.byPercent[percent], group.bestPercents, percent)).join('')}
        <td class="winner">${bestLabel(group.bestPercents)}</td>
      </tr>
    `
  }).join('')

  return `
    <section class="panel table-panel">
      <div class="section-heading">
        <div>
          <p class="eyebrow">NUMBER MODEL</p>
          <h2>เปอร์เซ็นต์แยกตามหลักร้อย</h2>
        </div>
        <p>คู่ต่ำ 0/2/4 • คู่สูง 6/8 • คี่ต่ำ 1/3 • คี่สูง 5/7/9</p>
      </div>
      <div class="table-scroll">
        <table>
          <thead><tr><th>ลักษณะ</th><th>7%</th><th>8%</th><th>9%</th><th>เด่น</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `
}

function hitText(test) {
  if (test.topHit && test.bottomHit) return 'บน + ล่าง'
  if (test.topHit) return 'บน'
  if (test.bottomHit) return 'ล่าง'
  return '—'
}

function auditTable(analysis) {
  const transitions = [...analysis.transitions].reverse()
  return `
    <details class="panel audit">
      <summary>ดูรายละเอียดการตรวจ ${transitions.length} รอบ</summary>
      <div class="table-scroll">
        <table>
          <thead><tr><th>ต้นทาง → งวดถัดไป</th><th>7%</th><th>8%</th><th>9%</th></tr></thead>
          <tbody>
            ${transitions.map((transition) => `
              <tr>
                <th>
                  <div>${transition.dayLabel} ${transition.source.top3}-${transition.source.bottom2}</div>
                  <small>${formatDate(transition.source.draw_date)} → ${transition.next.top3}-${transition.next.bottom2}</small>
                </th>
                ${TEST_PERCENTS.map((percent) => {
                  const test = transition.tests[percent]
                  return `<td class="audit-cell ${test.anyHit ? 'pass' : ''}"><strong>${test.formatted}</strong><small>${hitText(test)}</small></td>`
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </details>
  `
}

function recommendationCard(analysis, marketName, rowCount) {
  const rec = analysis.recommendation
  if (!rec) return ''

  const dayGroup = analysis.byDay[rec.dayIndex]
  const numberGroup = analysis.byHundreds[rec.hundreds.key]
  const dayTotal = dayGroup.byPercent[7].total
  const numberTotal = numberGroup.byPercent[7].total
  const strong = rec.strongMatch.length
  const verdict = strong
    ? `<div class="verdict strong">🔥 STRONG MATCH <strong>${bestLabel(rec.strongMatch)}</strong></div>`
    : `<div class="verdict conflict">⚖️ ยังไม่ตรงกัน — เก็บ DAY และ NUMBER แยกไว้ก่อน</div>`

  return `
    <section class="panel recommendation">
      <div class="section-heading">
        <div>
          <p class="eyebrow">LATEST SIGNAL</p>
          <h2>${escapeHtml(marketName)}</h2>
        </div>
        <span class="history-count">ย้อนหลัง ${rowCount} งวด</span>
      </div>

      <div class="latest-result">
        <div>
          <small>${formatDate(rec.latest.draw_date)} • ${rec.dayLabel}</small>
          <strong>${rec.latest.top3}<span>-</span>${rec.latest.bottom2}</strong>
        </div>
        <div class="hundreds-chip">หลักร้อย ${rec.hundreds.digit}<span>${rec.hundreds.label}</span></div>
      </div>

      <div class="model-grid">
        <article>
          <small>📅 DAY MODEL</small>
          <strong>${bestLabel(rec.dayBest)}</strong>
          <span>${dayTotal} รอบ ${sampleBadge(dayTotal)}</span>
        </article>
        <article>
          <small>🔢 NUMBER MODEL</small>
          <strong>${bestLabel(rec.numberBest)}</strong>
          <span>${numberTotal} รอบ ${sampleBadge(numberTotal)}</span>
        </article>
      </div>

      ${verdict}

      <div class="calc-grid">
        ${TEST_PERCENTS.map((percent) => {
          const calc = rec.calculations[percent]
          const highlighted = rec.strongMatch.includes(percent) ? ' chosen' : ''
          return `
            <article class="calc${highlighted}">
              <small>${rec.latest.top3} × ${percent}%</small>
              <strong>${calc.formatted}</strong>
              <span>${calc.digits.join(' • ')}</span>
            </article>
          `
        }).join('')}
      </div>
      <p class="rule-note">กติกา HIT: บนต้องชนอย่างน้อย 2 ตัวใน 3 ตัวบน หรือ ล่างต้องครบ 2 ตัวใน 2 ตัวล่าง โดยตรวจแต่ละฝั่งแยกกัน และเก็บเลขซ้ำจากผลคำนวณไว้ครบ</p>
    </section>
  `
}

function renderAnalysis(analysis, marketName, rowCount) {
  results.innerHTML = `
    ${recommendationCard(analysis, marketName, rowCount)}
    ${dayTable(analysis)}
    ${numberTable(analysis)}
    ${auditTable(analysis)}
  `
  results.hidden = false
}

async function analyzeSelectedMarket() {
  const marketKey = marketSelect.value
  const marketName = marketSelect.options[marketSelect.selectedIndex]?.textContent || marketKey
  if (!marketKey) return

  analyzeButton.disabled = true
  marketSelect.disabled = true
  status.textContent = 'กำลังดึงย้อนหลังสูงสุด 30 งวดและทดสอบ 7% / 8% / 9%...'
  results.hidden = true

  try {
    const rows = await loadAnalysisRows(marketKey)
    if (rows.length < 2) throw new Error('ตลาดนี้มีข้อมูลไม่พอสำหรับจับงวดก่อน → งวดถัดไป')
    const analysis = analyzePercentageHistory(rows)
    renderAnalysis(analysis, marketName, rows.length)
    status.textContent = `วิเคราะห์แล้ว ${analysis.transitions.length} รอบ • ข้อมูลแยกเฉพาะตลาดนี้ ไม่ปนตลาดอื่น`
  } catch (error) {
    console.error(error)
    status.textContent = `วิเคราะห์ไม่ได้: ${error?.message || 'เกิดข้อผิดพลาด'}`
  } finally {
    marketSelect.disabled = false
    analyzeButton.disabled = false
  }
}

async function init() {
  try {
    const markets = await loadMarkets()
    marketSelect.innerHTML = markets
      .map((market) => `<option value="${escapeHtml(market.market_key)}">${escapeHtml(market.market_name)}</option>`)
      .join('')
    marketSelect.disabled = markets.length === 0
    analyzeButton.disabled = markets.length === 0
    status.textContent = markets.length
      ? `พร้อมทดลอง ${markets.length} ตลาด • เลือกตลาดแล้วกดวิเคราะห์`
      : 'ยังไม่พบตลาดที่มีผลย้อนหลัง'
  } catch (error) {
    console.error(error)
    marketSelect.innerHTML = '<option>โหลดตลาดไม่สำเร็จ</option>'
    status.textContent = `โหลดตลาดไม่ได้: ${error?.message || 'เกิดข้อผิดพลาด'}`
  }
}

analyzeButton.addEventListener('click', analyzeSelectedMarket)
marketSelect.addEventListener('change', () => {
  results.hidden = true
  status.textContent = 'เปลี่ยนตลาดแล้ว • กดวิเคราะห์เพื่อคำนวณใหม่'
})

init()
