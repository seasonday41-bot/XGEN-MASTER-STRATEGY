import { analyzeStructuralProbabilityV5 } from './structural-probability-v5.js'
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
  if (!Array.isArray(history) || history.length < 4) {
    throw new Error('STRUCTURAL PROBABILITY ต้องมีข้อมูลย้อนหลังอย่างน้อย 4 งวด')
  }
  return history.slice(0, 30).map(normalizeDraw)
}

function canonical(value) {
  return String(value).split('').sort().join('')
}

function bestUnique(items, keyName, limit = 5) {
  const best = new Map()
  items.forEach((item) => {
    const key = canonical(item[keyName])
    const old = best.get(key)
    if (!old || item.score > old.score || (item.score === old.score && item[keyName] < old[keyName])) {
      best.set(key, item)
    }
  })
  return [...best.values()]
    .sort((a, b) => b.score - a.score || a[keyName].localeCompare(b[keyName]))
    .slice(0, limit)
}

function scoreMap(ranking) {
  return new Map((ranking || []).map((item) => [item.digit, item.score]))
}

function buildPairFromWin6(win6, scopeRanking, leftPositionRanking, rightPositionRanking) {
  const scope = scoreMap(scopeRanking)
  const leftPos = scoreMap(leftPositionRanking)
  const rightPos = scoreMap(rightPositionRanking)
  const pairs = []

  win6.forEach((left) => win6.forEach((right) => {
    if (left === right) return
    const evidence = [
      scope.get(left),
      scope.get(right),
      leftPos.get(left),
      rightPos.get(right),
    ]
    pairs.push({
      pair: `${left}${right}`,
      score: Math.round(avg(evidence)),
      components: {
        leftPosition: leftPos.get(left) ?? 0,
        rightPosition: rightPos.get(right) ?? 0,
        leftRank: scope.get(left) ?? 0,
        rightRank: scope.get(right) ?? 0,
      },
    })
  }))

  return bestUnique(pairs, 'pair')
}

function matchesPattern(triple, type) {
  const p = classifyStructuralPatternV2({ top3: triple, bottom2: '00' })
  if (type === 'DOUBLE') return p.doubleFront || p.doubleBack
  if (type === 'HAM') return p.ham
  if (type === 'TRIPLE') return p.triple
  if (type === 'SIBLING') return p.sibling && !p.doubleFront && !p.doubleBack && !p.ham && !p.triple
  return p.category === 'NORMAL'
}

function patternTriples(win6, type) {
  const triples = []
  for (const a of win6) for (const b of win6) for (const c of win6) {
    const triple = `${a}${b}${c}`
    if (matchesPattern(triple, type)) triples.push(triple)
  }
  return triples
}

function choosePattern(base, win6) {
  const ordered = []
  const seen = new Set()
  const add = (signal, source) => {
    if (!signal?.type || seen.has(signal.type)) return
    seen.add(signal.type)
    ordered.push({ ...signal, source })
  }

  add(base.patternForecast, 'FORECAST')
  ;(base.patternSignals || []).forEach((signal) => add(signal, 'RANKED_SIGNAL'))

  for (const signal of ordered) {
    const candidates = patternTriples(win6, signal.type)
    if (candidates.length) return { signal, candidates }
  }

  const fallback = { type: 'NORMAL', score: 0, status: 'สำรอง', source: 'NORMAL_FALLBACK' }
  return { signal: fallback, candidates: patternTriples(win6, 'NORMAL') }
}

function buildPatternTriples(win6, topRanking, positionRankings, selected) {
  const top = scoreMap(topRanking)
  const hundreds = scoreMap(positionRankings.top.hundreds)
  const tens = scoreMap(positionRankings.top.tens)
  const units = scoreMap(positionRankings.top.units)

  const scored = selected.candidates.map((triple) => {
    const [a, b, c] = triple.split('').map(Number)
    const evidence = [
      top.get(a), top.get(b), top.get(c),
      hundreds.get(a), tens.get(b), units.get(c),
    ]
    return {
      triple,
      score: Math.round(avg(evidence)),
      pattern: selected.signal.type,
      components: {
        hundreds: hundreds.get(a) ?? 0,
        tens: tens.get(b) ?? 0,
        units: units.get(c) ?? 0,
        digitRank: Math.round(avg([top.get(a), top.get(b), top.get(c)])),
      },
    }
  })

  return bestUnique(scored, 'triple')
}

function sameCombination(left, right) {
  return canonical(left) === canonical(right)
}

function actualMatchesPattern(actual, type) {
  const p = classifyStructuralPatternV2(actual)
  if (type === 'DOUBLE') return p.doubleFront || p.doubleBack
  if (type === 'HAM') return p.ham
  if (type === 'TRIPLE') return p.triple
  if (type === 'SIBLING') return p.sibling
  return p.category === 'NORMAL'
}

function walkForwardWin6Pattern(history, maxTests = 10) {
  const capped = normalizeHistory(history)
  const results = []

  for (let targetIndex = 0; targetIndex < capped.length - 4 && results.length < maxTests; targetIndex += 1) {
    const training = capped.slice(targetIndex + 1)
    if (training.length < 4) break
    const prediction = analyzeStructuralProbabilityV6(training, { includeBacktest: false })
    const actual = capped[targetIndex]
    const winSet = new Set(prediction.win6)
    const topDigits = actual.top3.split('').map(Number)
    const bottomDigits = actual.bottom2.split('').map(Number)

    results.push({
      win6TopFull: topDigits.every((digit) => winSet.has(digit)),
      win6BottomFull: bottomDigits.every((digit) => winSet.has(digit)),
      pin2TopPair: prediction.pin2Top.some((item) => sameCombination(item.pair, actual.top3.slice(1))),
      pin2BottomPair: prediction.pin2Bottom.some((item) => sameCombination(item.pair, actual.bottom2)),
      pin3PatternPermutation: prediction.pin3Pattern.some((item) => sameCombination(item.triple, actual.top3)),
      patternTypeHit: actualMatchesPattern(actual, prediction.pickPattern.type),
    })
  }

  const count = results.length || 1
  const rate = (key) => Math.round((results.filter((item) => item[key]).length / count) * 100)
  return {
    samples: results.length,
    metrics: {
      win6TopFull: rate('win6TopFull'),
      win6BottomFull: rate('win6BottomFull'),
      pin2TopPair: rate('pin2TopPair'),
      pin2BottomPair: rate('pin2BottomPair'),
      pin3PatternPermutation: rate('pin3PatternPermutation'),
      patternTypeHit: rate('patternTypeHit'),
    },
  }
}

export function analyzeStructuralProbabilityV6(history, { includeBacktest = true, maxBacktest = 10 } = {}) {
  const capped = normalizeHistory(history)
  const base = analyzeStructuralProbabilityV5(capped, { includeBacktest: false, maxBacktest })
  const win6 = [...base.win6]

  const pin2Top = buildPairFromWin6(
    win6,
    base.rankings.top,
    base.positionRankings.top.tens,
    base.positionRankings.top.units,
  )
  const pin2Bottom = buildPairFromWin6(
    win6,
    base.rankings.bottom,
    base.positionRankings.bottom.tens,
    base.positionRankings.bottom.units,
  )

  const selected = choosePattern(base, win6)
  const pin3Pattern = buildPatternTriples(win6, base.rankings.top, base.positionRankings, selected)
  const backtest = includeBacktest ? walkForwardWin6Pattern(capped, maxBacktest) : null

  return {
    ...base,
    version: 'v6.0-win6-pattern-picks',
    pickPolicy: 'WIN6_PATTERN_ONLY',
    win6,
    pin2Top,
    pin2Bottom,
    pickPattern: selected.signal,
    pin3Pattern,
    backtest,
  }
}
