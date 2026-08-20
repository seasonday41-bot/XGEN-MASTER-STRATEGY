export const HISTORY_LIMIT = 30
export const PRIMARY_SEARCH_LIMIT = 5
export const EXTRA_SEARCH_LIMIT = 3
export const INITIAL_SEARCH_WINDOW = PRIMARY_SEARCH_LIMIT
export const MAX_SEARCH_WINDOW = PRIMARY_SEARCH_LIMIT + EXTRA_SEARCH_LIMIT
export const MAX_WIN_DIGITS = 7

export class Win6XgenError extends Error {
  constructor(code, message, details = {}) {
    super(message)
    this.name = 'Win6XgenError'
    this.code = code
    this.details = details
  }
}

const PIN2_TEMPLATE = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 4],
  [1, 5],
]

const PIN3_TEMPLATE = [
  [0, 1, 2],
  [0, 3, 4],
  [1, 3, 5],
  [0, 2, 5],
  [1, 2, 4],
]

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

export function calculateFG(top3, bottom2) {
  const normalized = normalizeResult({ top3, bottom2 })
  if (!normalized) throw new Error('ผลล่าสุดต้องครบ 3 ตัวบน และ 2 ตัวล่าง')

  const [a, b, c] = normalized.top3.split('').map(Number)
  const [d, e] = normalized.bottom2.split('').map(Number)
  const isTriple = a === b && b === c
  const f = isTriple ? mod10(a + b + c) : mod10(b + c)
  const g = mod10(d + e)

  return {
    a,
    b,
    c,
    d,
    e,
    f,
    g,
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

function validateSearchDigit(value, label) {
  const digit = Number(value)
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
    throw new Win6XgenError('INVALID_FG', `${label} ต้องเป็นเลข 0-9`, { [label.toLowerCase()]: value })
  }
  return digit
}

function buildSearchPhases(f, g) {
  return [
    {
      mode: 'FG',
      label: 'FG SEARCH',
      targets: [f, g],
      startIndex: 0,
      limit: PRIMARY_SEARCH_LIMIT,
      extra: false,
    },
    {
      mode: 'F',
      label: 'F SEARCH',
      targets: [f],
      startIndex: 0,
      limit: PRIMARY_SEARCH_LIMIT,
      extra: false,
    },
    {
      mode: 'G',
      label: 'G SEARCH',
      targets: [g],
      startIndex: 0,
      limit: PRIMARY_SEARCH_LIMIT,
      extra: false,
    },
    {
      mode: 'FG_EXTRA',
      label: 'FG EXTRA SEARCH',
      targets: [f, g],
      startIndex: PRIMARY_SEARCH_LIMIT,
      limit: EXTRA_SEARCH_LIMIT,
      extra: true,
    },
    {
      mode: 'F_EXTRA',
      label: 'F EXTRA SEARCH',
      targets: [f],
      startIndex: PRIMARY_SEARCH_LIMIT,
      limit: EXTRA_SEARCH_LIMIT,
      extra: true,
    },
    {
      mode: 'G_EXTRA',
      label: 'G EXTRA SEARCH',
      targets: [g],
      startIndex: PRIMARY_SEARCH_LIMIT,
      limit: EXTRA_SEARCH_LIMIT,
      extra: true,
    },
  ]
}

function collectionSummary(candidatePool, phases, winningPhase) {
  const matches = phases.flatMap((phase) => phase.matchedRows)
  const checkedIndexes = phases.flatMap((phase) => phase.checkedRowIndexes)

  return {
    candidatePool: [...candidatePool],
    phases,
    winningPhase: winningPhase.mode,
    winningPhaseLabel: winningPhase.label,
    usedExtraSearch: winningPhase.extra,
    collectionRowsUsed: matches.length,
    sourceStartIndex: matches.length ? Math.min(...matches.map((match) => match.rowIndex)) : null,
    historyRangeUsed: checkedIndexes.length ? Math.max(...checkedIndexes) + 1 : 0,
    searchRowsChecked: phases.reduce((total, phase) => total + phase.rowsChecked, 0),
  }
}

export function collectFirstFoundWinDigits(history, fg) {
  const rows = (Array.isArray(history) ? history : [])
    .map(normalizeResult)
    .filter(Boolean)
    .slice(0, MAX_SEARCH_WINDOW)

  if (!rows.length) throw new Error('WIN6XGEN ต้องมีข้อมูลย้อนหลัง')

  const f = validateSearchDigit(fg?.f, 'F')
  const g = validateSearchDigit(fg?.g, 'G')
  const candidatePool = []
  const phases = []

  for (const search of buildSearchPhases(f, g)) {
    const phaseRows = rows.slice(search.startIndex, search.startIndex + search.limit)
    const phase = {
      mode: search.mode,
      label: search.label,
      targets: [...search.targets],
      extra: search.extra,
      startIndex: search.startIndex,
      rowsChecked: 0,
      checkedRowIndexes: [],
      matchedRows: [],
      candidateCountBefore: candidatePool.length,
    }

    for (let offset = 0; offset < phaseRows.length; offset += 1) {
      const row = phaseRows[offset]
      const rowIndex = search.startIndex + offset
      phase.rowsChecked += 1
      phase.checkedRowIndexes.push(rowIndex)

      if (!rowContainsTargets(row, search.targets)) continue

      const addedDigits = []
      for (const digit of resultDigits(row)) {
        if (candidatePool.length >= MAX_WIN_DIGITS) break
        if (candidatePool.includes(digit)) continue
        candidatePool.push(digit)
        addedDigits.push(digit)
      }

      phase.matchedRows.push({
        rowIndex,
        row,
        addedDigits,
        candidateCountAfter: candidatePool.length,
      })

      if (candidatePool.length >= MAX_WIN_DIGITS) break
    }

    phase.candidateCountAfter = candidatePool.length
    phases.push(phase)

    if (candidatePool.length >= 6) {
      return collectionSummary(candidatePool, phases, search)
    }
  }

  throw new Win6XgenError(
    'INSUFFICIENT_WIN_DIGITS',
    'ค้นครบ FG, F, G และ Extra ตามลำดับแล้วยังมีเลขที่พบจริงไม่ครบ 6 ตัว',
    {
      f,
      g,
      candidatePool: [...candidatePool],
      phases,
      historyChecked: rows.length,
      searchOrder: buildSearchPhases(f, g).map((phase) => phase.mode),
    },
  )
}

function normalizeWinDigits(values) {
  return uniqueFirst(Array.isArray(values) ? values : []).slice(0, 6)
}

export function buildPin2(winDigits) {
  const digits = normalizeWinDigits(winDigits)
  if (digits.length < 6) return []

  return PIN2_TEMPLATE.map((positions) => ({
    pair: positions.map((position) => digits[position]).join(''),
    positions: positions.map((position) => position + 1),
    reversible: true,
    usesParenthesizedDigit: false,
  }))
}

export function buildPin3(winDigits) {
  const digits = normalizeWinDigits(winDigits)
  if (digits.length < 6) return []

  return PIN3_TEMPLATE.map((positions) => ({
    triple: positions.map((position) => digits[position]).join(''),
    positions: positions.map((position) => position + 1),
    reversible: true,
    usesParenthesizedDigit: false,
  }))
}

function buildSourceSearch(collection) {
  const winning = collection.phases.at(-1)
  const firstMatch = winning?.matchedRows[0]

  return {
    mode: winning?.mode || null,
    target: winning?.targets || [],
    searchWindowUsed: collection.historyRangeUsed,
    match: firstMatch ? { row: firstMatch.row, rowIndex: firstMatch.rowIndex } : null,
    order: collection.phases.map((phase) => phase.mode),
    phases: collection.phases,
  }
}

export function analyzeWin6Xgen(input) {
  const source = normalizeResult(input)
  if (!source) throw new Error('ผลล่าสุดไม่ถูกต้อง')

  const history = (Array.isArray(input?.history) ? input.history : [])
    .map(normalizeResult)
    .filter(Boolean)
    .slice(0, HISTORY_LIMIT - 1)

  if (!history.length) throw new Error('WIN6XGEN ต้องมีผลย้อนหลังอย่างน้อย 1 งวด')

  const fg = calculateFG(source.top3, source.bottom2)
  const collected = collectFirstFoundWinDigits(history, fg)
  const winDigits = collected.candidatePool
  const win6 = winDigits.slice(0, 6)
  const reserve = winDigits.length === MAX_WIN_DIGITS ? winDigits[6] : null

  return {
    engine: 'WIN6XGEN',
    version: '5.0.0',
    source,
    history,
    historyUsed: Math.min(history.length + 1, HISTORY_LIMIT),
    ...fg,
    sourceSearch: buildSourceSearch(collected),
    searchPhases: collected.phases,
    winningPhase: collected.winningPhase,
    winningPhaseLabel: collected.winningPhaseLabel,
    selectionMode: 'FIRST_FOUND_SEQUENTIAL',
    candidatePool: winDigits,
    collectionRowsUsed: collected.collectionRowsUsed,
    searchRowsChecked: collected.searchRowsChecked,
    historyRangeUsed: collected.historyRangeUsed,
    usedExtraSearch: collected.usedExtraSearch,
    sourceStartIndex: collected.sourceStartIndex,
    win6,
    reserve,
    pinDigits: win6,
    pin2: buildPin2(win6),
    pin3: buildPin3(win6),
  }
}
