import { normalizeResult } from './win6xgen.js'

export const TOP_PATTERN_PRIORITY = ['TRIPLE', 'AAB', 'ABB', 'ABA', 'NORMAL']
export const PATTERN_TRACK_WINDOW = 5
export const DOUBLE_SIGNAL_SIBLING_STREAK = 2

const TOP_LABELS = {
  TRIPLE: 'ตอง AAA',
  AAB: 'เบิ้ลหน้า AAB',
  ABB: 'เบิ้ลหลัง ABB',
  ABA: 'หาม ABA',
  NORMAL: 'ปกติ',
}

export function isSibling(a, b) {
  const left = Number(a)
  const right = Number(b)
  if (!Number.isInteger(left) || !Number.isInteger(right) || left === right) return false
  const difference = Math.abs(left - right)
  return difference === 1 || difference === 9
}

export function isSequentialTop(top3) {
  const value = String(top3 ?? '')
  if (!/^\d{3}$/.test(value)) return false

  const digits = value.split('').map(Number)
  if (new Set(digits).size !== 3) return false

  const [a, b, c] = digits
  const firstStep = (b - a + 10) % 10
  const secondStep = (c - b + 10) % 10
  return (firstStep === 1 && secondStep === 1)
    || (firstStep === 9 && secondStep === 9)
}

function topDigitSignature(top3) {
  return String(top3).split('').sort().join('')
}

export function classifyTop(top3) {
  const value = String(top3 ?? '')
  if (!/^\d{3}$/.test(value)) throw new Error('3 ตัวบนไม่ถูกต้อง')
  const [a, b, c] = value.split('').map(Number)

  let type = 'NORMAL'
  if (a === b && b === c) type = 'TRIPLE'
  else if (a === b) type = 'AAB'
  else if (b === c) type = 'ABB'
  else if (a === c) type = 'ABA'

  return { type, label: TOP_LABELS[type], a, b, c }
}

export function inspectSyntraXRow(row) {
  const normalized = normalizeResult(row)
  if (!normalized) throw new Error('ข้อมูลสำหรับ SyntraX ไม่ถูกต้อง')

  const top = classifyTop(normalized.top3)
  const [a, b, c] = normalized.top3.split('').map(Number)
  const [d, e] = normalized.bottom2.split('').map(Number)
  const siblingChecks = [
    { slot: 'AB', pair: `${a}${b}`, active: isSibling(a, b) },
    { slot: 'BC', pair: `${b}${c}`, active: isSibling(b, c) },
    { slot: 'DE', pair: `${d}${e}`, active: isSibling(d, e) },
  ]
  const siblings = siblingChecks.filter((item) => item.active)
  const bottomDouble = d === e
  const topDouble = ['TRIPLE', 'AAB', 'ABB'].includes(top.type)

  return {
    row: normalized,
    top,
    bottomDouble,
    bottomDoublePair: bottomDouble ? `${d}${e}` : null,
    siblingChecks,
    siblings,
    hasSibling: siblings.length > 0,
    hasDouble: topDouble || bottomDouble,
    hasTriple: top.type === 'TRIPLE',
    isSequentialTop: isSequentialTop(normalized.top3),
    topDigitSignature: topDigitSignature(normalized.top3),
  }
}

function consecutiveCount(items, predicate) {
  let count = 0
  for (const item of items) {
    if (!predicate(item)) break
    count += 1
  }
  return count
}

function uniqueText(values) {
  return [...new Set(values.filter(Boolean))]
}

function findLatestEventIndex(items, predicate) {
  for (let index = 0; index < items.length - 1; index += 1) {
    if (predicate(items[index], items[index + 1])) return index
  }
  return -1
}

function trackedSignal(eventIndex, status, reason) {
  const active = eventIndex >= 0 && eventIndex < PATTERN_TRACK_WINDOW
  const round = active ? eventIndex + 1 : null

  return {
    active,
    status: active ? status : 'NORMAL',
    reason: active ? reason : null,
    round,
    total: PATTERN_TRACK_WINDOW,
    remaining: active ? PATTERN_TRACK_WINDOW - round + 1 : 0,
  }
}

function tripleFlowReason(newer, older) {
  const rotation = newer.topDigitSignature === older.topDigitSignature
  const sequence = newer.isSequentialTop && older.isSequentialTop

  if (rotation && sequence) return 'ROTATION_SEQUENCE'
  if (rotation) return 'ROTATION'
  if (sequence) return 'SEQUENCE'
  return null
}

export function analyzeSyntraXPattern(source, history = [], rud = []) {
  const rows = [source, ...(Array.isArray(history) ? history : [])]
    .map(normalizeResult)
    .filter(Boolean)
    .map(inspectSyntraXRow)

  if (!rows.length) throw new Error('SyntraX ต้องมีผลล่าสุด')

  const current = rows[0]
  const recent = rows.slice(0, 5)
  const siblingStreak = consecutiveCount(rows, (item) => item.hasSibling)
  const doubleStreak = consecutiveCount(rows, (item) => item.hasDouble)
  const doubleHits5 = recent.filter((item) => item.hasDouble).length
  const siblingHits5 = recent.filter((item) => item.hasSibling).length

  const doubleSignalActive = siblingStreak >= DOUBLE_SIGNAL_SIBLING_STREAK
  const doubleSignal = {
    active: doubleSignalActive,
    status: doubleSignalActive ? 'WATCH' : 'NORMAL',
    reason: doubleSignalActive ? 'SIBLING_STREAK' : null,
    sourceStreak: siblingStreak,
    round: doubleSignalActive ? 1 : null,
    total: 1,
    remaining: doubleSignalActive ? 1 : 0,
  }

  const doubleEventIndex = findLatestEventIndex(
    rows,
    (newer, older) => newer.hasDouble && older.hasDouble,
  )
  const siblingSignal = trackedSignal(doubleEventIndex, 'TRACK', 'DOUBLE_STREAK')

  let tripleEventIndex = -1
  let tripleReason = null
  for (let index = 0; index < rows.length - 1; index += 1) {
    const reason = tripleFlowReason(rows[index], rows[index + 1])
    if (!reason) continue
    tripleEventIndex = index
    tripleReason = reason
    break
  }
  const tripleSignal = trackedSignal(tripleEventIndex, 'WATCH', tripleReason)

  const doubleWatch = doubleSignal.active
    ? doubleSignal.status
    : current.hasDouble ? 'ACTIVE' : 'NORMAL'
  const siblingWatch = siblingSignal.active
    ? siblingSignal.status
    : current.hasSibling ? 'ACTIVE' : 'NORMAL'
  const tripleWatch = tripleSignal.active
    ? tripleSignal.status
    : current.hasTriple ? 'ACTIVE' : 'NORMAL'

  const doublePicks = uniqueText([
    current.top.type === 'TRIPLE' || current.top.type === 'AAB'
      ? `${current.top.a}${current.top.b}` : null,
    current.top.type === 'ABB' ? `${current.top.b}${current.top.c}` : null,
    current.bottomDoublePair,
    ...rud.map((digit) => `${digit}${digit}`),
  ])

  return {
    engine: 'SYNTRAX_PATTERN_MODULE',
    priority: TOP_PATTERN_PRIORITY,
    current,
    siblingStreak,
    doubleStreak,
    recentWindow: recent.length,
    doubleHits5,
    siblingHits5,
    doubleWatch,
    siblingWatch,
    tripleWatch,
    nextSignals: {
      double: doubleSignal,
      sibling: siblingSignal,
      triple: tripleSignal,
    },
    outputs: {
      doubles: doublePicks,
      siblings: uniqueText(current.siblings.map((item) => item.pair)),
      ham: current.top.type === 'ABA' ? [current.row.top3] : [],
      triples: current.top.type === 'TRIPLE' ? [current.row.top3] : [],
    },
    affectsCore: false,
  }
}
