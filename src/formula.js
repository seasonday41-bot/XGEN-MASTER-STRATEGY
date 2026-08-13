export function uniqueFirst(values, target = values.length) {
  return [...new Set(values)].slice(0, target)
}

export function calculateWin6(top3, bottom2) {
  if (!/^\d{3}$/.test(top3) || !/^\d{2}$/.test(bottom2)) {
    throw new Error('ผลรางวัลไม่ครบ 3 ตัวบน และ 2 ตัวล่าง')
  }

  const [a, b, c] = [...top3].map(Number)
  const [d, e] = [...bottom2].map(Number)
  const rudMain = (c + e) % 10
  const rudSecondary = (a + d) % 10
  const candidates = [
    rudMain,
    rudSecondary,
    (b + 1) % 10,
    (c + 2) % 10,
    (d + 3) % 10,
    (e + 4) % 10,
    (a + c) % 10,
    a,
    b,
    c,
    d,
    e,
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
  ]

  return {
    rud: [rudMain, rudSecondary],
    win6: uniqueFirst(candidates, 6),
  }
}

export function calculateDoubleAnalysis(top3, bottom2) {
  if (!/^\d{3}$/.test(top3) || !/^\d{2}$/.test(bottom2)) {
    throw new Error('ผลรางวัลไม่ครบ 3 ตัวบน และ 2 ตัวล่าง')
  }

  const [n1, n2, n3] = [...top3].map(Number)
  const [b1, b2] = [...bottom2].map(Number)
  let run1 = (n3 + b2) % 10
  let run2 = (n1 + b1) % 10

  if (run1 === run2) run2 = (run2 + 1) % 10

  let pattern = 'ปกติ'
  if (n1 === n2 && n2 === n3) pattern = 'ตอง'
  else if (n1 === n2) pattern = 'เบิ้ลหน้า'
  else if (n2 === n3) pattern = 'เบิ้ลหลัง'
  else if (n1 === n3) pattern = 'หาม'

  const repeated = pattern !== 'ปกติ'
  const doubleDigits = uniqueFirst(repeated ? [n2, n3] : [run1, run2], 2)

  return {
    pattern,
    doubles: doubleDigits.map((digit) => `${digit}${digit}`),
  }
}

export function hasRepeatedTop(top3) {
  if (!/^\d{3}$/.test(top3)) {
    throw new Error('ผลรางวัล 3 ตัวบนไม่ถูกต้อง')
  }

  const [first, second, third] = top3
  return first === second || second === third || first === third
}

export function calculateDoubleProbability(history, maxDraws = 30, minSamples = 15) {
  if (!Array.isArray(history)) {
    throw new Error('ข้อมูลย้อนหลังไม่ถูกต้อง')
  }

  // History is newest-first. The oldest row is the starting point, so every
  // newer row becomes one walk-forward outcome without looking into the future.
  const outcomes = history.slice(0, maxDraws).slice(0, -1)
  const samples = outcomes.length
  const hits = outcomes.filter((draw) => hasRepeatedTop(draw.top3)).length

  if (samples < minSamples) {
    return {
      percentage: null,
      hits,
      samples,
      advice: 'ข้อมูลยังไม่พอ',
      message: 'โอกาสเบิ้ล — • ข้อมูลยังไม่พอ',
    }
  }

  const percentage = Math.round((hits / samples) * 100)
  const advice = percentage >= 40
    ? 'เน้นเบิ้ล'
    : percentage >= 30
      ? 'ระวังเบิ้ล'
      : 'เน้นรูดสลับ'

  return {
    percentage,
    hits,
    samples,
    advice,
    message: `โอกาสเบิ้ล ${percentage}% • ${advice}`,
  }
}

export function allPairs(digits) {
  const pairs = []
  for (let i = 0; i < digits.length; i += 1) {
    for (let j = i + 1; j < digits.length; j += 1) {
      pairs.push({
        digits: [digits[i], digits[j]],
        pair: `${Math.min(digits[i], digits[j])}${Math.max(digits[i], digits[j])}`,
        formulaOrder: pairs.length,
      })
    }
  }
  return pairs
}

function digitCountInDraw(digit, draw) {
  return `${draw.top3}${draw.bottom2}`.split('').filter((value) => Number(value) === digit).length
}

export function scorePair(pair, history) {
  const [x, y] = pair.digits
  let multiplicity = 0
  let coOccurrence = 0

  for (const draw of history) {
    const digits = `${draw.top3}${draw.bottom2}`
    multiplicity += digitCountInDraw(x, draw) + digitCountInDraw(y, draw)
    if (digits.includes(String(x)) && digits.includes(String(y))) coOccurrence += 1
  }

  return {
    ...pair,
    multiplicity,
    coOccurrence,
    score: multiplicity + coOccurrence,
  }
}

export function selectColdPairs(win6, history, limit = 5) {
  if (!Array.isArray(history) || history.length < 4) {
    throw new Error('ต้องมีผลย้อนหลังอย่างน้อย 4 งวด')
  }

  return allPairs(win6)
    .map((pair) => scorePair(pair, history.slice(0, 4)))
    .sort((left, right) =>
      left.score - right.score ||
      left.coOccurrence - right.coOccurrence ||
      left.multiplicity - right.multiplicity ||
      left.formulaOrder - right.formulaOrder,
    )
    .slice(0, limit)
}

export function selectStrongDigit(pin2, win6 = []) {
  if (!Array.isArray(pin2) || pin2.length === 0) {
    throw new Error('ต้องมีชุดเจาะ 2 ก่อนคัดตัวแรง')
  }

  const winOrder = new Map(win6.map((digit, index) => [digit, index]))
  const stats = new Map()

  pin2.forEach((pair, pairIndex) => {
    pair.digits.forEach((digit) => {
      const current = stats.get(digit) || {
        digit,
        appearances: 0,
        scoreTotal: 0,
        firstPairIndex: pairIndex,
      }
      current.appearances += 1
      current.scoreTotal += pair.score
      stats.set(digit, current)
    })
  })

  return [...stats.values()].sort((left, right) =>
    right.appearances - left.appearances ||
    left.scoreTotal - right.scoreTotal ||
    left.firstPairIndex - right.firstPairIndex ||
    (winOrder.get(left.digit) ?? 99) - (winOrder.get(right.digit) ?? 99),
  )[0]
}

export function resolveUniqueRud(rud, strongDigit, win6 = []) {
  const [rudMain, rudSecondary] = rud
  if (rudMain !== rudSecondary) return [rudMain, rudSecondary]

  const strongValue = typeof strongDigit === 'object' ? strongDigit?.digit : strongDigit
  const replacement = [strongValue, ...win6]
    .find((digit) => Number.isInteger(digit) && digit !== rudMain)

  if (replacement === undefined) {
    throw new Error('ไม่พบเลขสำหรับแทนรูดรองที่ซ้ำ')
  }

  return [rudMain, replacement]
}

export function analyzeHistory(history) {
  if (!Array.isArray(history) || history.length < 4) {
    throw new Error('ต้องมีผลย้อนหลังอย่างน้อย 4 งวด')
  }
  const recent = history.slice(0, 4)
  const source = recent[0]
  const { rud: calculatedRud, win6 } = calculateWin6(source.top3, source.bottom2)
  const pin2 = selectColdPairs(win6, recent)
  const strongDigit = selectStrongDigit(pin2, win6)
  const rud = resolveUniqueRud(calculatedRud, strongDigit, win6)
  const doubleAnalysis = {
    ...calculateDoubleAnalysis(source.top3, source.bottom2),
    ...calculateDoubleProbability(history),
  }
  return { source, recent, rud, win6, pin2, strongDigit, doubleAnalysis }
}
