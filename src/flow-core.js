function normalizeDigits(value, width, label) {
  const text = String(value ?? '').trim().padStart(width, '0')
  if (!new RegExp(`^\\d{${width}}$`).test(text)) {
    throw new Error(`${label} ต้องเป็นตัวเลข ${width} หลัก`)
  }
  return text
}

function normalizeDraw(row) {
  const top3 = normalizeDigits(row?.top3, 3, '3 ตัวบน')
  const bottom2 = normalizeDigits(row?.bottom2, 2, '2 ตัวล่าง')
  const drawDate = String(row?.draw_date ?? '').trim()

  return {
    ...row,
    draw_date: drawDate,
    top3,
    bottom2,
  }
}

function dateValue(value) {
  const time = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(time) ? time : 0
}

export function calculateFlowPoints(draw) {
  const normalized = normalizeDraw(draw)
  const topPoint = (Number(normalized.top3[1]) + Number(normalized.top3[2])) % 10
  const bottomPoint = (Number(normalized.bottom2[0]) + Number(normalized.bottom2[1])) % 10
  const crossPoint = (topPoint + bottomPoint) % 10

  return {
    ...normalized,
    topPoint,
    bottomPoint,
    crossPoint,
  }
}

export function rankFlowDigits(pointDraws) {
  const stats = new Map()

  pointDraws.forEach((draw, drawIndex) => {
    const entries = [
      { digit: draw.topPoint, fieldPriority: 0, source: 'top' },
      { digit: draw.bottomPoint, fieldPriority: 1, source: 'bottom' },
    ]

    entries.forEach(({ digit, fieldPriority, source }) => {
      const current = stats.get(digit) || {
        digit,
        count: 0,
        latestDrawIndex: -1,
        latestFieldPriority: 9,
        latestSource: source,
      }

      current.count += 1

      if (
        drawIndex > current.latestDrawIndex ||
        (drawIndex === current.latestDrawIndex && fieldPriority < current.latestFieldPriority)
      ) {
        current.latestDrawIndex = drawIndex
        current.latestFieldPriority = fieldPriority
        current.latestSource = source
      }

      stats.set(digit, current)
    })
  })

  return [...stats.values()]
    .sort((left, right) =>
      right.count - left.count ||
      right.latestDrawIndex - left.latestDrawIndex ||
      left.latestFieldPriority - right.latestFieldPriority ||
      left.digit - right.digit,
    )
    .map((item, index) => ({ ...item, rank: index + 1 }))
}

function pushUnique(target, value) {
  if (value === undefined || value === null || target.includes(value)) return
  target.push(value)
}

export function buildFlowWin6(ranking, pointDraws) {
  const win6 = []
  ranking.forEach((item) => {
    if (win6.length < 6) pushUnique(win6, item.digit)
  })

  // ถ้าแต้มดิบซ้ำจนไม่ครบ 6 ให้เติมจาก (แต้มบน + แต้มล่าง) MOD10
  // โดยให้งวดล่าสุดมีสิทธิ์ก่อน ตามกติกาที่ตกลงกัน
  ;[...pointDraws].reverse().forEach((draw) => {
    if (win6.length < 6) pushUnique(win6, draw.crossPoint)
  })

  return win6.slice(0, 6)
}

export function buildFlowPin2(rud, win6) {
  if (rud.length < 2) return []
  const [main, secondary] = rud
  const others = win6.filter((digit) => digit !== main && digit !== secondary)
  const focus = others.slice(0, 2)
  const pairs = [`${main}${secondary}`]

  focus.forEach((digit) => pairs.push(`${main}${digit}`))
  focus.forEach((digit) => pairs.push(`${secondary}${digit}`))

  return pairs.slice(0, 5).map((pair, index) => ({ pair, rank: index + 1 }))
}

export function buildFlowPin3(rud, win6) {
  if (rud.length < 2) return { pin3: [], pin3Extra: [] }
  const [main, secondary] = rud
  const others = win6.filter((digit) => digit !== main && digit !== secondary)

  const pin3 = others.slice(0, 3).map((digit, index) => ({
    triple: `${main}${secondary}${digit}`,
    rank: index + 1,
  }))

  const extras = []
  if (others[3] !== undefined) {
    extras.push({ triple: `${main}${secondary}${others[3]}`, rank: 4 })
  }
  if (others[0] !== undefined && others[2] !== undefined) {
    extras.push({ triple: `${main}${others[0]}${others[2]}`, rank: 5 })
  }

  return { pin3, pin3Extra: extras.slice(0, 2) }
}

export function analyzeFlowCore(history) {
  if (!Array.isArray(history) || history.length < 3) {
    throw new Error('FLOW CORE ต้องใช้ผลล่าสุด 3 งวด')
  }

  const draws = history
    .slice(0, 3)
    .map(calculateFlowPoints)
    .sort((left, right) => dateValue(left.draw_date) - dateValue(right.draw_date))

  const ranking = rankFlowDigits(draws)
  const rud = ranking.slice(0, 2).map((item) => item.digit)
  const win6 = buildFlowWin6(ranking, draws)
  const { pin3, pin3Extra } = buildFlowPin3(rud, win6)

  return {
    engine: 'FLOW CORE — 3 Draw Point Flow',
    source: draws[draws.length - 1],
    draws,
    pointSequence: draws.flatMap((draw) => [draw.topPoint, draw.bottomPoint]),
    crossSequence: draws.map((draw) => draw.crossPoint),
    ranking,
    rud,
    win6,
    pin2: buildFlowPin2(rud, win6),
    pin3,
    pin3Extra,
  }
}
