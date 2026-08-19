import { analyzeStructuralProbabilityV5 } from './structural-probability-v5.js'
import { classifyStructuralPatternV2 } from './structural-probability-v2.js'

const WIN_SIZE = 6

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

function combinations(values, size) {
  const output = []
  const walk = (start, picked) => {
    if (picked.length === size) {
      output.push([...picked])
      return
    }
    for (let index = start; index <= values.length - (size - picked.length); index += 1) {
      picked.push(values[index])
      walk(index + 1, picked)
      picked.pop()
    }
  }
  walk(0, [])
  return output
}

export function selectMod0Win6FromRanking(fusionRanking) {
  const ranking = (fusionRanking || []).slice(0, 10)
  if (ranking.length < WIN_SIZE) throw new Error('WIN6 MOD0 ต้องมี Ranking อย่างน้อย 6 ตัว')

  const digits = ranking.map((item) => Number(item.digit))
  const rankIndex = new Map(digits.map((digit, index) => [digit, index + 1]))
  const rankScore = new Map(ranking.map((item) => [Number(item.digit), Number(item.score) || 0]))
  const baseWin6 = digits.slice(0, WIN_SIZE)
  const baseSet = new Set(baseWin6)

  const candidates = combinations(digits, WIN_SIZE)
    .filter((candidate) => candidate.reduce((sum, digit) => sum + digit, 0) % 10 === 0)
    .map((candidate) => {
      const ordered = [...candidate].sort((left, right) => rankIndex.get(left) - rankIndex.get(right))
      const overlap = ordered.filter((digit) => baseSet.has(digit)).length
      const rankSum = ordered.reduce((sum, digit) => sum + rankIndex.get(digit), 0)
      const worstRank = Math.max(...ordered.map((digit) => rankIndex.get(digit)))
      const scoreSum = ordered.reduce((sum, digit) => sum + rankScore.get(digit), 0)
      const sum = ordered.reduce((total, digit) => total + digit, 0)
      return {
        digits: ordered,
        sum,
        mod: sum % 10,
        replacements: WIN_SIZE - overlap,
        rankSum,
        worstRank,
        scoreSum,
      }
    })
    .sort((left, right) => (
      left.replacements - right.replacements
      || left.rankSum - right.rankSum
      || left.worstRank - right.worstRank
      || right.scoreSum - left.scoreSum
      || left.digits.join('').localeCompare(right.digits.join(''))
    ))

  if (!candidates.length) {
    throw new Error('ไม่พบชุด WIN6 ที่ผลรวม MOD10 = 0 จาก Ranking ปัจจุบัน')
  }

  return {
    baseWin6,
    primary: candidates[0],
    reserve: candidates[1] || null,
    candidateCount: candidates.length,
  }
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

function hitCount(actualDigits, winSet) {
  return actualDigits.filter((digit) => winSet.has(digit)).length
}

function walkForwardWin6Pattern(history, maxTests = 10) {
  const capped = normalizeHistory(history)
  const results = []

  for (let targetIndex = 0; targetIndex < capped.length - 4 && results.length < maxTests; targetIndex += 1) {
    const training = capped.slice(targetIndex + 1)
    if (training.length < 4) break
    const prediction = analyzeStructuralProbabilityV6(training, { includeBacktest: false })
    const actual = capped[targetIndex]
    const baseSet = new Set(prediction.baseWin6)
    const mod0Set = new Set(prediction.win6)
    const reserveSet = new Set(prediction.win6Mod0Reserve || [])
    const topDigits = actual.top3.split('').map(Number)
    const bottomDigits = actual.bottom2.split('').map(Number)
    const baseTopHits = hitCount(topDigits, baseSet)
    const mod0TopHits = hitCount(topDigits, mod0Set)
    const reserveTopHits = reserveSet.size ? hitCount(topDigits, reserveSet) : 0

    results.push({
      baseTopHits,
      mod0TopHits,
      reserveTopHits,
      mod0EitherTopHits: Math.max(mod0TopHits, reserveTopHits),
      win6TopFull: mod0TopHits === 3,
      win6BottomFull: bottomDigits.every((digit) => mod0Set.has(digit)),
      pin2TopPair: prediction.pin2Top.some((item) => sameCombination(item.pair, actual.top3.slice(1))),
      pin2BottomPair: prediction.pin2Bottom.some((item) => sameCombination(item.pair, actual.bottom2)),
      pin3PatternPermutation: prediction.pin3Pattern.some((item) => sameCombination(item.triple, actual.top3)),
      patternTypeHit: actualMatchesPattern(actual, prediction.pickPattern.type),
    })
  }

  const count = results.length || 1
  const rate = (predicate) => Math.round((results.filter(predicate).length / count) * 100)
  const distribution = (key) => ({
    3: results.filter((item) => item[key] === 3).length,
    2: results.filter((item) => item[key] === 2).length,
    1: results.filter((item) => item[key] === 1).length,
    0: results.filter((item) => item[key] === 0).length,
  })

  return {
    samples: results.length,
    topCoverage: {
      base: distribution('baseTopHits'),
      mod0Primary: distribution('mod0TopHits'),
      mod0Reserve: distribution('reserveTopHits'),
      mod0Either: distribution('mod0EitherTopHits'),
    },
    metrics: {
      baseTop3: rate((item) => item.baseTopHits === 3),
      baseTop2: rate((item) => item.baseTopHits === 2),
      baseTop1: rate((item) => item.baseTopHits === 1),
      mod0Top3: rate((item) => item.mod0TopHits === 3),
      mod0Top2: rate((item) => item.mod0TopHits === 2),
      mod0Top1: rate((item) => item.mod0TopHits === 1),
      mod0EitherTop3: rate((item) => item.mod0EitherTopHits === 3),
      win6TopFull: rate((item) => item.win6TopFull),
      win6BottomFull: rate((item) => item.win6BottomFull),
      pin2TopPair: rate((item) => item.pin2TopPair),
      pin2BottomPair: rate((item) => item.pin2BottomPair),
      pin3PatternPermutation: rate((item) => item.pin3PatternPermutation),
      patternTypeHit: rate((item) => item.patternTypeHit),
    },
  }
}

export function analyzeStructuralProbabilityV6(history, { includeBacktest = true, maxBacktest = 10 } = {}) {
  const capped = normalizeHistory(history)
  const base = analyzeStructuralProbabilityV5(capped, { includeBacktest: false, maxBacktest })
  const mod0 = selectMod0Win6FromRanking(base.rankings.fusion)
  const win6 = [...mod0.primary.digits]
  const win6Mod0Reserve = mod0.reserve ? [...mod0.reserve.digits] : []

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
    version: 'v6.1-win6-mod0-pattern-picks',
    pickPolicy: 'WIN6_MOD0_PATTERN_ONLY',
    baseWin6: mod0.baseWin6,
    win6,
    win6Mod0Reserve,
    mod0: {
      primary: mod0.primary,
      reserve: mod0.reserve,
      candidateCount: mod0.candidateCount,
    },
    pin2Top,
    pin2Bottom,
    pickPattern: selected.signal,
    pin3Pattern,
    backtest,
  }
}
