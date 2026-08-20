import '@fontsource-variable/noto-sans-thai'
import './style.css'
import { formatCopySection, formatCopyText } from './copy.js'
import { analyzeSyntraXPattern } from './syntrax-pattern.js'
import { loadMarketData, loadMarkets } from './supabase.js'
import { analyzeWin6Xgen } from './win6xgen.js'

const DRAGON_ASSET = 'https://raw.githubusercontent.com/seasonday41-bot/SyntraX/main/assets/dragon.svg'
const app = document.querySelector('#app')

app.innerHTML = `
  <main class="app-shell">
    <div class="sky-glow" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>

    <header class="temple-hero">
      <button id="menuButton" class="round-menu" type="button" aria-label="เลือกตลาด"><span></span><span></span><span></span></button>
      <div class="fortune-charm jade" aria-hidden="true"><b>福</b><i></i></div>
      <img class="hero-dragon" src="${DRAGON_ASSET}" alt="" aria-hidden="true">
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
        <b id="marketButtonName">กำลังโหลดตลาด</b>
        <i>⌄</i>
      </button>
      <button id="dateButton" class="control-pill date-pill" type="button">
        <span class="calendar-icon" aria-hidden="true">▦</span>
        <b id="drawDate">—</b>
        <i>⌄</i>
      </button>
      <button id="historyButton" class="history-button" type="button">
        <span aria-hidden="true">✦</span><b>ดูประวัติ</b>
      </button>
    </section>

    <div id="status" class="status loading" role="status"><i></i><span>กำลังเชื่อมต่อ six-digit-thai-lao</span></div>

    <section id="result" class="result hidden" aria-live="polite">
      <article class="latest-palace ornate-card">
        <div class="ornate-corner tl"></div><div class="ornate-corner tr"></div>
        <div class="ornate-corner bl"></div><div class="ornate-corner br"></div>
        <img class="card-dragon left" src="${DRAGON_ASSET}" alt="" aria-hidden="true">
        <img class="card-dragon right" src="${DRAGON_ASSET}" alt="" aria-hidden="true">
        <div class="section-banner"><span>ผลล่าสุด</span></div>
        <div class="latest-number"><b id="sourceTop">---</b><i>–</i><b id="sourceBottom" class="bottom">--</b></div>

        <div class="fgh-stage">
          <div class="formula-gem f-gem"><small>F <span id="fRule">2 ตัวบน</span></small><b id="fDigit">—</b><em>mod 10</em></div>
          <div class="lotus-seal" aria-hidden="true"><span>🪷</span></div>
          <div class="formula-gem g-gem"><small>G <span>2 ตัวล่าง</span></small><b id="gDigit">—</b><em>mod 10</em></div>
          <div class="formula-gem h-gem"><small>H <span>F + G</span></small><b id="hDigit">—</b><em>mod 10</em></div>
        </div>

        <div class="rud-banner">
          <span>รูดหลัก</span>
          <b id="rudMain">—</b><i>•</i><b id="rudSub" class="ruby-text">—</b>
        </div>
      </article>

      <section class="output-grid">
        <article class="win-card ornate-card">
          <div class="mini-banner">WIN 6 ตัว</div>
          <div id="win6" class="win-digits"></div>
          <div class="reserve-line"><span>สำรอง</span><b id="reserve">—</b></div>
          <div id="modGroups" class="mod-groups"></div>
        </article>

        <div class="drill-stack">
          <article class="drill-card emerald-card">
            <h2><span>เจาะ 2 ตัว</span><i>◇</i></h2>
            <div id="pin2" class="pick-row"></div>
          </article>
          <article class="drill-card emerald-card">
            <h2><span>เจาะ 3 ตัว</span><i>◇</i></h2>
            <div id="pin3" class="pick-row triple-row"></div>
          </article>
        </div>
      </section>

      <article class="pattern-card ornate-card">
        <div class="pattern-head">
          <div><small>SYNTRAX PATTERN MODULE</small><h2>โครงสร้างรอบล่าสุด</h2></div>
          <span id="topPattern" class="pattern-badge">NORMAL</span>
        </div>
        <div class="pattern-signals">
          <div><small>เบิ้ล</small><b id="doubleWatch">NORMAL</b><span id="doubleDetail">—</span></div>
          <div><small>พี่น้อง</small><b id="siblingWatch">NORMAL</b><span id="siblingDetail">—</span></div>
          <div><small>หาม / ตอง</small><b id="specialPattern">ไม่มี</b><span id="patternFlow">—</span></div>
        </div>
        <p>SyntraX อ่าน Pattern แยกจาก WIN6 CORE และไม่เปลี่ยน WIN6 หรือรูด F/G</p>
      </article>

      <article class="info-card ornate-card">
        <h2>ข้อมูลเพิ่มเติม</h2>
        <div class="info-grid">
          <div><span class="info-icon">◉</span><small>ประเภท</small><b id="infoMarket">—</b></div>
          <div><span class="info-icon">▣</span><small>อ้างอิงข้อมูล</small><b id="historyUsed">—</b></div>
          <div><span class="info-icon">♢</span><small>โครงสร้าง</small><b id="partitionType">—</b></div>
        </div>
        <details class="proof-details">
          <summary>ดูหลักฐานการคำนวณ WIN6XGEN</summary>
          <div class="proof-grid">
            <p><span>ค้นย้อนหลัง</span><b id="searchMode">—</b></p>
            <p><span>Candidate Pool</span><b id="candidatePool">—</b></p>
            <p><span>คู่เติม</span><b id="fillPair">—</b></p>
          </div>
        </details>
        <p class="disclaimer">* เป็นแนวทางจากโครงสร้างตัวเลขและข้อมูลย้อนหลัง ไม่การันตีผล 100%</p>
      </article>

      <section class="copy-actions" aria-label="คัดลอกผล">
        <button type="button" data-copy="rud"><span>▣</span><b>คัดลอก<br>รูด</b></button>
        <button type="button" data-copy="win6" class="ruby-button"><span>▣</span><b>คัดลอก<br>WIN6</b></button>
        <button type="button" data-copy="pin2"><span>▣</span><b>คัดลอก<br>เจาะ 2</b></button>
        <button type="button" data-copy="pin3" class="ruby-button"><span>▣</span><b>คัดลอก<br>เจาะ 3</b></button>
      </section>
      <button id="copyAll" class="copy-all" type="button">คัดลอกผลทั้งหมด</button>
    </section>

    <div class="bottom-spacer" aria-hidden="true"></div>
  </main>

  <nav class="bottom-nav" aria-label="เมนูหลัก">
    <button id="navHome" class="active" type="button"><span>⌂</span><b>หน้าหลัก</b></button>
    <button id="navMarket" type="button"><span>⌕</span><b>ค้นหางวด</b></button>
    <button id="navAnalyze" type="button"><span>☯</span><b>วิเคราะห์</b></button>
    <button id="navCopy" type="button"><span>☆</span><b>คัดลอก</b></button>
    <button id="navRefresh" type="button"><span>↻</span><b>รีเฟรช</b></button>
  </nav>

  <dialog id="marketDialog" class="sheet-dialog">
    <div class="sheet-head"><div><small>MARKET SELECTOR</small><h2>เลือกตลาด</h2></div><button type="button" data-close="marketDialog">×</button></div>
    <label class="market-search"><span>⌕</span><input id="marketSearch" type="search" placeholder="ค้นหา เช่น ลาวพัฒนา" autocomplete="off"></label>
    <div id="marketList" class="market-list"></div>
  </dialog>

  <dialog id="historyDialog" class="sheet-dialog history-dialog">
    <div class="sheet-head"><div><small>RECENT RESULTS</small><h2 id="historyTitle">ประวัติผล</h2></div><button type="button" data-close="historyDialog">×</button></div>
    <div id="historyList" class="history-list"></div>
  </dialog>

  <div id="toast" class="toast" role="status">คัดลอกแล้ว ✓</div>
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
  result: document.querySelector('#result'),
  sourceTop: document.querySelector('#sourceTop'),
  sourceBottom: document.querySelector('#sourceBottom'),
  fRule: document.querySelector('#fRule'),
  fDigit: document.querySelector('#fDigit'),
  gDigit: document.querySelector('#gDigit'),
  hDigit: document.querySelector('#hDigit'),
  rudMain: document.querySelector('#rudMain'),
  rudSub: document.querySelector('#rudSub'),
  win6: document.querySelector('#win6'),
  reserve: document.querySelector('#reserve'),
  modGroups: document.querySelector('#modGroups'),
  pin2: document.querySelector('#pin2'),
  pin3: document.querySelector('#pin3'),
  topPattern: document.querySelector('#topPattern'),
  doubleWatch: document.querySelector('#doubleWatch'),
  doubleDetail: document.querySelector('#doubleDetail'),
  siblingWatch: document.querySelector('#siblingWatch'),
  siblingDetail: document.querySelector('#siblingDetail'),
  specialPattern: document.querySelector('#specialPattern'),
  patternFlow: document.querySelector('#patternFlow'),
  infoMarket: document.querySelector('#infoMarket'),
  historyUsed: document.querySelector('#historyUsed'),
  partitionType: document.querySelector('#partitionType'),
  searchMode: document.querySelector('#searchMode'),
  candidatePool: document.querySelector('#candidatePool'),
  fillPair: document.querySelector('#fillPair'),
  copyActions: document.querySelector('.copy-actions'),
  copyAll: document.querySelector('#copyAll'),
  marketDialog: document.querySelector('#marketDialog'),
  marketSearch: document.querySelector('#marketSearch'),
  marketList: document.querySelector('#marketList'),
  historyDialog: document.querySelector('#historyDialog'),
  historyTitle: document.querySelector('#historyTitle'),
  historyList: document.querySelector('#historyList'),
  toast: document.querySelector('#toast'),
}

const state = {
  markets: [],
  selectedMarket: null,
  current: null,
  loading: false,
}

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

function showToast(message = 'คัดลอกแล้ว ✓') {
  elements.toast.textContent = message
  elements.toast.classList.add('show')
  window.clearTimeout(showToast.timer)
  showToast.timer = window.setTimeout(() => elements.toast.classList.remove('show'), 1500)
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
    document.body.append(textarea)
    textarea.select()
    document.execCommand('copy')
    textarea.remove()
  }
  navigator.vibrate?.(25)
  showToast()
}

function openDialog(dialog) {
  if (!dialog.open) dialog.showModal()
}

function renderMarketList(query = '') {
  const normalized = query.trim().normalize('NFC').toLocaleLowerCase('th-TH')
  const matches = state.markets.filter((market) =>
    !normalized || market.market_name.normalize('NFC').toLocaleLowerCase('th-TH').includes(normalized),
  )

  elements.marketList.replaceChildren()
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
    ACTIVE: 'กำลังมา',
    STREAK: 'ไหลต่อเนื่อง',
    WATCH: 'เฝ้าดู',
    NORMAL: 'ปกติ',
  }[status] || status
}

function renderPattern(pattern) {
  const current = pattern.current
  elements.topPattern.textContent = current.top.type
  elements.topPattern.dataset.pattern = current.top.type
  elements.doubleWatch.textContent = patternStatusLabel(pattern.doubleWatch)
  elements.doubleDetail.textContent = current.bottomDouble
    ? `ล่างเบิ้ล ${current.bottomDoublePair}`
    : pattern.outputs.doubles.length ? `กัน ${pattern.outputs.doubles.join(' • ')}` : `พบ ${pattern.doubleHits5}/${pattern.recentWindow} งวด`
  elements.siblingWatch.textContent = patternStatusLabel(pattern.siblingWatch)
  elements.siblingDetail.textContent = current.siblings.length
    ? current.siblings.map((item) => `${item.slot} ${item.pair}`).join(' • ')
    : `พบ ${pattern.siblingHits5}/${pattern.recentWindow} งวด`

  const special = [
    ...pattern.outputs.ham.map((value) => `หาม ${value}`),
    ...pattern.outputs.triples.map((value) => `ตอง ${value}`),
  ]
  elements.specialPattern.textContent = special.join(' • ') || current.top.label
  elements.patternFlow.textContent = `Sibling Streak ${pattern.siblingStreak} • Double Streak ${pattern.doubleStreak}`
}

function renderHistory() {
  if (!state.current) return
  elements.historyTitle.textContent = `ประวัติ ${state.current.marketName}`
  elements.historyList.innerHTML = state.current.allRows.slice(0, 20).map((row, index) => `
    <div class="history-item ${index === 0 ? 'latest' : ''}">
      <span>${String(index + 1).padStart(2, '0')}</span>
      <div><small>${formatThaiDate(row.draw_date)}</small><b>${row.top3}<i>–</i>${row.bottom2}</b></div>
      <em>${index === 0 ? 'ล่าสุด' : ''}</em>
    </div>
  `).join('')
}

function renderResult(analysis) {
  elements.sourceTop.textContent = analysis.source.top3
  elements.sourceBottom.textContent = analysis.source.bottom2
  elements.fRule.textContent = analysis.isTriple ? 'ตอง A+B+C' : '2 ตัวบน'
  elements.fDigit.textContent = analysis.f
  elements.gDigit.textContent = analysis.g
  elements.hDigit.textContent = analysis.h
  elements.rudMain.textContent = analysis.rud[0]
  elements.rudSub.textContent = analysis.rud[1]
  elements.drawDate.textContent = formatThaiDate(analysis.source.draw_date)

  elements.win6.innerHTML = analysis.win6.map((digit, index) => `
    <span class="win-digit ${index < 2 ? 'axis' : ''} ${index % 2 ? 'ruby' : 'jade'}"><b>${digit}</b></span>
  `).join('')
  elements.reserve.textContent = analysis.reserve ?? '—'
  elements.modGroups.innerHTML = analysis.mod10Groups.map((group) => `
    <span>${group.join(' + ')} ≡ 0</span>
  `).join('')
  elements.pin2.innerHTML = analysis.pin2.map((item) => `<b>${item.pair}</b>`).join('')
  elements.pin3.innerHTML = analysis.pin3.map((item) => `<b>${item.triple}</b>`).join('')

  renderPattern(analysis.pattern)
  elements.infoMarket.textContent = analysis.marketName
  elements.historyUsed.textContent = `ย้อนหลัง ${analysis.historyUsed} งวด`
  elements.partitionType.textContent = analysis.partitionType === 'PAIR×3' ? 'คู่ MOD10 × 3' : 'ชุด 3 MOD10 × 2'
  elements.searchMode.textContent = analysis.sourceSearch.mode === 'G+H'
    ? 'เจอ G+H ภายใน 5 งวด'
    : 'ไม่เจอ G+H • ใช้ H แล้ว G ชุดแรก'
  elements.candidatePool.textContent = analysis.candidatePool.join(' • ')
  elements.fillPair.textContent = analysis.fillPair
    ? `${analysis.fillPair.pair} จาก ${analysis.fillPair.row.top3}-${analysis.fillPair.row.bottom2}`
    : 'ไม่ต้องเติม'

  elements.marketButtonName.textContent = analysis.marketName
  elements.marketFlag.textContent = flagForMarket(analysis.marketName)
  elements.result.classList.remove('hidden')
  elements.result.classList.remove('reveal')
  void elements.result.offsetWidth
  elements.result.classList.add('reveal')
  renderHistory()
}

async function runAnalysis(marketKey) {
  if (state.loading) return
  const market = state.markets.find((item) => item.market_key === marketKey)
  if (!market) return

  state.loading = true
  state.selectedMarket = market
  state.current = null
  elements.result.classList.add('hidden')
  elements.marketButtonName.textContent = market.market_name
  elements.marketFlag.textContent = flagForMarket(market.market_name)
  setStatus('กำลังคำนวณ F/G/H และค้น Candidate Pool...', 'loading')

  try {
    const data = await loadMarketData(marketKey)
    const core = analyzeWin6Xgen(data)
    const pattern = analyzeSyntraXPattern(core.source, core.history, core.rud)
    state.current = { marketName: market.market_name, allRows: data.allRows, ...core, pattern }
    localStorage.setItem('xgen-market', marketKey)
    renderResult(state.current)
    setStatus(`พร้อม • WIN6XGEN ${core.partitionType} • SyntraX ${pattern.current.top.type}`, 'ready')
  } catch (error) {
    console.error(error)
    setStatus(`${market.market_name} • ${error.message || 'คำนวณไม่สำเร็จ'}`, 'error')
  } finally {
    state.loading = false
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
  if (!state.current) return
  renderHistory()
  openDialog(elements.historyDialog)
})
elements.dateButton.addEventListener('click', () => elements.historyButton.click())

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
  if (button && state.current) copyText(formatCopySection(state.current, button.dataset.copy))
})
elements.copyAll.addEventListener('click', () => state.current && copyText(formatCopyText(state.current)))

document.querySelector('#navHome').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }))
document.querySelector('#navMarket').addEventListener('click', openMarketDialog)
document.querySelector('#navAnalyze').addEventListener('click', () => elements.result.scrollIntoView({ behavior: 'smooth', block: 'start' }))
document.querySelector('#navCopy').addEventListener('click', () => state.current && copyText(formatCopyText(state.current)))
document.querySelector('#navRefresh').addEventListener('click', () => state.selectedMarket && runAnalysis(state.selectedMarket.market_key))

initialize()
