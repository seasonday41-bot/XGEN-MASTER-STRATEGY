const MOD10_PAIRS = [
  [1, 9],
  [2, 8],
  [3, 7],
  [4, 6],
]

function validateInput(top3, bottom2) {
  if (!/^\d{3}$/.test(top3) || !/^\d{2}$/.test(bottom2)) {
    throw new Error('ผลรางวัลไม่ครบ 3 ตัวบน และ 2 ตัวล่าง')
  }
}

function percentResult(value, percent) {
  const scaled = value * percent
  const integerPart = Math.floor(scaled / 100)
  const decimals = String(scaled % 100).padStart(2, '0')
  return `${integerPart}${decimals}`
}

function canonicalPair(a, b) {
  return `${Math.min(a, b)}${Math.max(a, b)}`
}

function pairDigits(pair) {
  return pair.split('').map(Number)
}

export function calculateFormulaResults(top3, bottom2) {
  validateInput(top3, bottom2)

  const top = Number(top3)
  const bottom = Number(bottom2)
  const reversedTop = Number([...top3].reverse().join(''))
  const cross = Number(`${top3[0]}${bottom2[1]}${top3[2]}${bottom2[0]}`)

  return [
    percentResult(top, 2),
    percentResult(top, 9),
    percentResult(bottom, 56),
    percentResult(top + bottom, 7),
    percentResult(Math.abs(top - bottom), 11),
    percentResult(Number(`${top3}${bottom2}`), 3),
    percentResult(reversedTop, 5),
    percentResult(cross, 8),
  ]
}

export function rankDigits(formulaResults) {
  if (!Array.isArray(formulaResults) || formulaResults.length !== 8) {
    throw new Error('ต้องมีผลจากสูตรหลักครบ 8 สูตร')
  }

  const stats = Array.from({ length: 10 }, (_, digit) => ({
    digit,
    occurrences: 0,
    formulaHits: 0,
    firstSeen: Number.POSITIVE_INFINITY,
    score: 0,
  }))

  let scanOrder = 0

  formulaResults.forEach((result) => {
    const present = new Set()
    String(result).split('').forEach((value) => {
      const digit = Number(value)
      const item = stats[digit]
      item.occurrences += 1
      present.add(digit)
      if (!Number.isFinite(item.firstSeen)) item.firstSeen = scanOrder
      scanOrder += 1
    })
    present.forEach((digit) => { stats[digit].formulaHits += 1 })
  })

  stats.forEach((item) => {
    item.score = item.occurrences + item.formulaHits
  })

  return stats
    .sort((left, right) =>
      right.score - left.score ||
      right.formulaHits - left.formulaHits ||
      right.occurrences - left.occurrences ||
      left.firstSeen - right.firstSeen ||
      left.digit - right.digit,
    )
    .map((item, index) => ({ ...item, rank: index + 1 }))
}

export function scoreMod10Pairs(ranking) {
  const byDigit = new Map(ranking.map((item) => [item.digit, item]))
  const strong = new Set(ranking.slice(0, 2).map((item) => item.digit))

  return MOD10_PAIRS.map((digits, sourceOrder) => {
    const [a, b] = digits
    const aStat = byDigit.get(a)
    const bStat = byDigit.get(b)
    const balanceBonus = Math.min(aStat.score, bStat.score) * 1.5
    const strongBonus = (strong.has(a) ? 2 : 0) + (strong.has(b) ? 2 : 0)
    const rankBonus = ((10 - aStat.rank) + (10 - bStat.rank)) * 0.12
    const score = aStat.score + bStat.score + balanceBonus + strongBonus + rankBonus

    return {
      pair: canonicalPair(a, b),
      digits,
      sourceOrder,
      balanceBonus,
      strongBonus,
      rankBonus,
      score,
    }
  }).sort((left, right) => right.score - left.score || left.sourceOrder - right.sourceOrder)
}

export function buildWin6(ranking, mod10Pairs) {
  const win6 = ranking.slice(0, 2).map((item) => item.digit)
  const selectedPairs = []

  mod10Pairs.forEach((item) => {
    if (win6.length >= 6) return
    const inside = item.digits.filter((digit) => win6.includes(digit))
    const outside = item.digits.filter((digit) => !win6.includes(digit))

    if (inside.length === 1 && outside.length === 1) {
      win6.push(outside[0])
      selectedPairs.push(item.pair)
      return
    }

    if (inside.length === 0 && outside.length === 2 && 6 - win6.length >= 2) {
      win6.push(...outside)
      selectedPairs.push(item.pair)
    }
  })

  ranking.forEach((item) => {
    if (win6.length < 6 && !win6.includes(item.digit)) win6.push(item.digit)
  })

  const seventh = ranking.find((item) => !win6.includes(item.digit))?.digit ?? null
  const keyPairs = mod10Pairs
    .filter((item) => selectedPairs.includes(item.pair) && item.digits.every((digit) => win6.includes(digit)))
    .map((item) => item.pair)

  return { win6, seventh, keyPairs }
}

export function analyzePairCollision(formulaResults, ranking, strongDigits, seventh) {
  const collisions = new Map()
  let firstSeen = 0

  formulaResults.forEach((result, formulaIndex) => {
    const digits = String(result).split('').map(Number)
    for (let left = 0; left < digits.length; left += 1) {
      for (let right = left + 1; right < digits.length; right += 1) {
        if (digits[left] === digits[right]) continue
        const pair = canonicalPair(digits[left], digits[right])
        const current = collisions.get(pair) || {
          pair,
          digits: pairDigits(pair),
          formulaSet: new Set(),
          formulaHits: 0,
          occurrences: 0,
          firstSeen,
        }
        current.occurrences += 1
        current.formulaSet.add(formulaIndex)
        collisions.set(pair, current)
        firstSeen += 1
      }
    }
  })

  const byDigit = new Map(ranking.map((item) => [item.digit, item]))
  const strong = new Set(strongDigits)

  return [...collisions.values()].map((item) => {
    item.formulaHits = item.formulaSet.size
    const baseStrength = item.digits.reduce((sum, digit) => sum + byDigit.get(digit).score, 0)
    const strongCount = item.digits.filter((digit) => strong.has(digit)).length
    const seventhBonus = item.digits.includes(seventh) ? 7 : 0
    const score =
      item.formulaHits * 18 +
      item.occurrences * 4 +
      strongCount * 12 +
      seventhBonus +
      baseStrength * 0.7

    return {
      pair: item.pair,
      digits: item.digits,
      formulaHits: item.formulaHits,
      occurrences: item.occurrences,
      baseStrength,
      strongCount,
      seventhBonus,
      score,
      firstSeen: item.firstSeen,
    }
  }).sort((left, right) =>
    right.formulaHits - left.formulaHits ||
    right.occurrences - left.occurrences ||
    right.score - left.score ||
    left.firstSeen - right.firstSeen ||
    left.pair.localeCompare(right.pair),
  )
}

export function buildPin3(pairCollisions, ranking, strongDigits, seventh) {
  const pairMap = new Map(pairCollisions.map((item) => [item.pair, item]))
  const byDigit = new Map(ranking.map((item) => [item.digit, item]))
  const strong = new Set(strongDigits)
  const candidates = []

  for (let a = 0; a <= 7; a += 1) {
    for (let b = a + 1; b <= 8; b += 1) {
      for (let c = b + 1; c <= 9; c += 1) {
        const digits = [a, b, c]
        const pairs = [canonicalPair(a, b), canonicalPair(a, c), canonicalPair(b, c)]
          .map((pair) => pairMap.get(pair))
          .filter(Boolean)

        if (pairs.length < 2) continue

        const pairScore = pairs.reduce((sum, item) => sum + item.score, 0)
        const formulaHits = pairs.reduce((sum, item) => sum + item.formulaHits, 0)
        const occurrences = pairs.reduce((sum, item) => sum + item.occurrences, 0)
        const strongCount = digits.filter((digit) => strong.has(digit)).length
        const rankingScore = digits.reduce((sum, digit) => sum + byDigit.get(digit).score, 0)
        const seventhBonus = digits.includes(seventh) ? 10 : 0
        const score =
          pairScore +
          formulaHits * 4 +
          strongCount * 18 +
          seventhBonus +
          rankingScore

        candidates.push({
          triple: digits.join(''),
          digits,
          pairHits: pairs.length,
          formulaHits,
          occurrences,
          strongCount,
          rankingScore,
          seventhBonus,
          score,
        })
      }
    }
  }

  return candidates.sort((left, right) =>
    right.score - left.score ||
    right.formulaHits - left.formulaHits ||
    right.occurrences - left.occurrences ||
    left.triple.localeCompare(right.triple),
  )
}

export function detectPatterns(formulaResults) {
  const doubles = []
  const triples = []
  const siblings = []

  formulaResults.forEach((result) => {
    const digits = String(result)

    for (let index = 0; index < digits.length - 1; index += 1) {
      const left = digits[index]
      const right = digits[index + 1]

      if (left === right) {
        const value = `${left}${right}`
        if (!doubles.includes(value)) doubles.push(value)
      }

      if (Math.abs(Number(left) - Number(right)) === 1) {
        const value = canonicalPair(Number(left), Number(right))
        if (!siblings.includes(value)) siblings.push(value)
      }
    }

    for (let index = 0; index < digits.length - 2; index += 1) {
      if (digits[index] === digits[index + 1] && digits[index] === digits[index + 2]) {
        const value = digits[index].repeat(3)
        if (!triples.includes(value)) triples.push(value)
      }
    }
  })

  return { doubles, triples, siblings }
}

export function analyzePercentCore(source, bottom2) {
  const input = typeof source === 'object' && source !== null
    ? source
    : { top3: source, bottom2 }

  const top3 = String(input.top3 ?? '')
  const bottom = String(input.bottom2 ?? '')
  validateInput(top3, bottom)

  const formulaResults = calculateFormulaResults(top3, bottom)
  const ranking = rankDigits(formulaResults)
  const strong = ranking.slice(0, 2).map((item) => item.digit)
  const secondary = ranking.slice(2, 4).map((item) => item.digit)
  const mod10Pairs = scoreMod10Pairs(ranking)
  const { win6, seventh, keyPairs } = buildWin6(ranking, mod10Pairs)
  const pairCollisions = analyzePairCollision(formulaResults, ranking, strong, seventh)
  const pin2 = pairCollisions.slice(0, 5)
  const pin3Candidates = buildPin3(pairCollisions, ranking, strong, seventh)
  const patterns = detectPatterns(formulaResults)

  return {
    engine: 'PERCENT CORE — Equal Weight + Strong Lock + MOD10 + Pair Collision',
    source: { ...input, top3, bottom2: bottom },
    formulaResults,
    ranking,
    strong,
    secondary,
    mod10Pairs,
    win6,
    seventh,
    keyPairs,
    pairCollisions,
    pin2,
    pin3: pin3Candidates.slice(0, 3),
    pin3Extra: pin3Candidates.slice(3, 5),
    patterns,
  }
}
