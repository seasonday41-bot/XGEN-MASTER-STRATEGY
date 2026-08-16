import { buildRadarPicks } from './market-radar-picks.js'
import { buildStatisticalMotion } from './statistical-motion.js'

const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value))

function canonicalPair(a, b) {
  return a === b ? `${a}${b}` : `${Math.min(a, b)}${Math.max(a, b)}`
}

function pairDigits(pair) {
  return pair.split('').map(Number)
}

function addScore(buckets, digit, points, reason) {
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) return
  buckets[digit].score += points
  if (reason) buckets[digit].reasons.add(reason)
}

function uniqueTripleKey(digits) {
  return [...digits].sort((a, b) => a - b).join('')
}

export function buildPin3FromSystem(rud, pin2, win6, limitPerRud = 2) {
  const output = []
  const seen = new Set()

  rud.slice(0, 2).forEach((lead) => {
    const pairCandidates = []

    pin2.forEach((item, index) => {
      const digits = item.digits || pairDigits(item.pair)
      if (!digits.includes(lead)) {
        pairCandidates.push({ digits, score: item.score ?? 0, sourceOrder: index })
      }
    })

    for (let i = 0; i < win6.length; i += 1) {
      for (let j = i + 1; j < win6.length; j += 1) {
        const digits = [win6[i], win6[j]]
        if (digits.includes(lead)) continue
        const key = canonicalPair(digits[0], digits[1])
        if (!pairCandidates.some((item) => canonicalPair(item.digits[0], item.digits[1]) === key)) {
          pairCandidates.push({ digits, score: 0, sourceOrder: 99 + i * 10 + j })
        }
      }
    }

    let used = 0
    for (const item of pairCandidates) {
      const digits = [lead, ...item.digits]
      const key = uniqueTripleKey(digits)
      if (seen.has(key)) continue
      seen.add(key)
      output.push({
        triple: `${lead}${item.digits[0]}${item.digits[1]}`,
        digits,
        lead,
        score: item.score ?? 0,
      })
      used += 1
      if (used >= limitPerRud) break
    }
  })

  return output.slice(0, 4)
}

function buildClassicSystem(base) {
  return {
    key: 'A',
    name: 'Xgen ปกติ',
    strongDigit: base.strongDigit.digit,
    rud: [...base.rud],
    win6: [...base.win6],
    pin2: base.pin2.map((item) => ({ ...item, digits: item.digits || pairDigits(item.pair) })),
    pin3: buildPin3FromSystem(base.rud, base.pin2, base.win6),
  }
}

function normalPairSupport(base) {
  const support = new Map()
  base.pin2.forEach((item, index) => {
    const key = canonicalPair(...(item.digits || pairDigits(item.pair)))
    support.set(key, Math.max(support.get(key) || 0, 18 - index * 2))
  })
  return support
}

function radarPairSupport(radar) {
  const support = new Map()
  radar?.pairPicks?.forEach((item) => support.set(item.pair, item.score || 0))
  return support
}

export function buildFusionSystem(base, analysis, history) {
  const radar = buildRadarPicks(analysis, history)
  const motion = buildStatisticalMotion(history)
  if (!radar || !motion) return null

  const buckets = Array.from({ length: 10 }, (_, digit) => ({ digit, score: 0, reasons: new Set() }))

  // System A evidence: keep the original Xgen engine as one independent expert.
  addScore(buckets, base.rud[0], 28, 'รูดหลักระบบปกติ')
  addScore(buckets, base.rud[1], 21, 'รูดรองระบบปกติ')
  addScore(buckets, base.strongDigit.digit, 26, 'ตัวแรงระบบปกติ')
  base.win6.forEach((digit, index) => addScore(buckets, digit, Math.max(7, 19 - index * 2), 'WIN6 ระบบปกติ'))
  base.pin2.forEach((item, index) => {
    const points = Math.max(3, 7 - index)
    ;(item.digits || pairDigits(item.pair)).forEach((digit) => addScore(buckets, digit, points, 'เจาะ2 ระบบปกติ'))
  })

  // Radar evidence: current-market acceleration / pattern state.
  radar.core.forEach((item, index) => addScore(
    buckets,
    item.digit,
    18 - index * 3 + item.score * 0.28,
    index === 0 ? 'Radar เด่น' : 'Radar core',
  ))
  radar.watch.forEach((item, index) => addScore(buckets, item.digit, 7 - index + item.score * 0.12, 'Radar defense'))
  radar.pairPicks.forEach((item) => pairDigits(item.pair).forEach((digit) => addScore(buckets, digit, item.score * 0.07, 'Radar pair')))

  // Statistical Motion: pandas describe-style mean/median/std/quartile motion.
  motion.rankedDigits.slice(0, 6).forEach((item, index) => addScore(
    buckets,
    item.digit,
    item.score * 0.24 + Math.max(0, 8 - index),
    `Stat Motion ${motion.state}`,
  ))

  const rawMax = Math.max(...buckets.map((item) => item.score), 1)
  const ranked = buckets
    .map((item) => ({
      digit: item.digit,
      rawScore: item.score,
      score: Math.round(clamp((item.score / rawMax) * 100)),
      reasons: [...item.reasons].slice(0, 5),
    }))
    .sort((a, b) => b.rawScore - a.rawScore || a.digit - b.digit)

  const win6 = ranked.slice(0, 6).map((item) => item.digit)
  const strongDigit = ranked[0].digit
  const rud = [ranked[0].digit, ranked.find((item) => item.digit !== ranked[0].digit)?.digit]

  const classicSupport = normalPairSupport(base)
  const liveSupport = radarPairSupport(radar)
  const pairMap = new Map()

  for (let i = 0; i < win6.length; i += 1) {
    for (let j = i + 1; j < win6.length; j += 1) {
      const pair = canonicalPair(win6[i], win6[j])
      pairMap.set(pair, { pair, digits: [win6[i], win6[j]] })
    }
  }

  radar.pairPicks.forEach((item) => {
    const digits = pairDigits(item.pair)
    if (digits.every((digit) => win6.includes(digit))) pairMap.set(item.pair, { pair: item.pair, digits })
  })

  const scoreByDigit = new Map(ranked.map((item) => [item.digit, item.score]))
  const pin2 = [...pairMap.values()]
    .map((item) => {
      const [a, b] = item.digits
      let score = (scoreByDigit.get(a) || 0) + (scoreByDigit.get(b) || 0)
      score += classicSupport.get(item.pair) || 0
      score += (liveSupport.get(item.pair) || 0) * 0.28
      if (item.digits.includes(rud[0])) score += 14
      if (item.digits.includes(rud[1])) score += 8
      return { ...item, score: Math.round(score) }
    })
    .sort((a, b) => b.score - a.score || a.pair.localeCompare(b.pair))
    .slice(0, 5)

  const pin3 = buildPin3FromSystem(rud, pin2, win6)

  return {
    key: 'B',
    name: 'Xgen Fusion',
    strongDigit,
    rud,
    win6,
    pin2,
    pin3,
    rankedDigits: ranked,
    radar,
    motion,
    summary: `${motion.summary} • Radar ${analysis.state} • Fusion คัดจาก 3 สมอง`,
  }
}

export function buildDualSystems(base, analysis, history) {
  return {
    classic: buildClassicSystem(base),
    fusion: buildFusionSystem(base, analysis, history),
  }
}
