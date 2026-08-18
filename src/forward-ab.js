import { analyzePercentCore } from './formula.js'
import { analyzeMarketIntelligence } from './market-intelligence.js'
import { buildDualSystems } from './dual-engine.js'
import { loadAllRecentResults } from './supabase.js'

const STORAGE_KEY = 'xgen.forward.ab.v1'
const MAX_SNAPSHOTS_PER_MARKET = 16

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"markets":{}}')
  } catch {
    return { markets: {} }
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch (error) {
    console.warn('Xgen Forward A/B store:', error)
  }
}

function compactSystem(system) {
  return {
    strongDigit: system.strongDigit,
    rud: system.rud,
    win6: system.win6,
    pin2: system.pin2.map((item) => item.pair),
    pin3: system.pin3.map((item) => item.triple),
  }
}

function pairKey(value) {
  return value.split('').sort().join('')
}

function tripleKey(value) {
  return value.split('').sort().join('')
}

export function evaluateSystem(system, actual) {
  const topDigits = actual.top3.split('').map(Number)
  const bottomDigits = actual.bottom2.split('').map(Number)
  const rudTargets = `${actual.top3.slice(1)}${actual.bottom2}`.split('').map(Number)
  const topPair = pairKey(actual.top3.slice(1))
  const bottomPair = pairKey(actual.bottom2)
  const actualTriple = tripleKey(actual.top3)

  const topCoverage = topDigits.filter((digit) => system.win6.includes(digit)).length
  const bottomCoverage = bottomDigits.filter((digit) => system.win6.includes(digit)).length
  const rudHit = rudTargets.some((digit) => system.rud.includes(digit))
  const pin2Top = system.pin2.some((pair) => pairKey(pair) === topPair)
  const pin2Bottom = system.pin2.some((pair) => pairKey(pair) === bottomPair)
  const pin3Top = system.pin3.some((triple) => tripleKey(triple) === actualTriple)

  const index =
    topCoverage * 2 +
    bottomCoverage +
    (rudHit ? 1 : 0) +
    (pin2Top ? 2 : 0) +
    (pin2Bottom ? 2 : 0) +
    (pin3Top ? 4 : 0)

  return { topCoverage, bottomCoverage, rudHit, pin2Top, pin2Bottom, pin3Top, index }
}

function nextDrawAfter(history, sourceDate) {
  return history
    .filter((draw) => draw.draw_date > sourceDate)
    .sort((a, b) => a.draw_date.localeCompare(b.draw_date))[0] || null
}

function latestPercentCoreBase(source) {
  const core = analyzePercentCore(source)
  return {
    ...core,
    rud: [...core.strong],
    strongDigit: { digit: core.strong[0] },
  }
}

function snapshotCurrent(item) {
  const source = item.history[0]
  if (!source) return null
  const base = latestPercentCoreBase(source)
  const intelligence = analyzeMarketIntelligence(item.history)
  const dual = buildDualSystems(base, intelligence, item.history)
  if (!dual.fusion) return null

  return {
    marketKey: item.marketKey,
    marketName: item.marketName,
    sourceDate: base.source.draw_date,
    sourceTop3: base.source.top3,
    sourceBottom2: base.source.bottom2,
    createdAt: new Date().toISOString(),
    systems: {
      A: compactSystem(dual.classic),
      B: compactSystem(dual.fusion),
    },
    settled: null,
  }
}

function settleMarketSnapshots(records, history) {
  records.forEach((snapshot) => {
    if (snapshot.settled) return
    const actual = nextDrawAfter(history, snapshot.sourceDate)
    if (!actual) return
    snapshot.settled = {
      actual,
      settledAt: new Date().toISOString(),
      A: evaluateSystem(snapshot.systems.A, actual),
      B: evaluateSystem(snapshot.systems.B, actual),
    }
  })
}

function ensureCurrentSnapshot(records, item) {
  const sourceDate = item.history[0]?.draw_date
  if (!sourceDate || records.some((snapshot) => snapshot.sourceDate === sourceDate)) return
  const snapshot = snapshotCurrent(item)
  if (snapshot) records.push(snapshot)
}

// Legacy lab only. This function is not loaded by the PERCENT CORE production entry.
export async function syncAllForwardAB() {
  const all = await loadAllRecentResults(30)
  const store = readStore()
  store.markets ||= {}

  all.forEach((item) => {
    if (!item.canAnalyze || item.history.length < 4) return
    const records = store.markets[item.marketKey] || []
    settleMarketSnapshots(records, item.history)
    ensureCurrentSnapshot(records, item)
    store.markets[item.marketKey] = records
      .sort((a, b) => b.sourceDate.localeCompare(a.sourceDate))
      .slice(0, MAX_SNAPSHOTS_PER_MARKET)
  })

  store.lastSyncAt = new Date().toISOString()
  writeStore(store)
  return summarizeForwardAB(store)
}

function emptyMetrics() {
  return {
    samples: 0,
    index: 0,
    topCoverage: 0,
    top3Full: 0,
    bottomCoverage: 0,
    rudHit: 0,
    pin2Top: 0,
    pin2Bottom: 0,
    pin3Top: 0,
  }
}

function addMetric(target, result) {
  target.samples += 1
  target.index += result.index
  target.topCoverage += result.topCoverage
  target.top3Full += result.topCoverage === 3 ? 1 : 0
  target.bottomCoverage += result.bottomCoverage
  target.rudHit += result.rudHit ? 1 : 0
  target.pin2Top += result.pin2Top ? 1 : 0
  target.pin2Bottom += result.pin2Bottom ? 1 : 0
  target.pin3Top += result.pin3Top ? 1 : 0
}

function summarizeRecords(records) {
  const A = emptyMetrics()
  const B = emptyMetrics()
  let aWins = 0
  let bWins = 0
  let ties = 0

  records.filter((snapshot) => snapshot.settled).forEach((snapshot) => {
    addMetric(A, snapshot.settled.A)
    addMetric(B, snapshot.settled.B)
    if (snapshot.settled.A.index > snapshot.settled.B.index) aWins += 1
    else if (snapshot.settled.B.index > snapshot.settled.A.index) bWins += 1
    else ties += 1
  })

  return { A, B, aWins, bWins, ties, samples: A.samples }
}

export function summarizeForwardAB(store = readStore(), marketKey = null) {
  const records = marketKey
    ? (store.markets?.[marketKey] || [])
    : Object.values(store.markets || {}).flat()
  return summarizeRecords(records)
}

export function getForwardABSummary(marketKey = null) {
  return summarizeForwardAB(readStore(), marketKey)
}
