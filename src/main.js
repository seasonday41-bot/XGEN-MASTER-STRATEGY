import '@fontsource-variable/noto-sans-thai'
import './style.css'
import { predictNextPattern } from './syntrax-predict.js'
import { formatCopySection, formatCopyText } from './copy.js'
import { rankMarketMatches } from './market-search.js'
import { analyzeSyntraXPattern } from './syntrax-pattern.js'
import { loadMarketData, loadMarkets } from './supabase.js'
import { analyzeWin6Xgen } from './win6xgen.js'

const app = document.querySelector('#app')

app.innerHTML = `
  <main class="app-shell">
    <div class="sky-glow" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>

    <header class="temple-hero">
      <button id="menuButton" class="round-menu" type="button" aria-label="เลือกตลาด"><span></span><span></span><span></span></button>
      <div class="fortune-charm jade" aria-hidden="true"><b>福</b><i></i></div>
      <div class="hero-scenery" aria-hidden="true"><i></i><i></i><i></i><span></span></div>
      <div class="hero-dragon" aria-hidden="true"></div>
      <div class="hero-brand">
        <div class="crown-mark" aria-hidden="true"><i></i><b>◆</b><i></i></div>
        <h1>XGEN</h1>
        <p>MASTER STRATEGY</p>
        <div class="brand-rule"><i></i><span>WIN6XGEN</span><i></i></div>
        <strong>แนวทางตัวเลขส่วนตัวของคุณ</strong>
      </div>
      <div class="fortune-charm ruby" aria-hidden="true"><b>財</b><i></i></div>
      <div class="hero-lotus left" aria-hidden="true">🪷</div>
      <div class="hero-lotus right" aria-hidden="true">🪷</div>
    </header>

    <section class="quick-controls" aria-label="ตัวเลือกข้อมูล">
      <button id="marketButton" class="control-pill market-pill" type="button">
        <span id="marketFlag" class="flag-orb">🌐</span>
        <span class="control-copy"><small>Market</small><b id="marketButtonName">กำลังโหลดตลาด</b></span>
        <i>⌄</i>
      </button>
      <button id="dateButton" class="control-pill date-pill" type="button">
        <span class="calendar-icon" aria-hidden="true">▦</span>
        <span class="control-copy"><small>Date</small><b id="drawDate">—</b></span>
        <i>⌄</i>
      </button>
      <button id="historyButton" class="history-button" type="button">
        <span aria-hidden="true">◷</span><b>ดูประวัติ</b>
      </button>
    </section>

    <div id="status" class="status loading" role="status"><i></i><span>กำลังเชื่อมต่อ six-digit-thai-lao</span></div>

    <section id="analysisIssue" class="analysis-issue hidden" aria-labelledby="issueTitle">
      <div class="issue-glow" aria-hidden="true">◇</div>
      <header>
        <small>XGEN NOTICE</small>
        <h2 id="issueTitle">ยังไม่มีชุดสำหรับงวดนี้</h2>
        <p id="issueSummary">ข้อมูลอัปเดตแล้ว กรุณาลองใหม่ในภายหลัง</p>
      </header>
      <button id="issueHistoryButton" class="issue-history-button" type="button">ดูข้อมูลย้อนหลังทั้งหมด</button>
    </section>

    <section id="result" class="result hidden" aria-live="polite" aria-busy="false">
      <article class="latest-palace ornate-card">
        <div class="ornate-corner tl"></div><div class="ornate-corner tr"></div>
        <div class="ornate-corner bl"></div><div class="ornate-corner br"></div>
        <div class="section-banner"><span>ผลล่าสุด</span></div>
        <div class="latest-number"><b id="sourceTop">---</b><i>–</i><b id="sourceBottom" class="bottom">--</b></div>

        <div class="result-divider" aria-hidden="true"><i></i><span>✦</span><i></i></div>

        <div class="rud-banner">
          <span>รูดหลัก</span>
          <b id="rudMain">—</b><i>•</i><b id="rudSub" class="ruby-text">—</b>
        </div>
      </article>

      <section class="output-grid">
        <article class="win-card ornate-card viewport-reveal">
          <div class="mini-banner">WIN 6 ตัว</div>
          <div id="win6" class="win-digits"></div>
        </article>

        <div class="drill-stack">
          <article class="drill-card emerald-card viewport-reveal">
            <h2><span>เจาะ 2 ตัว</span><i>◇</i></h2>
            <div id="pin2" class="pick-row"></div>
          </article>
          <article class="drill-card emerald-card viewport-reveal">
            <h2><span>เจาะ 3 ตัว</span><i>◇</i></h2>
            <div id="pin3" class="pick-row triple-row"></div>
          </article>
        </div>
      </section>

      <article class="pattern-card ornate-card viewport-reveal">
        <div class="pattern-head">
          <div><small>PATTERN FLOW</small><h2>สัญญาณรอบถัดไป</h2></div>
          <span id="topPattern" class="pattern-badge">NORMAL</span>
        </div>
        <div class="pattern-signals">
          <div><small>เบิ้ล</small><b id="doubleWatch">ปกติ</b><span id="doubleDetail">—</span></div>
          <div><small>พี่น้อง</small><b id="siblingWatch">ปกติ</b><span id="siblingDetail">—</span></div>
          <div><small>ตอง</small><b id="tripleWatch">ปกติ</b><span id="tripleDetail">—</span></div>
        </div>
        <p>ใช้เป็นสัญญาณติดตามเท่านั้น ไม่ใช่การยืนยันผล</p>
      </article>

      <article class="info-card ornate-card viewport-reveal">
        <h2>ข้อมูลเพิ่มเติม</h2>
        <div class="info-grid">
          <div><span class="info-icon">⌂</span><small>ตลาด</small><b id="infoMarket">—</b></div>
          <div><span class="info-icon">▥</span><small>ข้อมูลย้อนหลัง</small><b id="historyUsed">—</b></div>
          <div><span class="info-icon">♢</span><small>สถานะระบบ</small><b id="systemStatus">พร้อมใช้งาน</b></div>
        </div>
        <p class="disclaimer">* เป็นแนวทางจากโครงสร้างตัวเลขและข้อมูลย้อนหลัง ไม่การันตีผล 100%</p>
      </article>

      <section class="copy-actions" aria-label="คัดลอกผล">
        <button type="button" data-copy="rud"><span>▣</span><b>COPY<br>รูด</b></button>
        <button type="button" data-copy="win6" class="ruby-button"><span>▣</span><b>COPY<br>WIN6</b></button>
        <button type="button" data-copy="pin2"><span>▣</span><b>COPY<br>เจาะ 2</b></button>
        <button type="button" data-copy="pin3" class="ruby-button"><span>▣</span><b>COPY<br>เจาะ 3</b></button>
      </section>
      <button id="copyAll" class="copy-all" type="button">คัดลอกผลทั้งหมด</button>
    </section>

    <div class="bottom-spacer" aria-hidden="true"></div>
  </main>

  <nav class="bottom-nav" aria-label="เมนูหลัก">
    <i class="nav-indicator" aria-hidden="true"></i>
    <button id="navHome" class="active" type="button"><span>⌂</span><b>หน้าหลัก</b></button>
    <button id="navMarket" type="button"><span>⌕</span><b>ค้นหางวด</b></button>
    <button id="navAnalyze" type="button"><span>☯</span><b>วิเคราะห์</b></button>
    <button id="navCopy" type="button"><span>☆</span><b>คัดลอก</b></button>
    <button id="navRefresh" type="button"><span>↻</span><b>รีเฟรช</b></button>
  </nav>

  <dialog id="marketDialog" class="sheet-dialog market-dialog">
    <div class="sheet-head"><div><small>MARKET SELECTOR</small><h2>เลือกตลาด</h2></div><button type="button" data-close="marketDialog">×</button></div>
    <label class="market-search"><span>⌕</span><input id="marketSearch" type="search" placeholder="ค้นหา เช่น ลาวพัฒนา" autocomplete="off"></label>
    <div id="marketList" class="market-list"></div>
  </dialog>

  <dialog id="historyDialog" class="sheet-dialog history-dialog">
    <div class="sheet-head"><div><small>RECENT RESULTS</small><h2 id="historyTitle">ประวัติผล</h2></div><button type="button" data-close="historyDialog">×</button></div>
    <div id="historyList" class="history-list"></div>
  </dialog>

  <div id="toast" class="toast" role="status">✓ คัดลอกแล้ว</div>
`

const elements = {
  menuButton: document.querySelector('#menuButton'),
  marketButton: document.querySelector('#marketButton'),
  marketButtonName: document.querySelector('#marketButtonName'),
  marketFlag: document.querySelector('#marketFlag'),
  dateButton: document.querySelector('#dateButton'),
  drawDate: document.querySelector('#drawDate'),
  historyButton: document.querySelector('#historyButton'),
  status: document.querySelector('#status'),
  analysisIssue: document.querySelector('#analysisIssue'),
  issueTitle: document.querySelector('#issueTitle'),
  issueSummary: document.querySelector('#issueSummary'),
  issueHistoryButton: document.querySelector('#issueHistoryButton'),
  result: document.querySelector('#result'),
  sourceTop: document.querySelector('#sourceTop'),
  sourceBottom: document.querySelector('#sourceBottom'),
  latestNumber: document.querySelector('.latest-number'),
  rudBanner: document.querySelector('.rud-banner'),
  rudMain: document.querySelector('#rudMain'),
  rudSub: document.querySelector('#rudSub'),
  winCard: document.querySelector('.win-card'),
  win6: document.querySelector('#win6'),
  pin2: document.querySelector('#pin2'),
  pin3: document.querySelector('#pin3'),
  topPattern: document.querySelector('#topPattern'),
  doubleWatch: document.querySelector('#doubleWatch'),
  doubleDetail: document.querySelector('#doubleDetail'),
  siblingWatch: document.querySelector('#siblingWatch'),
  siblingDetail: document.querySelector('#siblingDetail'),
  tripleWatch: document.querySelector('#tripleWatch'),
  tripleDetail: document.querySelector('#tripleDetail'),
  infoMarket: document.querySelector('#infoMarket'),
  historyUsed: document.querySelector('#historyUsed'),
  systemStatus: document.querySelector('#systemStatus'),
  copyActions: document.querySelector('.copy-actions'),
  copyAll: document.querySelector('#copyAll'),
  marketDialog: document.querySelector('#marketDialog'),
  marketSearch: document.querySelector('#marketSearch'),
  marketList: document.querySelector('#marketList'),
  historyDialog: document.querySelector('#historyDialog'),
  historyTitle: document.querySelector('#historyTitle'),
  historyList: document.querySelector('#historyList'),
  toast: document.querySelector('#toast'),
  bottomNav: document.querySelector('.bottom-nav'),
  navButtons: [...document.querySelectorAll('.bottom-nav button')],
}

const state = {
  markets: [],
  selectedMarket: null,
  rows: [],
  selectedIndex: 0,
  current: null,
  loading: false,
}

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

function nextPaint() {
  return new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)))
}

function restartAnimation(element, className) {
  if (!element) return
  element.classList.remove(className)
  void element.offsetWidth
  element.classList.add(className)
}

function setLoading(isLoading) {
  elements.result.classList.toggle('is-loading', isLoading)
  elements.result.setAttribute('aria-busy', String(isLoading))
}

function setActiveNav(button) {
  const index = elements.navButtons.indexOf(button)
  if (index < 0) return
  elements.navButtons.forEach((item) => item.classList.toggle('active', item === button))
  elements.bottomNav.style.setProperty('--nav-index', index)
}

function observeReveals() {
  const revealElements = document.querySelectorAll('.viewport-reveal')
  if (reduceMotion.matches || !('IntersectionObserver' in window)) {
    revealElements.forEach((element) => element.classList.add('is-visible'))
    return
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return
      entry.target.classList.add('is-visible')
      observer.unobserve(entry.target)
    })
  }, { threshold: 0.14 })

  revealElements.forEach((element) => observer.observe(element))
}

window.requestAnimationFrame(() => document.body.classList.add('page-ready'))
observeReveals()

function flagForMarket(name) {
  const value = String(name || '').toLocaleLowerCase('th-TH')
  const rules = [
    [/ลาว|lao/, '🇱🇦'], [/ฮานอย|เวียดนาม/, '🇻🇳'], [/ฮั่งเส็ง|ฮ่องกง/, '🇭🇰'],
    [/ไต้หวัน/, '🇹🇼'], [/จีน/, '🇨🇳'], [/นิคเคอิ|นิเคอิ|ญี่ปุ่น/, '🇯🇵'],
    [/เกาหลี/, '🇰🇷'], [/สิงคโปร์/, '🇸🇬'], [/ดาวโจนส์|ดาวโจน/, '🇺🇸'],
    [/ไทย|ธ\.ก\.ส|ออมสิน/, '🇹🇭'], [/อินเดีย/, '🇮🇳'], [/อังกฤษ/, '🇬🇧'],
    [/เยอรมัน/, '🇩🇪'], [/รัสเซีย/, '🇷🇺'], [/มาเลย์/, '🇲🇾'], [/อียิปต์/, '🇪🇬'],
  ]
  return rules.find(([pattern]) => pattern.test(value))?.[1] || '🌐'
}

function formatThaiDate(dateString) {
  if (!dateString) return '—'
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  }).format(new Date(`${dateString}T00:00:00+07:00`))
}

function setStatus(message, type = 'ready') {
  elements.status.className = `status ${type}`
  elements.status.querySelector('span').textContent = message
}

function showToast(message = '✓ คัดลอกแล้ว') {
  elements.toast.textContent = message
  elements.toast.classList.add('show')
  window.clearTimeout(showToast.timer)
  showToast.timer = window.setTimeout(() => elements.toast.classList.remove('show'), 1500)
}

function showCopyFeedback(button) {
  if (!button) return
  const icon = button.querySelector('span')
  const label = button.querySelector('b')
  const originalIcon = icon?.textContent
  const originalLabel = label?.innerHTML
  const originalText = button.textContent

  button.classList.add('copied')
  if (icon) icon.textContent = '✓'
  if (label) label.textContent = 'คัดลอกแล้ว'
  if (!icon && !label) button.textContent = '✓ คัดลอกแล้ว'

  window.clearTimeout(button.copyResetTimer)
  button.copyResetTimer = window.setTimeout(() => {
    button.classList.remove('copied')
    if (icon) icon.textContent = originalIcon
    if (label) label.innerHTML = originalLabel
    if (!icon && !label) button.textContent = originalText
  }, 1300)
}

async function copyText(text, trigger) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.append(textarea)
    textarea.select()
    document.execCommand('copy')
    textarea.remove()
  }
  navigator.vibrate?.(25)
  showCopyFeedback(trigger)
  showToast()
}

function openDialog(dialog) {
  if (!dialog.open) dialog.showModal()
}

function renderMarketList(query = '') {
  const matches = rankMarketMatches(state.markets, query, state.selectedMarket?.market_key)

  elements.marketList.replaceChildren()
  elements.marketList.scrollTop = 0
  if (!matches.length) {
    const empty = document.createElement('p')
    empty.className = 'list-empty'
    empty.textContent = 'ไม่พบตลาดที่ค้นหา'
    elements.marketList.append(empty)
    return
  }

  matches.forEach((market) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = market.market_key === state.selectedMarket?.market_key ? 'active' : ''
    button.dataset.marketKey = market.market_key

    const flag = document.createElement('span')
    flag.textContent = flagForMarket(market.market_name)
    const name = document.createElement('b')
    name.textContent = market.market_name
    const action = document.createElement('i')
    action.textContent = market.market_key === state.selectedMarket?.market_key ? 'กำลังใช้ ✓' : 'เลือก ›'
    button.append(flag, name, action)
    elements.marketList.append(button)
  })
}

function patternStatusLabel(status) {
  return {
    ACTIVE: 'พบล่าสุด',
    TRACK: 'ติดตาม',
    WATCH: 'เฝ้าดู',
    NORMAL: 'ปกติ',
  }[status] || status
}

function renderPattern(pattern) {
  const current = pattern.current
  const signals = pattern.nextSignals
  elements.topPattern.textContent = current.top.type
  elements.topPattern.dataset.pattern = current.top.type

  elements.doubleWatch.textContent = patternStatusLabel(signals.double.status)
  elements.doubleDetail.textContent = signals.double.active
    ? 'จับตารอบถัดไป'
    : current.hasDouble ? 'รอบล่าสุดพบเบิ้ล' : 'ยังไม่เปิดสัญญาณ'

  elements.siblingWatch.textContent = patternStatusLabel(signals.sibling.status)
  elements.siblingDetail.textContent = signals.sibling.active
    ? `ติดตามรอบ ${signals.sibling.round}/${signals.sibling.total}`
    : current.hasSibling ? 'รอบล่าสุดพบพี่น้อง' : 'ยังไม่เปิดสัญญาณ'

  elements.tripleWatch.textContent = patternStatusLabel(signals.triple.status)
  elements.tripleDetail.textContent = signals.triple.active
    ? `ติดตามรอบ ${signals.triple.round}/${signals.triple.total}`
    : current.hasTriple ? `รอบล่าสุด ${current.row.top3}` : 'ยังไม่เปิดสัญญาณ'

  ;[
    [elements.doubleWatch, signals.double],
    [elements.siblingWatch, signals.sibling],
    [elements.tripleWatch, signals.triple],
  ].forEach(([element, signal]) => {
    element.parentElement.dataset.state = signal.active ? signal.status : 'NORMAL'
  })
}

function renderHistory() {
  if (!state.rows.length || !state.selectedMarket) return
  elements.historyTitle.textContent = `ประวัติ ${state.selectedMarket.market_name}`
  elements.historyList.innerHTML = state.rows.slice(0, 20).map((row, index) => `
    <button type="button" class="history-item ${index === 0 ? 'latest' : ''} ${index === state.selectedIndex ? 'selected' : ''}" data-history-index="${index}">
      <span>${String(index + 1).padStart(2, '0')}</span>
      <div><small>${formatThaiDate(row.draw_date)}</small><b>${row.top3}<i>–</i>${row.bottom2}</b></div>
      <em>${index === state.selectedIndex ? 'กำลังดู' : index === 0 ? 'ล่าสุด' : ''}</em>
    </button>
  `).join('')
}

function analyzeHistoryAt(index) {
  const source = state.rows[index]
  const history = state.rows.slice(index + 1)
  if (!source || !history.length) throw new Error('ข้อมูลย้อนหลังไม่พอสำหรับงวดนี้')

  const core = analyzeWin6Xgen({ ...source, history })
  const pattern = analyzeSyntraXPattern(core.source, core.history, core.rud)
  const prediction = predictNextPattern(state.rows)
  return {
    marketName: state.selectedMarket.market_name,
    allRows: state.rows,
    ...core,
    pattern,
  prediction,
  }
}

function renderIssue(error, market, data) {
  const details = error.details || {}
  const source = details.source || data

  elements.issueTitle.textContent = `ยังไม่มีชุดสำหรับ ${market.market_name}`
  elements.issueSummary.textContent = 'ตรวจข้อมูลล่าสุดครบแล้ว กรุณาลองใหม่อีกครั้งในภายหลัง'
  elements.drawDate.textContent = formatThaiDate(source?.draw_date)

  elements.marketButtonName.textContent = market.market_name
  elements.marketFlag.textContent = flagForMarket(market.market_name)
  elements.result.classList.add('hidden')
  setLoading(false)
  elements.analysisIssue.classList.remove('hidden', 'reveal')
  void elements.analysisIssue.offsetWidth
  elements.analysisIssue.classList.add('reveal')
  renderHistory()
}

function renderResult(analysis) {
  elements.sourceTop.textContent = analysis.source.top3
  elements.sourceBottom.textContent = analysis.source.bottom2
  elements.rudMain.textContent = analysis.rud[0]
  elements.rudSub.textContent = analysis.rud[1]
  elements.drawDate.textContent = formatThaiDate(analysis.source.draw_date)

  const parenthesizedDigit = Number.isInteger(analysis.reserve) ? `
    <span class="win-parenthesized" aria-label="เลขวงเล็บ ${analysis.reserve}">
      <i>(</i><b>${analysis.reserve}</b><i>)</i>
    </span>
  ` : ''

  elements.win6.innerHTML = analysis.win6.map((digit, index) => `
    <span class="win-digit ${index < 2 ? 'axis' : ''} ${index === 1 ? 'ruby' : 'jade'}" style="--win-index:${index}"><b>${digit}</b></span>
  `).join('') + parenthesizedDigit
  elements.pin2.innerHTML = analysis.pin2.map((item, index) => `<b class="${index === 0 ? 'recommended' : index === 1 ? 'secondary' : ''}">${item.pair}</b>`).join('')
  elements.pin3.innerHTML = analysis.pin3.map((item, index) => `<b class="${index === 0 ? 'recommended' : index === 1 ? 'secondary' : ''}">${item.triple}</b>`).join('')

  renderPattern(analysis.pattern)
  console.log("Pattern Prediction:", analysis.prediction)
  elements.infoMarket.textContent = analysis.marketName
  elements.historyUsed.textContent = `อ้างอิง ${analysis.historyUsed} งวด`
  elements.systemStatus.textContent = 'พร้อมใช้งาน'

  elements.marketButtonName.textContent = analysis.marketName
  elements.marketFlag.textContent = flagForMarket(analysis.marketName)
  elements.analysisIssue.classList.add('hidden')
  elements.result.classList.remove('hidden')
  setLoading(false)
  restartAnimation(elements.result, 'reveal')
  restartAnimation(elements.latestNumber, 'number-reveal')
  restartAnimation(elements.rudBanner, 'rud-reveal')
  restartAnimation(elements.winCard, 'win-reveal')
  renderHistory()
}

async function runAnalysis(marketKey) {
  if (state.loading) return
  const market = state.markets.find((item) => item.market_key === marketKey)
  if (!market) return

  const previous = {
    market: state.selectedMarket,
    rows: state.rows,
    selectedIndex: state.selectedIndex,
    current: state.current,
  }
  const hadVisibleResult = Boolean(state.current?.win6 && !elements.result.classList.contains('hidden'))

  state.loading = true
  state.selectedMarket = market
  elements.analysisIssue.classList.add('hidden')
  elements.marketButtonName.textContent = market.market_name
  elements.marketFlag.textContent = flagForMarket(market.market_name)
  setLoading(hadVisibleResult)
  setStatus('กำลังประมวลผลข้อมูลล่าสุด...', 'loading')

  let data
  try {
    if (hadVisibleResult) await nextPaint()
    data = await loadMarketData(marketKey)
    state.rows = data.allRows
    state.selectedIndex = 0
    state.current = analyzeHistoryAt(0)
    localStorage.setItem('xgen-market', marketKey)
    renderResult(state.current)
    setStatus(`พร้อม • ${market.market_name} • อัปเดต ${formatThaiDate(state.current.source.draw_date)}`, 'ready')
  } catch (error) {
    if (data && error.details) {
      console.warn(error)
      state.rows = data.allRows
      state.selectedIndex = 0
      state.current = {
        marketName: market.market_name,
        allRows: data.allRows,
        failure: true,
      }
      localStorage.setItem('xgen-market', marketKey)
      renderIssue(error, market, data)
      setStatus(`อัปเดตแล้ว • ยังไม่มีชุดสำหรับ ${market.market_name}`, 'blocked')
    } else {
      console.error(error)
      if (hadVisibleResult) {
        state.selectedMarket = previous.market
        state.rows = previous.rows
        state.selectedIndex = previous.selectedIndex
        state.current = previous.current
        elements.marketButtonName.textContent = previous.market.market_name
        elements.marketFlag.textContent = flagForMarket(previous.market.market_name)
      }
      setStatus(`${market.market_name} • ${error.message || 'คำนวณไม่สำเร็จ'}`, 'error')
    }
  } finally {
    state.loading = false
    setLoading(false)
  }
}

async function selectHistoryAt(index) {
  if (state.loading || index === state.selectedIndex || !state.rows[index]) return

  state.loading = true
  setLoading(true)
  setStatus('กำลังเปลี่ยนข้อมูลงวด...', 'loading')

  try {
    await nextPaint()
    state.selectedIndex = index
    state.current = analyzeHistoryAt(index)
    renderResult(state.current)
    setStatus(`พร้อม • ${state.selectedMarket.market_name} • งวด ${formatThaiDate(state.current.source.draw_date)}`, 'ready')
  } catch (error) {
    console.warn(error)
    state.current = {
      marketName: state.selectedMarket.market_name,
      allRows: state.rows,
      failure: true,
    }
    renderIssue(error, state.selectedMarket, state.rows[index])
    setStatus(`งวด ${formatThaiDate(state.rows[index].draw_date)} • ${error.message}`, 'blocked')
  } finally {
    state.loading = false
    setLoading(false)
  }
}

async function initialize() {
  try {
    state.markets = await loadMarkets()
    if (!state.markets.length) throw new Error('ไม่พบตลาดที่พร้อมใช้งาน')
    renderMarketList()

    const saved = localStorage.getItem('xgen-market')
    const preferred = state.markets.find((market) => market.market_key === saved)
      || state.markets.find((market) => market.market_name === 'ลาวพัฒนา')
      || state.markets[0]
    await runAnalysis(preferred.market_key)
  } catch (error) {
    console.error(error)
    setStatus(error.message || 'เชื่อมต่อข้อมูลไม่สำเร็จ', 'error')
  }
}

function openMarketDialog() {
  renderMarketList(elements.marketSearch.value)
  openDialog(elements.marketDialog)
  window.setTimeout(() => elements.marketSearch.focus(), 120)
}

elements.marketButton.addEventListener('click', openMarketDialog)
elements.menuButton.addEventListener('click', openMarketDialog)
elements.marketSearch.addEventListener('input', (event) => renderMarketList(event.target.value))
elements.marketList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-market-key]')
  if (!button) return
  elements.marketDialog.close()
  elements.marketSearch.value = ''
  await runAnalysis(button.dataset.marketKey)
})

elements.historyButton.addEventListener('click', () => {
  if (!state.rows.length) return
  renderHistory()
  openDialog(elements.historyDialog)
})
elements.issueHistoryButton.addEventListener('click', () => elements.historyButton.click())
elements.dateButton.addEventListener('click', () => elements.historyButton.click())
elements.historyList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-history-index]')
  if (!button) return
  elements.historyDialog.close()
  await selectHistoryAt(Number(button.dataset.historyIndex))
})

document.querySelectorAll('[data-close]').forEach((button) => {
  button.addEventListener('click', () => document.querySelector(`#${button.dataset.close}`).close())
})
document.querySelectorAll('.sheet-dialog').forEach((dialog) => {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close()
  })
})

elements.copyActions.addEventListener('click', (event) => {
  const button = event.target.closest('[data-copy]')
  if (button && state.current?.win6) copyText(formatCopySection(state.current, button.dataset.copy), button)
})
elements.copyAll.addEventListener('click', () => state.current?.win6 && copyText(formatCopyText(state.current), elements.copyAll))

elements.navButtons.forEach((button) => button.addEventListener('click', () => setActiveNav(button)))
document.querySelector('#navHome').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }))
document.querySelector('#navMarket').addEventListener('click', openMarketDialog)
document.querySelector('#navAnalyze').addEventListener('click', () => {
  const target = elements.analysisIssue.classList.contains('hidden') ? elements.result : elements.analysisIssue
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
})
document.querySelector('#navCopy').addEventListener('click', () => state.current?.win6 && copyText(formatCopyText(state.current)))
document.querySelector('#navRefresh').addEventListener('click', () => state.selectedMarket && runAnalysis(state.selectedMarket.market_key))

initialize()
