import { normalizeResult } from './win6xgen.js'

export const TEST_PERCENTS = [7, 8, 9]
export const WEEKDAY_LABELS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
export const HUNDRED_GROUP_ORDER = ['even-low', 'even-high', 'odd-low', 'odd-high']
export const HUNDRED_GROUP_LABELS = {
  'even-low': 'คู่ต่ำ 0 • 2 • 4',
  'even-high': 'คู่สูง 6 • 8',
  'odd-low': 'คี่ต่ำ 1 • 3',
  'odd-high': 'คี่สูง 5 • 7 • 9',
}

function parseTop3(top3) {
  const value = String(top3 ?? '').trim().padStart(3, '0')
  if (!/^\d{3}$/.test(value)) throw new Error('3 ตัวบนต้องเป็นตัวเลข 3 หลัก')
  return value
}

export function calculatePercentDigits(top3, percent) {
  const normalizedTop3 = parseTop3(top3)
  const pct = Number(percent)
  if (!TEST_PERCENTS.includes(pct)) throw new Error('เปอร์เซ็นต์ต้องเป็น 7, 8 หรือ 9')

  const value = (Number(normalizedTop3) * pct) / 100
  const formatted = value.toFixed(2)
  const digits = formatted.replace('.', '').split('').map(Number)

  return {
    top3: normalizedTop3,
    percent: pct,
    value,
    formatted,
    digits,
  }
}

function consumeMatches(sourceDigits, targetDigits) {
  const counts = new Map()
  sourceDigits.forEach((digit) => counts.set(digit, (counts.get(digit) || 0) + 1))

  const matched = []
  targetDigits.forEach((digit) => {
    const remaining = counts.get(digit) || 0
    if (remaining > 0) {
      matched.push(digit)
      counts.set(digit, remaining - 1)
    }
  })
  return matched
}

export function evaluateCalculatedDigits(calculatedDigits, nextRow) {
  const normalized = normalizeResult(nextRow)
  if (!normalized) throw new Error('ผลงวดถัดไปรูปแบบไม่ถูกต้อง')

  const topDigits = normalized.top3.split('').map(Number)
  const bottomDigits = normalized.bottom2.split('').map(Number)
  const topMatched = consumeMatches(calculatedDigits, topDigits)
  const bottomMatched = consumeMatches(calculatedDigits, bottomDigits)

  const topHit = topMatched.length >= 2
  const bottomHit = bottomMatched.length === 2

  return {
    topMatched,
    bottomMatched,
    topHit,
    bottomHit,
    anyHit: topHit || bottomHit,
    bothHit: topHit && bottomHit,
  }
}

export function weekdayIndex(drawDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(drawDate || ''))) return null
  return new Date(`${drawDate}T12:00:00Z`).getUTCDay()
}

export function classifyHundreds(top3) {
  const normalizedTop3 = parseTop3(top3)
  const digit = Number(normalizedTop3[0])
  const parity = digit % 2 === 0 ? 'even' : 'odd'
  const level = digit <= 4 ? 'low' : 'high'
  const key = `${parity}-${level}`

  return {
    digit,
    parity,
    level,
    key,
    label: HUNDRED_GROUP_LABELS[key],
  }
}

export function buildTransitions(rows) {
  const normalized = (rows || [])
    .map(normalizeResult)
    .filter((row) => row?.draw_date)
    .sort((left, right) => left.draw_date.localeCompare(right.draw_date))

  const transitions = []
  for (let index = 0; index < normalized.length - 1; index += 1) {
    const source = normalized[index]
    const next = normalized[index + 1]
    const dayIndex = weekdayIndex(source.draw_date)
    const hundreds = classifyHundreds(source.top3)
    const tests = {}

    TEST_PERCENTS.forEach((percent) => {
      const calculation = calculatePercentDigits(source.top3, percent)
      tests[percent] = {
        ...calculation,
        ...evaluateCalculatedDigits(calculation.digits, next),
      }
    })

    transitions.push({
      source,
      next,
      dayIndex,
      dayLabel: WEEKDAY_LABELS[dayIndex],
      hundreds,
      tests,
    })
  }

  return transitions
}

function emptyStats() {
  return {
    total: 0,
    anyHits: 0,
    topHits: 0,
    bottomHits: 0,
    bothHits: 0,
    rate: 0,
  }
}

function aggregateTransitions(transitions) {
  const byPercent = Object.fromEntries(TEST_PERCENTS.map((percent) => [percent, emptyStats()]))

  transitions.forEach((transition) => {
    TEST_PERCENTS.forEach((percent) => {
      const stats = byPercent[percent]
      const test = transition.tests[percent]
      stats.total += 1
      if (test.anyHit) stats.anyHits += 1
      if (test.topHit) stats.topHits += 1
      if (test.bottomHit) stats.bottomHits += 1
      if (test.bothHit) stats.bothHits += 1
    })
  })

  TEST_PERCENTS.forEach((percent) => {
    const stats = byPercent[percent]
    stats.rate = stats.total ? (stats.anyHits / stats.total) * 100 : 0
  })

  return byPercent
}

export function bestPercents(byPercent) {
  const available = TEST_PERCENTS.filter((percent) => (byPercent?.[percent]?.total || 0) > 0)
  if (!available.length) return []
  const maxRate = Math.max(...available.map((percent) => byPercent[percent].rate))
  return available.filter((percent) => Math.abs(byPercent[percent].rate - maxRate) < 0.000001)
}

export function analyzePercentageHistory(rows) {
  const transitions = buildTransitions(rows)
  const overall = aggregateTransitions(transitions)

  const byDay = {}
  WEEKDAY_LABELS.forEach((label, dayIndex) => {
    const group = transitions.filter((transition) => transition.dayIndex === dayIndex)
    byDay[dayIndex] = {
      label,
      transitions: group,
      byPercent: aggregateTransitions(group),
    }
    byDay[dayIndex].bestPercents = bestPercents(byDay[dayIndex].byPercent)
  })

  const byHundreds = {}
  HUNDRED_GROUP_ORDER.forEach((key) => {
    const group = transitions.filter((transition) => transition.hundreds.key === key)
    byHundreds[key] = {
      key,
      label: HUNDRED_GROUP_LABELS[key],
      transitions: group,
      byPercent: aggregateTransitions(group),
    }
    byHundreds[key].bestPercents = bestPercents(byHundreds[key].byPercent)
  })

  const sortedRows = (rows || [])
    .map(normalizeResult)
    .filter((row) => row?.draw_date)
    .sort((left, right) => right.draw_date.localeCompare(left.draw_date))
  const latest = sortedRows[0] || null

  let recommendation = null
  if (latest) {
    const dayIndex = weekdayIndex(latest.draw_date)
    const hundreds = classifyHundreds(latest.top3)
    const dayBest = byDay[dayIndex]?.bestPercents || []
    const numberBest = byHundreds[hundreds.key]?.bestPercents || []
    const strongMatch = dayBest.filter((percent) => numberBest.includes(percent))

    recommendation = {
      latest,
      dayIndex,
      dayLabel: WEEKDAY_LABELS[dayIndex],
      hundreds,
      dayBest,
      numberBest,
      strongMatch,
      calculations: Object.fromEntries(
        TEST_PERCENTS.map((percent) => [percent, calculatePercentDigits(latest.top3, percent)]),
      ),
    }
  }

  return {
    transitions,
    overall,
    overallBestPercents: bestPercents(overall),
    byDay,
    byHundreds,
    recommendation,
  }
}
