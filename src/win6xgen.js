export const HISTORY_LIMIT = 30
export const INITIAL_SEARCH_WINDOW = 5
export const MAX_SEARCH_WINDOW = 8
export const MAX_WIN_DIGITS = 7

export class Win6XgenError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'Win6XgenError'
    this.code = code
    this.details = details
  }
}

const PIN2_TEMPLATES = {
  6: [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 4],
    [1, 5],
  ],
  7: [
    [0, 1],
    [0, 2],
    [0, 3],
    [1, 4],
    [5, 6],
  ],
}

const PIN3_TEMPLATES = {
  6: [
    [0, 1, 2],
    [0, 3, 4],
    [1, 3, 5],
    [0, 2, 5],
    [1, 2, 4],
  ],
  7: [
    [0, 1, 2],
    [0, 3, 4],
    [1, 3, 5],
    [0, 2, 5],
    [0, 1, 6],
  ],
}

export function mod10(value) {
  return ((Number(value) % 10) + 10) % 10
}

export function uniqueFirst(values) {
  const output = []
  values.forEach((value) => {
    const digit = Number(value)
    if (Number.isInteger(digit) && digit >= 0 && digit <= 9 && !output.includes(digit)) {
      output.push(digit)
    }
  })
  return output
}

export function normalizeResult(row) {
  const top3 = String(row?.top3 ?? '').trim().padStart(3, '0')
  const bottom2 = String(row?.bottom2 ?? '').trim().padStart(2, '0')
  const drawDate = row?.draw_date ? String(row.draw_date).trim() : null

  if (!/^\d{3}$/.test(top3) || !/^\d{2}$/.test(bottom2)) return null
  if (drawDate && !/^\d{4}-\d{2}-\d{2}$/.test(drawDate)) return null

  return { draw_date: drawDate, top3, bottom2 }
}

export function resultDigits(row) {
  const normalized = normalizeResult(row)
  if (!normalized) return []
  return `${normalized.top3}${normalized.bottom2}`.split('').map(Number)
}

export function calculateFGH(top3, bottom2) {
  const normalized = normalizeResult({ top3, bottom2 })
  if (!normalized) throw new Error('ผลล่าสุดต้องครบ 3 ตัวบน และ 2 ตัวล่าง')

  const [a, b, c] = normalized.top3.split('').map(Number)
  const [d, e] = normalized.bottom2.split('').map(Number)
  const isTriple = a === b && b === c
  const f = isTriple ? mod10(a + b + c) : mod10(b + c)
  const g = mod10(d + e)
  const h = mod10(f + g)

  return {
    a,
    b,
    c,
    d,
    e,
    f,
    g,
    h,
    isTriple,
    rud: [f, g],
  }
}

function rowContainsTargets(row, targets) {
  const counts = new Map()
  resultDigits(row).forEach((digit) => counts.set(digit, (counts.get(digit) || 0) + 1))

  const needed = new Map()
  targets.forEach((digit) => needed.set(digit, (needed.get(digit) || 0) + 1))

  return [...needed.entries()].every(([digit, count]) => (counts.get(digit) || 0) >= count)
}

function firstMatchInWindow(rows, targets, window) {
  const rowIndex = rows
    .slice(0, window)
    .findIndex((row) => rowContainsTargets(row, targets))

  if (rowIndex < 0) return null
  return { row: rows[rowIndex], rowIndex }
}

export function searchCandidateSources(history, f, g, h) {
  const rows = (Array.isArray(history) ? history : []).map(normalizeResult).filter(Boolean)
  if (!rows.length) throw new Error('WIN6XGEN ต้องมีข้อมูลย้อนหลัง')

  const strategies = [
    { mode: 'G+H', targets: [g, h] },
    { mode: 'F+G', targets: [f, g] },
    { mode: 'H', targets: [h] },
    { mode: 'G', targets: [g] },
    { mode: 'F', targets: [f] },
  ]

  for (let window = INITIAL_SEARCH_WINDOW; window <= MAX_SEARCH_WINDOW; window += 1) {
    for (const strategy of strategies) {
      const match = firstMatchInWindow(rows, strategy.targets, window)
      if (!match) continue

      return {
        mode: strategy.mode,
        target: strategy.targets,
        searchWindowUsed: window,
        match,
      }
    }
  }

  throw new Win6XgenError(
    'SOURCE_NOT_FOUND',
    `ไม่พบ G+H, F+G, H=${h}, G=${g} หรือ F=${f} ภายใน 8 งวดย้อนหลัง`,
    { f, g, h, historyChecked: Math.min(rows.length, MAX_SEARCH_WINDOW) },
  )
}

export function collectWinDigits(history, fgh, sourceSearch) {
  const rows = (Array.isArray(history) ? history : []).map(normalizeResult).filter(Boolean)
  const sourceStartIndex = sourceSearch?.match?.rowIndex

  if (!Number.isInteger(sourceStartIndex) || sourceStartIndex < 0 || sourceStartIndex >= rows.length) {
    throw new Win6XgenError('INVALID_SOURCE', 'ไม่พบตำแหน่งงวดเริ่มต้นสำหรับจัด WIN6')
  }

  const baseDigits = uniqueFirst([fgh.f, fgh.g, fgh.h])
  const rowsFromSource = rows.slice(sourceStartIndex)

  for (let window = INITIAL_SEARCH_WINDOW; window <= MAX_SEARCH_WINDOW; window += 1) {
    const rowsUsed = rowsFromSource.slice(0, window)
    const candidatePool = uniqueFirst([
      ...baseDigits,
      ...rowsUsed.flatMap(resultDigits),
    ]).slice(0, MAX_WIN_DIGITS)

    if (candidatePool.length >= 6) {
      return {
        baseDigits,
        candidatePool,
        collectionWindowUsed: window,
        collectionRowsUsed: rowsUsed.length,
        sourceStartIndex,
      }
    }
  }

  throw new Win6XgenError(
    'INSUFFICIENT_WIN_DIGITS',
    'ไล่ย้อนหลังจากงวดที่พบถึงงวดที่ 8 แล้วยังมีเลขไม่ครบ 6 ตัว',
    {
      baseDigits,
      candidatePool: uniqueFirst([
        ...baseDigits,
        ...rowsFromSource.slice(0, MAX_SEARCH_WINDOW).flatMap(resultDigits),
      ]).slice(0, MAX_WIN_DIGITS),
      sourceStartIndex,
      collectionRowsAvailable: Math.min(rowsFromSource.length, MAX_SEARCH_WINDOW),
    },
  )
}

function normalizeWinDigits(values) {
  return uniqueFirst(Array.isArray(values) ? values : []).slice(0, MAX_WIN_DIGITS)
}

export function buildPin2(winDigits) {
  const digits = normalizeWinDigits(winDigits)
  if (digits.length < 6) return []

  return PIN2_TEMPLATES[digits.length].map((positions) => ({
    pair: positions.map((position) => digits[position]).join(''),
    positions: positions.map((position) => position + 1),
    reversible: true,
    usesParenthesizedDigit: positions.includes(6),
  }))
}

export function buildPin3(winDigits) {
  const digits = normalizeWinDigits(winDigits)
  if (digits.length < 6) return []

  return PIN3_TEMPLATES[digits.length].map((positions) => ({
    triple: positions.map((position) => digits[position]).join(''),
    positions: positions.map((position) => position + 1),
    reversible: true,
    usesParenthesizedDigit: positions.includes(6),
  }))
}

export function analyzeWin6Xgen(input) {
  const source = normalizeResult(input)
  if (!source) throw new Error('ผลล่าสุดไม่ถูกต้อง')

  const history = (Array.isArray(input?.history) ? input.history : [])
    .map(normalizeResult)
    .filter(Boolean)
    .slice(0, HISTORY_LIMIT - 1)

  if (!history.length) throw new Error('WIN6XGEN ต้องมีผลย้อนหลังอย่างน้อย 1 งวด')

  const fgh = calculateFGH(source.top3, source.bottom2)
  const sourceSearch = searchCandidateSources(history, fgh.f, fgh.g, fgh.h)
  const collected = collectWinDigits(history, fgh, sourceSearch)
  const winDigits = collected.candidatePool
  const win6 = winDigits.slice(0, 6)
  const reserve = winDigits.length === MAX_WIN_DIGITS ? winDigits[6] : null

  return {
    engine: 'WIN6XGEN',
    version: '3.1.1',
    source,
    history,
    historyUsed: Math.min(history.length + 1, HISTORY_LIMIT),
    ...fgh,
    sourceSearch,
    selectionMode: 'HISTORY_FIRST_UNIQUE',
    baseDigits: collected.baseDigits,
    candidatePool: winDigits,
    collectionWindowUsed: collected.collectionWindowUsed,
    collectionRowsUsed: collected.collectionRowsUsed,
    sourceStartIndex: collected.sourceStartIndex,
    win6,
    reserve,
    pinDigits: winDigits,
    pin2: buildPin2(winDigits),
    pin3: buildPin3(winDigits),
  }
}
