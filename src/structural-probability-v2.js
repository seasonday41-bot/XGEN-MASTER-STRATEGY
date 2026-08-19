const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value))
const avg = (values) => {
  const usable = values.filter((value) => Number.isFinite(value))
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : 0
}
const DIGITS = Array.from({ length: 10 }, (_, digit) => digit)
const WINDOWS = [5, 10, 15, 30]
const PATTERN_TYPES = ['DOUBLE', 'HAM', 'TRIPLE', 'SIBLING']

function normalizeDigits(value, width, label) {
  const text = String(value ?? '').trim().padStart(width, '0')
  if (!new RegExp(`^\\d{${width}}$`).test(text)) throw new Error(`${label} ต้องเป็นตัวเลข ${width} หลัก`)
  return text
}

function normalizeDraw(draw) {
  return {
    ...draw,
    top3: normalizeDigits(draw?.top3, 3, '3 ตัวบน'),
    bottom2: normalizeDigits(draw?.bottom2, 2, '2 ตัวล่าง'),
  }
}

function normalizeHistory(history) {
  if (!Array.isArray(history) || history.length < 4) {
    throw new Error('STRUCTURAL PROBABILITY ต้องมีข้อมูลย้อนหลังอย่างน้อย 4 งวด')
  }
  return history.slice(0, 30).map(normalizeDraw)
}

function digitsFrom(draw, scope = 'all') {
  if (scope === 'top') return draw.top3.split('').map(Number)
  if (scope === 'bottom') return draw.bottom2.split('').map(Number)
  return `${draw.top3}${draw.bottom2}`.split('').map(Number)
}

function countDigits(draws, scope) {
  const counts = Array(10).fill(0)
  draws.forEach((draw) => digitsFrom(draw, scope).forEach((digit) => { counts[digit] += 1 }))
  return counts
}

function normalizeScore(values) {
  const max = Math.max(...values, 0)
  if (max <= 0) return values.map(() => 0)
  return values.map((value) => Math.round(clamp((value / max) * 100)))
}

function currentGap(draws, digit, scope) {
  const index = draws.findIndex((draw) => digitsFrom(draw, scope).includes(digit))
  return index === -1 ? draws.length : index
}

function frequencyScore(draws, scope) {
  const weights = { 5: 0.4, 10: 0.3, 15: 0.2, 30: 0.1 }
  const positions = scope === 'top' ? 3 : scope === 'bottom' ? 2 : 5
  const raw = Array(10).fill(0)
  let activeWeight = 0

  WINDOWS.forEach((size) => {
    const actual = Math.min(size, draws.length)
    if (!actual) return
    const weight = weights[size]
    activeWeight += weight
    const counts = countDigits(draws.slice(0, actual), scope)
    counts.forEach((count, digit) => { raw[digit] += (count / (actual * positions)) * weight })
  })

  return normalizeScore(raw.map((value) => value / Math.max(activeWeight, 0.0001)))
}

function missingScore(draws, scope) {
  const gaps = DIGITS.map((digit) => currentGap(draws, digit, scope))
  return { gaps, scores: normalizeScore(gaps) }
}

function paritySignature(text) {
  return text.split('').map((digit) => Number(digit) % 2 === 0 ? 'E' : 'O').join('')
}

function highLowSignature(text) {
  return text.split('').map((digit) => Number(digit) >= 5 ? 'H' : 'L').join('')
}

export function classifyStructuralPatternV2(draw) {
  const normalized = normalizeDraw(draw)
  const [a, b, c] = normalized.top3.split('').map(Number)
  const [d, e] = normalized.bottom2.split('').map(Number)
  const triple = a === b && b === c
  const doubleFront = a === b && !triple
  const doubleBack = b === c && !triple
  const ham = a === c && !triple
  const siblingAB = Math.abs(a - b) === 1
  const siblingBC = Math.abs(b - c) === 1
  const siblingAC = Math.abs(a - c) === 1
  const skip2AB = Math.abs(a - b) === 2
  const skip2BC = Math.abs(b - c) === 2
  const skip2AC = Math.abs(a - c) === 2

  let category = 'NORMAL'
  if (triple) category = 'TRIPLE'
  else if (ham) category = 'HAM'
  else if (doubleFront) category = 'DOUBLE_FRONT'
  else if (doubleBack) category = 'DOUBLE_BACK'
  else if (siblingAB || siblingBC || siblingAC) category = 'SIBLING'
  else if (skip2AB || skip2BC || skip2AC) category = 'SKIP2'

  return {
    category,
    topParity: paritySignature(normalized.top3),
    topHighLow: highLowSignature(normalized.top3),
    bottomParity: paritySignature(normalized.bottom2),
    bottomHighLow: highLowSignature(normalized.bottom2),
    doubleFront,
    doubleBack,
    triple,
    ham,
    siblingAB,
    siblingBC,
    siblingAC,
    sibling: siblingAB || siblingBC || siblingAC,
    skip2AB,
    skip2BC,
    skip2AC,
    bottomDouble: d === e,
    bottomSibling: Math.abs(d - e) === 1,
    bottomSkip2: Math.abs(d - e) === 2,
  }
}

function hasPattern(draw, type) {
  const p = classifyStructuralPatternV2(draw)
  if (type === 'DOUBLE') return p.doubleFront || p.doubleBack
  if (type === 'HAM') return p.ham
  if (type === 'TRIPLE') return p.triple
  if (type === 'SIBLING') return p.sibling
  return false
}

function structuralFeatures(draw) {
  const p = classifyStructuralPatternV2(draw)
  return {
    category: p.category,
    topParity: p.topParity,
    topHighLow: p.topHighLow,
    bottomParity: p.bottomParity,
    bottomHighLow: p.bottomHighLow,
  }
}

function similarity(left, right) {
  let score = 0
  let total = 0
  const add = (same, weight) => { total += weight; if (same) score += weight }
  add(left.category === right.category, 3)
  add(left.topParity === right.topParity, 1)
  add(left.topHighLow === right.topHighLow, 1)
  add(left.bottomParity === right.bottomParity, 1)
  add(left.bottomHighLow === right.bottomHighLow, 1)
  return total ? score / total : 0
}

function collectNextDraws(history, matcher) {
  const matches = []
  for (let index = 1; index < history.length; index += 1) {
    const weight = matcher(history[index], index)
    if (!(weight > 0)) continue
    matches.push({ trigger: history[index], next: history[index - 1], weight, index })
  }
  return matches
}

function transitionEvidence(history) {
  const current = classifyStructuralPatternV2(history[0])
  const matches = collectNextDraws(history, (draw) => classifyStructuralPatternV2(draw).category === current.category ? 1 : 0)
  return { current: current.category, samples: matches.length, matches }
}

function mirrorEvidence(history) {
  const current = structuralFeatures(history[0])
  const matches = collectNextDraws(history, (draw) => {
    const value = similarity(current, structuralFeatures(draw))
    return value >= 0.57 ? value : 0
  }).sort((a, b) => b.weight - a.weight || a.index - b.index).slice(0, 8)

  return {
    samples: matches.length,
    exactSamples: matches.filter((item) => item.weight === 1).length,
    averageSimilarity: matches.length
      ? Math.round((matches.reduce((sum, item) => sum + item.weight, 0) / matches.length) * 1000) / 10
      : 0,
    matches,
  }
}

function balanceEvidence(history) {
  const current = structuralFeatures(history[0])
  const matches = collectNextDraws(history, (draw) => {
    const candidate = structuralFeatures(draw)
    let score = 0
    if (candidate.topParity === current.topParity) score += 1
    if (candidate.topHighLow === current.topHighLow) score += 1
    if (candidate.bottomParity === current.bottomParity) score += 1
    if (candidate.bottomHighLow === current.bottomHighLow) score += 1
    return score >= 2 ? score / 4 : 0
  })
  return { samples: matches.length, matches }
}

function weightedRate(matches, predicate) {
  if (!matches.length) return null
  let total = 0
  let hit = 0
  matches.forEach(({ next, weight }) => {
    total += weight
    if (predicate(next)) hit += weight
  })
  return total > 0 ? hit / total : null
}

function statusFromScore(score) {
  if (score >= 45) return 'เด่น'
  if (score >= 25) return 'เฝ้าดู'
  return 'ต่ำ'
}

function buildPatternSignals(history, transition, mirror) {
  const baseline = history.slice(1)
  return PATTERN_TYPES.map((type) => {
    const baselineRate = baseline.length
      ? baseline.filter((draw) => hasPattern(draw, type)).length / baseline.length
      : 0
    const transitionRate = transition.samples >= 3
      ? weightedRate(transition.matches, (draw) => hasPattern(draw, type))
      : null
    const mirrorRate = mirror.samples >= 3
      ? weightedRate(mirror.matches, (draw) => hasPattern(draw, type))
      : null
    const activeRates = [baselineRate]
    if (transitionRate !== null) activeRates.push(transitionRate)
    if (mirrorRate !== null) activeRates.push(mirrorRate)
    const score = Math.round(clamp(avg(activeRates) * 100))

    return {
      type,
      score,
      status: statusFromScore(score),
      baselineRate: Math.round(baselineRate * 100),
      baselineSamples: baseline.length,
      transitionRate: transitionRate === null ? null : Math.round(transitionRate * 100),
      transitionSamples: transition.samples,
      mirrorRate: mirrorRate === null ? null : Math.round(mirrorRate * 100),
      mirrorSamples: mirror.samples,
    }
  }).sort((a, b) => b.score - a.score || PATTERN_TYPES.indexOf(a.type) - PATTERN_TYPES.indexOf(b.type))
}

function choosePatternForecast(signals, historyLength, transition, mirror) {
  const leader = signals[0]
  const enoughSpecificEvidence = transition.samples >= 3 || mirror.samples >= 5
  if (historyLength < 10 || !enoughSpecificEvidence || !leader || leader.score < 25) return null
  return { ...leader }
}

function weightedDigitScores(matches, scope) {
  if (!matches.length) return Array(10).fill(null)
  const values = Array(10).fill(0)
  matches.forEach(({ next, weight }) => {
    digitsFrom(next, scope).forEach((digit) => { values[digit] += weight })
  })
  return normalizeScore(values)
}

function rankScope(history, scope, transition, mirror, balance) {
  const frequency = frequencyScore(history, scope)
  const missing = missingScore(history, scope)
  const transitionScores = weightedDigitScores(transition.matches, scope)
  const mirrorScores = weightedDigitScores(mirror.matches, scope)
  const balanceScores = weightedDigitScores(balance.matches, scope)

  return DIGITS.map((digit) => {
    const components = {
      missing: missing.scores[digit],
      frequency: frequency[digit],
      transition: transitionScores[digit],
      mirror: mirrorScores[digit],
      balance: balanceScores[digit],
    }
    const active = [components.missing, components.frequency]
    if (components.transition !== null) active.push(components.transition)
    if (components.mirror !== null) active.push(components.mirror)
    if (components.balance !== null) active.push(components.balance)
    return {
      digit,
      score: Math.round(clamp(avg(active))),
      gap: missing.gaps[digit],
      components,
    }
  }).sort((a, b) => b.score - a.score || b.gap - a.gap || a.digit - b.digit)
}

function fuseRankings(topRanking, bottomRanking, allRanking) {
  const maps = [topRanking, bottomRanking, allRanking].map((ranking) => new Map(ranking.map((item) => [item.digit, item.score])))
  return DIGITS.map((digit) => ({
    digit,
    topScore: maps[0].get(digit),
    bottomScore: maps[1].get(digit),
    allScore: maps[2].get(digit),
    score: Math.round(avg(maps.map((map) => map.get(digit)))),
  })).sort((a, b) => b.score - a.score || b.topScore - a.topScore || a.digit - b.digit)
}

function weightedPositionScores(matches, selector, position) {
  if (!matches.length) return Array(10).fill(null)
  const values = Array(10).fill(0)
  matches.forEach(({ next, weight }) => {
    const text = selector(next)
    values[Number(text[position])] += weight
  })
  return normalizeScore(values)
}

function buildPairRanking(win6, scopeRanking, transition, mirror, scope) {
  const rankMap = new Map(scopeRanking.map((item) => [item.digit, item.score]))
  const selector = scope === 'top' ? (draw) => draw.top3.slice(1) : (draw) => draw.bottom2
  const positionSets = [transition.matches, mirror.matches].map((matches) => [
    weightedPositionScores(matches, selector, 0),
    weightedPositionScores(matches, selector, 1),
  ])
  const pairs = []

  win6.forEach((left) => win6.forEach((right) => {
    if (left === right) return
    const evidence = [rankMap.get(left), rankMap.get(right)]
    positionSets.forEach(([tens, units]) => {
      if (tens[left] !== null) evidence.push(tens[left])
      if (units[right] !== null) evidence.push(units[right])
    })
    pairs.push({ pair: `${left}${right}`, score: Math.round(avg(evidence)) })
  }))

  return pairs.sort((a, b) => b.score - a.score || a.pair.localeCompare(b.pair)).slice(0, 5)
}

function buildTripleRanking(win6, topRanking, forecast, transition, mirror) {
  const type = forecast?.type || 'NORMAL'
  const rankMap = new Map(topRanking.map((item) => [item.digit, item.score]))
  const matches = [...transition.matches, ...mirror.matches]
  const pos = [0, 1, 2].map((position) => weightedPositionScores(matches, (draw) => draw.top3, position))
  const triples = new Set()
  const add = (value) => { if (triples.size < 80) triples.add(value) }

  if (type === 'HAM') {
    win6.forEach((a) => win6.filter((b) => b !== a).forEach((b) => add(`${a}${b}${a}`)))
  } else if (type === 'DOUBLE') {
    win6.forEach((a) => win6.filter((b) => b !== a).forEach((b) => {
      add(`${a}${a}${b}`)
      add(`${b}${a}${a}`)
    }))
  } else if (type === 'TRIPLE') {
    win6.forEach((a) => add(`${a}${a}${a}`))
  } else if (type === 'SIBLING') {
    for (const a of win6) for (const b of win6) for (const c of win6) {
      if (new Set([a, b, c]).size !== 3) continue
      if (Math.abs(a - b) === 1 || Math.abs(b - c) === 1 || Math.abs(a - c) === 1) add(`${a}${b}${c}`)
    }
  } else {
    for (const a of win6) for (const b of win6) for (const c of win6) {
      if (new Set([a, b, c]).size === 3) add(`${a}${b}${c}`)
    }
  }

  if (!triples.size) {
    for (const a of win6) for (const b of win6) for (const c of win6) {
      if (new Set([a, b, c]).size === 3) add(`${a}${b}${c}`)
    }
  }

  return [...triples].map((triple) => {
    const digits = triple.split('').map(Number)
    const evidence = digits.map((digit) => rankMap.get(digit))
    digits.forEach((digit, index) => { if (pos[index][digit] !== null) evidence.push(pos[index][digit]) })
    return { triple, score: Math.round(avg(evidence)) }
  }).sort((a, b) => b.score - a.score || a.triple.localeCompare(b.triple)).slice(0, 5)
}

function confidenceLabel(sampleSize) {
  if (sampleSize >= 20) return 'MEDIUM'
  if (sampleSize >= 10) return 'LOW'
  return 'VERY_LOW'
}

function analyzeCore(history) {
  const capped = normalizeHistory(history)
  const transition = transitionEvidence(capped)
  const mirror = mirrorEvidence(capped)
  const balance = balanceEvidence(capped)
  const patternSignals = buildPatternSignals(capped, transition, mirror)
  const patternForecast = choosePatternForecast(patternSignals, capped.length, transition, mirror)
  const topRanking = rankScope(capped, 'top', transition, mirror, balance)
  const bottomRanking = rankScope(capped, 'bottom', transition, mirror, balance)
  const allRanking = rankScope(capped, 'all', transition, mirror, balance)
  const fusionRanking = fuseRankings(topRanking, bottomRanking, allRanking)
  const win6 = fusionRanking.slice(0, 6).map((item) => item.digit)
  const topWin6 = topRanking.slice(0, 6).map((item) => item.digit)
  const bottomWin6 = bottomRanking.slice(0, 6).map((item) => item.digit)
  const rud = fusionRanking.slice(0, 2).map((item) => item.digit)

  return {
    engine: 'XGEN STRUCTURAL PROBABILITY',
    version: 'v2.0-pattern-signals',
    source: capped[0],
    sampleSize: capped.length,
    currentPattern: classifyStructuralPatternV2(capped[0]),
    transition: { current: transition.current, samples: transition.samples, confidence: confidenceLabel(transition.samples) },
    mirror: {
      samples: mirror.samples,
      exactSamples: mirror.exactSamples,
      averageSimilarity: mirror.averageSimilarity,
      confidence: confidenceLabel(mirror.samples),
    },
    balance: { samples: balance.samples, confidence: confidenceLabel(balance.samples) },
    patternSignals,
    patternForecast,
    rankings: { top: topRanking, bottom: bottomRanking, all: allRanking, fusion: fusionRanking },
    rud,
    win6,
    topWin6,
    bottomWin6,
    pin2Top: buildPairRanking(topWin6, topRanking, transition, mirror, 'top'),
    pin2Bottom: buildPairRanking(bottomWin6, bottomRanking, transition, mirror, 'bottom'),
    pin3: buildTripleRanking(topWin6, topRanking, patternForecast, transition, mirror),
    dataConfidence: Math.round(clamp((capped.length / 30) * 100)),
    note: 'Pattern % เป็น Structural Rate จากข้อมูลย้อนหลัง ไม่ใช่เปอร์เซ็นต์การันตีผล',
  }
}

function forecastHit(forecast, actual) {
  if (!forecast) return null
  return hasPattern(actual, forecast.type)
}

function evaluatePrediction(prediction, actual) {
  const topDigits = actual.top3.split('').map(Number)
  const bottomDigits = actual.bottom2.split('').map(Number)
  const winSet = new Set(prediction.win6)
  const rudSet = new Set(prediction.rud)
  const topPair = actual.top3.slice(1)
  const bottomReverse = actual.bottom2.split('').reverse().join('')
  const patternResult = forecastHit(prediction.patternForecast, actual)

  return {
    source: actual,
    win6TopFull: topDigits.every((digit) => winSet.has(digit)),
    win6BottomFull: bottomDigits.every((digit) => winSet.has(digit)),
    rudTop: topDigits.some((digit) => rudSet.has(digit)),
    rudBottom: bottomDigits.some((digit) => rudSet.has(digit)),
    pin2TopStraight: prediction.pin2Top.some((item) => item.pair === topPair),
    pin2BottomStraight: prediction.pin2Bottom.some((item) => item.pair === actual.bottom2),
    pin2BottomReverse: prediction.pin2Bottom.some((item) => item.pair === bottomReverse),
    pin3Straight: prediction.pin3.some((item) => item.triple === actual.top3),
    pin3Permutation: prediction.pin3.some((item) => item.triple.split('').sort().join('') === actual.top3.split('').sort().join('')),
    patternForecasted: patternResult !== null,
    patternHit: patternResult === true,
  }
}

export function walkForwardBacktestV2(history, maxTests = 10) {
  const capped = normalizeHistory(history)
  const results = []
  for (let targetIndex = 0; targetIndex < capped.length - 4 && results.length < maxTests; targetIndex += 1) {
    const training = capped.slice(targetIndex + 1)
    if (training.length < 4) break
    const prediction = analyzeCore(training)
    results.push(evaluatePrediction(prediction, capped[targetIndex]))
  }

  const count = results.length || 1
  const rate = (key) => Math.round((results.filter((item) => item[key]).length / count) * 100)
  const forecasted = results.filter((item) => item.patternForecasted)
  const patternRate = forecasted.length
    ? Math.round((forecasted.filter((item) => item.patternHit).length / forecasted.length) * 100)
    : null

  return {
    samples: results.length,
    patternForecastSamples: forecasted.length,
    metrics: {
      win6TopFull: rate('win6TopFull'),
      win6BottomFull: rate('win6BottomFull'),
      rudTop: rate('rudTop'),
      rudBottom: rate('rudBottom'),
      pin2TopStraight: rate('pin2TopStraight'),
      pin2BottomStraight: rate('pin2BottomStraight'),
      pin3Straight: rate('pin3Straight'),
      pin3Permutation: rate('pin3Permutation'),
      patternHit: patternRate,
    },
    results,
  }
}

export function analyzeStructuralProbabilityV2(history, { includeBacktest = true, maxBacktest = 10 } = {}) {
  const analysis = analyzeCore(history)
  return {
    ...analysis,
    backtest: includeBacktest ? walkForwardBacktestV2(history, maxBacktest) : null,
  }
}
