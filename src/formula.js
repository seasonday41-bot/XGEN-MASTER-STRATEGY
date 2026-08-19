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

export function calculateFG(top3, bottom2) {
  const top = String(top3 ?? '')
  const bottom = String(bottom2 ?? '')
  validateInput(top, bottom)

  const f = (Number(top[1]) + Number(top[2])) % 10
  const g = (Number(bottom[0]) + Number(bottom[1])) % 10
  return { f, g, digits: [f, g] }
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

    present.forEach((digit) => {
      stats[digit].drawHits += 1
    })
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
    if (win6.length < 6 && !win6.includes(item.digit)) {
      win6.push(item.digit)
    }
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
    const present = new Set(digits)
    if (present.has(a) && present.has(b)) drawHits += 1
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
    candidates.push({
      pair,
      digits: [a, b],
      sourceOrder,
      ...pairStats(a, b, matchedHistory),
    })
    sourceOrder += 1
  }

  if (fgDigits[0] !== fgDigits[1]) add(fgDigits[0], fgDigits[1])

  anchors.forEach((anchor) => {
    pool.forEach((digit) => add(anchor, digit))
  })

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

  const history = Array.isArray(input.history)
    ? input.history.map(normalizeRow).filter(Boolean)
    : []

  if (!history.length) {
    throw new Error('สูตร FG ต้องมีข้อมูลย้อนหลังเพื่อค้นหางวดที่มี F และ G อยู่พร้อมกัน')
  }

  const { f, g, digits: fg } = calculateFG(top3, bottom)
  const matchedHistory = matchHistoryByFG(history, f, g)

  if (!matchedHistory.length) {
    throw new Error(`ไม่พบงวดย้อนหลังที่มี FG ${f}${g} อยู่พร้อมกันในชุด 3 บน + 2 ล่าง`)
  }

  const ranking = rankMatchedDigits(matchedHistory)
  const { win6, seventh } = buildHistoryWin6(fg, ranking)
  const strong = unique(fg)
  const secondary = ranking
    .map((item) => item.digit)
    .filter((digit) => !strong.includes(digit))
    .slice(0, 2)
  const pin2 = buildPin2(fg, win6, seventh, matchedHistory)
  const pin3Candidates = buildPin3(fg, win6, seventh, matchedHistory, ranking)
  const patterns = detectHistoryPatterns(matchedHistory)
  const { history: _history, ...sourceWithoutHistory } = input

  return {
    engine: 'FG HISTORY CORE — MOD10 + MATCH FREQUENCY',
    source: { ...sourceWithoutHistory, top3, bottom2: bottom },
    fg,
    f,
    g,
    matchCount: matchedHistory.length,
    matchedHistory,
    ranking,
    strong,
    secondary,
    win6,
    seventh,
    keyPairs: [`${f}${g}`],
    mod10Pairs: [],
    pairCollisions: pin2,
    pin2,
    pin3: pin3Candidates.slice(0, 3),
    pin3Extra: pin3Candidates.slice(3, 5),
    patterns,
  }
}
