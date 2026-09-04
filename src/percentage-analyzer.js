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

export const SHADOW_MAP = {
  0: 5,
  1: 6,
  2: 7,
  3: 8,
  4: 9,
  5: 0,
  6: 1,
  7: 2,
  8: 3,
  9: 4,
}

function parseTop3(top3) {
  const value = String(top3 ?? '').trim().padStart(3, '0')
  if (!/^\d{3}$/.test(value)) throw new Error('3 ตัวบนต้องเป็นตัวเลข 3 หลัก')
  return value
}

function mod10(value) {
  return ((Number(value) % 10) + 10) % 10
}

function unique(values) {
  return [...new Set(values)]
}

function digitCounts(values) {
  const counts = new Map()
  values.forEach((digit) => counts.set(digit, (counts.get(digit) || 0) + 1))
  return counts
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
  const counts = digitCounts(sourceDigits)
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

function buildFusionTest(tests, next) {
  const digits = TEST_PERCENTS.flatMap((percent) => tests[percent].digits)
  return {
    digits,
    uniqueDigits: unique(digits),
    ...evaluateCalculatedDigits(digits, next),
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
      fusion: buildFusionTest(tests, next),
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

function finalizeStats(stats) {
  stats.rate = stats.total ? (stats.anyHits / stats.total) * 100 : 0
  return stats
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

  TEST_PERCENTS.forEach((percent) => finalizeStats(byPercent[percent]))
  return byPercent
}

function aggregateFusion(transitions) {
  const stats = emptyStats()
  transitions.forEach((transition) => {
    stats.total += 1
    if (transition.fusion.anyHit) stats.anyHits += 1
    if (transition.fusion.topHit) stats.topHits += 1
    if (transition.fusion.bottomHit) stats.bottomHits += 1
    if (transition.fusion.bothHit) stats.bothHits += 1
  })
  return finalizeStats(stats)
}

export function bestPercents(byPercent) {
  const available = TEST_PERCENTS.filter((percent) => (byPercent?.[percent]?.total || 0) > 0)
  if (!available.length) return []
  const maxRate = Math.max(...available.map((percent) => byPercent[percent].rate))
  return available.filter((percent) => Math.abs(byPercent[percent].rate - maxRate) < 0.000001)
}

function percentPriority(overall) {
  return [...TEST_PERCENTS].sort((left, right) => (
    (overall?.[right]?.rate || 0) - (overall?.[left]?.rate || 0)
    || (overall?.[right]?.anyHits || 0) - (overall?.[left]?.anyHits || 0)
    || right - left
  ))
}

function createScoreEntry(digit, firstSeen = 999) {
  return {
    digit,
    score: 0,
    formulaCount: 0,
    occurrences: 0,
    firstSeen,
    reasons: new Set(),
  }
}

function addScore(entries, digit, amount, reason, firstSeen = 999) {
  if (!entries.has(digit)) entries.set(digit, createScoreEntry(digit, firstSeen))
  const entry = entries.get(digit)
  entry.score += amount
  entry.firstSeen = Math.min(entry.firstSeen, firstSeen)
  if (reason) entry.reasons.add(reason)
}

function isSibling(a, b) {
  return mod10(a + 1) === b || mod10(b + 1) === a
}

function pairKey(a, b) {
  return a <= b ? `${a}${b}` : `${b}${a}`
}

function pairDigits(key) {
  return key.split('').map(Number)
}

function pairBehaviorBonus(a, b) {
  let bonus = 0
  if (isSibling(a, b)) bonus += 0.8
  if (SHADOW_MAP[a] === b || SHADOW_MAP[b] === a) bonus += 0.8
  return bonus
}

function buildPairCandidates(ranked, calculations, priority = TEST_PERCENTS) {
  const entryMap = new Map(ranked.map((entry) => [entry.digit, entry]))
  const hottestDigit = ranked[0]?.digit
  const normalizedPriority = [
    ...priority.filter((percent) => TEST_PERCENTS.includes(percent)),
    ...TEST_PERCENTS.filter((percent) => !priority.includes(percent)),
  ]
  const perFormula = {}

  TEST_PERCENTS.forEach((percent) => {
    const formulaDigits = unique(calculations[percent].digits)
    const candidates = []

    for (let left = 0; left < formulaDigits.length; left += 1) {
      for (let right = left + 1; right < formulaDigits.length; right += 1) {
        const key = pairKey(formulaDigits[left], formulaDigits[right])
        const [a, b] = pairDigits(key)
        const aEntry = entryMap.get(a)
        const bEntry = entryMap.get(b)
        if (!aEntry || !bEntry) continue

        candidates.push({
          key,
          percent,
          score: aEntry.score + bEntry.score + pairBehaviorBonus(a, b),
        })
      }
    }

    perFormula[percent] = candidates.sort((left, right) => (
      right.score - left.score
      || Number(left.key) - Number(right.key)
    ))
  })

  const selected = []
  const seen = new Set()
  const selectedByFormula = Object.fromEntries(TEST_PERCENTS.map((percent) => [percent, 0]))
  let hottestUses = 0

  // เลือกแบบวนสูตรตามผลงานย้อนหลัง เพื่อไม่ให้สูตรเดียวหรือเลขแรงตัวเดียวกินคู่เกือบทั้งหมด
  for (let round = 0; round < 2; round += 1) {
    normalizedPriority.forEach((percent) => {
      if (selected.length >= 6 || selectedByFormula[percent] >= 2) return
      const candidates = perFormula[percent] || []

      const candidate = candidates.find((item) => {
        if (seen.has(item.key)) return false
        const containsHottest = hottestDigit != null && pairDigits(item.key).includes(hottestDigit)
        if (containsHottest && hottestUses >= 2) return false
        return true
      })

      if (!candidate) return
      selected.push(candidate)
      seen.add(candidate.key)
      selectedByFormula[percent] += 1
      if (hottestDigit != null && pairDigits(candidate.key).includes(hottestDigit)) hottestUses += 1
    })
  }

  // กรณีสูตรใดมีเลขไม่พอสร้าง 2 คู่ ให้เติมจาก candidate ที่เหลือโดยยังคงห้ามคู่ซ้ำ
  if (selected.length < 6) {
    const fallback = TEST_PERCENTS
      .flatMap((percent) => perFormula[percent] || [])
      .filter((item) => !seen.has(item.key))
      .sort((left, right) => right.score - left.score || Number(left.key) - Number(right.key))

    for (const candidate of fallback) {
      if (selected.length >= 6) break
      selected.push(candidate)
      seen.add(candidate.key)
    }
  }

  return selected.slice(0, 6).map((item) => item.key)
}

function buildTripleCandidates(ranked, calculations) {
  const pool = ranked.slice(0, 6)
  const triples = []

  for (let a = 0; a < pool.length; a += 1) {
    for (let b = a + 1; b < pool.length; b += 1) {
      for (let c = b + 1; c < pool.length; c += 1) {
        const digits = [pool[a], pool[b], pool[c]]
        let score = digits.reduce((sum, entry) => sum + entry.score, 0)
        if (TEST_PERCENTS.some((percent) => digits.every((entry) => calculations[percent].digits.includes(entry.digit)))) {
          score += 1.5
        }
        triples.push({ digits: digits.map((entry) => entry.digit), score })
      }
    }
  }

  return triples
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((triple) => triple.digits.join(''))
}

export function buildFusionRecommendation(
  latest,
  calculations,
  dayBest = [],
  numberBest = [],
  priority = TEST_PERCENTS,
) {
  const normalized = normalizeResult(latest)
  if (!normalized) throw new Error('ผลล่าสุดไม่ถูกต้อง')

  const entries = new Map()
  let appearance = 0

  TEST_PERCENTS.forEach((percent) => {
    const digits = calculations[percent].digits
    const counts = digitCounts(digits)
    unique(digits).forEach((digit) => {
      addScore(entries, digit, 2, `อยู่ในชุด ${percent}`, appearance)
      const entry = entries.get(digit)
      entry.formulaCount += 1
      entry.occurrences += counts.get(digit) || 0
      if ((counts.get(digit) || 0) > 1) addScore(entries, digit, 0.5, 'เกิดซ้ำในผลคำนวณ', appearance)
      if (dayBest.includes(percent)) addScore(entries, digit, 1.4, 'DAY MODEL รองรับ', appearance)
      if (numberBest.includes(percent)) addScore(entries, digit, 1.4, 'NUMBER MODEL รองรับ', appearance)
      appearance += 1
    })
  })

  const sourceDigits = unique(normalized.top3.split('').map(Number))
  const plusMinus1 = unique(sourceDigits.flatMap((digit) => [mod10(digit - 1), mod10(digit + 1)]))
  const plusMinus2 = unique(sourceDigits.flatMap((digit) => [mod10(digit - 2), mod10(digit + 2)]))
  const shadows = unique(sourceDigits.map((digit) => SHADOW_MAP[digit]))

  plusMinus1.forEach((digit) => addScore(entries, digit, 0.9, 'ขยับ ±1'))
  plusMinus2.forEach((digit) => addScore(entries, digit, 0.6, 'ขยับ ±2'))
  shadows.forEach((digit) => addScore(entries, digit, 0.7, 'เลขเงา'))

  const ranked = [...entries.values()]
    .map((entry) => ({ ...entry, reasons: [...entry.reasons] }))
    .sort((left, right) => (
      right.score - left.score
      || right.formulaCount - left.formulaCount
      || right.occurrences - left.occurrences
      || left.firstSeen - right.firstSeen
      || left.digit - right.digit
    ))

  const rankedDigits = ranked.map((entry) => entry.digit)
  const win7 = rankedDigits.slice(0, 7)
  const win6 = rankedDigits.slice(0, 6)
  const hot = rankedDigits.slice(0, 2)
  const secondary = rankedDigits.slice(2, 5)

  const formulaCounts = new Map()
  TEST_PERCENTS.forEach((percent) => {
    const counts = digitCounts(calculations[percent].digits)
    counts.forEach((count, digit) => {
      if (count >= 2) formulaCounts.set(digit, Math.max(formulaCounts.get(digit) || 0, count))
    })
  })

  const doubles = [...formulaCounts.keys()]
    .sort((a, b) => (entries.get(b)?.score || 0) - (entries.get(a)?.score || 0))
    .slice(0, 3)
    .map((digit) => `${digit}${digit}`)

  const siblingPairs = []
  for (let left = 0; left < win7.length; left += 1) {
    for (let right = left + 1; right < win7.length; right += 1) {
      if (isSibling(win7[left], win7[right])) {
        const key = pairKey(win7[left], win7[right])
        if (!siblingPairs.includes(key)) siblingPairs.push(key)
      }
    }
  }

  return {
    ranked,
    hot,
    secondary,
    win6,
    win7,
    pairs: buildPairCandidates(ranked, calculations, priority),
    triples: buildTripleCandidates(ranked, calculations),
    behavior: {
      shadows,
      plusMinus1,
      plusMinus2,
      siblingPairs: siblingPairs.slice(0, 4),
      doubles,
    },
  }
}

function joinDigits(values) {
  return values?.length ? values.join(' • ') : 'ไม่มี'
}

function joinSets(values) {
  return values?.length ? values.join(' • ') : 'ไม่มี'
}

export function buildPublicCopy({ marketName, latest, fusion }) {
  const market = String(marketName || 'XGEN LAB').trim()
  const result = normalizeResult(latest)
  if (!result) throw new Error('ไม่มีผลล่าสุดสำหรับคัดลอก')

  return [
    `🧬 XGEN LAB | ${market}`,
    `ผลล่าสุด ${result.top3}-${result.bottom2}`,
    '',
    `🔥 ตัวแรง ${joinDigits(fusion.hot)}`,
    `⭐ ตัวรอง ${joinDigits(fusion.secondary)}`,
    `✨ WIN7 ${joinDigits(fusion.win7)}`,
    '',
    `🎯 เจาะ 2 ${joinSets(fusion.pairs)}`,
    `🎯 เจาะ 3 ${joinSets(fusion.triples)}`,
    '',
    `🪞 เงา ${joinDigits(fusion.behavior.shadows)}`,
    `👯 พี่น้อง ${joinSets(fusion.behavior.siblingPairs)}`,
    `🔄 เบิ้ล ${joinSets(fusion.behavior.doubles)}`,
  ].join('\n')
}

export function analyzePercentageHistory(rows) {
  const transitions = buildTransitions(rows)
  const overall = aggregateTransitions(transitions)
  const fusionOverall = aggregateFusion(transitions)
  const priority = percentPriority(overall)

  const byDay = {}
  WEEKDAY_LABELS.forEach((label, dayIndex) => {
    const group = transitions.filter((transition) => transition.dayIndex === dayIndex)
    byDay[dayIndex] = {
      label,
      transitions: group,
      byPercent: aggregateTransitions(group),
      fusion: aggregateFusion(group),
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
      fusion: aggregateFusion(group),
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
    const calculations = Object.fromEntries(
      TEST_PERCENTS.map((percent) => [percent, calculatePercentDigits(latest.top3, percent)]),
    )

    recommendation = {
      latest,
      dayIndex,
      dayLabel: WEEKDAY_LABELS[dayIndex],
      hundreds,
      dayBest,
      numberBest,
      strongMatch,
      calculations,
      fusion: buildFusionRecommendation(latest, calculations, dayBest, numberBest, priority),
    }
  }

  return {
    transitions,
    overall,
    fusionOverall,
    overallBestPercents: bestPercents(overall),
    percentPriority: priority,
    byDay,
    byHundreds,
    recommendation,
  }
}
