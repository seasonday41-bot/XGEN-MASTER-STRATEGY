import { analyzeStructuralProbabilityV4 } from './structural-probability-v4.js'
import { classifyStructuralPatternV2 } from './structural-probability-v2.js'
import { buildMatrixPickChallenger } from './matrix-pick-challenger.js'

const DIGITS = Array.from({ length: 10 }, (_, digit) => digit)
const FREQUENCY_WINDOW = 5
const FREQUENCY_WEIGHTS = { 5: 1 }
const POSITION_GATE_SIZE = 6

const avg = (values) => {
  const usable = values.filter((value) => Number.isFinite(value))
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : 0
}
const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value))

function normalizeDraw(draw) {
  return {
    ...draw,
    top3: String(draw?.top3 ?? '').trim().padStart(3, '0'),
    bottom2: String(draw?.bottom2 ?? '').trim().padStart(2, '0'),
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

function fiveDrawFrequencyScore(history, scope) {
  const recent = history.slice(0, Math.min(FREQUENCY_WINDOW, history.length))
  return normalizeScore(countDigits(recent, scope))
}

function trendEvidence(history, scope, gapByDigit) {
  const positions = scope === 'top' ? 3 : scope === 'bottom' ? 2 : 5
  const recent = history.slice(0, Math.min(5, history.length))
  const previous = history.slice(5, Math.min(10, history.length))
  const older = history.slice(5)
  const recentCounts = countDigits(recent, scope)
  const previousCounts = countDigits(previous, scope)
  const olderCounts = countDigits(older, scope)
  const rawMomentum = Array(10).fill(0)
  const meta = []

  DIGITS.forEach((digit) => {
    const recentRate = recent.length ? recentCounts[digit] / (recent.length * positions) : 0
    const previousRate = previous.length ? previousCounts[digit] / (previous.length * positions) : 0
    const olderRate = older.length ? olderCounts[digit] / (older.length * positions) : 0
    const acceleration = Math.max(0, recentRate - olderRate)
    rawMomentum[digit] = (recentRate * 0.7) + (acceleration * 0.3)

    let state = 'WARM'
    const returning = recentCounts[digit] >= 1
      && recentRate > olderRate
      && (previousCounts[digit] === 0 || recentRate >= previousRate * 1.5)
    const hot = recentCounts[digit] >= 2 && recentRate >= olderRate
    const cold = recentCounts[digit] === 0 && (gapByDigit[digit] ?? 0) >= 3

    if (returning) state = 'RETURNING'
    else if (hot) state = 'HOT'
    else if (cold) state = 'COLD'

    meta.push({
      digit,
      state,
      recent5Count: recentCounts[digit],
      previous5Count: previousCounts[digit],
      recentRate,
      previousRate,
      olderRate,
    })
  })

  const scores = normalizeScore(rawMomentum)
  return meta.map((item) => ({ ...item, score: scores[item.digit] }))
}

function rerankScope(history, scope, baseRanking) {
  const baseMap = new Map(baseRanking.map((item) => [item.digit, item]))
  const frequency = fiveDrawFrequencyScore(history, scope)
  const gapByDigit = Object.fromEntries(baseRanking.map((item) => [item.digit, item.gap]))
  const trend = trendEvidence(history, scope, gapByDigit)
  const trendMap = new Map(trend.map((item) => [item.digit, item]))

  return DIGITS.map((digit) => {
    const old = baseMap.get(digit)
    const pulse = trendMap.get(digit)
    const components = {
      ...old.components,
      frequency: frequency[digit],
      trend: pulse.score,
    }
    const active = [components.missing, components.frequency, components.trend]
    if (components.transition !== null) active.push(components.transition)
    if (components.mirror !== null) active.push(components.mirror)
    if (components.balance !== null) active.push(components.balance)

    return {
      ...old,
      score: Math.round(clamp(avg(active))),
      components,
      trendState: pulse.state,
      trendScore: pulse.score,
      recent5Count: pulse.recent5Count,
      previous5Count: pulse.previous5Count,
    }
  }).sort((a, b) => b.score - a.score || b.trendScore - a.trendScore || b.gap - a.gap || a.digit - b.digit)
}

function fuseRankings(topRanking, bottomRanking, allRanking) {
  const maps = [topRanking, bottomRanking, allRanking].map((ranking) => new Map(ranking.map((item) => [item.digit, item.score])))
  const allMap = new Map(allRanking.map((item) => [item.digit, item]))
  return DIGITS.map((digit) => ({
    digit,
    topScore: maps[0].get(digit),
    bottomScore: maps[1].get(digit),
    allScore: maps[2].get(digit),
    score: Math.round(avg(maps.map((map) => map.get(digit)))),
    trendState: allMap.get(digit)?.trendState || 'WARM',
    trendScore: allMap.get(digit)?.trendScore || 0,
  })).sort((a, b) => b.score - a.score || b.trendScore - a.trendScore || b.topScore - a.topScore || a.digit - b.digit)
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

function transitionMatches(history) {
  const current = classifyStructuralPatternV2(history[0]).category
  return collectNextDraws(history, (draw) => classifyStructuralPatternV2(draw).category === current ? 1 : 0)
}

function mirrorMatches(history) {
  const current = structuralFeatures(history[0])
  return collectNextDraws(history, (draw) => {
    const value = similarity(current, structuralFeatures(draw))
    return value >= 0.57 ? value : 0
  }).sort((a, b) => b.weight - a.weight || a.index - b.index).slice(0, 8)
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

function positionSelector(scope) {
  return scope === 'top' ? (draw) => draw.top3 : (draw) => draw.bottom2
}

function countPositionDigits(draws, scope, position) {
  const selector = positionSelector(scope)
  const counts = Array(10).fill(0)
  draws.forEach((draw) => { counts[Number(selector(draw)[position])] += 1 })
  return counts
}

function positionGap(history, scope, position, digit) {
  const selector = positionSelector(scope)
  const index = history.findIndex((draw) => Number(selector(draw)[position]) === digit)
  return index === -1 ? history.length : index
}

function positionGateRanking(history, scope, position, transition, mirror) {
  const selector = positionSelector(scope)
  const recent = history.slice(0, Math.min(5, history.length))
  const previous = history.slice(5, Math.min(10, history.length))
  const older = history.slice(5)
  const recentCounts = countPositionDigits(recent, scope, position)
  const previousCounts = countPositionDigits(previous, scope, position)
  const olderCounts = countPositionDigits(older, scope, position)
  const frequency = normalizeScore(recentCounts)
  const gaps = DIGITS.map((digit) => positionGap(history, scope, position, digit))
  const missing = normalizeScore(gaps)
  const rawTrend = DIGITS.map((digit) => {
    const recentRate = recent.length ? recentCounts[digit] / recent.length : 0
    const olderRate = older.length ? olderCounts[digit] / older.length : 0
    return (recentRate * 0.7) + (Math.max(0, recentRate - olderRate) * 0.3)
  })
  const trend = normalizeScore(rawTrend)
  const transitionScore = weightedPositionScores(transition, selector, position)
  const mirrorScore = weightedPositionScores(mirror, selector, position)

  return DIGITS.map((digit) => {
    const evidence = [missing[digit], frequency[digit], trend[digit]]
    if (transitionScore[digit] !== null) evidence.push(transitionScore[digit])
    if (mirrorScore[digit] !== null) evidence.push(mirrorScore[digit])
    return {
      digit,
      score: Math.round(clamp(avg(evidence))),
      gap: gaps[digit],
      trendScore: trend[digit],
      components: {
        missing: missing[digit],
        frequency: frequency[digit],
        trend: trend[digit],
        transition: transitionScore[digit],
        mirror: mirrorScore[digit],
      },
      recent5Count: recentCounts[digit],
      previous5Count: previousCounts[digit],
    }
  }).sort((a, b) => b.score - a.score || b.trendScore - a.trendScore || b.gap - a.gap || a.digit - b.digit)
}

function buildPositionGates(history, transition, mirror) {
  const top = [0, 1, 2].map((position) => positionGateRanking(history, 'top', position, transition, mirror))
  const bottom = [0, 1].map((position) => positionGateRanking(history, 'bottom', position, transition, mirror))
  const take = (ranking) => ranking.slice(0, POSITION_GATE_SIZE).map((item) => item.digit)

  return {
    rankings: {
      top: { hundreds: top[0], tens: top[1], units: top[2] },
      bottom: { tens: bottom[0], units: bottom[1] },
    },
    gates: {
      top: { hundreds: take(top[0]), tens: take(top[1]), units: take(top[2]) },
      bottom: { tens: take(bottom[0]), units: take(bottom[1]) },
    },
  }
}

function canonical(value) {
  return String(value).split('').sort().join('')
}

function bestUnique(items, keyName) {
  const best = new Map()
  items.forEach((item) => {
    const key = canonical(item[keyName])
    const old = best.get(key)
    if (!old || item.score > old.score || (item.score === old.score && item[keyName] < old[keyName])) best.set(key, item)
  })
  return [...best.values()].sort((a, b) => b.score - a.score || a[keyName].localeCompare(b[keyName])).slice(0, 5)
}

function buildPairRanking(leftGate, rightGate, scopeRanking, transition, mirror, scope) {
  const rankMap = new Map(scopeRanking.map((item) => [item.digit, item.score]))
  const selector = scope === 'top' ? (draw) => draw.top3.slice(1) : (draw) => draw.bottom2
  const positionSets = [transition, mirror].map((matches) => [
    weightedPositionScores(matches, selector, 0),
    weightedPositionScores(matches, selector, 1),
  ])
  const pairs = []

  leftGate.forEach((left) => rightGate.forEach((right) => {
    if (left === right) return
    const evidence = [rankMap.get(left), rankMap.get(right)]
    positionSets.forEach(([tens, units]) => {
      if (tens[left] !== null) evidence.push(tens[left])
      if (units[right] !== null) evidence.push(units[right])
    })
    pairs.push({ pair: `${left}${right}`, score: Math.round(avg(evidence)) })
  }))

  return bestUnique(pairs, 'pair')
}

function buildTripleRanking(positionGates, topRanking, type, transition, mirror) {
  const rankMap = new Map(topRanking.map((item) => [item.digit, item.score]))
  const matches = [...transition, ...mirror]
  const pos = [0, 1, 2].map((position) => weightedPositionScores(matches, (draw) => draw.top3, position))
  const [hundreds, tens, units] = positionGates
  const triples = new Set()

  if (type === 'DOUBLE') {
    const tensSet = new Set(tens)
    const unitsSet = new Set(units)

    hundreds.forEach((a) => {
      if (tensSet.has(a)) {
        units.forEach((b) => {
          if (b !== a) triples.add(`${a}${a}${b}`)
        })
      }
      tens.forEach((b) => {
        if (b !== a && unitsSet.has(b)) triples.add(`${a}${b}${b}`)
      })
    })
  } else {
    for (const a of hundreds) for (const b of tens) for (const c of units) {
      if (new Set([a, b, c]).size === 3) triples.add(`${a}${b}${c}`)
    }
  }

  const scored = [...triples].map((triple) => {
    const digits = triple.split('').map(Number)
    const evidence = digits.map((digit) => rankMap.get(digit))
    digits.forEach((digit, index) => { if (pos[index][digit] !== null) evidence.push(pos[index][digit]) })
    return { triple, score: Math.round(avg(evidence)) }
  })

  return bestUnique(scored, 'triple')
}

function selectReserve(win6, topWin6, bottomWin6, fusionRanking) {
  const main = new Set(win6)
  const top = new Set(topWin6)
  const bottom = new Set(bottomWin6)
  const scoreMap = new Map(fusionRanking.map((item) => [item.digit, item.score]))
  const candidates = [...new Set([...topWin6, ...bottomWin6])]
    .filter((digit) => !main.has(digit))
    .map((digit) => ({
      digit,
      score: scoreMap.get(digit) ?? 0,
      sources: [top.has(digit) ? 'TOP' : null, bottom.has(digit) ? 'BOTTOM' : null].filter(Boolean),
    }))
    .sort((a, b) => b.score - a.score || b.sources.length - a.sources.length || a.digit - b.digit)
  return candidates[0]?.digit ?? fusionRanking.find((item) => !main.has(item.digit))?.digit ?? null
}

function sameCombination(left, right) {
  return canonical(left) === canonical(right)
}

function walkForwardAdaptive(history, maxTests = 10) {
  const capped = normalizeHistory(history)
  const results = []

  for (let targetIndex = 0; targetIndex < capped.length - 4 && results.length < maxTests; targetIndex += 1) {
    const training = capped.slice(targetIndex + 1)
    if (training.length < 4) break
    const prediction = analyzeStructuralProbabilityV5(training, { includeBacktest: false })
    const actual = capped[targetIndex]
    const actualTopDigits = actual.top3.split('').map(Number)
    const actualBottomDigits = actual.bottom2.split('').map(Number)
    const rudSet = new Set(prediction.rud)

    results.push({
      rudTop: actualTopDigits.some((digit) => rudSet.has(digit)),
      rudBottom: actualBottomDigits.some((digit) => rudSet.has(digit)),
      pin2TopPair: prediction.pin2Top.some((item) => sameCombination(item.pair, actual.top3.slice(1))),
      pin2BottomPair: prediction.pin2Bottom.some((item) => sameCombination(item.pair, actual.bottom2)),
      pin3NormalPermutation: prediction.pin3Normal.some((item) => sameCombination(item.triple, actual.top3)),
      pin3DoublePermutation: prediction.pin3Double.some((item) => sameCombination(item.triple, actual.top3)),
      matrixPin2TopPair: prediction.matrixChallenger.pin2Top.some((item) => sameCombination(item.pair, actual.top3.slice(1))),
      matrixPin2BottomPair: prediction.matrixChallenger.pin2Bottom.some((item) => sameCombination(item.pair, actual.bottom2)),
      matrixPin3NormalPermutation: prediction.matrixChallenger.pin3Normal.some((item) => sameCombination(item.triple, actual.top3)),
      matrixPin3HamPermutation: prediction.matrixChallenger.pin3Ham.some((item) => sameCombination(item.triple, actual.top3)),
      matrixPin3DoublePermutation: prediction.matrixChallenger.pin3Double.some((item) => sameCombination(item.triple, actual.top3)),
    })
  }

  const count = results.length || 1
  const rate = (key) => Math.round((results.filter((item) => item[key]).length / count) * 100)
  return {
    samples: results.length,
    metrics: {
      rudTop: rate('rudTop'),
      rudBottom: rate('rudBottom'),
      pin2TopPair: rate('pin2TopPair'),
      pin2BottomPair: rate('pin2BottomPair'),
      pin3NormalPermutation: rate('pin3NormalPermutation'),
      pin3DoublePermutation: rate('pin3DoublePermutation'),
      matrixPin2TopPair: rate('matrixPin2TopPair'),
      matrixPin2BottomPair: rate('matrixPin2BottomPair'),
      matrixPin3NormalPermutation: rate('matrixPin3NormalPermutation'),
      matrixPin3HamPermutation: rate('matrixPin3HamPermutation'),
      matrixPin3DoublePermutation: rate('matrixPin3DoublePermutation'),
    },
  }
}

function marketPulse(allRanking) {
  const order = ['HOT', 'RETURNING', 'WARM', 'COLD']
  return Object.fromEntries(order.map((state) => [
    state,
    allRanking.filter((item) => item.trendState === state).map((item) => ({
      digit: item.digit,
      score: item.trendScore,
      structuralScore: item.score,
      recent5Count: item.recent5Count,
      previous5Count: item.previous5Count,
    })),
  ]))
}

export function analyzeStructuralProbabilityV5(history, { includeBacktest = true, maxBacktest = 10 } = {}) {
  const capped = normalizeHistory(history)
  const base = analyzeStructuralProbabilityV4(capped, { includeBacktest, maxBacktest })
  const topRanking = rerankScope(capped, 'top', base.rankings.top)
  const bottomRanking = rerankScope(capped, 'bottom', base.rankings.bottom)
  const allRanking = rerankScope(capped, 'all', base.rankings.all)
  const fusionRanking = fuseRankings(topRanking, bottomRanking, allRanking)
  const rankings = { top: topRanking, bottom: bottomRanking, all: allRanking, fusion: fusionRanking }
  const win6 = fusionRanking.slice(0, 6).map((item) => item.digit)
  const topWin6 = topRanking.slice(0, 6).map((item) => item.digit)
  const bottomWin6 = bottomRanking.slice(0, 6).map((item) => item.digit)
  const rud = fusionRanking.slice(0, 2).map((item) => item.digit)
  const transition = transitionMatches(capped)
  const mirror = mirrorMatches(capped)
  const position = buildPositionGates(capped, transition, mirror)
  const pin2Top = buildPairRanking(position.gates.top.tens, position.gates.top.units, topRanking, transition, mirror, 'top')
  const pin2Bottom = buildPairRanking(position.gates.bottom.tens, position.gates.bottom.units, bottomRanking, transition, mirror, 'bottom')
  const pin3Normal = buildTripleRanking([
    position.gates.top.hundreds,
    position.gates.top.tens,
    position.gates.top.units,
  ], topRanking, 'NORMAL', transition, mirror)
  const pin3Double = buildTripleRanking([
    position.gates.top.hundreds,
    position.gates.top.tens,
    position.gates.top.units,
  ], topRanking, 'DOUBLE', transition, mirror)
  const matrixChallenger = buildMatrixPickChallenger({
    history: capped,
    positionGates: position.gates,
    positionRankings: position.rankings,
    rankings,
    patternSignals: base.patternSignals,
    transition,
    mirror,
  })
  const adaptiveBacktest = includeBacktest ? walkForwardAdaptive(capped, maxBacktest) : null

  return {
    ...base,
    version: 'v5.4-matrix-challenger',
    frequencyWindow: FREQUENCY_WINDOW,
    frequencyWeights: { ...FREQUENCY_WEIGHTS },
    positionGateSize: POSITION_GATE_SIZE,
    positionGates: position.gates,
    positionRankings: position.rankings,
    rankings,
    marketPulse: marketPulse(allRanking),
    rud,
    win6,
    topWin6,
    bottomWin6,
    reserve: selectReserve(win6, topWin6, bottomWin6, fusionRanking),
    pin2Top,
    pin2Bottom,
    pin3Normal,
    pin3Double,
    matrixChallenger,
    backtest: base.backtest && adaptiveBacktest
      ? {
          ...base.backtest,
          samples: adaptiveBacktest.samples,
          metrics: {
            ...base.backtest.metrics,
            ...adaptiveBacktest.metrics,
          },
        }
      : base.backtest,
  }
}
