import { normalizeResult } from './win6xgen.js'

export const TOP_PATTERN_PRIORITY = ['TRIPLE', 'AAB', 'ABB', 'ABA', 'NORMAL']

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

  const doubleWatch = current.hasDouble
    ? 'ACTIVE'
    : doubleHits5 >= 2 ? 'WATCH' : 'NORMAL'
  const siblingWatch = current.hasSibling
    ? siblingStreak >= 2 ? 'STREAK' : 'ACTIVE'
    : siblingHits5 >= 2 ? 'WATCH' : 'NORMAL'

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
    outputs: {
      doubles: doublePicks,
      siblings: uniqueText(current.siblings.map((item) => item.pair)),
      ham: current.top.type === 'ABA' ? [current.row.top3] : [],
      triples: current.top.type === 'TRIPLE' ? [current.row.top3] : [],
    },
    affectsCore: false,
  }
}
