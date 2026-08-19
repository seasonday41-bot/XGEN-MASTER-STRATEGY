const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value))
const round1 = (value) => Math.round(value * 10) / 10
const DIGITS = Array.from({ length: 10 }, (_, digit) => digit)
const WINDOWS = [5, 10, 15, 30]

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

function frequencyWindows(draws, scope) {
  return Object.fromEntries(WINDOWS.map((size) => [
    size,
    countDigits(draws.slice(0, Math.min(size, draws.length)), scope),
  ]))
}

function frequencyScore(draws, scope) {
  const weights = { 5: 0.4, 10: 0.3, 15: 0.2, 30: 0.1 }
  const windows = frequencyWindows(draws, scope)
  const positions = scope === 'top' ? 3 : scope === 'bottom' ? 2 : 5
  const raw = Array(10).fill(0)
  let weightTotal = 0

  WINDOWS.forEach((size) => {
    const actual = Math.min(size, draws.length)
    if (!actual) return
    const weight = weights[size]
    weightTotal += weight
    windows[size].forEach((count, digit) => {
      raw[digit] += (count / (actual * positions)) * weight
    })
  })

  return {
    windows,
    scores: normalizeScore(raw.map((value) => value / Math.max(weightTotal, 0.0001))),
  }
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

export function classifyStructuralPattern(draw) {
  const normalized = normalizeDraw(draw)
  const [a, b, c] = normalized.top3.split('').map(Number)
  const [d, e] = normalized.bottom2.split('').map(Number)
  const siblingAB = Math.abs(a - b) === 1
  const siblingBC = Math.abs(b - c) === 1
  const siblingAC = Math.abs(a - c) === 1
  const skip2AB = Math.abs(a - b) === 2
  const skip2BC = Math.abs(b - c) === 2
  const skip2AC = Math.abs(a - c) === 2

  let category = 'NORMAL'
  if (a === b && b === c) category = 'TRIPLE'
  else if (a === c) category = 'HAM'
  else if (a === b) category = 'DOUBLE_FRONT'
  else if (b === c) category = 'DOUBLE_BACK'
  else if (siblingBC) category = 'SIBLING_BC'
  else if (skip2BC) category = 'SKIP2_BC'

  return {
    category,
    topParity: paritySignature(normalized.top3),
    topHighLow: highLowSignature(normalized.top3),
    bottomParity: paritySignature(normalized.bottom2),
    bottomHighLow: highLowSignature(normalized.bottom2),
    doubleFront: a === b,
    doubleBack: b === c,
    triple: a === b && b === c,
    ham: a === c && a !== b,
    siblingAB,
    siblingBC,
    siblingAC,
    skip2AB,
    skip2BC,
    skip2AC,
    bottomDouble: d === e,
    bottomSibling: Math.abs(d - e) === 1,
    bottomSkip2: Math.abs(d - e) === 2,
  }
}

function structuralFeatures(draw) {
  const p = classifyStructuralPattern(draw)
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

function weightedDigitScores(matches, scope) {
  if (!matches.length) return Array(10).fill(null)
  const values = Array(10).fill(0)
  matches.forEach(({ next, weight }) => {
    digitsFrom(next, scope).forEach((digit) => { values[digit] += weight })
  })
  return normalizeScore(values)
}

function transitionEvidence(history) {
  const current = classifyStructuralPattern(history[0])
  const matches = collectNextDraws(history, (draw) => classifyStructuralPattern(draw).category === current.category ? 1 : 0)
  const counts = new Map()
  matches.forEach(({ next }) => {
    const category = classifyStructuralPattern(next).category
    counts.set(category, (counts.get(category) || 0) + 1)
  })
  const ranked = [...counts.entries()]
    .map(([category, count]) => ({ category, count, percentage: Math.round((count / matches.length) * 100) }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category))
  return { current: current.category, samples: matches.length, ranked, matches }
}

function mirrorEvidence(history) {
  const current = structuralFeatures(history[0])
  const matches = collectNextDraws(history, (draw) => {
    const value = similarity(current, structuralFeatures(draw))
    return value >= 0.57 ? value : 0
  })
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
    .slice(0, 8)

  return {
    samples: matches.length,
    exactSamples: matches.filter((item) => item.weight === 1).length,
    averageSimilarity: matches.length ? round1((matches.reduce((sum, item) => sum + item.weight, 0) / matches.length) * 100) : 0,
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

function average(values) {
  const usable = values.filter((value) => Number.isFinite(value))
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : 0
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
      frequency: frequency.scores[digit],
      transition: transitionScores[digit],
      mirror: mirrorScores[digit],
      balance: balanceScores[digit],
    }
    const active = [components.missing, components.frequency]
    if (components.transition !== null) active.push(components.transition)
    if (components.mirror !== null) active.push(components.mirror)
    if (components.balance !== null) active.push(components.balance)
    const score = Math.round(clamp(average(active)))

    return {
      digit,
      score,
      gap: missing.gaps[digit],
      components,
      reasons: [
        `Gap ${scope.toUpperCase()} ${missing.gaps[digit]}`,
        `Frequency ${components.frequency}`,
        ...(components.transition !== null ? [`Transition ${components.transition}`] : []),
        ...(components.mirror !== null ? [`Mirror ${components.mirror}`] : []),
        ...(components.balance !== null ? [`Balance ${components.balance}`] : []),
      ],
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
    score: Math.round(average(maps.map((map) => map.get(digit)))),
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
  const sources = [transition.matches, mirror.matches]
  const positionSets = sources.map((matches) => [
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
    pairs.push({ pair: `${left}${right}`, score: Math.round(average(evidence)) })
  }))

  return pairs.sort((a, b) => b.score - a.score || a.pair.localeCompare(b.pair)).slice(0, 5)
}

function buildTripleRanking(win6, topRanking, patternForecast, transition, mirror) {
  const category = patternForecast?.category || 'NORMAL'
  const rankMap = new Map(topRanking.map((item) => [item.digit, item.score]))
  const matches = [...transition.matches, ...mirror.matches]
  const pos = [0, 1, 2].map((position) => weightedPositionScores(matches, (draw) => draw.top3, position))
  const triples = new Set()

  const add = (value) => { if (triples.size < 40) triples.add(value) }
  if (category === 'HAM') {
    win6.forEach((a) => win6.filter((b) => b !== a).forEach((b) => add(`${a}${b}${a}`)))
  } else if (category === 'DOUBLE_FRONT') {
    win6.forEach((a) => win6.filter((b) => b !== a).forEach((b) => add(`${a}${a}${b}`)))
  } else if (category === 'DOUBLE_BACK') {
    win6.forEach((a) => win6.filter((b) => b !== a).forEach((b) => add(`${b}${a}${a}`)))
  } else if (category === 'TRIPLE') {
    win6.forEach((a) => add(`${a}${a}${a}`))
  } else {
    for (const a of win6) for (const b of win6) for (const c of win6) {
      if (new Set([a, b, c]).size === 3) add(`${a}${b}${c}`)
    }
  }

  return [...triples].map((triple) => {
    const digits = triple.split('').map(Number)
    const evidence = digits.map((digit) => rankMap.get(digit))
    digits.forEach((digit, index) => { if (pos[index][digit] !== null) evidence.push(pos[index][digit]) })
    return { triple, score: Math.round(average(evidence)) }
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
  const topRanking = rankScope(capped, 'top', transition, mirror, balance)
  const bottomRanking = rankScope(capped, 'bottom', transition, mirror, balance)
  const allRanking = rankScope(capped, 'all', transition, mirror, balance)
  const fusionRanking = fuseRankings(topRanking, bottomRanking, allRanking)
  const win6 = fusionRanking.slice(0, 6).map((item) => item.digit)
  const topWin6 = topRanking.slice(0, 6).map((item) => item.digit)
  const bottomWin6 = bottomRanking.slice(0, 6).map((item) => item.digit)
  const rud = fusionRanking.slice(0, 2).map((item) => item.digit)
  const patternForecast = transition.samples >= 5 ? transition.ranked[0] || null : null

  return {
    engine: 'XGEN STRUCTURAL PROBABILITY',
    version: 'v1.0',
    source: capped[0],
    sampleSize: capped.length,
    currentPattern: classifyStructuralPattern(capped[0]),
    transition: {
      current: transition.current,
      samples: transition.samples,
      ranked: transition.ranked,
      confidence: confidenceLabel(transition.samples),
    },
    mirror: {
      samples: mirror.samples,
      exactSamples: mirror.exactSamples,
      averageSimilarity: mirror.averageSimilarity,
      confidence: confidenceLabel(mirror.samples),
    },
    balance: { samples: balance.samples, confidence: confidenceLabel(balance.samples) },
    rankings: { top: topRanking, bottom: bottomRanking, all: allRanking, fusion: fusionRanking },
    rud,
    win6,
    topWin6,
    bottomWin6,
    pin2Top: buildPairRanking(topWin6, topRanking, transition, mirror, 'top'),
    pin2Bottom: buildPairRanking(bottomWin6, bottomRanking, transition, mirror, 'bottom'),
    pin3: buildTripleRanking(topWin6, topRanking, patternForecast, transition, mirror),
    patternForecast,
    dataConfidence: Math.round(clamp((capped.length / 30) * 100)),
    note: 'คะแนนเป็น Structural Score ไม่ใช่โอกาสถูกรางวัลจริง และ Missing เป็น Candidate Signal ไม่ใช่กฎว่าเลขต้องกลับมา',
  }
}

function evaluatePrediction(prediction, actual) {
  const topDigits = actual.top3.split('').map(Number)
  const bottomDigits = actual.bottom2.split('').map(Number)
  const winSet = new Set(prediction.win6)
  const rudSet = new Set(prediction.rud)
  const topUnique = new Set(topDigits)
  const bottomUnique = new Set(bottomDigits)
  const topPair = actual.top3.slice(1)
  const topPairReverse = topPair.split('').reverse().join('')
  const bottomReverse = actual.bottom2.split('').reverse().join('')

  return {
    source: actual,
    win6TopPositions: topDigits.filter((digit) => winSet.has(digit)).length,
    win6TopFull: topDigits.every((digit) => winSet.has(digit)),
    win6BottomFull: bottomDigits.every((digit) => winSet.has(digit)),
    win6TopUnique: [...topUnique].filter((digit) => winSet.has(digit)).length,
    win6BottomUnique: [...bottomUnique].filter((digit) => winSet.has(digit)).length,
    rudTop: topDigits.some((digit) => rudSet.has(digit)),
    rudBottom: bottomDigits.some((digit) => rudSet.has(digit)),
    pin2TopStraight: prediction.pin2Top.some((item) => item.pair === topPair),
    pin2TopReverse: prediction.pin2Top.some((item) => item.pair === topPairReverse),
    pin2BottomStraight: prediction.pin2Bottom.some((item) => item.pair === actual.bottom2),
    pin2BottomReverse: prediction.pin2Bottom.some((item) => item.pair === bottomReverse),
    pin3Straight: prediction.pin3.some((item) => item.triple === actual.top3),
    pin3Permutation: prediction.pin3.some((item) => item.triple.split('').sort().join('') === actual.top3.split('').sort().join('')),
    patternHit: Boolean(prediction.patternForecast && prediction.patternForecast.category === classifyStructuralPattern(actual).category),
  }
}

export function walkForwardBacktest(history, maxTests = 10) {
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
  return {
    samples: results.length,
    metrics: {
      win6TopFull: rate('win6TopFull'),
      win6BottomFull: rate('win6BottomFull'),
      rudTop: rate('rudTop'),
      rudBottom: rate('rudBottom'),
      pin2TopStraight: rate('pin2TopStraight'),
      pin2BottomStraight: rate('pin2BottomStraight'),
      pin3Straight: rate('pin3Straight'),
      pin3Permutation: rate('pin3Permutation'),
      patternHit: rate('patternHit'),
    },
    results,
  }
}

export function analyzeStructuralProbability(history, { includeBacktest = true, maxBacktest = 10 } = {}) {
  const analysis = analyzeCore(history)
  return {
    ...analysis,
    backtest: includeBacktest ? walkForwardBacktest(history, maxBacktest) : null,
  }
}
