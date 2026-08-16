import { buildNextDrawSignals } from './market-signal-interpreter.js'

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value))
const mod10 = (value) => ((value % 10) + 10) % 10

function validHistory(history) {
  return Array.isArray(history) && history.length >= 4 && history.every((draw) => /^\d{3}$/.test(draw?.top3 || '') && /^\d{2}$/.test(draw?.bottom2 || ''))
}

function bottomDistribution(history, size) {
  const counts = Array(10).fill(0)
  const draws = history.slice(0, size)
  let total = 0
  draws.forEach((draw) => {
    draw.bottom2.split('').forEach((digit) => {
      counts[Number(digit)] += 1
      total += 1
    })
  })
  return counts.map((count) => total ? count / total : 0)
}

function signalByKey(signals, key) {
  return signals.find((signal) => signal.key === key) || { score: 0, level: 'NORMAL' }
}

function addReason(bucket, digit, reason) {
  if (!reason) return
  bucket[digit].reasons.add(reason)
}

function addScore(bucket, digit, points, reason) {
  const normalized = mod10(digit)
  bucket[normalized].score += points
  addReason(bucket, normalized, reason)
}

function canonicalPair(a, b) {
  return a === b ? `${a}${b}` : `${Math.min(a, b)}${Math.max(a, b)}`
}

function addPair(map, a, b, points, reason) {
  const pair = canonicalPair(mod10(a), mod10(b))
  const current = map.get(pair) || { pair, score: 0, reasons: new Set() }
  current.score += points
  if (reason) current.reasons.add(reason)
  map.set(pair, current)
}

function statePolicy(state) {
  if (state === 'FLOW') return { followRecent: 1.18, followSaturation: true, rotate: false }
  if (state === 'STABLE') return { followRecent: 1.00, followSaturation: true, rotate: false }
  if (state === 'COMPRESSION') return { followRecent: 0.92, followSaturation: false, rotate: true }
  if (state === 'ROTATION' || state === 'RESET') return { followRecent: 0.82, followSaturation: false, rotate: true }
  return { followRecent: 0.90, followSaturation: false, rotate: false }
}

export function buildRadarPicks(analysis, history) {
  if (!analysis || !validHistory(history)) return null

  const signals = buildNextDrawSignals(analysis)
  const repeatSignal = signalByKey(signals, 'repeat')
  const siblingSignal = signalByKey(signals, 'sibling')
  const doubleSignal = signalByKey(signals, 'double')
  const hamSignal = signalByKey(signals, 'ham')
  const policy = statePolicy(analysis.state)

  const recent = bottomDistribution(history, 5)
  const baseline = bottomDistribution(history, 20)
  const currentBottom = history[0].bottom2.split('').map(Number)
  const previousBottom = history[1].bottom2.split('').map(Number)
  const buckets = Array.from({ length: 10 }, (_, digit) => ({ digit, score: 0, reasons: new Set() }))

  // 1) Current-market frequency and acceleration. This is the core "lead the market" lane.
  for (let digit = 0; digit <= 9; digit += 1) {
    const share5 = recent[digit]
    const share20 = baseline[digit]
    const momentum = share5 - share20
    addScore(buckets, digit, share5 * 42 * policy.followRecent, share5 > 0 ? `5 งวดมี ${Math.round(share5 * 100)}%` : null)
    if (momentum > 0) addScore(buckets, digit, momentum * 82 * policy.followRecent, `Momentum +${Math.round(momentum * 1000) / 10}`)
    if (analysis.state === 'FLOW' && momentum >= 0.05) addScore(buckets, digit, 8, 'FLOW สนับสนุน')
  }

  // 2) Saturation is directional only when the state says "follow". We do not blindly reverse an extreme.
  const high = analysis.saturation?.high?.value ?? 50
  const even = analysis.saturation?.even?.value ?? 50
  if (policy.followSaturation) {
    if (high >= 70 || high <= 30) {
      const preferHigh = high >= 70
      for (let digit = 0; digit <= 9; digit += 1) {
        if ((digit >= 5) === preferHigh) addScore(buckets, digit, 5, preferHigh ? 'ฝั่งสูงนำ' : 'ฝั่งต่ำนำ')
      }
    }
    if (even >= 70 || even <= 30) {
      const preferEven = even >= 70
      for (let digit = 0; digit <= 9; digit += 1) {
        if ((digit % 2 === 0) === preferEven) addScore(buckets, digit, 5, preferEven ? 'เลขคู่นำ' : 'เลขคี่นำ')
      }
    }
  }

  // In Rotation/Reset we diversify into digits that are under-represented in the recent 5 vs 20 baseline.
  if (policy.rotate) {
    for (let digit = 0; digit <= 9; digit += 1) {
      const reverseMomentum = baseline[digit] - recent[digit]
      if (reverseMomentum >= 0.05) addScore(buckets, digit, Math.min(10, reverseMomentum * 38), 'Rotation defense')
    }
  }

  // 3) Repeat signal keeps the actual currently-repeating digits alive instead of only saying "Repeat is high".
  if (repeatSignal.score >= 45) {
    const shared = [...new Set(currentBottom.filter((digit) => previousBottom.includes(digit)))]
    const targets = shared.length ? shared : [...new Set(currentBottom)]
    targets.forEach((digit) => addScore(buckets, digit, repeatSignal.score >= 55 ? 14 : 8, 'Repeat signal'))
  }

  // 4) Sibling signal produces concrete ±1 candidates from the current bottom structure.
  const siblingCandidates = new Set()
  if (siblingSignal.score >= 45) {
    if (currentBottom[0] === currentBottom[1]) {
      siblingCandidates.add(mod10(currentBottom[0] - 1))
      siblingCandidates.add(mod10(currentBottom[0] + 1))
    } else {
      currentBottom.forEach((digit) => {
        siblingCandidates.add(mod10(digit - 1))
        siblingCandidates.add(mod10(digit + 1))
      })
    }
    siblingCandidates.forEach((digit) => addScore(buckets, digit, siblingSignal.score >= 55 ? 16 : 10, 'Sibling watch'))
  }

  const ranked = buckets
    .map((item) => ({ ...item, score: Math.round(clamp(item.score)), reasons: [...item.reasons].slice(0, 4) }))
    .sort((left, right) => right.score - left.score || recent[right.digit] - recent[left.digit] || left.digit - right.digit)

  const core = ranked.slice(0, 3)
  const watch = ranked.slice(3, 6)
  const strongDigit = core[0]?.digit ?? null

  // 5) Pair lane: combine the strongest digit with independent evidence, then inject pattern-specific pairs.
  const pairs = new Map()
  if (strongDigit != null) {
    core.slice(1).forEach((item, index) => addPair(pairs, strongDigit, item.digit, 34 - index * 3, 'Radar core'))
    watch.slice(0, 2).forEach((item, index) => addPair(pairs, strongDigit, item.digit, 24 - index * 3, 'Radar watch'))
  }

  if (siblingSignal.score >= 45) {
    const anchors = currentBottom[0] === currentBottom[1] ? [currentBottom[0]] : currentBottom
    anchors.forEach((anchor) => {
      addPair(pairs, anchor, mod10(anchor - 1), siblingSignal.score, 'Sibling -1')
      addPair(pairs, anchor, mod10(anchor + 1), siblingSignal.score, 'Sibling +1')
    })
  }

  if (repeatSignal.score >= 45) {
    addPair(pairs, currentBottom[0], currentBottom[1], repeatSignal.score, 'Repeat pair')
  }

  if (doubleSignal.score >= 55) {
    core.slice(0, 2).forEach((item) => addPair(pairs, item.digit, item.digit, doubleSignal.score * 0.85, 'Double alert'))
  }

  const pairPicks = [...pairs.values()]
    .map((item) => ({ pair: item.pair, score: Math.round(clamp(item.score)), reasons: [...item.reasons].slice(0, 2) }))
    .sort((left, right) => right.score - left.score || left.pair.localeCompare(right.pair))
    .slice(0, 5)

  const patternDigits = {
    sibling: [...siblingCandidates],
    repeat: [...new Set(currentBottom.filter((digit) => previousBottom.includes(digit)))],
    double: doubleSignal.score >= 55 ? core.slice(0, 2).map((item) => item.digit) : [],
    ham: hamSignal.score >= 55 ? core.slice(0, 2).map((item) => item.digit) : [],
  }

  return {
    version: 'radar_candidate_v1',
    state: analysis.state,
    strongDigit,
    core,
    watch,
    pairPicks,
    patternDigits,
    summary: strongDigit == null
      ? 'ข้อมูลยังไม่พอสร้าง Radar Picks'
      : `Radar เด่น ${strongDigit} • รอง ${core.slice(1).map((item) => item.digit).join(' • ') || '—'}`,
  }
}
