const LEGACY_MOD10_PAIRS = [
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

function normalizeRow(row) {
  const top3 = String(row?.top3 ?? '').trim().padStart(3, '0')
  const bottom2 = String(row?.bottom2 ?? '').trim().padStart(2, '0')
  if (!/^\d{3}$/.test(top3) || !/^\d{2}$/.test(bottom2)) return null
  return { ...row, top3, bottom2 }
}

function rowDigits(row) {
  return `${row.top3}${row.bottom2}`.split('').map(Number)
}

function unique(values) {
  return [...new Set(values)]
}

function canonicalPair(a, b) {
  return `${Math.min(a, b)}${Math.max(a, b)}`
}

function siblingPair(a, b) {
  const diff = Math.abs(a - b)
  return diff === 1 || diff === 9
}

function pairExistsInRow(row, pairDigits) {
  const digits = rowDigits(row)
  const [a, b] = pairDigits
  if (a === b) return digits.filter((digit) => digit === a).length >= 2
  const present = new Set(digits)
  return present.has(a) && present.has(b)
}

function legacyPercentResult(value, percent) {
  const scaled = value * percent
  const integerPart = Math.floor(scaled / 100)
  const decimals = String(scaled % 100).padStart(2, '0')
  return `${integerPart}${decimals}`
}

function legacyFormulaResults(top3, bottom2) {
  const top = Number(top3)
  const bottom = Number(bottom2)
  const reversedTop = Number([...top3].reverse().join(''))
  const cross = Number(`${top3[0]}${bottom2[1]}${top3[2]}${bottom2[0]}`)

  return [
    legacyPercentResult(top, 2),
    legacyPercentResult(top, 9),
    legacyPercentResult(bottom, 56),
    legacyPercentResult(top + bottom, 7),
    legacyPercentResult(Math.abs(top - bottom), 11),
    legacyPercentResult(Number(`${top3}${bottom2}`), 3),
    legacyPercentResult(reversedTop, 5),
    legacyPercentResult(cross, 8),
  ]
}

function legacyRankDigits(formulaResults) {
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

  stats.forEach((item) => { item.score = item.occurrences + item.formulaHits })
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

function legacyScoreMod10Pairs(ranking) {
  const byDigit = new Map(ranking.map((item) => [item.digit, item]))
  const strong = new Set(ranking.slice(0, 2).map((item) => item.digit))

  return LEGACY_MOD10_PAIRS.map((digits, sourceOrder) => {
    const [a, b] = digits
    const aStat = byDigit.get(a)
    const bStat = byDigit.get(b)
    const balanceBonus = Math.min(aStat.score, bStat.score) * 1.5
    const strongBonus = (strong.has(a) ? 2 : 0) + (strong.has(b) ? 2 : 0)
    const rankBonus = ((10 - aStat.rank) + (10 - bStat.rank)) * 0.12
    return {
      pair: canonicalPair(a, b),
      digits,
      sourceOrder,
      score: aStat.score + bStat.score + balanceBonus + strongBonus + rankBonus,
    }
  }).sort((left, right) => right.score - left.score || left.sourceOrder - right.sourceOrder)
}

function legacyBuildWin6(ranking, mod10Pairs) {
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

// Compatibility only for dormant FLOW × PERCENT modules/tests that still call
// analyzePercentCore without history. The live Xgen entry always supplies history
// and therefore always follows the FG shadow first-match core below.
function analyzeLegacyPercentCompatibility(input, top3, bottom2) {
  const formulaResults = legacyFormulaResults(top3, bottom2)
  const ranking = legacyRankDigits(formulaResults)
  const strong = ranking.slice(0, 2).map((item) => item.digit)
  const secondary = ranking.slice(2, 4).map((item) => item.digit)
  const mod10Pairs = legacyScoreMod10Pairs(ranking)
  const { win6, seventh, keyPairs } = legacyBuildWin6(ranking, mod10Pairs)

  return {
    engine: 'LEGACY PERCENT COMPATIBILITY — FLOW ONLY',
    source: { ...input, top3, bottom2 },
    formulaResults,
    ranking,
    strong,
    secondary,
    mod10Pairs,
    win6,
    seventh,
    keyPairs,
  }
}

export function calculateFG(top3, bottom2) {
  const top = String(top3 ?? '')
  const bottom = String(bottom2 ?? '')
  validateInput(top, bottom)

  const isTriple = top[0] === top[1] && top[1] === top[2]
  const f = isTriple
    ? (Number(top[0]) + Number(top[1]) + Number(top[2])) % 10
    : (Number(top[1]) + Number(top[2])) % 10
  const g = (Number(bottom[0]) + Number(bottom[1])) % 10
  return { f, g, digits: [f, g], isTriple }
}

export function shadowDigit(digit) {
  return (Number(digit) + 5) % 10
}

export function buildShadowSearchPairs(f, g) {
  const shadowF = shadowDigit(f)
  const shadowG = shadowDigit(g)
  return [
    { pair: `${f}${shadowG}`, digits: [f, shadowG] },
    { pair: `${f}${g}`, digits: [f, g] },
    { pair: `${g}${shadowF}`, digits: [g, shadowF] },
  ]
}

export function findFirstHistoryPairMatch(history, searchPairs) {
  const rows = Array.isArray(history) ? history.map(normalizeRow).filter(Boolean) : []

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]
    const matchedPairs = searchPairs.filter((item) => pairExistsInRow(row, item.digits))
    if (matchedPairs.length) {
      return { row, rowIndex, matchedPairs }
    }
  }

  return null
}

export function buildFirstMatchSet(f, g, matchedRow) {
  const base = unique([f, g, shadowDigit(f), shadowDigit(g)])
  const values = [...base]

  rowDigits(matchedRow).forEach((digit) => {
    if (!values.includes(digit)) values.push(digit)
  })

  return { base, values }
}

export function matchHistoryByFG(history, f, g) {
  const rows = Array.isArray(history) ? history.map(normalizeRow).filter(Boolean) : []
  return rows.filter((row) => {
    const present = new Set(rowDigits(row))
    return present.has(f) && present.has(g)
  })
}

export function rankMatchedDigits(matchedHistory) {
  const stats = Array.from({ length: 10 }, (_, digit) => ({
    digit,
    occurrences: 0,
    drawHits: 0,
    latestMatchIndex: Number.POSITIVE_INFINITY,
    firstSeen: Number.POSITIVE_INFINITY,
  }))

  let scanOrder = 0
  matchedHistory.forEach((row, rowIndex) => {
    const digits = rowDigits(row)
    const present = new Set()

    digits.forEach((digit) => {
      const item = stats[digit]
      item.occurrences += 1
      present.add(digit)
      if (!Number.isFinite(item.latestMatchIndex)) item.latestMatchIndex = rowIndex
      if (!Number.isFinite(item.firstSeen)) item.firstSeen = scanOrder
      scanOrder += 1
    })

    present.forEach((digit) => { stats[digit].drawHits += 1 })
  })

  return stats
    .filter((item) => item.occurrences > 0)
    .sort((left, right) =>
      right.occurrences - left.occurrences ||
      left.latestMatchIndex - right.latestMatchIndex ||
      left.firstSeen - right.firstSeen ||
      left.digit - right.digit,
    )
    .map((item, index) => ({ ...item, rank: index + 1 }))
}

export function buildHistoryWin6(fgDigits, ranking) {
  const win6 = []

  fgDigits.forEach((digit) => {
    if (!win6.includes(digit)) win6.push(digit)
  })

  ranking.forEach((item) => {
    if (win6.length < 6 && !win6.includes(item.digit)) win6.push(item.digit)
  })

  if (win6.length < 6) {
    throw new Error(`ข้อมูลย้อนหลังที่มี FG ครบ ให้เลขไม่ซ้ำเพียง ${win6.length} ตัว จึงยังสร้าง WIN6 ไม่ได้`)
  }

  const seventh = ranking.find((item) => !win6.includes(item.digit))?.digit ?? null
  return { win6, seventh }
}

function pairStats(a, b, matchedHistory) {
  let drawHits = 0
  let occurrences = 0
  matchedHistory.forEach((row) => {
    const digits = rowDigits(row)
    if (pairExistsInRow(row, [a, b])) drawHits += 1
    occurrences += digits.filter((digit) => digit === a || digit === b).length
  })
  return { formulaHits: drawHits, occurrences }
}

function tripleStats(digits, matchedHistory) {
  let drawHits = 0
  let occurrences = 0
  matchedHistory.forEach((row) => {
    const rowValues = rowDigits(row)
    const present = new Set(rowValues)
    if (digits.every((digit) => present.has(digit))) drawHits += 1
    occurrences += rowValues.filter((digit) => digits.includes(digit)).length
  })
  return { formulaHits: drawHits, occurrences }
}

export function buildPin2(fgDigits, win6, seventh, matchedHistory) {
  const pool = unique([...win6, seventh].filter((digit) => digit !== null && digit !== undefined))
  const anchors = unique(fgDigits)
  const candidates = []
  const seen = new Set()
  let sourceOrder = 0

  function add(a, b) {
    if (a === b) return
    const pair = `${a}${b}`
    if (seen.has(pair)) return
    seen.add(pair)
    candidates.push({ pair, digits: [a, b], sourceOrder, ...pairStats(a, b, matchedHistory) })
    sourceOrder += 1
  }

  if (fgDigits[0] !== fgDigits[1]) add(fgDigits[0], fgDigits[1])
  anchors.forEach((anchor) => { pool.forEach((digit) => add(anchor, digit)) })

  return candidates
    .sort((left, right) =>
      right.formulaHits - left.formulaHits ||
      right.occurrences - left.occurrences ||
      left.sourceOrder - right.sourceOrder,
    )
    .slice(0, 5)
}

export function buildPin3(fgDigits, win6, seventh, matchedHistory, ranking) {
  const pool = unique([...win6, seventh].filter((digit) => digit !== null && digit !== undefined))
  const fgSet = new Set(fgDigits)
  const frequency = new Map(ranking.map((item) => [item.digit, item.occurrences]))
  const candidates = []
  let sourceOrder = 0

  for (let a = 0; a < pool.length - 2; a += 1) {
    for (let b = a + 1; b < pool.length - 1; b += 1) {
      for (let c = b + 1; c < pool.length; c += 1) {
        const digits = [pool[a], pool[b], pool[c]]
        const fgHits = digits.filter((digit) => fgSet.has(digit)).length
        const rankingScore = digits.reduce((sum, digit) => sum + (frequency.get(digit) || 0), 0)
        candidates.push({
          triple: digits.join(''),
          digits,
          fgHits,
          rankingScore,
          sourceOrder,
          ...tripleStats(digits, matchedHistory),
        })
        sourceOrder += 1
      }
    }
  }

  return candidates.sort((left, right) =>
    right.fgHits - left.fgHits ||
    right.formulaHits - left.formulaHits ||
    right.rankingScore - left.rankingScore ||
    right.occurrences - left.occurrences ||
    left.sourceOrder - right.sourceOrder,
  )
}

export function detectHistoryPatterns(matchedHistory) {
  const doubles = []
  const triples = []
  const siblings = []

  matchedHistory.forEach((row) => {
    const top = row.top3.split('').map(Number)
    const all = rowDigits(row)

    if (top[0] === top[1]) {
      const value = `${top[0]}${top[1]}`
      if (!doubles.includes(value)) doubles.push(value)
    }
    if (top[1] === top[2]) {
      const value = `${top[1]}${top[2]}`
      if (!doubles.includes(value)) doubles.push(value)
    }
    if (top[0] === top[1] && top[1] === top[2]) {
      const value = row.top3
      if (!triples.includes(value)) triples.push(value)
    }

    for (let index = 0; index < all.length - 1; index += 1) {
      if (!siblingPair(all[index], all[index + 1])) continue
      const value = canonicalPair(all[index], all[index + 1])
      if (!siblings.includes(value)) siblings.push(value)
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

  const hasHistoryField = Array.isArray(input.history)
  if (!hasHistoryField) {
    return analyzeLegacyPercentCompatibility(input, top3, bottom)
  }

  const history = input.history.map(normalizeRow).filter(Boolean)
  if (!history.length) {
    throw new Error('สูตร FG ต้องมีข้อมูลย้อนหลังเพื่อค้นหาคู่ FG + เงา')
  }

  const { f, g, digits: fg, isTriple } = calculateFG(top3, bottom)
  const shadow = [shadowDigit(f), shadowDigit(g)]
  const searchPairObjects = buildShadowSearchPairs(f, g)
  const firstMatch = findFirstHistoryPairMatch(history, searchPairObjects)

  if (!firstMatch) {
    throw new Error(`ไม่พบงวดย้อนหลังที่มีคู่ ${searchPairObjects.map((item) => item.pair).join(' / ')}`)
  }

  const matchedHistory = [firstMatch.row]
  const ranking = rankMatchedDigits(matchedHistory)
  const { base, values } = buildFirstMatchSet(f, g, firstMatch.row)
  const win6 = values
  const seventh = null
  const strong = unique(fg)
  const secondary = shadow.filter((digit) => !strong.includes(digit))
  const pin2 = buildPin2(fg, win6, seventh, matchedHistory)
  const pin3Candidates = buildPin3(fg, win6, seventh, matchedHistory, ranking)
  const patterns = detectHistoryPatterns(matchedHistory)
  const matchedPairs = firstMatch.matchedPairs.map((item) => item.pair)
  const { history: _history, ...sourceWithoutHistory } = input

  return {
    engine: 'FG SHADOW FIRST MATCH CORE',
    source: { ...sourceWithoutHistory, top3, bottom2: bottom },
    fg,
    f,
    g,
    isTriple,
    shadow,
    shadowF: shadow[0],
    shadowG: shadow[1],
    base,
    searchPairs: searchPairObjects.map((item) => item.pair),
    matchedPairs,
    matchCount: 1,
    matchIndex: firstMatch.rowIndex,
    matchedHistory,
    firstMatch: firstMatch.row,
    ranking,
    strong,
    secondary,
    win6,
    coreSet: win6,
    seventh,
    keyPairs: searchPairObjects.map((item) => item.pair),
    mod10Pairs: [],
    pairCollisions: pin2,
    pin2,
    pin3: pin3Candidates.slice(0, 3),
    pin3Extra: pin3Candidates.slice(3, 5),
    patterns,
  }
}
