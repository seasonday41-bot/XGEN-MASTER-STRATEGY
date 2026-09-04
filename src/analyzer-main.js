import '@fontsource-variable/noto-sans-thai'
import './analyzer.css'
import { loadMarkets, supabase } from './supabase.js'
import { normalizeResult } from './win6xgen.js'
import {
  HUNDRED_GROUP_ORDER,
  TEST_PERCENTS,
  WEEKDAY_LABELS,
  analyzePercentageHistory,
  buildPublicCopy,
} from './percentage-analyzer.js'

const app = document.querySelector('#app')

app.innerHTML = `
  <main class="shell">
    <header class="hero">
      <div class="brand-block">
        <div class="brand-orb" aria-hidden="true"><span>X</span></div>
        <div>
          <div class="brand-line">
            <p class="eyebrow">XGEN EXPERIMENTAL SYSTEM</p>
            <span class="lab-badge">LAB</span>
          </div>
          <h1>XGEN LAB</h1>
          <p class="hero-copy">ห้องทดลองพฤติกรรมตัวเลข • แยกตลาด • ทดสอบย้อนหลัง • คัด FUSION เป็นชุดใช้งาน</p>
        </div>
      </div>
      <a class="home-link" href="/">หน้าหลัก</a>
    </header>

    <section class="control-glass">
      <div class="control-head">
        <div>
          <span class="control-kicker">MARKET SCANNER</span>
          <strong>เลือกตลาดที่ต้องการทดลอง</strong>
        </div>
        <span class="live-dot"><i></i> READ ONLY</span>
      </div>
      <div class="control-row">
        <label class="select-wrap" for="marketSelect">
          <span>ตลาด</span>
          <select id="marketSelect" disabled>
            <option>กำลังโหลดตลาด...</option>
          </select>
        </label>
        <button id="analyzeButton" class="liquid-action" type="button" disabled>
          <span>วิเคราะห์ตลาด</span>
          <i aria-hidden="true">→</i>
        </button>
      </div>
      <p id="status" class="status">กำลังเตรียมข้อมูล...</p>
    </section>

    <nav id="labNav" class="liquid-nav" aria-label="XGEN LAB navigation" hidden>
      <button type="button" class="active" data-tab="overview">ภาพรวม</button>
      <button type="button" data-tab="day">DAY</button>
      <button type="button" data-tab="number">NUMBER</button>
      <button type="button" data-tab="history">BACKTEST</button>
    </nav>

    <section id="results" hidden></section>
    <div id="toast" class="toast" role="status" aria-live="polite"></div>
  </main>
`

const marketSelect = document.querySelector('#marketSelect')
const analyzeButton = document.querySelector('#analyzeButton')
const status = document.querySelector('#status')
const results = document.querySelector('#results')
const labNav = document.querySelector('#labNav')
const toast = document.querySelector('#toast')

let currentOutput = null
let toastTimer = null

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

function digitChips(values, className = '') {
  if (!values?.length) return '<span class="no-data">ไม่มี</span>'
  return `<div class="digit-row ${className}">${values.map((digit) => `<span>${escapeHtml(digit)}</span>`).join('')}</div>`
}

function setChips(values) {
  if (!values?.length) return '<span class="no-data">ไม่มี</span>'
  return `<div class="set-row">${values.map((value) => `<span>${escapeHtml(value)}</span>`).join('')}</div>`
}

function rateBar(stats) {
  const rate = Number(stats?.rate || 0)
  return `
    <div class="rate-line"><span style="--rate:${Math.min(rate, 100)}%"></span></div>
    <div class="rate-meta"><strong>${rate.toFixed(0)}%</strong><small>${stats?.anyHits || 0}/${stats?.total || 0} รอบ</small></div>
  `
}

function modelCard(icon, title, best, total, className) {
  return `
    <article class="model-card ${className}">
      <div class="model-icon">${icon}</div>
      <div>
        <small>${title}</small>
        <strong>${bestLabel(best)}</strong>
        <span>${total} รอบ • ${sampleBadge(total)}</span>
      </div>
    </article>
  `
}

function formulaDeck(rec) {
  return `
    <section class="formula-stage panel-lite">
      <div class="section-title-row">
        <div>
          <span class="micro-label">FORMULA DECK</span>
          <h3>ผลทดลอง 7 / 8 / 9%</h3>
        </div>
        <div class="deck-arrows">
          <button type="button" data-deck="prev" aria-label="ก่อนหน้า">‹</button>
          <button type="button" data-deck="next" aria-label="ถัดไป">›</button>
        </div>
      </div>
      <div class="formula-deck" id="formulaDeck">
        ${TEST_PERCENTS.map((percent) => {
          const calc = rec.calculations[percent]
          const day = rec.dayBest.includes(percent)
          const number = rec.numberBest.includes(percent)
          const strong = rec.strongMatch.includes(percent)
          return `
            <article class="formula-card ${strong ? 'is-strong' : ''}">
              <div class="formula-card-top">
                <span class="percent-orb">${percent}%</span>
                <div class="signal-tags">
                  ${day ? '<span>DAY</span>' : ''}
                  ${number ? '<span>NUMBER</span>' : ''}
                  ${strong ? '<span class="strong-tag">MATCH</span>' : ''}
                </div>
              </div>
              <small>${rec.latest.top3} × ${percent}%</small>
              <strong>${calc.formatted}</strong>
              ${digitChips(calc.digits, 'compact')}
            </article>
          `
        }).join('')}
      </div>
    </section>
  `
}

function fusionCard(analysis, marketName) {
  const rec = analysis.recommendation
  const fusion = rec.fusion
  const fusionStats = analysis.fusionOverall

  return `
    <section class="fusion-card">
      <div class="fusion-glow"></div>
      <div class="fusion-head">
        <div>
          <span class="micro-label">FUSION OUTPUT</span>
          <h2>ชุดคัด XGEN</h2>
        </div>
        <span class="fusion-score">ย้อนหลัง ${fusionStats.total} รอบ</span>
      </div>

      <div class="fusion-feature">
        <div class="feature-block hot-block">
          <small>🔥 ตัวแรง</small>
          ${digitChips(fusion.hot, 'hot-digits')}
        </div>
        <div class="feature-block">
          <small>⭐ ตัวรอง</small>
          ${digitChips(fusion.secondary)}
        </div>
      </div>

      <div class="win-panel">
        <div class="win-label"><span>WIN7</span><small>เรียงตามคะแนนรวม</small></div>
        ${digitChips(fusion.win7, 'win-digits')}
      </div>

      <div class="output-grid">
        <article>
          <small>🎯 เจาะ 2</small>
          ${setChips(fusion.pairs)}
        </article>
        <article>
          <small>🎯 เจาะ 3</small>
          ${setChips(fusion.triples)}
        </article>
      </div>

      <div class="copy-actions">
        <button type="button" class="copy-primary" data-copy="all">คัดลอกทั้งหมด</button>
        <button type="button" data-copy="win">WIN</button>
        <button type="button" data-copy="pair">เจาะ 2</button>
        <button type="button" data-copy="triple">เจาะ 3</button>
      </div>
      <p class="copy-note">ข้อความที่คัดลอกจะมีเฉพาะผลคัดแล้ว — ไม่ใส่สูตร, เปอร์เซ็นต์, DAY MODEL หรือ NUMBER MODEL</p>
    </section>
  `
}

function behaviorPanel(rec) {
  const behavior = rec.fusion.behavior
  const ranked = rec.fusion.ranked.slice(0, 5)
  return `
    <section class="behavior-panel panel-lite">
      <div class="section-title-row">
        <div>
          <span class="micro-label">NUMBER BEHAVIOR</span>
          <h3>พฤติกรรมเลขรอบถัดไป</h3>
        </div>
        <span class="mode-chip">TRANSITION</span>
      </div>

      <div class="behavior-grid">
        <article><span>🪞</span><small>เลขเงา</small>${digitChips(behavior.shadows, 'mini')}</article>
        <article><span>↔️</span><small>ขยับ ±1</small>${digitChips(behavior.plusMinus1, 'mini')}</article>
        <article><span>⇄</span><small>ขยับ ±2</small>${digitChips(behavior.plusMinus2, 'mini')}</article>
        <article><span>👯</span><small>พี่น้อง</small>${setChips(behavior.siblingPairs)}</article>
        <article><span>🔄</span><small>เบิ้ลเฝ้า</small>${setChips(behavior.doubles)}</article>
      </div>

      <div class="rank-list">
        ${ranked.map((entry, index) => `
          <div class="rank-item">
            <span class="rank-no">0${index + 1}</span>
            <strong>${entry.digit}</strong>
            <div><span>${entry.score.toFixed(1)} pts</span><small>${entry.reasons.slice(0, 3).join(' • ')}</small></div>
          </div>
        `).join('')}
      </div>
    </section>
  `
}

function fusionPerformance(analysis) {
  const stats = analysis.fusionOverall
  return `
    <section class="performance panel-lite">
      <div class="section-title-row">
        <div>
          <span class="micro-label">BACKTEST SNAPSHOT</span>
          <h3>FUSION ครอบคลุมย้อนหลัง</h3>
        </div>
        <span class="mode-chip">${stats.total} TRANSITIONS</span>
      </div>
      <div class="performance-grid">
        <article><small>ผ่านอย่างน้อย 1 ฝั่ง</small><strong>${stats.anyHits}/${stats.total}</strong>${rateBar(stats)}</article>
        <article><small>เข้า 2 ตัวบน</small><strong>${stats.topHits}/${stats.total}</strong><span class="metric-caption">ตรวจบนแยกฝั่ง</span></article>
        <article><small>เข้า 2 ตัวล่าง</small><strong>${stats.bottomHits}/${stats.total}</strong><span class="metric-caption">ต้องครบ 2 ตัว</span></article>
        <article><small>บน + ล่างพร้อมกัน</small><strong>${stats.bothHits}/${stats.total}</strong><span class="metric-caption">ไม่เอาบน 1 + ล่าง 1 มารวม</span></article>
      </div>
    </section>
  `
}

function overviewView(analysis, marketName, rowCount) {
  const rec = analysis.recommendation
  const dayGroup = analysis.byDay[rec.dayIndex]
  const numberGroup = analysis.byHundreds[rec.hundreds.key]
  const dayTotal = dayGroup.byPercent[7].total
  const numberTotal = numberGroup.byPercent[7].total
  const strong = rec.strongMatch.length > 0

  return `
    <div class="tab-view active" data-view="overview">
      <section class="signal-hero">
        <div class="signal-topline">
          <span>${escapeHtml(marketName)}</span>
          <span>ย้อนหลัง ${rowCount} งวด</span>
        </div>
        <div class="latest-wrap">
          <div>
            <small>${formatDate(rec.latest.draw_date)} • ${rec.dayLabel}</small>
            <strong>${rec.latest.top3}<i>-</i>${rec.latest.bottom2}</strong>
          </div>
          <div class="hundred-orb">
            <span>${rec.hundreds.digit}</span>
            <small>${rec.hundreds.label}</small>
          </div>
        </div>
        <div class="model-grid">
          ${modelCard('◫', 'DAY MODEL', rec.dayBest, dayTotal, 'day-model')}
          ${modelCard('⌁', 'NUMBER MODEL', rec.numberBest, numberTotal, 'number-model')}
        </div>
        <div class="match-banner ${strong ? 'strong' : 'conflict'}">
          ${strong
            ? `<span>✦ STRONG MATCH</span><strong>${bestLabel(rec.strongMatch)}</strong><small>วันและลักษณะหลักร้อยเลือกตรงกัน</small>`
            : `<span>⚖ SIGNAL SPLIT</span><strong>${bestLabel(rec.dayBest)} / ${bestLabel(rec.numberBest)}</strong><small>เก็บสองโมเดลแยกและให้ FUSION ช่วยคัด</small>`}
        </div>
      </section>

      ${formulaDeck(rec)}
      ${fusionCard(analysis, marketName)}
      ${behaviorPanel(rec)}
      ${fusionPerformance(analysis)}
    </div>
  `
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

function dayView(analysis) {
  const rows = WEEKDAY_LABELS.map((label, dayIndex) => {
    const group = analysis.byDay[dayIndex]
    const total = group.byPercent[7].total
    return `
      <tr>
        <th><div>${label}</div><small>${total} รอบ ${sampleBadge(total)}</small></th>
        ${TEST_PERCENTS.map((percent) => statsCell(group.byPercent[percent], group.bestPercents, percent)).join('')}
        <td class="metric fusion-metric"><strong>${group.fusion.anyHits}/${group.fusion.total || 0}</strong><span>${group.fusion.rate.toFixed(0)}%</span><small>FUSION</small></td>
        <td class="winner">${bestLabel(group.bestPercents)}</td>
      </tr>
    `
  }).join('')

  return `
    <div class="tab-view" data-view="day">
      <section class="table-panel panel-lite">
        <div class="section-title-row"><div><span class="micro-label">DAY MODEL</span><h3>เปอร์เซ็นต์แยกตามวัน</h3></div><span class="mode-chip">MARKET ONLY</span></div>
        <p class="table-help">นับจากวันของงวดต้นทาง → ผลงวดถัดไปของตลาดเดียวกัน</p>
        <div class="table-scroll"><table><thead><tr><th>วัน</th><th>7%</th><th>8%</th><th>9%</th><th>FUSION</th><th>เด่น</th></tr></thead><tbody>${rows}</tbody></table></div>
      </section>
    </div>
  `
}

function numberView(analysis) {
  const rows = HUNDRED_GROUP_ORDER.map((key) => {
    const group = analysis.byHundreds[key]
    const total = group.byPercent[7].total
    return `
      <tr>
        <th><div>${group.label}</div><small>${total} รอบ ${sampleBadge(total)}</small></th>
        ${TEST_PERCENTS.map((percent) => statsCell(group.byPercent[percent], group.bestPercents, percent)).join('')}
        <td class="metric fusion-metric"><strong>${group.fusion.anyHits}/${group.fusion.total || 0}</strong><span>${group.fusion.rate.toFixed(0)}%</span><small>FUSION</small></td>
        <td class="winner">${bestLabel(group.bestPercents)}</td>
      </tr>
    `
  }).join('')

  return `
    <div class="tab-view" data-view="number">
      <section class="table-panel panel-lite">
        <div class="section-title-row"><div><span class="micro-label">NUMBER MODEL</span><h3>แยกตามลักษณะหลักร้อย</h3></div><span class="mode-chip">0–9 DNA</span></div>
        <p class="table-help">คู่ต่ำ 0/2/4 • คู่สูง 6/8 • คี่ต่ำ 1/3 • คี่สูง 5/7/9</p>
        <div class="table-scroll"><table><thead><tr><th>ลักษณะ</th><th>7%</th><th>8%</th><th>9%</th><th>FUSION</th><th>เด่น</th></tr></thead><tbody>${rows}</tbody></table></div>
      </section>
    </div>
  `
}

function hitText(test) {
  if (test.topHit && test.bottomHit) return 'บน + ล่าง'
  if (test.topHit) return 'บน'
  if (test.bottomHit) return 'ล่าง'
  return '—'
}

function historyView(analysis) {
  const transitions = [...analysis.transitions].reverse()
  return `
    <div class="tab-view" data-view="history">
      <section class="table-panel panel-lite">
        <div class="section-title-row"><div><span class="micro-label">AUDIT TRAIL</span><h3>ตรวจย้อนหลังทีละรอบ</h3></div><span class="mode-chip">${transitions.length} ROWS</span></div>
        <p class="table-help">กติกาเดิม: บนต้องอย่างน้อย 2 ตัว • ล่างต้องครบ 2 ตัว • ห้ามรวมบน 1 + ล่าง 1</p>
        <div class="table-scroll"><table class="audit-table"><thead><tr><th>ต้นทาง → งวดถัดไป</th><th>7%</th><th>8%</th><th>9%</th><th>FUSION</th></tr></thead><tbody>
          ${transitions.map((transition) => `
            <tr>
              <th><div>${transition.dayLabel} ${transition.source.top3}-${transition.source.bottom2}</div><small>${formatDate(transition.source.draw_date)} → ${transition.next.top3}-${transition.next.bottom2}</small></th>
              ${TEST_PERCENTS.map((percent) => {
                const test = transition.tests[percent]
                return `<td class="audit-cell ${test.anyHit ? 'pass' : ''}"><strong>${test.formatted}</strong><small>${hitText(test)}</small></td>`
              }).join('')}
              <td class="audit-cell fusion-audit ${transition.fusion.anyHit ? 'pass' : ''}"><strong>${transition.fusion.uniqueDigits.join(' • ')}</strong><small>${hitText(transition.fusion)}</small></td>
            </tr>
          `).join('')}
        </tbody></table></div>
      </section>
    </div>
  `
}

function renderAnalysis(analysis, marketName, rowCount) {
  currentOutput = { analysis, marketName }
  results.innerHTML = `
    ${overviewView(analysis, marketName, rowCount)}
    ${dayView(analysis)}
    ${numberView(analysis)}
    ${historyView(analysis)}
  `
  results.hidden = false
  labNav.hidden = false
  bindResultInteractions()
  setActiveTab('overview')
}

function showToast(message) {
  clearTimeout(toastTimer)
  toast.textContent = message
  toast.classList.add('show')
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800)
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    textarea.remove()
  }
  showToast('คัดลอกแล้ว ✓')
}

function copyPayload(type) {
  const rec = currentOutput?.analysis?.recommendation
  const fusion = rec?.fusion
  if (!rec || !fusion) return ''

  if (type === 'all') {
    return buildPublicCopy({ marketName: currentOutput.marketName, latest: rec.latest, fusion })
  }
  if (type === 'win') return `✨ WIN7 ${fusion.win7.join(' • ')}`
  if (type === 'pair') return `🎯 เจาะ 2 ${fusion.pairs.join(' • ') || 'ไม่มี'}`
  if (type === 'triple') return `🎯 เจาะ 3 ${fusion.triples.join(' • ') || 'ไม่มี'}`
  return ''
}

function setActiveTab(name) {
  labNav.querySelectorAll('[data-tab]').forEach((button) => button.classList.toggle('active', button.dataset.tab === name))
  results.querySelectorAll('[data-view]').forEach((view) => view.classList.toggle('active', view.dataset.view === name))
}

function bindResultInteractions() {
  results.querySelectorAll('[data-copy]').forEach((button) => {
    button.addEventListener('click', () => {
      const payload = copyPayload(button.dataset.copy)
      if (payload) copyText(payload)
    })
  })

  const deck = results.querySelector('#formulaDeck')
  results.querySelectorAll('[data-deck]').forEach((button) => {
    button.addEventListener('click', () => {
      const direction = button.dataset.deck === 'next' ? 1 : -1
      deck?.scrollBy({ left: direction * Math.max(240, deck.clientWidth * 0.72), behavior: 'smooth' })
    })
  })
}

labNav.addEventListener('click', (event) => {
  const button = event.target.closest('[data-tab]')
  if (!button) return
  setActiveTab(button.dataset.tab)
})

async function analyzeSelectedMarket() {
  const marketKey = marketSelect.value
  const marketName = marketSelect.options[marketSelect.selectedIndex]?.textContent || marketKey
  if (!marketKey) return

  analyzeButton.disabled = true
  marketSelect.disabled = true
  analyzeButton.classList.add('loading')
  status.textContent = 'กำลังดึงย้อนหลังสูงสุด 30 งวดและสร้าง DAY / NUMBER / FUSION / BEHAVIOR...'
  results.hidden = true
  labNav.hidden = true

  try {
    const rows = await loadAnalysisRows(marketKey)
    if (rows.length < 2) throw new Error('ตลาดนี้มีข้อมูลไม่พอสำหรับจับงวดก่อน → งวดถัดไป')
    const analysis = analyzePercentageHistory(rows)
    renderAnalysis(analysis, marketName, rows.length)
    status.textContent = `พร้อมแล้ว • ${analysis.transitions.length} ช่วงเปลี่ยนงวด • วิเคราะห์เฉพาะ ${marketName}`
  } catch (error) {
    console.error(error)
    status.textContent = `วิเคราะห์ไม่ได้: ${error?.message || 'เกิดข้อผิดพลาด'}`
  } finally {
    marketSelect.disabled = false
    analyzeButton.disabled = false
    analyzeButton.classList.remove('loading')
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
  labNav.hidden = true
  status.textContent = 'เปลี่ยนตลาดแล้ว • กดวิเคราะห์เพื่อคำนวณใหม่'
})

init()
