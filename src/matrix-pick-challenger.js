const DIGITS = Array.from({ length: 10 }, (_, digit) => digit)

const avg = (values) => {
  const usable = values.filter((value) => Number.isFinite(value))
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : 0
}

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value))
const round = (value) => Math.round(clamp(value))
const canonical = (value) => String(value).split('').sort().join('')

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

function mapScore(ranking) {
  return new Map(ranking.map((item) => [item.digit, item.score]))
}

function signalScore(patternSignals, type, fallback = 25) {
  return patternSignals.find((item) => item.type === type)?.score ?? fallback
}

function combineMatches(transition = [], mirror = []) {
  const merged = new Map()
  ;[...transition, ...mirror].forEach((item) => {
    const key = item.index ?? `${item.trigger?.top3}-${item.trigger?.bottom2}-${item.next?.top3}-${item.next?.bottom2}`
    const old = merged.get(key)
    if (!old || item.weight > old.weight) merged.set(key, item)
  })
  return [...merged.values()]
}

function weightedRate(matches, predicate, fallback = 0.5) {
  if (!matches.length) return fallback
  let hit = 0
  let total = 0
  matches.forEach((item) => {
    const weight = Number.isFinite(item.weight) ? item.weight : 1
    total += weight
    if (predicate(item)) hit += weight
  })
  return total ? hit / total : fallback
}

function pairText(draw, scope) {
  return scope === 'top' ? draw.top3.slice(1) : draw.bottom2
}

function pairDigits(text) {
  return text.split('').map(Number)
}

function isParityMixed(text) {
  const [a, b] = pairDigits(text)
  return (a % 2) !== (b % 2)
}

function isHighLowMixed(text) {
  const [a, b] = pairDigits(text)
  return (a >= 5) !== (b >= 5)
}

function pairGap(text) {
  const [a, b] = pairDigits(text)
  return Math.abs(a - b)
}

function gapScores(matches, scope) {
  const values = Array(10).fill(0)
  matches.forEach(({ next, weight = 1 }) => {
    values[pairGap(pairText(next, scope))] += weight
  })
  const max = Math.max(...values, 0)
  return max > 0 ? values.map((value) => round((value / max) * 100)) : values.map(() => 50)
}

function kingOfMissing(scopeRanking) {
  return [...scopeRanking]
    .sort((a, b) => b.gap - a.gap || b.components.missing - a.components.missing || a.digit - b.digit)[0]?.digit ?? null
}

function pairPolarityModel(matches, scope) {
  const parityMixedRate = weightedRate(matches, ({ next }) => isParityMixed(pairText(next, scope)))
  const highLowMixedRate = weightedRate(matches, ({ next }) => isHighLowMixed(pairText(next, scope)))
  return { parityMixedRate, highLowMixedRate }
}

function pairPolarityScore(pair, model) {
  const parityLikelihood = isParityMixed(pair) ? model.parityMixedRate : 1 - model.parityMixedRate
  const highLowLikelihood = isHighLowMixed(pair) ? model.highLowMixedRate : 1 - model.highLowMixedRate
  return round(avg([parityLikelihood * 100, highLowLikelihood * 100]))
}

function missingAnchorScore(left, right, anchor, scopeRanking) {
  if (left === anchor || right === anchor) return 100
  const rankMap = new Map(scopeRanking.map((item) => [item.digit, item]))
  return round(avg([
    rankMap.get(left)?.components?.missing ?? 0,
    rankMap.get(right)?.components?.missing ?? 0,
  ]))
}

function buildMatrixPairs({ leftGate, rightGate, leftRanking, rightRanking, scopeRanking, transition, mirror, scope }) {
  const matches = combineMatches(transition, mirror)
  const leftScore = mapScore(leftRanking)
  const rightScore = mapScore(rightRanking)
  const gap = gapScores(matches, scope)
  const polarity = pairPolarityModel(matches, scope)
  const missingAnchor = kingOfMissing(scopeRanking)
  const items = []

  leftGate.forEach((left) => rightGate.forEach((right) => {
    if (left === right) return
    const pair = `${left}${right}`
    const components = {
      position: round(avg([leftScore.get(left), rightScore.get(right)])),
      missing: missingAnchorScore(left, right, missingAnchor, scopeRanking),
      polarity: pairPolarityScore(pair, polarity),
      gap: gap[pairGap(pair)] ?? 50,
    }
    items.push({
      pair,
      score: round(avg(Object.values(components))),
      components,
      missingAnchor,
    })
  }))

  return {
    picks: bestUnique(items, 'pair'),
    model: {
      missingAnchor,
      parityMixedRate: Math.round(polarity.parityMixedRate * 100),
      highLowMixedRate: Math.round(polarity.highLowMixedRate * 100),
    },
  }
}

function containsNeighborOfLatest(candidate, latestTop3) {
  const bases = latestTop3.slice(1).split('').map(Number)
  const digits = candidate.split('').map(Number)
  return digits.some((digit) => bases.some((base) => Math.abs(digit - base) === 1))
}

function historicalStepRate(matches) {
  return weightedRate(matches, ({ trigger, next }) => containsNeighborOfLatest(next.top3, trigger.top3))
}

function transitionDigitScores(matches) {
  const values = Array(10).fill(0)
  matches.forEach(({ next, weight = 1 }) => {
    next.top3.split('').map(Number).forEach((digit) => { values[digit] += weight })
  })
  const max = Math.max(...values, 0)
  return max > 0 ? values.map((value) => round((value / max) * 100)) : values.map(() => 50)
}

function balanceScore(triple) {
  const digits = triple.split('').map(Number)
  const [a, b, c] = digits
  const alternatingParity = (a % 2) === (c % 2) && (a % 2) !== (b % 2)
  const parityMixed = new Set(digits.map((digit) => digit % 2)).size === 2
  const parity = alternatingParity ? 100 : parityMixed ? 65 : 20
  const bands = new Set(digits.map((digit) => digit <= 3 ? 'LOW' : digit <= 6 ? 'MID' : 'HIGH')).size
  const spread = bands === 3 ? 100 : bands === 2 ? 65 : 20
  return round(avg([parity, spread]))
}

function patternSupport(triple, patternSignals) {
  const [a, b, c] = triple.split('').map(Number)
  const tripleRepeat = a === b && b === c
  const ham = a === c && !tripleRepeat
  const double = (a === b || b === c) && !tripleRepeat
  const sibling = Math.abs(a - b) === 1 || Math.abs(b - c) === 1 || Math.abs(a - c) === 1

  if (tripleRepeat) return signalScore(patternSignals, 'TRIPLE')
  if (ham) return signalScore(patternSignals, 'HAM')
  if (double) return signalScore(patternSignals, 'DOUBLE')
  if (sibling) return signalScore(patternSignals, 'SIBLING')

  const strongestPattern = Math.max(
    signalScore(patternSignals, 'DOUBLE', 0),
    signalScore(patternSignals, 'HAM', 0),
    signalScore(patternSignals, 'TRIPLE', 0),
    signalScore(patternSignals, 'SIBLING', 0),
  )
  return clamp(100 - strongestPattern, 15, 100)
}

function tripleShapeScore(triple, patternSignals) {
  return round(avg([patternSupport(triple, patternSignals), balanceScore(triple)]))
}

function buildTripleCandidates(positionGates, type) {
  const [hundreds, tens, units] = positionGates
  const triples = new Set()

  if (type === 'HAM') {
    const unitsSet = new Set(units)
    hundreds.forEach((a) => {
      if (!unitsSet.has(a)) return
      tens.forEach((b) => {
        if (a !== b) triples.add(`${a}${b}${a}`)
      })
    })
    return [...triples]
  }

  if (type === 'DOUBLE') {
    const tensSet = new Set(tens)
    const unitsSet = new Set(units)
    hundreds.forEach((a) => {
      if (tensSet.has(a)) units.forEach((b) => { if (b !== a) triples.add(`${a}${a}${b}`) })
      tens.forEach((b) => { if (b !== a && unitsSet.has(b)) triples.add(`${a}${b}${b}`) })
    })
    return [...triples]
  }

  for (const a of hundreds) for (const b of tens) for (const c of units) {
    if (new Set([a, b, c]).size === 3) triples.add(`${a}${b}${c}`)
  }
  return [...triples]
}

function buildMatrixTriples({ positionGates, positionRankings, patternSignals, transition, mirror, latestTop3, type }) {
  const matches = combineMatches(transition, mirror)
  const positionMaps = positionRankings.map(mapScore)
  const digitSupport = transitionDigitScores(matches)
  const stepRate = historicalStepRate(matches)
  const candidates = buildTripleCandidates(positionGates, type)

  const scored = candidates.map((triple) => {
    const digits = triple.split('').map(Number)
    const stepMatch = containsNeighborOfLatest(triple, latestTop3)
    const components = {
      position: round(avg(digits.map((digit, index) => positionMaps[index].get(digit)))),
      shape: tripleShapeScore(triple, patternSignals),
      transition: round(avg(digits.map((digit) => digitSupport[digit]))),
      step: round((stepMatch ? stepRate : 1 - stepRate) * 100),
    }
    return {
      triple,
      score: round(avg(Object.values(components))),
      components,
      stepMatch,
    }
  })

  return {
    picks: bestUnique(scored, 'triple'),
    model: { stepFollowRate: Math.round(stepRate * 100) },
  }
}

export function buildMatrixPickChallenger({
  history,
  positionGates,
  positionRankings,
  rankings,
  patternSignals,
  transition,
  mirror,
}) {
  const topPair = buildMatrixPairs({
    leftGate: positionGates.top.tens,
    rightGate: positionGates.top.units,
    leftRanking: positionRankings.top.tens,
    rightRanking: positionRankings.top.units,
    scopeRanking: rankings.top,
    transition,
    mirror,
    scope: 'top',
  })
  const bottomPair = buildMatrixPairs({
    leftGate: positionGates.bottom.tens,
    rightGate: positionGates.bottom.units,
    leftRanking: positionRankings.bottom.tens,
    rightRanking: positionRankings.bottom.units,
    scopeRanking: rankings.bottom,
    transition,
    mirror,
    scope: 'bottom',
  })
  const topPositionGates = [positionGates.top.hundreds, positionGates.top.tens, positionGates.top.units]
  const topPositionRankings = [positionRankings.top.hundreds, positionRankings.top.tens, positionRankings.top.units]
  const commonTriple = {
    positionGates: topPositionGates,
    positionRankings: topPositionRankings,
    patternSignals,
    transition,
    mirror,
    latestTop3: history[0].top3,
  }
  const normal = buildMatrixTriples({ ...commonTriple, type: 'NORMAL' })
  const ham = buildMatrixTriples({ ...commonTriple, type: 'HAM' })
  const double = buildMatrixTriples({ ...commonTriple, type: 'DOUBLE' })

  return {
    version: 'matrix-v1-adaptive-score',
    policy: 'SCORE_ONLY_NO_HARD_LOCK',
    pin2Top: topPair.picks,
    pin2Bottom: bottomPair.picks,
    pin3Normal: normal.picks,
    pin3Ham: ham.picks,
    pin3Double: double.picks,
    model: {
      topPair: topPair.model,
      bottomPair: bottomPair.model,
      stepFollowRate: normal.model.stepFollowRate,
    },
  }
}
