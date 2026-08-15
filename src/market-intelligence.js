const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value))
const round1 = (value) => Math.round(value * 10) / 10

function assertDraw(draw) {
  if (!draw || !/^\d{3}$/.test(draw.top3) || !/^\d{2}$/.test(draw.bottom2)) {
    throw new Error('ข้อมูลย้อนหลังสำหรับ Market Intelligence ไม่ถูกต้อง')
  }
}

export function circularDistance(a, b) {
  const x = Number(a)
  const y = Number(b)
  const direct = Math.abs(x - y)
  return Math.min(direct, 10 - direct)
}

export function classifyDraw(draw) {
  assertDraw(draw)
  const [a, b, c] = [...draw.top3].map(Number)
  const [d, e] = [...draw.bottom2].map(Number)
  const bottomDistance = circularDistance(d, e)

  return {
    ham: a === c,
    topDouble: a === b || b === c,
    topTriple: a === b && b === c,
    bottomDouble: d === e,
    sibling: bottomDistance === 1,
    nearSibling: bottomDistance === 2,
  }
}

function allDigits(draw) {
  return `${draw.top3}${draw.bottom2}`.split('').map(Number)
}

function bottomDigits(draw) {
  return draw.bottom2.split('').map(Number)
}

function ratio(value, total) {
  return total ? value / total : 0
}

function rate(draws, predicate) {
  if (!draws.length) return 0
  return draws.filter(predicate).length / draws.length
}

function eventGap(history, predicate) {
  const index = history.findIndex(predicate)
  return index === -1 ? null : index
}

function distribution(draws, selector = allDigits) {
  const counts = Array(10).fill(0)
  let total = 0
  draws.forEach((draw) => {
    selector(draw).forEach((digit) => {
      counts[digit] += 1
      total += 1
    })
  })
  return counts.map((count) => ratio(count, total))
}

function totalVariation(left, right) {
  return 0.5 * left.reduce((sum, value, index) => sum + Math.abs(value - right[index]), 0)
}

function windowStats(history, size) {
  const draws = history.slice(0, size)
  const bottoms = draws.flatMap(bottomDigits)
  const highs = bottoms.filter((digit) => digit >= 5).length
  const evens = bottoms.filter((digit) => digit % 2 === 0).length
  const flags = draws.map(classifyDraw)

  const bottomDistribution = distribution(draws, bottomDigits)
  const rankedBottomDigits = bottomDistribution
    .map((share, digit) => ({ digit, share }))
    .sort((left, right) => right.share - left.share || left.digit - right.digit)

  return {
    size: draws.length,
    highRatio: ratio(highs, bottoms.length),
    evenRatio: ratio(evens, bottoms.length),
    hamRate: rate(flags, (item) => item.ham),
    doubleRate: rate(flags, (item) => item.topDouble || item.bottomDouble),
    siblingRate: rate(flags, (item) => item.sibling),
    nearSiblingRate: rate(flags, (item) => item.nearSibling),
    rankedBottomDigits,
    allDistribution: distribution(draws, allDigits),
    bottomDistribution,
  }
}

function bottomRepeatStats(history, size) {
  const draws = history.slice(0, size)
  if (draws.length < 2) return { exactRate: 0, overlapRate: 0, currentExact: false, currentOverlap: 0 }

  let exact = 0
  let overlap = 0
  let pairs = 0

  for (let index = 0; index < draws.length - 1; index += 1) {
    const current = draws[index].bottom2
    const previous = draws[index + 1].bottom2
    pairs += 1
    if (current === previous) exact += 1
    const previousDigits = new Set(previous.split(''))
    if (current.split('').some((digit) => previousDigits.has(digit))) overlap += 1
  }

  const current = draws[0].bottom2
  const previous = draws[1].bottom2
  const currentOverlap = current.split('').filter((digit) => previous.includes(digit)).length

  return {
    exactRate: ratio(exact, pairs),
    overlapRate: ratio(overlap, pairs),
    currentExact: current === previous,
    currentOverlap,
  }
}

function pressure(shortRate, longRate, currentActive = false) {
  return Math.round(clamp((shortRate * 0.70 + longRate * 0.20 + (currentActive ? 0.10 : 0)) * 100))
}

function transitionRate(history, triggerPredicate, outcomePredicate) {
  let samples = 0
  let hits = 0

  // History is newest-first. If history[i] is the trigger, history[i - 1]
  // is the chronologically next draw and is safe for walk-forward counting.
  for (let index = 1; index < history.length; index += 1) {
    const trigger = history[index]
    const nextDraw = history[index - 1]
    if (!triggerPredicate(trigger)) continue
    samples += 1
    if (outcomePredicate(nextDraw)) hits += 1
  }

  return {
    samples,
    hits,
    percentage: samples >= 3 ? Math.round((hits / samples) * 100) : null,
  }
}

function normalizeExpertWeights(raw) {
  const entries = Object.entries(raw)
  const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1
  const normalized = entries.map(([key, value]) => [key, Math.round((value / total) * 100)])
  const delta = 100 - normalized.reduce((sum, [, value]) => sum + value, 0)
  if (normalized.length) normalized[0][1] += delta
  return Object.fromEntries(normalized)
}

function classifyBalance(value, upper = 0.7, lower = 0.3) {
  if (value >= upper) return 'HIGH'
  if (value <= lower) return 'LOW'
  return 'BALANCED'
}

export function analyzeMarketIntelligence(history) {
  if (!Array.isArray(history) || history.length < 4) {
    throw new Error('Market Intelligence ต้องมีข้อมูลย้อนหลังอย่างน้อย 4 งวด')
  }

  history.forEach(assertDraw)
  const capped = history.slice(0, 30)
  const w3 = windowStats(capped, 3)
  const w5 = windowStats(capped, 5)
  const w10 = windowStats(capped, 10)
  const w20 = windowStats(capped, 20)
  const w30 = windowStats(capped, 30)
  const currentFlags = classifyDraw(capped[0])
  const repeat5 = bottomRepeatStats(capped, 5)
  const repeat20 = bottomRepeatStats(capped, 20)

  const baselineSlice = capped.length >= 10 ? capped.slice(5, 15) : capped.slice(Math.min(3, capped.length - 1))
  const recentSlice = capped.slice(0, Math.min(5, capped.length))
  const distributionShift = baselineSlice.length
    ? totalVariation(distribution(recentSlice), distribution(baselineSlice))
    : 0

  const highDelta = Math.abs(w5.highRatio - w20.highRatio)
  const evenDelta = Math.abs(w5.evenRatio - w20.evenRatio)
  const patternDelta = (
    Math.abs(w5.doubleRate - w20.doubleRate) +
    Math.abs(w5.hamRate - w20.hamRate) +
    Math.abs(w5.siblingRate - w20.siblingRate)
  ) / 3

  const shiftScore = Math.round(clamp((
    distributionShift * 0.55 +
    highDelta * 0.15 +
    evenDelta * 0.10 +
    patternDelta * 0.20
  ) * 100))

  const digitMomentum = w5.allDistribution
    .map((share, digit) => ({ digit, share5: share, share20: w20.allDistribution[digit], delta: share - w20.allDistribution[digit] }))
    .sort((left, right) => right.delta - left.delta || right.share5 - left.share5 || left.digit - right.digit)

  const concentration = Math.round((w5.rankedBottomDigits[0]?.share || 0) * 100)
  const highExtremity = Math.abs(w5.highRatio - 0.5) * 2
  const evenExtremity = Math.abs(w5.evenRatio - 0.5) * 2

  const doublePressure = pressure(w5.doubleRate, w20.doubleRate, currentFlags.topDouble || currentFlags.bottomDouble)
  const hamPressure = pressure(w5.hamRate, w20.hamRate, currentFlags.ham)
  const siblingPressure = pressure(w5.siblingRate, w20.siblingRate, currentFlags.sibling)
  const repeatPressure = pressure(repeat5.overlapRate, repeat20.overlapRate, repeat5.currentExact || repeat5.currentOverlap > 0)

  const compressionScore = Math.round(clamp(
    concentration * 0.35 +
    highExtremity * 100 * 0.15 +
    evenExtremity * 100 * 0.10 +
    Math.max(doublePressure, hamPressure, siblingPressure, repeatPressure) * 0.25 +
    shiftScore * 0.15,
  ))

  let state = 'STABLE'
  if (capped.length < 8) state = 'UNKNOWN'
  else if ((currentFlags.ham && currentFlags.bottomDouble) || shiftScore >= 72) state = 'RESET'
  else if (compressionScore >= 68 && shiftScore >= 42) state = 'COMPRESSION'
  else if (shiftScore >= 48) state = 'ROTATION'
  else if ((digitMomentum[0]?.delta || 0) >= 0.08) state = 'FLOW'

  const expertWeights = normalizeExpertWeights({
    momentum: 24 + Math.max(0, (digitMomentum[0]?.delta || 0) * 180) + (state === 'FLOW' ? 18 : 0),
    transition: 24 + shiftScore * 0.42 + (['ROTATION', 'RESET'].includes(state) ? 16 : 0),
    frequency: 24 + (100 - shiftScore) * 0.28 + (state === 'STABLE' ? 12 : 0),
    pattern: 24 + Math.max(doublePressure, hamPressure, siblingPressure, repeatPressure) * 0.28 + (state === 'COMPRESSION' ? 16 : 0),
  })

  const hamToDouble = transitionRate(
    capped,
    (draw) => classifyDraw(draw).ham,
    (draw) => {
      const flags = classifyDraw(draw)
      return flags.topDouble || flags.bottomDouble
    },
  )

  const doubleToSibling = transitionRate(
    capped,
    (draw) => classifyDraw(draw).bottomDouble,
    (draw) => classifyDraw(draw).sibling,
  )

  const leadingDigits = w5.bottomDistribution
    .map((share, digit) => ({
      digit,
      share: Math.round(share * 100),
      momentum: round1((share - w20.bottomDistribution[digit]) * 100),
    }))
    .sort((left, right) => right.share - left.share || right.momentum - left.momentum || left.digit - right.digit)
    .slice(0, 3)

  const reasons = []
  if (Math.abs(w5.highRatio - w20.highRatio) >= 0.15) reasons.push(`สูง/ต่ำเปลี่ยน ${Math.round((w5.highRatio - w20.highRatio) * 100)} จุดจากฐาน 20 งวด`)
  if (shiftScore >= 48) reasons.push('การกระจายเลข 5 งวดล่าสุดต่างจากฐานชัดเจน')
  if (repeat5.currentExact) reasons.push('ล่างซ้ำตรงจากงวดก่อน')
  else if (repeat5.currentOverlap > 0) reasons.push(`ล่างมีเลขซ้ำจากงวดก่อน ${repeat5.currentOverlap} หลัก`)
  if (currentFlags.ham) reasons.push('งวดล่าสุดมีหามบน')
  if (currentFlags.bottomDouble) reasons.push('งวดล่าสุดมีเบิ้ลล่าง')
  if (currentFlags.sibling) reasons.push('งวดล่าสุดเป็นพี่น้องล่าง')
  if (!reasons.length) reasons.push('โครงสร้างล่าสุดยังไม่เกิดสัญญาณเปลี่ยนแรง')

  return {
    engineVersion: 'market_intelligence_v2_shadow',
    mode: 'SHADOW',
    sampleSize: capped.length,
    source: capped[0],
    state,
    shiftScore,
    compressionScore,
    dataConfidence: Math.round(clamp((capped.length / 20) * 100)),
    saturation: {
      high: {
        value: Math.round(w5.highRatio * 100),
        momentum: round1((w5.highRatio - w20.highRatio) * 100),
        state: classifyBalance(w5.highRatio),
        windows: { 3: Math.round(w3.highRatio * 100), 5: Math.round(w5.highRatio * 100), 10: Math.round(w10.highRatio * 100), 20: Math.round(w20.highRatio * 100), 30: Math.round(w30.highRatio * 100) },
      },
      even: {
        value: Math.round(w5.evenRatio * 100),
        momentum: round1((w5.evenRatio - w20.evenRatio) * 100),
        state: classifyBalance(w5.evenRatio),
      },
      leadingDigits,
    },
    patterns: {
      current: currentFlags,
      double: { pressure: doublePressure, gap: eventGap(capped, (draw) => { const f = classifyDraw(draw); return f.topDouble || f.bottomDouble }), rate5: Math.round(w5.doubleRate * 100), rate20: Math.round(w20.doubleRate * 100) },
      ham: { pressure: hamPressure, gap: eventGap(capped, (draw) => classifyDraw(draw).ham), rate5: Math.round(w5.hamRate * 100), rate20: Math.round(w20.hamRate * 100) },
      sibling: { pressure: siblingPressure, gap: eventGap(capped, (draw) => classifyDraw(draw).sibling), rate5: Math.round(w5.siblingRate * 100), rate20: Math.round(w20.siblingRate * 100) },
      repeat: { pressure: repeatPressure, exactRate5: Math.round(repeat5.exactRate * 100), overlapRate5: Math.round(repeat5.overlapRate * 100), currentExact: repeat5.currentExact, currentOverlap: repeat5.currentOverlap },
    },
    transitions: { hamToDouble, doubleToSibling },
    expertWeights,
    reasons,
  }
}
