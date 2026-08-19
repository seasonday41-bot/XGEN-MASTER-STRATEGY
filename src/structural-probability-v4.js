import { analyzeStructuralProbabilityV3 } from './structural-probability-v3.js'
import { classifyStructuralPatternV2 } from './structural-probability-v2.js'

const avg = (values) => {
  const usable = values.filter((value) => Number.isFinite(value))
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : 0
}

function normalizeDraw(draw) {
  return {
    ...draw,
    top3: String(draw?.top3 ?? '').trim().padStart(3, '0'),
    bottom2: String(draw?.bottom2 ?? '').trim().padStart(2, '0'),
  }
}

function normalizeHistory(history) {
  if (!Array.isArray(history) || history.length < 4) throw new Error('ต้องมีข้อมูลย้อนหลังอย่างน้อย 4 งวด')
  return history.slice(0, 30).map(normalizeDraw)
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
    if (weight > 0) matches.push({ trigger: history[index], next: history[index - 1], weight, index })
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

function normalizeScore(values) {
  const max = Math.max(...values, 0)
  if (max <= 0) return values.map(() => 0)
  return values.map((value) => Math.round((value / max) * 100))
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

function buildPairRanking(win6, scopeRanking, transition, mirror, scope) {
  const rankMap = new Map(scopeRanking.map((item) => [item.digit, item.score]))
  const selector = scope === 'top' ? (draw) => draw.top3.slice(1) : (draw) => draw.bottom2
  const positionSets = [transition, mirror].map((matches) => [
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
  return bestUnique(pairs, 'pair')
}

function buildTripleRanking(win6, topRanking, type, transition, mirror) {
  const rankMap = new Map(topRanking.map((item) => [item.digit, item.score]))
  const matches = [...transition, ...mirror]
  const pos = [0, 1, 2].map((position) => weightedPositionScores(matches, (draw) => draw.top3, position))
  const triples = new Set()

  if (type === 'DOUBLE') {
    win6.forEach((a) => win6.filter((b) => b !== a).forEach((b) => {
      triples.add(`${a}${a}${b}`)
      triples.add(`${b}${a}${a}`)
    }))
  } else {
    for (const a of win6) for (const b of win6) for (const c of win6) {
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

function sameCombination(left, right) {
  return canonical(left) === canonical(right)
}

function walkForwardPicks(history, maxTests = 10) {
  const capped = normalizeHistory(history)
  const results = []
  for (let targetIndex = 0; targetIndex < capped.length - 4 && results.length < maxTests; targetIndex += 1) {
    const training = capped.slice(targetIndex + 1)
    if (training.length < 4) break
    const prediction = analyzeStructuralProbabilityV4(training, { includeBacktest: false })
    const actual = capped[targetIndex]
    results.push({
      pin2TopPair: prediction.pin2Top.some((item) => sameCombination(item.pair, actual.top3.slice(1))),
      pin2BottomPair: prediction.pin2Bottom.some((item) => sameCombination(item.pair, actual.bottom2)),
      pin3NormalPermutation: prediction.pin3Normal.some((item) => sameCombination(item.triple, actual.top3)),
      pin3DoublePermutation: prediction.pin3Double.some((item) => sameCombination(item.triple, actual.top3)),
    })
  }
  const count = results.length || 1
  const rate = (key) => Math.round((results.filter((item) => item[key]).length / count) * 100)
  return {
    samples: results.length,
    metrics: {
      pin2TopPair: rate('pin2TopPair'),
      pin2BottomPair: rate('pin2BottomPair'),
      pin3NormalPermutation: rate('pin3NormalPermutation'),
      pin3DoublePermutation: rate('pin3DoublePermutation'),
    },
  }
}

export function analyzeStructuralProbabilityV4(history, { includeBacktest = true, maxBacktest = 10 } = {}) {
  const base = analyzeStructuralProbabilityV3(history, { includeBacktest, maxBacktest })
  const capped = normalizeHistory(history)
  const transition = transitionMatches(capped)
  const mirror = mirrorMatches(capped)
  const pin2Top = buildPairRanking(base.topWin6, base.rankings.top, transition, mirror, 'top')
  const pin2Bottom = buildPairRanking(base.bottomWin6, base.rankings.bottom, transition, mirror, 'bottom')
  const pin3Normal = buildTripleRanking(base.topWin6, base.rankings.top, 'NORMAL', transition, mirror)
  const pin3Double = buildTripleRanking(base.topWin6, base.rankings.top, 'DOUBLE', transition, mirror)
  const extraBacktest = includeBacktest ? walkForwardPicks(capped, maxBacktest) : null

  return {
    ...base,
    version: 'v4.1-no-reverse-picks',
    pin2Top,
    pin2Bottom,
    pin3Normal,
    pin3Double,
    backtest: base.backtest && extraBacktest
      ? { ...base.backtest, metrics: { ...base.backtest.metrics, ...extraBacktest.metrics } }
      : base.backtest,
  }
}
